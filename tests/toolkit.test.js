'use strict';

const assert = require('node:assert');
const toolkit = require('../src/index');
const { trueRate, breakEven, rateVerdict } = toolkit;
const { loadProfit } = toolkit;
const { planTrip, resetAdvice } = toolkit;
const { detentionCharge, claimLetter } = toolkit;
const { gallonsByState, taxEstimate } = toolkit;

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('ok ' + passed + ' - ' + name);
}
function approx(actual, expected, tolerance = 0.005) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    'expected ' + actual + ' to be within ' + tolerance + ' of ' + expected
  );
}

// ---------- rates.trueRate ----------
test('trueRate: hand-checked example, 2400 on 800 loaded + 100 deadhead', () => {
  const r = trueRate({ linehaul: 2400, loadedMiles: 800, deadheadMiles: 100 });
  assert.strictEqual(r.revenue, 2400);
  assert.strictEqual(r.totalMiles, 900);
  assert.strictEqual(r.rpmLoaded, 3.0);
  approx(r.rpmAllMiles, 2.67, 0.01); // 2400 / 900 = 2.6667
  assert.strictEqual(r.deadheadPercent, 11.11); // 100 / 900 = 11.11 percent
});

test('trueRate: accessorials add to revenue', () => {
  const r = trueRate({ linehaul: 2000, accessorials: 250, loadedMiles: 750 });
  assert.strictEqual(r.revenue, 2250);
  assert.strictEqual(r.rpmLoaded, 3.0);
  assert.strictEqual(r.deadheadPercent, 0);
});

test('trueRate: rejects zero loaded miles', () => {
  assert.throws(() => trueRate({ linehaul: 1000, loadedMiles: 0 }), RangeError);
});

// ---------- rates.breakEven ----------
test('breakEven: cost plus margin markup', () => {
  approx(breakEven({ costPerMile: 2.0, targetMarginPercent: 10 }), 2.2, 1e-9);
  approx(breakEven({ costPerMile: 2.336 }), 2.336, 1e-9); // ATRI 2025 average cost per mile
});

// ---------- rates.rateVerdict ----------
test('rateVerdict: all four bands against a 2.00 break-even', () => {
  assert.strictEqual(rateVerdict({ rpmAllMiles: 1.9, breakEvenRpm: 2.0 }).verdict, 'below cost');
  assert.strictEqual(rateVerdict({ rpmAllMiles: 2.05, breakEvenRpm: 2.0 }).verdict, 'thin');
  assert.strictEqual(rateVerdict({ rpmAllMiles: 2.3, breakEvenRpm: 2.0 }).verdict, 'fair');
  assert.strictEqual(rateVerdict({ rpmAllMiles: 2.7, breakEvenRpm: 2.0 }).verdict, 'strong');
  const v = rateVerdict({ rpmAllMiles: 2.5, breakEvenRpm: 2.0 });
  assert.strictEqual(v.spreadPercent, 25);
});

// ---------- profit.loadProfit ----------
test('loadProfit: full worked example, every component asserted', () => {
  // By hand:
  //   gross      = 3000 + 150 detention + 75 lumper reimbursed = 3225
  //   miles      = 1000 loaded + 120 deadhead = 1120
  //   gallons    = 1120 / 6.5 = 172.3077 -> 172.31
  //   fuel       = 172.3077 * 3.80 = 654.7692 -> 654.77
  //   factoring  = 3225 * 3 percent = 96.75
  //   driver pay = 25 percent of linehaul 3000 = 750
  //   costs      = 654.77 + 96.75 + 750 + 45 tolls + 75 lumper = 1621.52
  //   net        = 3225 - 1621.5192 = 1603.4808 -> 1603.48
  //   per mile   = 1603.4808 / 1120 = 1.4317 -> 1.43
  //   margin     = 1603.4808 / 3225 = 49.72 percent
  const p = loadProfit({
    linehaul: 3000, detentionPay: 150, lumperReimbursed: 75,
    loadedMiles: 1000, deadheadMiles: 120,
    mpg: 6.5, fuelPricePerGallon: 3.8,
    factoringPercent: 3, tolls: 45,
    driverPayPercent: 25, lumperCost: 75,
  });
  assert.strictEqual(p.grossRevenue, 3225);
  assert.strictEqual(p.totalMiles, 1120);
  assert.strictEqual(p.gallonsUsed, 172.31);
  assert.strictEqual(p.fuelCost, 654.77);
  assert.strictEqual(p.factoringCost, 96.75);
  assert.strictEqual(p.driverPay, 750);
  assert.strictEqual(p.totalCosts, 1621.52);
  assert.strictEqual(p.netProfit, 1603.48);
  assert.strictEqual(p.profitPerMile, 1.43);
  assert.strictEqual(p.marginPercent, 49.72);
});

