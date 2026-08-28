Design direction

UPS's own product surfaces (ups.com, WorldShip, Quantum View) are light, dense, and utilitarian — white canvas, brown structural chrome, gold used sparingly for action. So I'm reversing my earlier dark-mode suggestion. A dark command center looks cool but reads as "generic AI dashboard." A light UPS-native operations console reads as "this could ship inside UPS next quarter." That's the judgment call, and it's the one that wins this brief.

Signature element: the OEI score lives inside a UPS shield silhouette that fills with gold from the bottom as the score rises. Brand-native, instantly readable, and nobody else will have it.

1. Color tokens

Brand sources disagree slightly. UPS's own brand guidelines PDF lists UPS Gold as 
#FFBE00 and UPS Brown as 
#330000, while other references cite 
#FAB80A gold and 
#301506 brown. The digital styleguide set is 
#351c15, 
#ffb500, 
#64a70b — that's the one to use, since it includes a green for positive states. 
Annexbrands + 2

css
:root {
  /* Brand */
  --ups-brown:      #351C15;   /* chrome, headers, primary text */
  --ups-brown-900:  #24120D;   /* sidebar, deepest surface */
  --ups-brown-700:  #4A2B21;   /* hover on brown surfaces */
  --ups-gold:       #FFB500;   /* THE accent — use once per screen */
  --ups-gold-600:   #E0A000;   /* gold hover */
  --ups-green:      #64A70B;   /* on-target, positive delta */

  /* Canvas */
  --canvas:         #FFFFFF;
  --surface:        #FAF8F6;   /* page background, warm off-white */
  --surface-alt:    #F2EEEA;   /* table stripe, inset panels */
  --border:         #E3DCD6;   /* hairlines */
  --border-strong:  #C9BFB6;

  /* Text */
  --text:           #1F1512;
  --text-muted:     #6B5D55;
  --text-inverse:   #FFF9F0;

  /* Semantic (ops states) */
  --status-ok:      #64A70B;   /* within tolerance */
  --status-watch:   #FFB500;   /* gap 5–15% */
  --status-risk:    #C0392B;   /* gap >15%, SLA breach */
  --status-idle:    #8C9196;   /* underutilized */
  --forecast-band:  rgba(53,28,21,0.10);  /* P10–P90 fan fill */
}

Contrast rule you must not break: gold on white fails WCAG for text. Gold is for fills, bars, borders, and the shield — never for small type on light backgrounds. Gold buttons take brown text (--ups-brown on --ups-gold), which is exactly what UPS does on their own CTAs.

Where each color is allowed:

Token	Allowed uses
Brown	Sidebar, topbar, primary buttons' text-on-gold, headings, table headers
Gold	Primary CTA fill, shield fill, active nav indicator, "watch" status, one chart series
Green	Positive delta arrows, on-target badges, "surplus staff"
Red	Understaffing, SLA risk, anomaly markers
Grey	Idle/underutilized zones only — never as a decorative neutral
2. Typography

UPS's brand face is FF Dax (a narrow humanist sans). The closest free Google Font is Barlow — same humanist skeleton, slightly condensed, engineered feel.

css
--font-display: 'Barlow Condensed', sans-serif;  /* eyebrows, section labels, KPI labels */
--font-ui:      'Barlow', sans-serif;            /* everything else */
--font-mono:    'IBM Plex Mono', monospace;      /* all numbers, always */

Every numeral in the product uses the mono face with font-variant-numeric: tabular-nums. Digits align in columns, and metrics don't jitter when they update on a slider drag. This one rule does more for perceived polish than any animation.

Role	Font	Size / Line	Weight	Tracking
Metric hero (OEI)	Mono	56 / 56	600	−0.02em
Metric large (KPI cards)	Mono	32 / 36	600	−0.01em
Metric inline (tables)	Mono	14 / 20	500	0
Page title	Condensed	28 / 32	600	0
Section header	Condensed	18 / 24	600	0.02em
Eyebrow / KPI label	Condensed	11 / 14	600	0.12em, UPPERCASE
Body	Barlow	14 / 22	400	0
Caption / footnote	Barlow	12 / 18	400	0.01em
Button	Barlow	14 / 20	600	0.02em

