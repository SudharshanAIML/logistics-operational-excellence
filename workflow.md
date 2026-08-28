A warehouse/hub operations intelligence platform for UPS ground hub services. Four modules, one web product:

Module	Core job
Volume Forecasting	Predict inbound shipments, outbound orders, inventory movement (hourly/daily/weekly)
Smart Workforce Planning	Convert forecasted volume → headcount → shift roster
Ops Efficiency Dashboard	Define + track KPIs: throughput, cycle time, utilization
Resource Optimization Engine	Find under/over-utilized zones, rebalance, run peak scenarios

Read the Note on page 2 carefully — it's a constraint, not a footnote. No individual employee scoring. Everything must aggregate at process/zone/shift level. Judges will test this. Build it in as an architectural guarantee (aggregation floor: never display a metric derived from fewer than N workers) and say so on your slide. Most teams will miss this.

Also note challenge #1: "lack of a measurable yardstick." That's your headline deliverable, not the ML.

The single biggest novelty: define the yardstick

Warehouses have no equivalent of manufacturing's OEE. Build one — Ops Efficiency Index (OEI):

OEI = Throughput Ratio × Quality Ratio × Utilization Ratio
Throughput Ratio = actual units-per-labor-hour ÷ engineered standard
Quality Ratio = 1 − (rework + misroutes + damage) / total
Utilization Ratio = productive hours ÷ paid hours (idle, waiting, travel excluded)

Compute per process (unload, sort, pick, pack, load), per zone, per shift. One number a hub manager can compare Monday vs Tuesday, Hub A vs Hub B. Everything else in the product hangs off this.

Other novelty ideas (pick 3–4, not all)
Uncertainty-aware staffing. Don't output "you need 42 people." Output P50/P90 quantile forecasts and solve a newsvendor tradeoff: cost of understaffing (SLA penalty, overtime) vs overstaffing (idle labor). Show the manager a cost curve and let them pick a service level. This is a genuinely more sophisticated answer than a point forecast.
Digital twin / What-if Lab. SimPy discrete-event simulation of the hub. "What if inbound spikes 30% and 5 sorters call in sick?" → simulated dock-to-stock time, backlog, SLA breach probability. Directly answers their "scenario-based planning for peak and non-peak."
Prescriptive optimizer, not just predictive. OR-Tools CP-SAT solving actual shift assignment under constraints: skills matrix, max consecutive hours, break rules, min rest, union/labor-law limits, cross-training. Output a publishable roster, not a number.
Mid-shift burn-down + live re-allocation. Real-time actual-vs-forecast tracker. At 11am, if inbound is tracking 18% above forecast, the system nudges: "move 3 from packing to unload, zone C." Reactive→proactive is literally in their problem statement.
Explainable forecasts. SHAP on the forecast drivers: holiday, weather, day-of-week, promo events. Managers don't trust black boxes; a "why" panel wins trust points.
Ops Copilot (agentic layer). Natural-language over a semantic KPI layer — "why did dock-to-stock slip last Tuesday?" → agent queries KPI store, correlates with anomaly log and weather, returns a narrative. Given your RAG background this is cheap for you to build and demos extremely well.
Drift + anomaly detection on both KPIs and model accuracy, with an automatic retrain trigger.
Website structure

Roles: Hub Manager · Shift Supervisor · Workforce Planner · Regional/Exec · Admin

Pages:

Command Center (landing) — today's OEI, live volume burn-down vs forecast, staffing gap gauge, active alerts, zone heatmap of the hub floor
Forecast Studio — horizon selector (next 4h / day / week / month), inbound·outbound·inventory tabs, P10/P50/P90 fan chart, driver breakdown, accuracy backtest (MAPE/WAPE vs baseline)
Workforce Planner — forecast → required hours → headcount by process; available roster vs required; gap table; "Generate Roster" → optimizer output as a Gantt shift board; drag-to-override with instant recompute
Efficiency Dashboard — OEI trend, KPI grid by process, cycle-time waterfall (dock→unload→sort→stow→pick→pack→load), period comparison, benchmark vs network median
Optimization Lab — under/over-utilization matrix, recommended redistributions with projected OEI delta and cost impact, scenario builder (peak/holiday/absenteeism/volume surge), scenario diff view
Alerts & Insights — anomalies, forecast misses, auto-generated narrative summaries
Model & Data Health — pipeline freshness, model accuracy, drift, retrain log
Admin — RBAC, hub config, labor standards, cost parameters, privacy/aggregation settings

