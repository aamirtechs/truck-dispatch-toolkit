# truck-dispatch-toolkit
Live page: https://aamirtechs.github.io/truck-dispatch-toolkit/
Use it in your browser: the Pages site above runs the full tool locally, no install needed.

![Stars](https://img.shields.io/github/stars/aamirtechs/truck-dispatch-toolkit?style=flat&color=C9A227)
![Forks](https://img.shields.io/github/forks/aamirtechs/truck-dispatch-toolkit?style=flat&color=0D1F3C)
![Issues](https://img.shields.io/github/issues/aamirtechs/truck-dispatch-toolkit?style=flat)
![Zero dependencies](https://img.shields.io/badge/Dependencies-0-1DBF73?style=flat)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat)

The math a U.S. truck dispatcher or owner-operator runs every day,
in one zero-dependency JavaScript library and CLI: true rate per mile,
load profit, hours-of-service feasibility, detention claims, IFTA
fuel tax estimates, a personal lane rate book, broker payment
scorecards, trip fuel planning, check-call schedules, and the full
accessorial bundle.

No accounts, no API keys, no build step, no dependencies. Clone it,
run it, read every line of it. Built by **Dispatch Authority**.

## Who it is for

- **Owner-operators** pricing loads and checking whether a rate really
  covers their cost per mile once deadhead is counted.
- **Small fleets** standardising how loads are vetted, booked, and billed.
- **Independent dispatchers** who want detention claims, profit math,
  and HOS sanity checks they can run from a terminal in seconds.

## Install

```bash
git clone https://github.com/aamirtechs/truck-dispatch-toolkit.git
cd truck-dispatch-toolkit
npm test          # 50 hand-checked tests, no install of anything needed
node bin/cli.js --help
```

Node 18 or newer. There is nothing to `npm install`; the dependency
list is empty on purpose.

## The ten tools

### 1. True rate (`rate`)

Loaded RPM lies. A $2,400 load on 800 loaded miles is $3.00 per mile
until you count the 100 deadhead miles to get there, and then it is
$2.67. This tool always prices all miles, grades the rate against
your break-even, and tells you the verdict.

```bash
node bin/cli.js rate --linehaul 2400 --loaded-miles 800 --deadhead-miles 100 --cost-per-mile 2.10
```

```
True rate
  Revenue:          $2,400.00
  Miles:            800 loaded + 100 deadhead = 900
  Rate (loaded):    $3.00 per mile
  Rate (all miles): $2.67 per mile
  Deadhead:         11.11%
  Break-even:       $2.10 per mile
  Verdict:          fair (26.98% vs break-even)
```

Verdict bands: below cost, thin (under break-even + 10 percent), fair
(under break-even + 30 percent), strong (above that).

### 2. Load profit (`profit`)

Gross revenue minus fuel, factoring, driver pay, tolls, and lumper,
with margin and profit per mile. Driver pay takes a percent of
linehaul, or a per-mile rate when no percent is given.

```bash
node bin/cli.js profit --linehaul 3000 --detention-pay 150 --lumper-reimbursed 75 \
  --loaded-miles 1000 --deadhead-miles 120 --mpg 6.5 --fuel-price 3.80 \
  --factoring-percent 3 --tolls 45 --driver-pay-percent 25 --lumper-cost 75
```

```
Load profit
  Gross revenue:  $3,225.00 on 1120 total miles
  Fuel:           $654.77 (172.31 gal)
  Factoring:      $96.75
  Driver pay:     $750.00
  Tolls:          $45.00
  Lumper:         $75.00
  Total costs:    $1,621.52
  Net profit:     $1,603.48 ($1.43 per mile, 49.72% margin)
```

### 3. Hours-of-service feasibility (`hos`)

A simplified check of the 11-hour driving limit, the 14-hour window,
the 70-hour cycle, and the 30-minute break after 8 hours of driving.
Pass the driver's remaining ELD hours to check against reality instead
of the legal defaults.

```bash
node bin/cli.js hos --distance-miles 500 --average-mph 50 --loading-hours 1 --unloading-hours 1
```

```
Trip feasibility (estimate, not legal advice)
  Driving:        10.00h with 1 break(s)
  Total duty:     12.50h
  Feasible:       yes
  Limiting:       11-hour driving limit
```

### 4. Detention (`detention`)

Dwell minus free time minus grace, rounded up to the billing
increment, priced at your contract rate. Add `--letter` with the load
facts and it prints a ready-to-send claim letter citing the ELD
timestamps and the signed BOL.

```bash
node bin/cli.js detention --arrival 2026-10-01T08:00:00Z --departure 2026-10-01T12:10:00Z --rate 65
```

```
Detention
  Dwell:          4.17h
  Billable:       2.25h at $65.00 per hour
  Amount due:     $146.25
```

### 5. IFTA estimates (`ifta`, library)

Per-state gallon apportionment and fuel tax owed estimates, with a
bundled approximate 2025 rate table for 13 states. IFTA rates change
quarterly; verify current rates at ifta.org before filing anything.
Oregon is listed at 0.00 on purpose: Oregon has no fuel tax and
charges a weight-mile tax instead.

```js
const { taxEstimate } = require('./src/ifta');
taxEstimate({ milesByState: { TX: 500, OK: 200 }, mpg: 7 });
// TX: 71.43 gal, tax $14.29. OK: 28.57 gal, tax $5.71. totalTax $20.
```

### 6. Lane rate book (`lane-add`, `lane-check`)

Load boards show the market's rates. This keeps yours. Record every
booked load in a JSON lane book, then check new offers against your
own history on that lane: your average, the spread, and the counter
to make. Judging starts at two loads on the lane; one load is an
anecdote.

```bash
node bin/cli.js lane-add --file lanes.json --origin TX --dest OK --linehaul 1500 --loaded-miles 500 --date 2026-09-15
node bin/cli.js lane-add --file lanes.json --origin TX --dest OK --linehaul 1320 --loaded-miles 440 --date 2026-10-02
node bin/cli.js lane-check --file lanes.json --origin TX --dest OK --offered-linehaul 1200 --loaded-miles 500
```

```
Added to lanes.json: TX-OK dry van, $1,500.00 on 500 miles ($3.00 per mile). 1 load(s) on this lane.
Added to lanes.json: TX-OK dry van, $1,320.00 on 440 miles ($3.00 per mile). 2 load(s) on this lane.
Lane check TX-OK
  Your average:   $3.00 per mile on 2 loads
  Offered:        $2.40 per mile ($1,200.00 on 500 miles)
  Difference:     -20.00%
  Verdict:        lowball
  Counter at:     $1,650.00 (your average plus 10 percent)
```

### 7. Broker scorecard (`broker`)

Grades a broker A to F from your own invoice history: average and
median days to pay, percent late against terms, money outstanding,
and a plain booking recommendation. It also annualizes quick-pay
fees (library: `quickPayMath`), so "2 percent for quick-pay" can be
compared honestly against factoring; 2 percent to be paid 20 days
early is an effective annual rate of 37.24 percent.

```bash
node bin/cli.js broker --days 25,28,30 --amounts 2000,1800,2400 --terms 30
```

```
Broker scorecard
  Invoices:       3 paid, 0 unpaid
  Average days:   27.67 (median 28.00, terms 30)
  Late:           0.00% past terms
  Billed:         $6,200.00   Outstanding: $0.00
  Grade:          A
  Recommendation: Safe to book, standard terms
```

### 8. Trip fuel plan (`fuel`)

Gallons the trip burns, gallons you actually have to buy after
starting fuel and your reserve, stops counted on usable gallons per
fill, and the true burn cost per mile. The library also has
`priceCompare`, which prices a cheaper pump against the detour fuel
it takes to reach it.

```bash
node bin/cli.js fuel --total-miles 1800 --mpg 6 --tank-capacity 120 --starting-gallons 30 --fuel-price 3.90
```

```
Fuel plan
  Gallons needed: 300.00 gal
  Fuel to buy:    285.00 gal (after starting fuel, keeping the reserve)
  Stops needed:   3
  Range (full):   720 miles
  Burn cost:      $1,170.00 ($0.65 per mile)
```

### 9. Check-call schedule (`checkcall`)

The update rhythm brokers grade you on, planned from the three
times on the rate con: departure, arriving at the shipper, loaded,
en-route calls on your interval, one hour out, and delivered with
the POD requested. All times are UTC (convert before you run it).
En-route calls that land in quiet hours are flagged, not dropped.

```bash
node bin/cli.js checkcall --departure 2026-10-05T11:00:00Z --pickup 2026-10-05T13:00:00Z --delivery 2026-10-06T13:00:00Z
```

```
2026-10-05 11:00 UTC  departed, rolling to pickup
2026-10-05 12:30 UTC  arriving at shipper
2026-10-05 14:00 UTC  loaded, paperwork in hand
2026-10-05 18:00 UTC  en route check call
2026-10-05 22:00 UTC  en route check call (quiet hours)
2026-10-06 02:00 UTC  en route check call (quiet hours)
2026-10-06 06:00 UTC  en route check call
2026-10-06 10:00 UTC  en route check call
2026-10-06 12:00 UTC  one hour out
2026-10-06 13:30 UTC  delivered, POD requested
```

### 10. Accessorials (`accessorials`)

Layover and TONU beside the detention tool. TONU defaults to 25
percent of the linehaul, floored at $150 and capped at $500, when
the rate con names no figure. Add `--letter` with the load facts
and it prints one combined claim letter covering every charge.

```bash
node bin/cli.js accessorials --layover-days 2 --tonu-linehaul 2000
```

```
Accessorials
  Layover: 2 day(s) at $250.00 per day = $500.00
  TONU:    $500.00 (default 25% of linehaul, $150-$500)
  Total:   $1,000.00
```

## Library usage

Every module is a pure CommonJS module with no dependencies, usable
from Node or bundled into a browser page.

```js
const toolkit = require('./src/index');

const rate = toolkit.trueRate({ linehaul: 2400, loadedMiles: 800, deadheadMiles: 100 });
const be = toolkit.breakEven({ costPerMile: 2.10, targetMarginPercent: 10 });
const verdict = toolkit.rateVerdict({ rpmAllMiles: rate.rpmAllMiles, breakEvenRpm: be });

const profit = toolkit.loadProfit({
  linehaul: 3000, loadedMiles: 1000, deadheadMiles: 120,
  mpg: 6.5, fuelPricePerGallon: 3.80, factoringPercent: 3,
  driverPayPercent: 25, tolls: 45,
});

const trip = toolkit.planTrip({ distanceMiles: 500, averageMph: 50, loadingHours: 1, unloadingHours: 1 });
const charge = toolkit.detentionCharge({
  arrivalISO: '2026-10-01T08:00:00Z', departureISO: '2026-10-01T12:10:00Z', ratePerHour: 65,
});

const book = toolkit.createLaneBook();
toolkit.addLoad(book, { originState: 'TX', destState: 'OK', linehaul: 1500, loadedMiles: 500, dateISO: '2026-09-15' });
const guard = toolkit.rateGuard(book, { originState: 'TX', destState: 'OK', offeredLinehaul: 1200, loadedMiles: 500 });
const score = toolkit.scoreBroker({ invoices: [{ amount: 2000, daysToPay: 25 }], termsDays: 30 });
const fuel = toolkit.planFuel({ totalMiles: 1800, mpg: 6, tankCapacityGallons: 120, startingGallons: 30, fuelPricePerGallon: 3.90 });
const calls = toolkit.planCheckCalls({
  departureISO: '2026-10-05T11:00:00Z', pickupISO: '2026-10-05T13:00:00Z', deliveryISO: '2026-10-06T13:00:00Z',
});
const tonu = toolkit.tonuCharge({ linehaul: 2000 });
```

Every command also supports `--json` for machine-readable output.

## Checklists (docs/checklists)

Field checklists written from real dispatch operations:

- [Pre-book carrier vetting](docs/checklists/pre-book-carrier-vetting.md):
  FMCSA authority, insurance and safety checks, authority-age rules,
  and the double-broker red flags that stop freight fraud.
- [Load booking workflow](docs/checklists/load-booking-workflow.md):
  rate con to POD, step by step, including where detention files open.
- [Driver onboarding documents](docs/checklists/driver-onboarding-documents.md):
  the DQ file, Clearinghouse, drug testing, and pay setup, with CFR
  references.
- [First load with a new broker](docs/checklists/first-load-with-new-broker.md):
  FMCSA and bond verification, factoring credit approval, written
  money terms, and first-load precautions.

## Playbooks (docs/playbooks)

- [Broker rate negotiation](docs/playbooks/broker-rate-negotiation.md):
  the talk track from opening questions to the counter at your
  average plus 10, the walk-away line, and the accessorial clauses
  to get on the rate con before booking.

## Important limits

Hours-of-service and IFTA outputs are **planning estimates, not legal
or tax advice**. The HOS module simplifies 49 CFR 395.3 and does not
model split sleeper, adverse conditions, or team driving. The IFTA
table is approximate 2025 data for estimation; filing uses the
current quarter's official rates and your actual fuel receipts.

## Roadmap

- Full quarterly IFTA rate tables for all jurisdictions (data PRs welcome)
- Canadian HOS module
- Metric units (km, litres)
- Two-load chain (deadhead optimizer) comparison
- Static web demo of the calculators
- Spanish translations of the checklists

See [docs/GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md) for scoped
starter tasks.

## Contributing

Vanilla JS, zero dependencies, tests required, estimates labelled.
Read [CONTRIBUTING.md](CONTRIBUTING.md), then pick an issue.

## License

MIT. Copyright 2026 Amir Hussain. See [LICENSE](LICENSE).

Built by Dispatch Authority, a U.S. truck dispatching service for
owner-operators and small fleets.