test('loadProfit: per-mile driver pay when no percent given', () => {
  const p = loadProfit({
    linehaul: 2000, loadedMiles: 1000, mpg: 6, fuelPricePerGallon: 4,
    driverPayPerMile: 0.65,
  });
  assert.strictEqual(p.driverPay, 650);
});

test('loadProfit: percent driver pay wins over per-mile', () => {
  const p = loadProfit({
    linehaul: 2000, loadedMiles: 1000, mpg: 6, fuelPricePerGallon: 4,
    driverPayPercent: 25, driverPayPerMile: 0.65,
  });
  assert.strictEqual(p.driverPay, 500); // 25 percent of 2000, not 650
});

// ---------- hos.planTrip ----------
test('planTrip: feasible 500 mile trip', () => {
  // driving = 500 / 50 = 10h; one break (crosses the 8h mark once) = 0.5h
  // duty = 10 + 0.5 + 1 loading + 1 unloading = 12.5h
  // tightest constraint: duty 12.5 of 13 remaining shift hours (96 percent)
  const t = planTrip({
    distanceMiles: 500, averageMph: 50, loadingHours: 1, unloadingHours: 1,
    driveHoursAvailable: 10.5, shiftHoursAvailable: 13, cycleHoursAvailable: 40,
  });
  assert.strictEqual(t.drivingHours, 10);
  assert.strictEqual(t.breakCount, 1);
  assert.strictEqual(t.totalDutyHours, 12.5);
  assert.strictEqual(t.feasible, true);
  assert.deepStrictEqual(t.violations, []);
  assert.strictEqual(t.limitingFactor, 'remaining shift hours');
});

test('planTrip: exactly 8 hours of driving needs no break', () => {
  const t = planTrip({ distanceMiles: 400, averageMph: 50 });
  assert.strictEqual(t.drivingHours, 8);
  assert.strictEqual(t.breakCount, 0);
  assert.strictEqual(t.feasible, true);
});

test('planTrip: infeasible 700 mile trip flags the driving limit', () => {
  // driving = 14h (over the 11h limit), duty = 14 + 0.5 + 1 + 1 = 16.5h
  const t = planTrip({ distanceMiles: 700, averageMph: 50, loadingHours: 1, unloadingHours: 1 });
  assert.strictEqual(t.drivingHours, 14);
  assert.strictEqual(t.totalDutyHours, 16.5);
  assert.strictEqual(t.feasible, false);
  assert.ok(t.violations.length >= 2);
  assert.strictEqual(t.limitingFactor, '11-hour driving limit');
});

test('resetAdvice: warns under 10 remaining cycle hours', () => {
  const low = resetAdvice({ cycleHoursUsed: 62 });
  assert.strictEqual(low.remainingCycleHours, 8);
  assert.ok(typeof low.warning === 'string' && low.warning.length > 0);
  const fine = resetAdvice({ cycleHoursUsed: 30 });
  assert.strictEqual(fine.remainingCycleHours, 40);
  assert.strictEqual(fine.warning, null);
});

// ---------- detention ----------
test('detentionCharge: 4h10m dwell, 2h free, 15 minute increments', () => {
  // dwell 250 min, free 120, billable raw 130, rounded up to 135 min = 2.25h
  const d = detentionCharge({
    arrivalISO: '2026-10-01T08:00:00Z',
    departureISO: '2026-10-01T12:10:00Z',
    freeHours: 2, ratePerHour: 65,
  });
  assert.strictEqual(d.dwellHours, 4.17);
  assert.strictEqual(d.billableHours, 2.25);
  assert.strictEqual(d.amount, 146.25);
});

test('detentionCharge: inside free time bills zero', () => {
  const d = detentionCharge({
    arrivalISO: '2026-10-01T08:00:00Z',
    departureISO: '2026-10-01T09:30:00Z',
    freeHours: 2, ratePerHour: 65,
  });
  assert.strictEqual(d.billableHours, 0);
  assert.strictEqual(d.amount, 0);
});