Design cue: dark command-center aesthetic, UPS brown (
#351C15) + gold (
#FFB500) accents, dense but breathable. Judges notice.

Data flow
SOURCES
 WMS scan events (unload/sort/pick/pack/load)
 TMS trailer arrivals & departures
 ERP inventory movements
 HRMS roster, skills, availability, leave
 External: weather API, holiday calendar, e-comm event calendar
        │
        ▼
INGESTION
 Batch (historical, Airflow/Prefect) + Stream (Kafka topics: scan.events, trailer.arrival)
        │
        ▼
STORAGE  (medallion)
 Bronze raw → Silver cleaned/conformed → Gold aggregates
 PostgreSQL + TimescaleDB hypertables (hourly volume, KPI rollups)
        │
        ▼
FEATURE LAYER
 lags(1,7,14,28) · rolling means · calendar · holiday flags
 weather joins · peak-season flag · zone/process encodings
        │
        ├──► FORECAST SERVICE ── quantile volume forecasts ──┐
        ├──► PRODUCTIVITY MODEL ── predicted UPH per zone ───┤
        │                                                     ▼
        │                                          LABOR DEMAND ENGINE
        │                                    hours = volume ÷ UPH; +absenteeism buffer
        │                                                     │
        │                                                     ▼
        │                                          OPTIMIZER (CP-SAT)
        │                                    roster + redistribution plan
        │                                                     │
        ├──► KPI ENGINE ── OEI, cycle time, utilization ──────┤
        ├──► ANOMALY DETECTOR ───────────────────────────────┤
        └──► SIMULATION ENGINE (SimPy) ──────────────────────┤
                                                              ▼
                                                    FastAPI + WebSocket
                                                              │
                                                       React frontend
                                                              │
                                              actuals ──► accuracy monitor ──► retrain
Tech stack

Frontend: React 18 + TypeScript + Vite · Tailwind + shadcn/ui · Recharts or Apache ECharts (better for Gantt/heatmaps) · TanStack Query · Zustand · dnd-kit for the shift board

Backend: FastAPI (Python — keeps ML in-process) · Pydantic v2 · SQLAlchemy · Celery + Redis for async jobs · WebSockets for live updates

Data: PostgreSQL + TimescaleDB · Redis cache · Kafka (or Redis Streams if you're short on time) · Prefect or Airflow for orchestration · Great Expectations for data quality

ML/OR: Nixtla StatsForecast (fast classical baselines) · LightGBM (global model) · scikit-learn · SHAP · Optuna · OR-Tools CP-SAT (scheduling) · SimPy (digital twin) · MLflow (tracking)

LLM layer: Claude API for the copilot + auto-narratives

Infra: Docker Compose for the demo. On slides, map it to Azure — Event Hubs, Data Factory, Azure ML, Synapse, AKS, Blob Storage. UPS is enterprise; showing the production path matters.

Auth: JWT + role-based middleware; mention SSO/Entra ID for production.

Do you need ML? Yes — but be precise about where
Problem	Approach	Notes
Volume forecasting	ML — yes. Hierarchical time series	Baseline: seasonal naive + AutoETS. Main: LightGBM global model with lag/calendar/weather features, quantile objective for P10/50/90. Stretch: N-HiTS or TFT via neuralforecast. Reconcile hub→zone→process with MinT
Productivity rate (UPH)	ML — yes. Gradient-boosted regression	Predicts units-per-hour given zone, shift, day, volume mix, weather. Beats a static constant, and it's the link between forecast and headcount
Manpower requirement	Not ML. Deterministic formula	hours = volume / predicted_UPH, + absenteeism buffer + break factor. Keep it transparent — managers must audit it
Shift assignment / roster	Not ML — Operations Research. CP-SAT	Constraint satisfaction, not prediction. Say this explicitly in your pitch; it shows you know the difference
Anomaly detection	ML — yes. STL residuals + Isolation Forest	On KPI streams
Zone behavior profiling	Optional. KMeans/DBSCAN	Group zones with similar load patterns
Scenario planning	Simulation, not ML. SimPy	Monte Carlo over forecast uncertainty
Explainability	SHAP	Feeds the "why" panel

Judges love a team that says "we did not use ML here, and here's why." Overusing ML is the most common hackathon failure.

Datasets

First: ask the SPOC (Sivakumar Kaliappan) whether UPS is providing data. If yes, everything below is a fallback. Ask specifically for scan-event-level data with timestamps, not aggregates.

Public proxies (all free, Kaggle/UCI):

M5 Forecasting – Accuracy — best analog. Hierarchical demand across stores/departments with calendar and event effects. Maps almost 1:1 to hub→zone→process volume forecasting
Online Retail II (UCI) — transaction-level orders with timestamps → outbound order volumes
Olist Brazilian E-Commerce — orders with purchase→approval→ship→delivery timestamps. Ideal for cycle-time and OTIF KPI work
Instacart Market Basket — order arrival timing patterns, hour-of-day/day-of-week seasonality
DataCo Smart Supply Chain — logistics-flavored with shipping and delay fields
Rossmann Store Sales — holiday/promo effect modeling
Open-Meteo API — free historical + forecast weather, no key needed
holidays Python package — regional holiday calendars

No public dataset exists for warehouse rosters, scan events, or labor standards. So:

Build a synthetic data generator. This is the strongest move available to you. A ~200-line Python script producing 2 years of:

hourly inbound trailer arrivals + package counts (weekly seasonality, Nov–Dec peak, holiday dips)
outbound order volumes correlated to inbound with lag
individual scan events per process with realistic UPH distributions
worker roster: 80–150 workers, skills matrix, absenteeism ~6%, shift patterns
injected anomalies: a trailer breakdown, a flu week, a Black Friday spike
weather joined in, with a small negative effect on unload rate

Then blend: real M5/Olist for the forecasting realism, synthetic for the labor/scan side. Say openly in the pitch that labor data is synthetic and schema-compatible with WMS/HRMS exports — honesty here reads as maturity, not weakness.

Build priority if time is short
KPI engine + OEI definition (this alone answers their #1 challenge)
Forecasting with a real accuracy backtest vs a naive baseline
Labor demand calculation + gap view
Dashboard that looks like a real product
CP-SAT optimizer
Scenario Lab / copilot — whichever you can finish

A polished 4 beats a broken 6.

Want me to draft the synthetic data generator, the OEI computation module, or the database schema next?