The tracked-out condensed uppercase eyebrow is the typographic signature — it's how logistics equipment, dock signage, and shipping labels are set. It ties the type system to the subject rather than to a template.

3. Grid & spacing
Spacing scale (4px base): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64
Radius:  cards 8px · buttons 6px · badges 4px · inputs 6px
         (UPS is squared-off and industrial — never exceed 8px)
Shadow:  cards use 1px hairline border, NOT drop shadows
         only modals/dropdowns get shadow: 0 8px 24px rgba(53,28,21,0.12)

Page frame:

┌──────────────────────────────────────────────────────────┐
│  TOPBAR                                       height 64  │
├──────────┬───────────────────────────────────────────────┤
│          │  ← 32px page padding →                        │
│ SIDEBAR  │  ┌─────────────────────────────────────────┐  │
│  240px   │  │  12-col grid · 24px gutter              │  │
│  fixed   │  │  max-width 1440 · centered              │  │
│          │  └─────────────────────────────────────────┘  │
└──────────┴───────────────────────────────────────────────┘

Column width at 1440: (1440 − 240 − 64 − 11×24) / 12 = 76px.

Standard spans: KPI card = 3 cols · half-panel = 6 cols · main chart = 8 cols · side rail = 4 cols · full-bleed table = 12 cols. Vertical rhythm between sections: 32px. Inside cards: 20px padding, 16px between elements.

Breakpoints: ≥1280 full 12-col · 1024–1279 sidebar collapses to 64px icon rail · <1024 cards stack to 1-col, sidebar becomes a top drawer. For an 8-hour build, get 1280+ perfect and just make sure nothing overflows below that.

4. Navigation

Topbar (64px, --ups-brown background):

[shield] SYNAPSE OPS        Hub: Chennai GH-01 ▾   Shift: Day ▾   [ⓘ 3]   AS
  gold      condensed              pill selects              alerts   avatar

The hub and shift selectors sit in the topbar because they're global context — every screen is scoped to them. Put a thin gold 3px bar across the very top edge of the topbar; it's the one place gold appears on every screen and it reads as a UPS brand stripe.

Sidebar (240px, --ups-brown-900):

┌────────────────────────────┐
│  ▌ Command Center          │  ← active: 3px gold left bar,
│    Forecast                │     bg lightens to brown-700,
│    Workforce               │     label goes gold
│    Efficiency              │
│    Optimization Lab        │
│                            │
│  ─────────────────────     │
│  OPERATIONS                │  ← eyebrow, condensed, muted
│    Alerts            (3)   │
│    Data Health             │
│                            │
├────────────────────────────┤
│  ⓘ Aggregated metrics only │  ← privacy badge, pinned bottom
│    No individual scoring   │     12px, --text-muted
└────────────────────────────┘

Nav items: 44px tall, 16px horizontal padding, Barlow 14/600, --text-inverse at 70% opacity, 100% when active. Icons 18px from Lucide, 12px gap to label.

Pin that privacy badge in the sidebar on every screen. It's the constraint from page 2 of the brief, and a judge will see it in every screenshot.

For the hackathon: use tabs, not a router. Five useState tabs styled as a sidebar. Zero routing bugs, identical demo.