test('detentionCharge: grace period absorbs the overrun', () => {
  const d = detentionCharge({
    arrivalISO: '2026-10-01T08:00:00Z',
    departureISO: '2026-10-01T10:10:00Z',
    freeHours: 2, ratePerHour: 65, graceMinutes: 15,
  });
  assert.strictEqual(d.billableHours, 0);
});

test('detentionCharge: departure before arrival throws', () => {
  assert.throws(() => detentionCharge({
    arrivalISO: '2026-10-01T12:00:00Z',
    departureISO: '2026-10-01T08:00:00Z',
    ratePerHour: 65,
  }), RangeError);
});

test('claimLetter: contains carrier, amount and load reference', () => {
  const letter = claimLetter({
    carrierName: 'Bluebonnet Carriers LLC', mcNumber: '123456',
    brokerName: 'Acme Brokerage', loadReference: 'LD-8841',
    facility: 'Big DC Warehouse', city: 'Dallas', state: 'TX',
    arrivalISO: '2026-10-01T08:00:00Z', departureISO: '2026-10-01T12:10:00Z',
    freeHours: 2, ratePerHour: 65, amount: 146.25, billableHours: 2.25,
    dispatcherName: 'Sam Reyes', companyName: 'Dispatch Authority',
    dateISO: '2026-10-02',
  });
  assert.ok(letter.includes('Detention Claim'));
  assert.ok(letter.includes('Bluebonnet Carriers LLC'));
  assert.ok(letter.includes('MC 123456'));
  assert.ok(letter.includes('LD-8841'));
  assert.ok(letter.includes('$146.25'));
  assert.ok(letter.includes('signed bill of lading'));
});

// ---------- ifta ----------
test('gallonsByState: two-state split at 7 mpg', () => {
  const g = gallonsByState({ milesByState: { TX: 500, OK: 200 }, mpg: 7 });
  assert.strictEqual(g.byState.TX.gallons, 71.43); // 500 / 7 = 71.4286
  assert.strictEqual(g.byState.OK.gallons, 28.57); // 200 / 7 = 28.5714
  assert.strictEqual(g.totalMiles, 700);
  assert.strictEqual(g.totalGallons, 100);
});

test('taxEstimate: default 2025 table, TX and OK at 0.20', () => {
  const t = taxEstimate({ milesByState: { TX: 500, OK: 200 }, mpg: 7 });
  assert.strictEqual(t.byState.TX.tax, 14.29); // 71.4286 gal * 0.20
  assert.strictEqual(t.byState.OK.tax, 5.71); // 28.5714 gal * 0.20
  assert.strictEqual(t.totalTax, 20);
  assert.deepStrictEqual(t.unrated, []);
});

test('taxEstimate: unknown state lands in unrated, not an exception', () => {
  const t = taxEstimate({ milesByState: { TX: 500, ZZ: 140 }, mpg: 7 });
  assert.deepStrictEqual(t.unrated, ['ZZ']);
  assert.strictEqual(t.byState.ZZ.gallons, 20);
  assert.strictEqual(t.byState.ZZ.tax, null);
  assert.strictEqual(t.totalTax, 14.29);
});

test('taxEstimate: caller-supplied rates override the default table', () => {
  const t = taxEstimate({ milesByState: { TX: 500, OK: 200 }, mpg: 7, taxRates: { TX: 0.1 } });
  assert.strictEqual(t.byState.TX.tax, 7.14); // 71.4286 * 0.10
  assert.deepStrictEqual(t.unrated, ['OK']);
});

// ---------- index exports ----------
test('index: all modules re-exported', () => {
  for (const fn of ['trueRate', 'breakEven', 'rateVerdict', 'loadProfit', 'planTrip',
    'resetAdvice', 'detentionCharge', 'claimLetter', 'gallonsByState', 'taxEstimate']) {
    assert.strictEqual(typeof toolkit[fn], 'function', fn + ' should be exported');
  }
  assert.strictEqual(toolkit.IFTA_DEFAULT_RATES.TX, 0.2);
});

// ---------- lanes ----------
const { createLaneBook, addLoad, laneStats, rateGuard, equipmentBreakdown } = toolkit;

