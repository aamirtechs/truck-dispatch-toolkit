'use strict';

const fs = require('fs');
const path = require('path');

// Trip fuel planner.
//
// Two different fuel numbers matter on a trip, and mixing them up is
// how loads get mispriced:
//   - burn cost: the fuel the trip actually consumes (miles / mpg),
//     priced per mile. This belongs in the load profit math.
//   - fuel to buy: what has to go through the pump on this trip,
//     which depends on what is already in the tank and the reserve
//     the driver refuses to run below.
// Stops are planned on usable gallons per fill: tank capacity minus
// the reserve, because a driver who plans to arrive on fumes is
// planning to buy the most expensive fuel on the route.

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(name + ' must be a finite number, got: ' + String(value));
  }
}

function planFuel({
  totalMiles,
  mpg,
  tankCapacityGallons,
  startingGallons,
  fuelPricePerGallon,
  fuelState,
  fuelPriceDate,
  reserveGallons = 15,
} = {}) {
  if (fuelPricePerGallon === undefined &&
      fuelState !== undefined &&
      fuelPriceDate !== undefined) {
    fuelPricePerGallon = fuelPriceForState(fuelState, fuelPriceDate);
  }
  const numbers = { totalMiles, mpg, tankCapacityGallons, startingGallons, fuelPricePerGallon, reserveGallons };
  for (const [name, value] of Object.entries(numbers)) {
    assertFiniteNumber(value, name);
  }
  if (totalMiles <= 0) throw new RangeError('totalMiles must be greater than 0, got: ' + totalMiles);
  if (mpg <= 0) throw new RangeError('mpg must be greater than 0, got: ' + mpg);
  if (tankCapacityGallons <= 0) {
    throw new RangeError('tankCapacityGallons must be greater than 0, got: ' + tankCapacityGallons);
  }
  if (startingGallons < 0) throw new RangeError('startingGallons must be 0 or more, got: ' + startingGallons);
  if (fuelPricePerGallon < 0) {
    throw new RangeError('fuelPricePerGallon must be 0 or more, got: ' + fuelPricePerGallon);
  }
  if (reserveGallons < 0) throw new RangeError('reserveGallons must be 0 or more, got: ' + reserveGallons);
  if (reserveGallons >= tankCapacityGallons) {
    throw new RangeError('reserveGallons must be less than tankCapacityGallons');
  }

  const gallonsNeededRaw = totalMiles / mpg;
  const fuelToBuyRaw = Math.max(0, gallonsNeededRaw + reserveGallons - startingGallons);

  const startingRangeMiles = startingGallons * mpg;
  let stopsNeeded = 0;
  if (totalMiles > startingRangeMiles) {
    const usableMilesPerFill = (tankCapacityGallons - reserveGallons) * mpg;
    stopsNeeded = Math.ceil((totalMiles - startingRangeMiles) / usableMilesPerFill);
  }

  const burnCostRaw = gallonsNeededRaw * fuelPricePerGallon;
  return {
    gallonsNeeded: round2(gallonsNeededRaw),
    fuelToBuy: round2(fuelToBuyRaw),
    stopsNeeded,
    rangeMilesOnFullTank: round2(tankCapacityGallons * mpg),
    burnCost: round2(burnCostRaw),
    burnCostPerMile: round2(burnCostRaw / totalMiles),
  };
}

// Compare fuel stops for a planned purchase. The cheapest pump price
// is not always the cheapest stop: a detour burns fuel too, priced
// here at fuelPriceForDetour (defaulting to the stop's own price).
// Returns every option with its true total cost, cheapest first,
// and what each one saves against the most expensive option.
function priceCompare({ gallons, options } = {}) {
  assertFiniteNumber(gallons, 'gallons');
  if (gallons <= 0) throw new RangeError('gallons must be greater than 0, got: ' + gallons);
  if (!Array.isArray(options) || options.length === 0) {
    throw new RangeError('priceCompare requires a non-empty options array');
  }

  const priced = options.map((option, i) => {
    if (!option || typeof option !== 'object') {
      throw new RangeError('options[' + i + '] must be an object with name and pricePerGallon');
    }
    if (typeof option.name !== 'string' || option.name.trim() === '') {
      throw new RangeError('options[' + i + '].name must be a non-empty string');
    }
   let pricePerGallon = option.pricePerGallon;

if (pricePerGallon === undefined &&
    option.fuelState !== undefined &&
    option.fuelPriceDate !== undefined) {
  pricePerGallon = fuelPriceForState(
    option.fuelState,
    option.fuelPriceDate
  );
}

assertFiniteNumber(pricePerGallon, 'options[' + i + '].pricePerGallon');
if (pricePerGallon < 0) {
  throw new RangeError('options[' + i + '].pricePerGallon must be 0 or more');
}
    const detourMiles = option.detourMiles === undefined ? 0 : option.detourMiles;
    assertFiniteNumber(detourMiles, 'options[' + i + '].detourMiles');
    if (detourMiles < 0) throw new RangeError('options[' + i + '].detourMiles must be 0 or more');
    let detourCost = 0;
    if (detourMiles > 0) {
      assertFiniteNumber(option.mpg, 'options[' + i + '].mpg (required when detourMiles is set)');
      if (option.mpg <= 0) throw new RangeError('options[' + i + '].mpg must be greater than 0');
     const detourPrice = option.fuelPriceForDetour === undefined
  ? pricePerGallon
  : option.fuelPriceForDetour;
      assertFiniteNumber(detourPrice, 'options[' + i + '].fuelPriceForDetour');
      detourCost = (detourMiles / option.mpg) * detourPrice;
    }
   return {
  name: option.name,
  pricePerGallon,
  detourMiles,
  totalCost: round2(gallons * pricePerGallon + detourCost),
};
  });
  
  const highest = Math.max(...priced.map((o) => o.totalCost));
  for (const option of priced) {
    option.savingsVsHighest = round2(highest - option.totalCost);
  }
  priced.sort((a, b) => a.totalCost - b.totalCost);
  return priced;
}

// Load a dated historical diesel price snapshot.
function loadFuelPrices(snapshotDate) {
  if (typeof snapshotDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate)) {
    throw new RangeError('snapshotDate must use YYYY-MM-DD format');
  }

  const filePath = path.join(
    __dirname,
    'data',
    'fuel-prices',
    snapshotDate + '.json'
  );

  if (!fs.existsSync(filePath)) {
    throw new Error('Fuel price snapshot not found: ' + snapshotDate);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
// Look up a state's historical diesel price by snapshot date.
function fuelPriceForState(state, snapshotDate) {
  if (typeof state !== 'string' || state.trim() === '') {
    throw new RangeError('state must be a non-empty string');
  }

  const snapshot = loadFuelPrices(snapshotDate);
  const price = snapshot.prices[state];

  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    throw new Error(
      'Fuel price not found for state "' + state +
      '" in snapshot ' + snapshotDate
    );
  }

  return price;
}

module.exports = {
  planFuel,
  priceCompare,
  loadFuelPrices,
  fuelPriceForState,
};
