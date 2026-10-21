'use strict';

// truck-dispatch-toolkit
// Calculation library for U.S. truck dispatchers and owner-operators.
// Zero dependencies. Every function is pure and environment-agnostic.

const rates = require('./rates');
const profit = require('./profit');
const hos = require('./hos');
const detention = require('./detention');
const ifta = require('./ifta');
const lanes = require('./lanes');
const broker = require('./broker');
const fuel = require('./fuel');
const checkcall = require('./checkcall');
const accessorials = require('./accessorials');

module.exports = {
  // Namespaced access: toolkit.rates.trueRate(...)
  rates,
  profit,
  hos,
  detention,
  ifta,
  lanes,
  broker,
  fuel,
  checkcall,
  accessorials,
  // Flat access: toolkit.trueRate(...)
  trueRate: rates.trueRate,
  breakEven: rates.breakEven,
  rateVerdict: rates.rateVerdict,
  loadProfit: profit.loadProfit,
  planTrip: hos.planTrip,
  resetAdvice: hos.resetAdvice,
  detentionCharge: detention.detentionCharge,
  claimLetter: detention.claimLetter,
  gallonsByState: ifta.gallonsByState,
  taxEstimate: ifta.taxEstimate,
  IFTA_DEFAULT_RATES: ifta.DEFAULT_RATES,
  createLaneBook: lanes.createLaneBook,
  addLoad: lanes.addLoad,
  laneStats: lanes.laneStats,
  rateGuard: lanes.rateGuard,
  equipmentBreakdown: lanes.equipmentBreakdown,
  laneBookToJSON: lanes.toJSON,
  laneBookFromJSON: lanes.fromJSON,
  scoreBroker: broker.scoreBroker,
  quickPayMath: broker.quickPayMath,
 planFuel: fuel.planFuel,
priceCompare: fuel.priceCompare,
loadFuelPrices: fuel.loadFuelPrices,
fuelPriceForState: fuel.fuelPriceForState,
  planCheckCalls: checkcall.planCheckCalls,
  formatSchedule: checkcall.formatSchedule,
  layoverCharge: accessorials.layoverCharge,
  tonuCharge: accessorials.tonuCharge,
  combinedClaimLetter: accessorials.combinedClaimLetter,
};