function sampleBook() {
  // TX to OK, dry van. RPMs by hand: 1500/500 = 3.00, 1320/440 = 3.00,
  // 1200/500 = 2.40. Inserted out of date order on purpose.
  const book = createLaneBook();
  addLoad(book, { originState: 'tx', destState: 'ok', linehaul: 1500, loadedMiles: 500, dateISO: '2026-09-15' });
  addLoad(book, { originState: 'TX', destState: 'OK', linehaul: 1320, loadedMiles: 440, dateISO: '2026-10-02' });
  addLoad(book, { originState: 'TX', destState: 'OK', linehaul: 1200, loadedMiles: 500, dateISO: '2026-09-01' });
  return book;
}

test('lanes: addLoad normalizes states and stores the computed rpm', () => {
  const book = createLaneBook();
  const load = addLoad(book, { originState: 'tx', destState: 'ok', linehaul: 1500, loadedMiles: 500, dateISO: '2026-09-15' });
  assert.strictEqual(load.lane, 'TX-OK');
  assert.strictEqual(load.equipment, 'dry van');
  assert.strictEqual(load.rpm, 3);
  assert.strictEqual(book.loads.length, 1);
});

test('lanes: laneStats averages the booked history', () => {
  // avg rpm = (3.00 + 3.00 + 2.40) / 3 = 2.80; median of [2.40, 3.00, 3.00] = 3.00
  // avg linehaul = (1500 + 1320 + 1200) / 3 = 1340; last date = 2026-10-02
  const s = laneStats(sampleBook(), { originState: 'TX', destState: 'OK' });
  assert.strictEqual(s.count, 3);
  assert.strictEqual(s.avgRpm, 2.8);
  assert.strictEqual(s.medianRpm, 3);
  assert.strictEqual(s.minRpm, 2.4);
  assert.strictEqual(s.maxRpm, 3);
  assert.strictEqual(s.avgLinehaul, 1340);
  assert.strictEqual(s.lastDateISO, '2026-10-02');
});

test('lanes: laneStats is null with no loads, and equipment filter applies', () => {
  const book = sampleBook();
  assert.strictEqual(laneStats(book, { originState: 'TX', destState: 'NM' }), null);
  assert.strictEqual(laneStats(book, { originState: 'TX', destState: 'OK', equipment: 'reefer' }), null);
  assert.strictEqual(laneStats(book, { originState: 'TX', destState: 'OK', equipment: 'Dry Van' }).count, 3);
});

test('lanes: rateGuard refuses to judge on a single load', () => {
  const book = createLaneBook();
  addLoad(book, { originState: 'TX', destState: 'OK', linehaul: 1500, loadedMiles: 500, dateISO: '2026-09-15' });
  const g = rateGuard(book, { originState: 'TX', destState: 'OK', offeredLinehaul: 1400, loadedMiles: 500 });
  assert.strictEqual(g.verdict, 'insufficient history');
  assert.strictEqual(g.sampleSize, 1);
});

test('lanes: rateGuard at or above your average', () => {
  // offered 1450 / 500 = 2.90 vs average 2.80; diff = 0.10 / 2.80 = 3.57 percent
  const g = rateGuard(sampleBook(), { originState: 'TX', destState: 'OK', offeredLinehaul: 1450, loadedMiles: 500 });
  assert.strictEqual(g.verdict, 'at or above your average');
  assert.strictEqual(g.offeredRpm, 2.9);
  assert.strictEqual(g.avgRpm, 2.8);
  assert.strictEqual(g.percentDiff, 3.57);
});

test('lanes: rateGuard below average counters at your average', () => {
  // offered 1330 / 500 = 2.66, which is 5 percent under the 2.80 average
  // counter = 2.80 * 500 = 1400
  const g = rateGuard(sampleBook(), { originState: 'TX', destState: 'OK', offeredLinehaul: 1330, loadedMiles: 500 });
  assert.strictEqual(g.verdict, 'below average, counter suggested');
  assert.strictEqual(g.percentDiff, -5);
  assert.strictEqual(g.suggestedCounter, 1400);
});

