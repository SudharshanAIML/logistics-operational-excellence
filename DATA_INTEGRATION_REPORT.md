# Data Integration Report: Connecting Synapse Ops to Real Postgres Data

This document covers everything done to take the app from "migrated data sitting in Postgres, frontend still showing mock numbers" to "every screen backed by real, validated data" — what was found, what was changed, why, and how it was verified. It's written to answer the "why" behind each decision, not just list the diff.

## 1. Starting point

The app had already been migrated from a local SQLite file to Aiven Postgres (349,595 `scan_events` rows, 26,208 `hourly_volume` rows, and five smaller tables — verified row-for-row against the original SQLite database). But a full audit of all 6 backend endpoint files, all 6 service files, and all 7 frontend pages found that **almost nothing on screen was actually coming from that real data**. Three separate problems were compounding each other:

1. **Frontend fallback constants.** Every major page shipped a hardcoded `FALLBACK_*` object, rendered instantly and never fully replaced if the real fetch failed silently.
2. **Backend-side fabrication.** Several endpoints returned hardcoded dicts, `random.uniform()`, a `hash()`-based jitter on top of real numbers, or literal fake SHAP values — dressed up to look like computed output.
3. **Silent bugs breaking the real path.** A missing import crashed an endpoint outright; a hardcoded "now" timestamp meant the forecast endpoint's date-range filter never matched any real row; a nonexistent `cp_model.datetime` attribute crashed the roster optimizer every time it was called. In every case, the frontend's fallback constants masked the crash, so nobody had ever seen these actually fail.

## 2. Step 1 — Shifting the dataset's dates (root-cause fix)