5. Screen layouts
Command Center
COMMAND CENTER                              Fri 28 Aug · Day Shift · 06:00–14:00
─────────────────────────────────────────────────────────────────────────────────
┌─── 4 cols ──────────┐ ┌─── 8 cols ─────────────────────────────────────────┐
│  ▲ SHIELD GAUGE     │ │  TODAY'S VOLUME · FORECAST VS ACTUAL               │
│                     │ │                                                     │
│   ╱────────╲        │ │   ╱‾‾‾‾╲            forecast P50 ── brown solid    │
│  │  0.87    │       │ │  ╱      ╲___        P10–P90 band ─ brown 10% fill  │
│  │  ▓▓▓▓▓▓  │ gold  │ │ ╱            ╲      actual ─────── gold, 3px       │
│  │  ▓▓▓▓▓▓  │ fill  │ │╱                ╲   now-line ───── dashed vertical  │
│   ╲────────╱        │ │                                                     │
│  OPS EFFICIENCY IDX │ │  06  07  08  09  10  11  12  13  14                │
│  ▲ 0.04 vs last wk  │ └─────────────────────────────────────────────────────┘
└─────────────────────┘
┌── 3 ──┐┌── 3 ──┐┌── 3 ──┐┌── 3 ──┐        ← KPI row, all 3-col, 120px tall
│THRUPUT││CYCLE  ││UTILIZN││STAFF  │
│ 1,240 ││ 42m   ││  78%  ││ −6    │        ← mono 32px
│ units ││ dock→ ││ prod. ││ short │
│ ▲ 3.2%││ ▼ 5m  ││ ▲ 2pp ││ RISK  │        ← delta chip, semantic color
└───────┘└───────┘└───────┘└───────┘
┌─── 7 cols ──────────────────────┐ ┌─── 5 cols ────────────────────┐
│  ZONE UTILIZATION               │ │  ALERTS                        │
│  ┌────┬────┬────┬────┐          │ │  ● Inbound 18% over forecast   │
│  │ A  │ B  │ C  │ D  │  heatmap │ │  ● Zone C at 96% utilization   │
│  │94% │71% │96% │48% │  cells   │ │  ● Sort UPH below standard     │
│  └────┴────┴────┴────┘  120×88  │ │                                │
└─────────────────────────────────┘ └────────────────────────────────┘

Heatmap cells are not a gradient. Use four discrete states — idle grey (<60%), green (60–85%), gold (85–95%), red (>95%) — with the percentage in mono inside the cell. Discrete beats continuous here because a supervisor needs a decision, not a shade.

Forecast
┌─ Horizon: [ 4H ][ 1D ][ 1W ][ 1M ]  Stream: [Inbound ▾]   ← segmented control,
└──────────────────────────────────────────────────────────    active = gold fill,
                                                                brown text
┌─── 8 cols · 360px tall ────────────┐ ┌─── 4 cols ──────────┐
│  FORECAST FAN CHART                │ │  MODEL ACCURACY     │
│  P90 ┈┈┈┈╱‾‾‾╲┈┈┈                  │ │  ┌─────┬──────────┐ │
│  P50 ────╱─────╲───                │ │  │LGBM │  8.4%    │ │
│  P10 ┈┈╱┈┈┈┈┈┈┈╲┈┈                 │ │  │Naive│ 19.1%    │ │
│                                    │ │  └─────┴──────────┘ │
│  (actuals overlay in gold)         │ │  WAPE · 30-day      │
└────────────────────────────────────┘ │  backtest           │
                                       │  ▬▬▬▬▬▬▬ 56% better │
┌─── 12 cols ───────────────────────┐  └─────────────────────┘
│  HOURLY BREAKDOWN                  │
│  Hour │ P10 │ P50 │ P90 │ Actual │ Var  ← mono, tabular, right-aligned
└────────────────────────────────────┘
Workforce
┌─── 12 cols ─────────────────────────────────────────────────────────┐
│  Process   Fcst Vol   Std UPH   Req Hrs   Req HC   Avail   Gap      │
│  ─────────────────────────────────────────────────────────────────  │
│  Unload      4,200      140       30.0      4        5     ▲ +1     │
│  Sort       12,800      320       40.0      5        3     ▼ −2  ⚠  │
│  Stow        3,900      110       35.5      5        5       0      │
│  Pick        8,400      180       46.7      6        4     ▼ −2  ⚠  │
│  Pack        7,100      150       47.3      6        6       0      │
│  ─────────────────────────────────────────────────────────────────  │
│  TOTAL                                     26       23     ▼ −3     │  ← brown
└──────────────────────────────────────────────────────────────────────┘   bg row

Gap column gets a filled chip, not just colored text: green +, red −, grey 0. Rows with a shortfall get a 3px red left border. Total row is --ups-brown background with inverse text.