test('lanes: rateGuard lowball counters at average plus 10 percent', () => {
  // offered 1200 / 500 = 2.40; below = 0.40 / 2.80 = 14.29 percent
  // counter = 2.80 * 1.1 * 500 = 1540
  const g = rateGuard(sampleBook(), { originState: 'TX', destState: 'OK', offeredLinehaul: 1200, loadedMiles: 500 });
  assert.strictEqual(g.verdict, 'lowball');
  assert.strictEqual(g.percentBelow, 14.29);
  assert.strictEqual(g.percentDiff, -14.29);
  assert.strictEqual(g.suggestedCounter, 1540);
});

test('lanes: JSON round trip restores the book and recomputes rpm', () => {
  const book = sampleBook();
  const restored = toolkit.lanes.fromJSON(toolkit.lanes.toJSON(book));
  assert.strictEqual(restored.loads.length, 3);
  assert.strictEqual(restored.loads[0].rpm, 3);
  const s = laneStats(restored, { originState: 'TX', destState: 'OK' });
  assert.strictEqual(s.avgRpm, 2.8);
  assert.throws(() => toolkit.lanes.fromJSON('{"nope":1}'), RangeError);
  assert.throws(() => toolkit.lanes.fromJSON('not json'), RangeError);
});

test('lanes: equipmentBreakdown counts and averages per equipment', () => {
  const book = createLaneBook();
  addLoad(book, { originState: 'TX', destState: 'OK', linehaul: 1500, loadedMiles: 500, dateISO: '2026-09-15' });
  addLoad(book, { originState: 'TX', destState: 'NM', linehaul: 1200, loadedMiles: 500, dateISO: '2026-09-20' });
  addLoad(book, { originState: 'TX', destState: 'OK', equipment: 'reefer', linehaul: 1800, loadedMiles: 500, dateISO: '2026-09-22' });
  const b = equipmentBreakdown(book);
  assert.strictEqual(b['dry van'].count, 2);
  assert.strictEqual(b['dry van'].avgRpm, 2.7); // (3.00 + 2.40) / 2
  assert.strictEqual(b.reefer.count, 1);
  assert.strictEqual(b.reefer.avgRpm, 3.6);
});

// ---------- broker ----------
const { scoreBroker, quickPayMath } = toolkit;

test('broker: on-time payer grades A', () => {
  // days 25, 28, 30 on 30-day terms: avg = 83 / 3 = 27.67, none late
  const s = scoreBroker({
    invoices: [
      { amount: 2000, daysToPay: 25 },
      { amount: 1800, daysToPay: 28 },
      { amount: 2400, daysToPay: 30 },
    ],
    termsDays: 30,
  });
  assert.strictEqual(s.grade, 'A');
  assert.strictEqual(s.avgDaysToPay, 27.67);
  assert.strictEqual(s.medianDaysToPay, 28);
  assert.strictEqual(s.latePercent, 0);
  assert.strictEqual(s.totalBilled, 6200);
  assert.strictEqual(s.totalOutstanding, 0);
  assert.strictEqual(s.recommendation, 'Safe to book, standard terms');
  assert.deepStrictEqual(s.flags, []);
});

test('broker: slow payer at 45 and 50 days grades D', () => {
  // avg 47.5: over terms + 15 (45) but inside terms + 30 (60)
  const s = scoreBroker({
    invoices: [
      { amount: 1500, daysToPay: 45 },
      { amount: 1500, daysToPay: 50 },
    ],
    termsDays: 30,
  });
  assert.strictEqual(s.grade, 'D');
  assert.strictEqual(s.avgDaysToPay, 47.5);
  assert.strictEqual(s.latePercent, 100);
  assert.strictEqual(s.recommendation, 'Quick-pay or fuel advance only');
});

test('broker: mixed history, late percent, unpaid flag and outstanding', () => {
  // paid days 20, 35, 40, 28: avg = 123 / 4 = 30.75, median = (28 + 35) / 2 = 31.5
  // late = 2 of 4 = 50 percent, which blocks B, so the grade is C
  const s = scoreBroker({
    invoices: [
      { amount: 1000, daysToPay: 20 },
      { amount: 1000, daysToPay: 35 },
      { amount: 1000, daysToPay: 40 },
      { amount: 1000, daysToPay: 28 },
      { amount: 750, paid: false },
    ],
    termsDays: 30,
  });
  assert.strictEqual(s.paidCount, 4);
  assert.strictEqual(s.unpaidCount, 1);
  assert.strictEqual(s.avgDaysToPay, 30.75);
  assert.strictEqual(s.medianDaysToPay, 31.5);
  assert.strictEqual(s.latePercent, 50);
  assert.strictEqual(s.grade, 'C');
  assert.strictEqual(s.totalBilled, 4750);
  assert.strictEqual(s.totalOutstanding, 750);
  assert.deepStrictEqual(s.flags, ['has unpaid invoices']);
});

