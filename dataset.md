The core problem with public data

No public dataset has warehouse scan events + worker rosters + labor standards together. That data is operationally sensitive; companies don't release it. So your real decision is:

Which one open dataset gives you the richest proxy for volume + timestamps, and where do you draw an honest line and use assumption-based parameters instead of pretending you found a dataset for something that doesn't exist publicly?

Given 8 hours solo, I'd commit to one primary dataset, not four.

Primary recommendation: Olist Brazilian E-Commerce Dataset

This is the best single fit because it has real, order-level timestamps across the full fulfillment lifecycle — which is the closest public proxy to inbound→outbound cycle time that exists.

Get it:

bash
pip install kaggle --break-system-packages
# needs kaggle.json API token from kaggle.com/settings → API → Create New Token
mkdir -p ~/.kaggle && mv kaggle.json ~/.kaggle/
kaggle datasets download -d olistbr/brazilian-ecommerce
unzip brazilian-ecommerce.zip -d ./data

No Kaggle account handy? Direct browser download works too: search "Olist Brazilian E-Commerce Kaggle" → download button, no API needed.

What's in it and how it maps to your problem:

Olist file	Real columns	Maps to
olist_orders_dataset.csv	order_purchase_timestamp, order_approved_at, order_delivered_carrier_date, order_delivered_customer_date, order_estimated_delivery_date	Inbound = purchase→approved volume by hour/day. Outbound = carrier handoff volume. Cycle time = delivered − purchase, exactly your "dock-to-stock" analog
olist_order_items_dataset.csv	product_id, price, freight_value, quantity per order	Package/unit volume, not just order count — gives you unit-level throughput
olist_products_dataset.csv	category, weight, dimensions	Zone/process assignment proxy (heavy vs small items → different processes)
olist_customers_dataset.csv + olist_geolocation_dataset.csv	city, state, lat/lng	Regional hub simulation — treat each state as a "zone"
olist_sellers_dataset.csv	seller location	Can double as "inbound source" for a synthetic multi-hub angle if you have time

Aggregate order_purchase_timestamp by hour → that's your inbound volume time series. Aggregate order_delivered_carrier_date → outbound. The gap between them, per order, is your cycle-time KPI feed directly.

License: CC0 — no restriction, cite it as source in your slide.

If you want a stronger forecasting demo specifically: M5

If your priority is a really convincing quantile-forecast backtest (P10/P50/P90, WAPE vs baseline), M5 Forecasting – Accuracy is purpose-built for this and will save you feature-engineering time, since it already ships calendar features.

bash
kaggle competitions download -c m5-forecasting-accuracy
File	Gives you
sales_train_validation.csv	Daily unit sales, hierarchical (item→dept→category→store→state) — directly mirrors process→zone→hub rollup
calendar.csv	Day-of-week, month, event flags (SuperBowl, Christmas, etc.), SNAP days
sell_prices.csv	Weekly price

M5's hierarchy (store→dept→item) maps cleanly onto hub→process→zone, so your reconciliation story ("we forecast at hub level and reconcile down to zone level") is literally the same math M5 competitors used — you can even reference the M5 accuracy competition results as your credibility anchor in the pitch.

Given your 8 hours, don't use both. Olist gives you cycle-time + KPI data that M5 lacks; M5 gives you calendar-rich forecasting that Olist lacks. Pick based on which module you want to demo hardest. If I had to choose one: Olist, because cycle time / OEI is your differentiator, and forecasting alone is table stakes every team will have.

Weather (free, no signup, 5 minutes)
python
import requests
r = requests.get("https://archive-api.open-meteo.com/v1/archive", params={
    "latitude": -23.55, "longitude": -46.63,   # São Paulo, matches Olist's largest hub
    "start_date": "2017-01-01", "end_date": "2018-12-31",
    "daily": "precipitation_sum,temperature_2m_max",
    "timezone": "America/Sao_Paulo"
})
weather_df = pd.DataFrame(r.json()["daily"])

No API key, no rate-limit headaches, historical archive goes back decades.

What genuinely doesn't exist publicly — and what to do instead

Worker rosters, individual UPH, absenteeism logs, shift schedules: no public dataset exists, full stop. Don't spend time hunting — you'll burn an hour and find nothing usable.

Handle it as documented parameters, not as a missing dataset:

python
# Labor standards — industry-benchmark assumptions, not fabricated data.
# Cite as: "engineered standards per typical parcel-hub UPH benchmarks"
UPH_STANDARD = {
    "unload": 140, "sort": 320, "stow": 110, "pick": 180, "pack": 150
}
SHIFT_HOURS = 8
ABSENTEEISM_RATE = 0.06   # industry-typical warehouse absenteeism

This is a completely legitimate move in a hackathon. Say it plainly on your data-sources slide: "Volume and cycle-time data: Olist (real, public). Labor standards: parameterized from typical parcel-hub benchmarks, since no public workforce dataset exists — schema-compatible with a real WMS/HRMS export." That sentence signals you understand the difference between a dataset gap and a design choice — judges notice teams who are honest about this versus teams who quietly fabricate labor data and hope nobody asks.

Fast field-mapping checklist (do this first, before writing any model code)
Load olist_orders_dataset.csv, parse the four timestamp columns to datetime
inbound_hourly = orders.groupby(orders.order_purchase_timestamp.dt.floor('H')).size()
outbound_hourly = orders.groupby(orders.order_delivered_carrier_date.dt.floor('H')).size()
cycle_time = order_delivered_customer_date − order_purchase_timestamp → feeds OEI's quality/speed component
Join order_items to get unit counts, not just order counts, for a more realistic volume signal
Join weather by date (and city if you want a real join, else just date-level for São Paulo)
Apply your UPH_STANDARD dict to convert volume → required hours → headcount

That's your entire H0–H0:45 data step, using real data end to end except the labor constants.