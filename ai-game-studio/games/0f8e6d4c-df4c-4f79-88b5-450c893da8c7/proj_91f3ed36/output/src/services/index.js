/**
 * Services Index
 * Central export for all business logic services
 */

const AuthService = require('./AuthService');
const GameService = require('./GameService');
const EconomyService = require('./EconomyService');
const ProgressionService = require('./ProgressionService');
const TradingService = require('./TradingService');

module.exports = {
  AuthService,
  GameService,
  EconomyService,
  ProgressionService,
  TradingService,
};