Optimization Lab
┌─── 4 cols ─────────────┐ ┌─── 8 cols ──────────────────────────────┐
│  SCENARIO              │ │  PROJECTED IMPACT                        │
│                        │ │  ┌──────────┬──────────┬──────────┐     │
│  Volume                │ │  │ BASELINE │ SCENARIO │  DELTA   │     │
│  ──────●──────  +30%   │ │  │   26 HC  │   34 HC  │  ▲ +8    │     │
│  gold thumb, brown trk │ │  │  OEI .87 │  OEI .71 │  ▼ −.16  │     │
│                        │ │  └──────────┴──────────┴──────────┘     │
│  Absenteeism           │ └──────────────────────────────────────────┘
│  ───●─────────  12%    │ ┌─── 8 cols ──────────────────────────────┐
│                        │ │  RECOMMENDED MOVES                       │
│  [ Peak Season ]       │ │  Zone D → Zone C    2 workers   OEI +.04 │
│  [ Normal Day  ]  ←    │ │  Zone B → Sort      1 worker    OEI +.02 │
│  [ Flu Week    ]  presets │  [ Apply plan ]  ← gold button          │
└────────────────────────┘ └──────────────────────────────────────────┘

The sliders are your demo moment. Numbers must recompute instantly on drag — no debounce, no loading state. Client-side arithmetic on the precomputed JSON makes this trivial and it feels like magic in a live demo.

6. Components

Card — background: var(--canvas), border: 1px solid var(--border), radius: 8px, padding: 20px. Header row: eyebrow label left, optional action right, 16px below to content. No shadows.

KPI card — eyebrow (11px condensed uppercase, muted) → value (32px mono) → unit (12px muted, inline after value) → delta chip. Height locked at 120px so the row never ragged-edges.

Delta chip — ▲ 3.2%, 12px mono, 2px 8px padding, 4px radius, background: color-mix(in srgb, var(--status-ok) 12%, transparent), text in the full status color.

Buttons

Primary: gold fill, brown text, 6px radius, 10px 20px, 600 weight. Hover → --ups-gold-600.
Secondary: transparent, 1px brown border, brown text.
Ghost: text only, muted → brown on hover.
One primary button per screen, maximum.

Table — header row --surface-alt, 11px condensed uppercase tracked, --text-muted. Body rows 44px, 1px --border between. Labels left-aligned Barlow; all numbers right-aligned mono. Hover row → --surface.

Charts (Recharts)

grid lines    #E3DCD6, dashed 3 3, horizontal only
axis text     11px Barlow, --text-muted, no axis lines
forecast P50  --ups-brown, 2px
P10–P90 band  Area, fill --forecast-band, no stroke
actuals       --ups-gold, 3px, dots only on hover
now-line      ReferenceLine, --text-muted, dashed
tooltip       white, 1px --border, 8px radius, mono values

Kill the default Recharts legend and build your own as a small caption row of colored 8px squares with condensed uppercase labels. The stock legend is the single most obvious "hackathon dashboard" tell.

7. Microcopy

Write from the supervisor's side of the screen. Not forecast_p50 — "Expected volume." Not "Optimization complete" — "3 moves recommended."

Instead of	Write
Submit	Generate plan
Error loading data	Volume data hasn't synced since 06:00. Showing last known values.
No data	No shortfall predicted for this shift.
Staffing deficit: −2	Sort is 2 people short at 09:00

Alerts state the problem, the location, and the time. Empty states are an invitation, not an apology.

8. Build order for the UI block (H2:50–5:30)
Time	Do
0:20	Tokens into index.css, fonts from Google, Tailwind config extending the palette
0:25	App shell — topbar, sidebar, tab state, privacy badge
0:20	<Card>, <KpiCard>, <DeltaChip>, <Eyebrow>, <StatusBadge>
0:45	Command Center including the shield gauge
0:30	Forecast screen
0:25	Workforce table
0:35	Optimization Lab with live sliders
0:20	Pass over spacing, tabular-nums everywhere, hover states

The shield gauge is just an SVG path of the UPS shield used as a clipPath, with a gold rect animating its y based on OEI, and the number in mono on top. Twenty minutes, and it's the thing judges remember.

Want me to write the index.css token file plus the shell and component primitives so you can paste and go?