test('broker: empty invoice list throws', () => {
  assert.throws(() => scoreBroker({ invoices: [] }), RangeError);
});

test('broker: quickPayMath annualizes the fee', () => {
  // fee = 2 percent of 2000 = 40; net = 1960
  // effective annual = (40 / 1960) * (365 / 20) * 100 = 37.2448... -> 37.24
  const q = quickPayMath({ amount: 2000, quickPayPercent: 2, daysEarly: 20 });
  assert.strictEqual(q.fee, 40);
  assert.strictEqual(q.netReceived, 1960);
  assert.strictEqual(q.effectiveAnnualRatePercent, 37.24);
});

// ---------- fuel ----------
const {
  planFuel,
  priceCompare,
  loadFuelPrices,
  fuelPriceForState,
} = toolkit;

test('fuel prices: loads a known historical snapshot', () => {
  const snapshot = loadFuelPrices('2026-10-19');

  assert.strictEqual(snapshot.date, '2026-10-19');
  assert.strictEqual(snapshot.unit, 'USD per gallon');
  assert.strictEqual(typeof snapshot.prices, 'object');
});

test('fuel prices: throws a clear error for a missing snapshot', () => {
  assert.throws(
    () => loadFuelPrices('1900-01-01'),
    /Fuel price snapshot not found: 1900-01-01/
  );
});

test('fuel prices: state price can be used by priceCompare', () => {
  test('fuel prices: priceCompare accepts a state and snapshot date', () => {
  const result = priceCompare({
    gallons: 10,
    options: [
      {
        name: 'California',
        fuelState: 'California',
        fuelPriceDate: '2026-10-19',
      },
    ],
  });

  assert.strictEqual(result[0].pricePerGallon, 8.242);
  assert.strictEqual(result[0].totalCost, 82.42);
});
  test('fuel prices: planFuel accepts a state and snapshot date', () => {
  const result = planFuel({
    totalMiles: 100,
    mpg: 10,
    tankCapacityGallons: 50,
    startingGallons: 20,
    fuelState: 'California',
    fuelPriceDate: '2026-10-19',
  });

  assert.strictEqual(result.burnCost, 82.42);
});
  const price = fuelPriceForState('California', '2026-10-19');

  const result = priceCompare({
    gallons: 10,
    options: [
      { name: 'California', pricePerGallon: price },
    ],
  });

  assert.strictEqual(result[0].pricePerGallon, price);
  assert.strictEqual(result[0].totalCost, 82.42);
});

test('fuel: 1100 miles at 6.5 mpg burns 169.23 gallons', () => {
  // gallons = 1100 / 6.5 = 169.2307; buy = 169.2307 + 15 reserve - 50 in tank = 134.23
  // starting range = 50 * 6.5 = 325 mi; one fill of (150 - 15) * 6.5 = 877.5 mi covers the rest
  // burn cost = 169.2307 * 3.80 = 643.08; per mile = 0.58
  const f = planFuel({
    totalMiles: 1100, mpg: 6.5, tankCapacityGallons: 150,
    startingGallons: 50, fuelPricePerGallon: 3.8,
  });
  assert.strictEqual(f.gallonsNeeded, 169.23);
  assert.strictEqual(f.fuelToBuy, 134.23);
  assert.strictEqual(f.stopsNeeded, 1);
  assert.strictEqual(f.rangeMilesOnFullTank, 975);
  assert.strictEqual(f.burnCost, 643.08);
  assert.strictEqual(f.burnCostPerMile, 0.58);
});

