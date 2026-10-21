## Unreleased

### Added
- Add dated historical fuel price snapshots and state-level price lookup helpers.
- Allow `planFuel` and `priceCompare` to use prices from a selected state and snapshot date.

### Tests
- Add tests for snapshot loading, missing snapshots, state price lookup, and fuel price integration.
# Changelog

All notable changes to truck-dispatch-toolkit are recorded here.
This project follows semantic versioning.

## 1.1.0 (2026-10-21)

Five new tools, all mirrored in the CLI.

- `lanes`: personal lane rate book. Record booked loads, get lane
  stats (average, median, min, max RPM) and a rate guard that judges
  new offers against your own history with dispatcher counter
  tactics: counter at your average on a soft offer, at your average
  plus 10 percent on a lowball. JSON serialize and restore, plus a
  per-equipment breakdown.
- `broker`: broker payment scorecard (A to F) from your own invoice
  history, with average and median days to pay, late percent,
  outstanding money, unpaid flags, and booking recommendations.
  Includes `quickPayMath`, which annualizes quick-pay fees for an
  honest comparison against factoring.
- `fuel`: trip fuel planner covering gallons burned, gallons to
  buy after starting fuel and reserve, stops on usable gallons per
  fill, and true burn cost per mile, plus `priceCompare` for fuel
  stops priced with their detour cost included.
- `checkcall`: check-call schedule generator (departure, shipper
  arrival, loaded, en-route interval calls, one hour out, delivered
  with POD requested), all UTC, with quiet-hours flagging and a
  plain-text schedule renderer.
- `accessorials`: layover charges, TONU (agreed figure, or the
  default 25 percent of linehaul floored at $150 and capped at
  $500), and a combined accessorial claim letter.
- CLI: new `lane-add`, `lane-check`, `broker`, `fuel`, `checkcall`,
  and `accessorials` commands, all with `--json` where sensible.
- Docs: broker rate negotiation playbook, first-load-with-a-new-
  broker checklist, and three new good first issues (GitHub Pages
  demo, lane book CSV import, per-state fuel price tables).
- Test suite: 50 hand-checked cases (22 existing, 28 new).

## 1.0.0 (2026-10-21)

First public release.

- `rates`: true rate per mile on loaded and all miles, deadhead
  percent, break-even RPM with target margin, and the four-band rate
  verdict (below cost, thin, fair, strong).
- `profit`: full load profit breakdown with fuel, factoring, driver
  pay (percent of linehaul or per loaded mile), tolls and lumper,
  net profit, profit per mile, and margin percent.
- `hos`: simplified U.S. hours-of-service trip feasibility with the
  11-hour, 14-hour, and 70-hour limits, 30-minute break modelling,
  violations list and limiting factor, plus cycle reset advice.
- `detention`: detention charge calculator (free time, grace period,
  billable time rounded up to a billing increment) and a plain-text
  detention claim letter generator.
- `ifta`: per-state gallon apportionment and fuel tax estimates with
  a bundled approximate 2025 rate table for 13 states, caller-supplied
  rates, and unrated-state reporting.
- CLI (`dispatch-toolkit`) with rate, profit, hos, and detention
  commands and `--json` output.
- Checklists: pre-book carrier vetting, load booking workflow, and
  driver onboarding documents.
- Test suite: 22 hand-checked cases, zero dependencies.
