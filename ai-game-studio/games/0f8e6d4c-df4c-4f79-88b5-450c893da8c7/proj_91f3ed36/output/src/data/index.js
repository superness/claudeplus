/**
 * Data Access Layer Index
 * Central export for all repositories
 */

const BaseRepository = require('./BaseRepository');
const PlayerRepository = require('./PlayerRepository');
const MatchRepository = require('./MatchRepository');

module.exports = {
  BaseRepository,
  PlayerRepository,
  MatchRepository,
};