test('fuel: stops counted on usable gallons per fill', () => {
  // 1800 mi at 6 mpg = 300 gal; buy = 300 + 15 - 30 = 285
  // starting range = 180 mi; each fill covers (120 - 15) * 6 = 630 mi
  // stops = ceil((1800 - 180) / 630) = ceil(2.5714) = 3
  const f = planFuel({
    totalMiles: 1800, mpg: 6, tankCapacityGallons: 120,
    startingGallons: 30, fuelPricePerGallon: 3.9, reserveGallons: 15,
  });
  assert.strictEqual(f.gallonsNeeded, 300);
  assert.strictEqual(f.fuelToBuy, 285);
  assert.strictEqual(f.stopsNeeded, 3);
  assert.strictEqual(f.rangeMilesOnFullTank, 720);
  assert.strictEqual(f.burnCost, 1170);
  assert.strictEqual(f.burnCostPerMile, 0.65);
});

test('fuel: no stop when the starting fuel covers the trip', () => {
  const f = planFuel({
    totalMiles: 150, mpg: 6, tankCapacityGallons: 120,
    startingGallons: 40, fuelPricePerGallon: 4,
  });
  assert.strictEqual(f.stopsNeeded, 0);
  assert.strictEqual(f.fuelToBuy, 0); // 25 needed + 15 reserve = the 40 already in the tank
});

test('fuel: priceCompare prices the detour, not just the pump', () => {
  // Mid: 100 * 3.60 = 360. Cheap far: 100 * 3.50 + (30 / 6) * 3.80 = 350 + 19 = 369.
  // Near pricey: 100 * 3.70 = 370. Highest is 370.
  const out = priceCompare({
    gallons: 100,
    options: [
      { name: 'Near pricey', pricePerGallon: 3.7 },
      { name: 'Cheap far', pricePerGallon: 3.5, detourMiles: 30, mpg: 6, fuelPriceForDetour: 3.8 },
      { name: 'Mid', pricePerGallon: 3.6 },
    ],
  });
  assert.deepStrictEqual(out.map((o) => o.name), ['Mid', 'Cheap far', 'Near pricey']);
  assert.strictEqual(out[0].totalCost, 360);
  assert.strictEqual(out[0].savingsVsHighest, 10);
  assert.strictEqual(out[1].totalCost, 369);
  assert.strictEqual(out[1].savingsVsHighest, 1);
  assert.strictEqual(out[2].totalCost, 370);
  assert.strictEqual(out[2].savingsVsHighest, 0);
});

test('fuel: priceCompare defaults the detour price to the stop price', () => {
  // 50 * 4.00 = 200, detour burns 12 / 6 = 2 gal at 4.00 = 8, total 208
  const out = priceCompare({
    gallons: 50,
    options: [{ name: 'Only stop', pricePerGallon: 4, detourMiles: 12, mpg: 6 }],
  });
  assert.strictEqual(out[0].totalCost, 208);
  assert.strictEqual(out[0].savingsVsHighest, 0);
});

// ---------- checkcall ----------
const { planCheckCalls, formatSchedule } = toolkit;

function sampleCalls() {
  return planCheckCalls({
    departureISO: '2026-10-05T11:00:00Z',
    pickupISO: '2026-10-05T13:00:00Z',
    deliveryISO: '2026-10-06T13:00:00Z',
    intervalHours: 4,
  });
}

test('checkcall: full milestone schedule for a next-day delivery', () => {
  // departure 11:00, shipper 12:30, loaded 14:00, en route every 4h
  // (18:00, 22:00, 02:00, 06:00, 10:00), one hour out 12:00, delivered 13:30
  const calls = sampleCalls();
  assert.strictEqual(calls.length, 10);
  assert.strictEqual(calls[0].timeISO, '2026-10-05T11:00:00.000Z');
  assert.strictEqual(calls[0].label, 'departed, rolling to pickup');
  assert.strictEqual(calls[0].quiet, false);
  const last = calls[calls.length - 1];
  assert.strictEqual(last.label, 'delivered, POD requested');
  assert.strictEqual(last.timeISO, '2026-10-06T13:30:00.000Z');
  const times = calls.map((c) => c.timeISO);
  assert.deepStrictEqual(times, [...times].sort());
});

test('checkcall: en-route calls in quiet hours are flagged, not dropped', () => {
  const calls = sampleCalls();
  const at2am = calls.find((c) => c.timeISO === '2026-10-06T02:00:00.000Z');
  assert.ok(at2am);
  assert.strictEqual(at2am.label, 'en route check call');
  assert.strictEqual(at2am.quiet, true);
  const at6am = calls.find((c) => c.timeISO === '2026-10-06T06:00:00.000Z');
  assert.strictEqual(at6am.quiet, false); // quiet hours end at 06:00
  const at10pm = calls.find((c) => c.timeISO === '2026-10-05T22:00:00.000Z');
  assert.strictEqual(at10pm.quiet, true); // quiet hours start at 22:00
});