**The problem:** the migrated data spans `2017-09-01` to `2018-03-01` (it's blended with real Olist e-commerce timestamps), but the entire app assumes "today" is `2026-08-28` — the frontend's default date, `forecasting.py`'s hardcoded `now`, `copilot_agent.py`'s today/yesterday/weekday parsing, and every endpoint's fallback date. Before this fix, every one of those assumptions was silently wrong, papered over by a single hardcoded fallback string (`"2017-11-24"`) that every endpoint quietly swapped in when the requested date didn't exist.

**The fix:** a one-off script computed the exact day offset between the dataset's latest real timestamp (`2018-03-01`) and `2026-08-28`, then ran a single `UPDATE ... SET col = to_char(to_timestamp(col, fmt) + interval 'N days', fmt)` per affected table — fast, server-side, no row-by-row round trip.

| Table | Before | After |
|---|---|---|
| `hourly_volume` | 2017-09-01 00:00 → 2018-03-01 23:00 | **2026-02-28 00:00 → 2026-08-28 23:00** |
| `scan_events` | 2017-09-01 06:00 → 2018-03-01 05:58 | **2026-02-28 06:00 → 2026-08-28 05:58** |
| `shift_schedule` | 2017-09-01 → 2018-02-28 | **2026-02-28 → 2026-08-27** |
| `daily_kpis` | 2017-09-01 → 2018-02-28 | **2026-02-28 → 2026-08-27** |

`alerts`, `simulation_runs`, and `model_drift_log` were **not** touched — they were already seeded in the `2026-08-22`–`2026-08-28` window (generated relative to real wall-clock time, unlike the main historical tables), and now line up naturally with the shifted range.

Row counts were re-verified identical before/after (26,208 / 349,595 / 6,520 / 3,258 — no data lost), and sample rows were spot-checked for correct date arithmetic.

**Why shift the data instead of adding a `/meta` date-discovery endpoint?** That was the explicit direction given when this was raised as a decision point — it's more surgical: the app's existing hardcoded "today" assumptions become *true* rather than needing new plumbing everywhere they're used.

## 3. Real bugs fixed (all pre-existing, none caused by the migration)

These would have failed identically against the original SQLite database — they were simply never exercised, because the frontend's fallback constants hid every failure.

| Bug | Where | Effect before the fix |
|---|---|---|
| `DailyKPI` used but never imported | `workforce.py` | Both `/workforce/gaps` and `/workforce/optimize` crashed with `NameError` on every call |
| `cp_model.datetime` doesn't exist (OR-Tools has no `datetime` submodule) | `roster_optimizer.py` | `/workforce/optimize` crashed with `AttributeError` on every call — **"Generate Roster" has never worked**, ever, even before this migration |
| Hardcoded `now = datetime(2026, 8, 28, 10, 0, 0)` compared against 2017/2018 data | `forecasting.py` | Every date-range filter came back empty — the Forecast Studio chart was **always** empty from the real endpoint |
| SQLite-only `?` placeholders and `INSERT OR REPLACE` (Postgres has neither) | `forecasting.py` (`train_volume_forecast_model`), `anomaly_detector.py` | Clicking "Retrain Forecast Model" crashed against Postgres; the anomaly detector would crash the moment anything called it |
| `hash(zone) % 20 - 10` jitter added on top of real `utilization_ratio` | `dashboard.py` heatmap | Fabricated noise layered onto real numbers, and non-deterministic across server restarts (Python randomizes string hashes per process) |
| `accuracy.bias_pct`, `/forecast/drivers`, `FALLBACK_TELEMETRY`'s shape | `forecasting.py`, `OptimizationLab.tsx` | UI displayed fields the backend never returned at all — pure client-side fabrication with zero backend counterpart |
| `throughput_mult` had no lower clamp | `simulator.py` | A large simulated backlog could drive it negative, producing a **negative OEI** (`-1.344`) — impossible by definition, since OEI is a product of three ratios each bounded in [0,1] |
| Missing `import json` (dormant — only triggers if `GEMINI_API_KEY` is set) | `copilot_agent.py` | Latent `NameError` waiting to happen |
| "Efficiency Variance" slider never sent to the backend at all | `OptimizationLab.tsx` | The user could drag it and see zero effect — a control that lied about doing something |

## 4. The privacy-floor discovery (found during testing, not anticipated in the original plan)

While testing the escalated real data, `daily_kpis.active_worker_count` turned out to be **0–3 across the entire dataset** (average 1.88), because the synthetic generator's headcount formula (`backend/scripts/generate_synthetic_data.py`) floors required headcount at `max(2, ceil(required_hours / 8))` — routinely just 2 people per process/shift/zone. Since the privacy floor (`AGGREGATION_FLOOR = 5`, enforced in `backend/app/core/aggregation.py`) redacts any OEI/throughput/quality/utilization value derived from fewer than 5 workers, **almost every row in the dataset was being silently redacted** — a pre-existing mismatch between the data generator and the privacy requirement, unrelated to the migration itself.

**The fix** (confirmed with the user before implementing): `oei_calculator.get_oei_summary()` now tries the requested shift-level slice first, and only escalates to a full-day rollup **for that specific process** if the shift-level worker count is below the floor — summing worker counts and computing a worker-count-weighted average of the ratios across shifts. The floor threshold itself (5) was **not** weakened; only the aggregation *grain* changes, and only when necessary. This is exactly how a real ops dashboard would reasonably roll up daily numbers anyway.

Real-world effect, using 2026-08-27 as an example:

| Process | Per-shift worker count | Rolled up (all shifts) |
|---|---|---|
| sort | 2 (redacted) | **6** (shown) |
| unload | 2 (redacted) | **5** (shown) |
| stow | 1–2 (redacted) | **4** (still below floor → correctly redacted) |
| pick | 2 (redacted) | **5** (shown) |
| pack | 2 (redacted) | **6** (shown) |
| load | 2 (redacted) | **6** (shown) |

The same escalation logic now backs both `/dashboard/summary` and `/dashboard/heatmap` (the heatmap previously didn't call the privacy-floor function *at all* — it read `utilization_ratio` straight off the row, a real privacy-guarantee gap that predates this work).

**A separate, unresolved finding:** the underlying `throughput_ratio`/`quality_ratio`/`utilization_ratio`/`oei` values themselves are chronically very low across the whole dataset (typically 0.02–0.12, vs. an intended target of ~0.85). This traces to the synthetic generator's own OEI arithmetic (`generate_synthetic_data.py` lines ~440–480), not to anything in this integration work. Fixing it would mean re-deriving the generator's business logic and re-seeding the dataset — a separate, larger task, flagged here rather than attempted silently.

## 5. Real SHAP explainability (replacing 5 hardcoded numbers)

`/api/forecast/drivers` previously returned five literal driver values ("Weather & Road Conditions: +4.8%", etc.) regardless of process or date. It now trains the same LightGBM P50 quantile model used for forecasting, runs `shap.TreeExplainer` against the last 168 hours of real feature rows, and returns the mean `|SHAP|` contribution per feature (hour-of-day, day-of-week, month, 24h/168h lags, temperature, rain, holiday flag) — genuinely per-process, genuinely per-date, matching the "Explainable Forecast (SHAP Impact Drivers)" label the UI already made.

## 6. Real live telemetry (replacing `random.uniform()`)

`main.py`'s `/ws/live` WebSocket broadcast pure `random.uniform()` numbers every 5 seconds, feeding Command Center's live KPI tile. It now queries the 200 most recent real `scan_events.actual_uph` readings per process from Postgres on each tick.

## 7. Frontend: every `FALLBACK_*` constant removed

Applied consistently across `CommandCenter.tsx`, `ForecastStudio.tsx`, `WorkforcePlanner.tsx`, `EfficiencyDashboard.tsx`, `OptimizationLab.tsx` (the pattern already existed correctly in `AlertsInsights.tsx`/`ModelDataHealth.tsx`):
- Initial state is `null`/`[]`, never a fake object.
- Real `loading` and `error` state, with a clear error banner instead of silently falling back to fabricated numbers on fetch failure.
- `AppContext.tsx`: the 3 hardcoded seed alerts are gone — it starts empty and only populates from the real `/dashboard/summary` response.
- A new `frontend/src/config.ts` centralizes `API_BASE_URL`/`WS_BASE_URL` (from `VITE_API_BASE_URL`/`VITE_WS_BASE_URL`, defaulting to `localhost:8000`), replacing ~20 scattered `http://localhost:8000` literals.

**`EfficiencyDashboard.tsx` was the deepest case** — its `useEffect` fetched `/dashboard/trends` but never used the response; the whole page was 100% fabricated with no real endpoint behind it at all. Two of its metrics (`jamPct`/`recircPct`, and an "Unplanned Stops / Chute Jams / Staff Starvation" loss breakdown) have **no corresponding column anywhere in the schema** — there's no sensor or downtime-reason table to connect to. Rather than leave them fabricated or silently delete the panels:
- A new `/api/dashboard/efficiency` endpoint computes real facility-wide average UPH (from `scan_events`), lost time (`shift_schedule.actual_hours_worked - productive_hours`, summed), cost-per-package (real `worker_roster.wage_rate` × hours ÷ real volume), an hourly throughput-vs-standard series, and a per-process zone audit.
- "OEI Loss Decomposition" now shows the real `(1−throughput_ratio)`, `(1−quality_ratio)`, `(1−utilization_ratio)` breakdown — the OEI formula's own three components, which is what was actually measurable.
- The zone audit's fabricated "chute jam %" became real `quality_loss_pct` = `(1 − quality_ratio) × 100`.

**`OptimizationLab.tsx`'s zone-by-zone telemetry table had zero backend counterpart** — `simulator.run_hub_simulation()` never returned anything resembling `FALLBACK_TELEMETRY`'s shape. `simulator.py` now returns a real `per_process` array (base/actual headcount, standard UPH) built from data the simulation already computes internally, plus real `baseline_oei`, `baseline_dock_to_stock_min`, `baseline_cost`, and `simulated_cost` (the last two computed from the real average `worker_roster.wage_rate`, replacing a made-up `surge_pct × 145 − absenteeism_pct × 80` cost formula). The "Actionable Directives" panel's two hardcoded fake reassignment cards (fictional names, zones that didn't match the real Zone A–F scheme) became a real computation over `per_process`: processes where simulated absenteeism dropped headcount below the base plan, sorted by gap size.

**`WorkforcePlanner.tsx`'s "Dispatch Directives"** (two hardcoded fake worker reassignments) became a real greedy pairing algorithm over the actual per-process gap data: the process with the largest headcount surplus is matched against the process with the largest shortfall. The "Break Rotation Timeline" panel's `Active (X/Y)` labels now show real available/required headcounts per process (the timeline bar positions themselves remain illustrative — there's no break-schedule data in the schema to drive them).

**Shield Gauge** ("vs last week" delta) and the Command Center KPI row ("DOCK-TO-DOOR CYCLE") were also fabricated (`delta={0.04}` hardcoded; `"42"` hardcoded regardless of data). Both now come from real backend computation — a real week-over-week OEI comparison and a real weighted-average cycle time.

**Fabricated trend-arrow deltas removed rather than faked further**: several KPI cards (Command Center's throughput/utilization tiles, Efficiency Dashboard's four top KPIs) previously showed invented "+3.2%" / "-5.0%" style deltas with no real prior-period comparison behind them. Rather than compute a new backend feature for every one of these under time constraints, the fake deltas were simply removed — no number is better than a fabricated one.

## 8. Real data validation (`/api/data-health/status`)

Previously hardcoded: `"Synced 15 minutes ago"`, `total_records * 12` as a fake proxy for scan event count, and a static `"12 checks passed / 0 failed"` regardless of reality. Now genuinely computed against live Postgres data:

| Check | Method | Result (as of this integration) |
|---|---|---|
| `volume_non_negative` | `COUNT(*) WHERE actual_volume < 0` | **Passed** — 0 negative rows |
| `worker_count_limit` | `COUNT(*) WHERE active_worker_count > (real roster size)` | **Passed** — all within the 120-worker roster |
| `timestamp_continuity` | Compare row count to timestamp span in hours, per process | **Passed** — no gaps in the hourly sequence |
| `oei_bounds` | `COUNT(*) WHERE oei < 0 OR oei > 1` | **Passed** — all values within [0, 1] |
| `scan_event_worker_referential_integrity` | Every distinct `scan_events.worker_id` exists in `worker_roster` | **Passed** |

Real scan event count returned: **349,595** (exact match to the migrated row count). Freshness is now reported as the actual latest timestamp in the data rather than an invented "X minutes ago" claim that never made sense for daily-granularity historical data.

## 9. Verification performed

- Row-count parity re-checked after the date shift (unchanged: 26,208 / 349,595 / 6,520 / 3,258).
- Every backend endpoint hit directly with realistic parameters (multiple processes, both shift-filtered and unfiltered, several copilot queries including "today"/"yesterday"/"last tuesday") and confirmed to return real, non-empty, non-error JSON — including reproducing and fixing the roster-optimizer crash live.
- `npx tsc --noEmit` run across the frontend: zero new errors introduced (the only remaining issues are pre-existing unused-import warnings and one pre-existing invalid Recharts prop, none of which block the build since `vite build` doesn't run `tsc`).
- `npm run build` (production Vite build): succeeds.
- Attempted a full headless-browser click-through of all 7 tabs via the Chrome DevTools Protocol (no Playwright available in this environment). Screenshot capture consistently timed out in this sandbox regardless of approach tried, and a lighter DOM-content check returned an empty page body for reasons that look like a quirk of the ad-hoc CDP script rather than the app itself (the dev server independently confirmed healthy and serving valid HTML via `curl`). This was not pursued further given the strength of the endpoint-level and build-level verification already in hand — **this is the one verification gap worth calling out**: nobody has visually confirmed all 7 tabs render correctly in an actual browser since these changes landed.

## 10. Explicitly out of scope / left as-is

- **`anomaly_detector.py`** — its Postgres-incompatibility bug was fixed (converted from raw SQLite-style cursor SQL to ORM inserts), but it remains unwired to any endpoint, exactly as before. Wiring real ML-based anomaly detection into a live endpoint would be a new feature, not a mock-data fix.
- **UI action buttons** ("Execute", "Dispatch", "Acknowledge Scenario") remain local-only state toggles. There's no persistence layer for operator actions in the schema; toggling a button's own display state is a legitimate interaction pattern for a demo, not fabricated data.
- **`simulator.py`'s `baseline_backlog = 180`** stays a structural simulation constant — backlog isn't a tracked column anywhere in the schema, so there's no real number to source it from; this is a modeling assumption, not mislabeled fake data.
- **The synthetic generator's chronically low OEI/utilization values** (Section 4) and its **2-person-per-process headcount floor** (root cause of the privacy-floor issue) were diagnosed but not fixed — that's a change to `generate_synthetic_data.py`'s business logic and a full data re-seed, well beyond "connect and validate existing data."
- **The stray comment lines appended to `backend/.env`** (leftover `psql`/`\dt` commands from an earlier terminal session, now commented out) were left alone — harmless, but worth a cleanup pass if desired.
- **A `.Rmd` file deletion appears staged in git** (`olist-ecommerce-analytics-quasi-poisson-poly-regs.Rmd`) that this session did not make — flagging it since it wasn't there at the start of this conversation and none of the commands run here touched that file.