test('checkcall: formatSchedule renders UTC lines with quiet suffixes', () => {
  const text = formatSchedule(sampleCalls());
  const lines = text.split('\n');
  assert.strictEqual(lines[0], '2026-10-05 11:00 UTC  departed, rolling to pickup');
  assert.ok(lines.includes('2026-10-06 02:00 UTC  en route check call (quiet hours)'));
  assert.ok(lines.includes('2026-10-06 12:00 UTC  one hour out'));
});

test('checkcall: delivery before pickup throws', () => {
  assert.throws(() => planCheckCalls({
    departureISO: '2026-10-05T11:00:00Z',
    pickupISO: '2026-10-05T13:00:00Z',
    deliveryISO: '2026-10-05T12:00:00Z',
  }), RangeError);
});

// ---------- accessorials ----------
const { layoverCharge, tonuCharge, combinedClaimLetter } = toolkit;

test('accessorials: layover at the default daily rate', () => {
  const l = layoverCharge({ days: 2 });
  assert.strictEqual(l.ratePerDay, 250);
  assert.strictEqual(l.amount, 500);
  assert.strictEqual(layoverCharge({ days: 1, ratePerDay: 300 }).amount, 300);
});

test('accessorials: TONU default is 25 percent of linehaul, floored and capped', () => {
  assert.strictEqual(tonuCharge({ linehaul: 2000 }).amount, 500); // 25 percent = 500, at the cap
  assert.strictEqual(tonuCharge({ linehaul: 2400 }).amount, 500); // 600 would pass the cap
  assert.strictEqual(tonuCharge({ linehaul: 400 }).amount, 150); // 100 raised to the floor
  assert.strictEqual(tonuCharge({ linehaul: 1200 }).amount, 300);
  assert.strictEqual(tonuCharge({ linehaul: 2000 }).basis, 'default 25% of linehaul, $150-$500');
});

test('accessorials: agreed TONU wins over the default', () => {
  const t = tonuCharge({ agreedTonu: 350, linehaul: 2000 });
  assert.strictEqual(t.amount, 350);
  assert.strictEqual(t.basis, 'agreed');
  assert.throws(() => tonuCharge({}), RangeError);
});

test('accessorials: combined claim letter lists every item and the total', () => {
  const letter = combinedClaimLetter({
    carrierName: 'Bluebonnet Carriers LLC', mcNumber: '123456',
    brokerName: 'Acme Brokerage', loadReference: 'LD-8841',
    items: [
      { type: 'Detention', description: '2.25 billable hours at Dallas DC', amount: 146.25 },
      { type: 'Layover', description: '1 day, facility closed', amount: 250 },
    ],
    dispatcherName: 'Sam Reyes', companyName: 'Dispatch Authority',
    dateISO: '2026-10-07',
  });
  assert.ok(letter.includes('Accessorial Claim'));
  assert.ok(letter.includes('Detention, 2.25 billable hours at Dallas DC: $146.25'));
  assert.ok(letter.includes('Layover, 1 day, facility closed: $250.00'));
  assert.ok(letter.includes('Total due:      $396.25'));
  assert.ok(letter.includes('LD-8841'));
});

// ---------- index exports (new modules) ----------
test('index: new modules re-exported, namespaced and flat', () => {
  for (const ns of ['lanes', 'broker', 'fuel', 'checkcall', 'accessorials']) {
    assert.strictEqual(typeof toolkit[ns], 'object', ns + ' namespace should exist');
  }
  for (const fn of ['createLaneBook', 'addLoad', 'laneStats', 'rateGuard', 'equipmentBreakdown',
    'laneBookToJSON', 'laneBookFromJSON', 'scoreBroker', 'quickPayMath',
   'planFuel', 'priceCompare', 'loadFuelPrices', 'fuelPriceForState',
'planCheckCalls', 'formatSchedule',
    'layoverCharge', 'tonuCharge', 'combinedClaimLetter']) {
    assert.strictEqual(typeof toolkit[fn], 'function', fn + ' should be exported');
  }
});

console.log('\nAll ' + passed + ' tests passed.');
