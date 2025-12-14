/**
 * Trading Service
 * Handles player-to-player resource trading with limits and taxes
 */

const PlayerRepository = require('../data/PlayerRepository');
const config = require('../config');
const { toCamelCase, getDbColumnName } = require('../utils/currency');

// Trading constants
const TRADING_CONFIG = {
  minTradeAmount: 5,
  maxTradeAmount: 50,
  taxRate: 0.10, // 10% tax on trades
  dailyTradeLimit: 5,
  matchesRequiredToUnlock: 50,
  tradeableCurrencies: ['starlightOrbs', 'shadowShards'],
};

class TradingService {
  constructor(db) {
    this.playerRepo = new PlayerRepository(db);
    this.db = db;
  }

  /**
   * Check trading status for player
   */
  async getTradingStatus(playerId) {
    const progress = await this.playerRepo.getProgress(playerId);
    const matchesPlayed = progress.totalMatches;
    const tradingUnlocked = matchesPlayed >= TRADING_CONFIG.matchesRequiredToUnlock;

    // Get today's trade count
    const today = new Date().toISOString().split('T')[0];
    const limitResult = await this.db.query(
      `SELECT trades_today FROM player_trade_limit
       WHERE player_id = $1 AND trade_date = $2`,
      [playerId, today]
    );

    const tradesToday = limitResult.rows[0]?.trades_today || 0;

    return {
      tradingEnabled: tradingUnlocked,
      unlockRequirements: {
        matchesRequired: TRADING_CONFIG.matchesRequiredToUnlock,
        matchesPlayed,
        met: tradingUnlocked,
      },
      dailyLimit: {
        maxTrades: TRADING_CONFIG.dailyTradeLimit,
        tradesToday,
        remaining: Math.max(0, TRADING_CONFIG.dailyTradeLimit - tradesToday),
        resetsAt: this._getNextMidnight(),
      },
      taxRate: TRADING_CONFIG.taxRate,
      tradeableCurrencies: TRADING_CONFIG.tradeableCurrencies,
      limits: {
        minAmount: TRADING_CONFIG.minTradeAmount,
        maxAmount: TRADING_CONFIG.maxTradeAmount,
      },
    };
  }

  /**
   * Execute a trade between players
   */
  async executeTrade({ senderId, receiverUsername, resourceType, amount }) {
    // Validate resource type (normalize to camelCase)
    const normalizedResource = this._normalizeCurrencyName(resourceType);
    if (!TRADING_CONFIG.tradeableCurrencies.includes(normalizedResource)) {
      const error = new Error(`Cannot trade ${resourceType}. Only ${TRADING_CONFIG.tradeableCurrencies.join(', ')} are tradeable.`);
      error.code = 'INVALID_RESOURCE';
      throw error;
    }

    // Validate amount
    if (amount < TRADING_CONFIG.minTradeAmount || amount > TRADING_CONFIG.maxTradeAmount) {
      const error = new Error(`Trade amount must be between ${TRADING_CONFIG.minTradeAmount} and ${TRADING_CONFIG.maxTradeAmount}`);
      error.code = 'INVALID_AMOUNT';
      throw error;
    }

    // Find receiver
    const receiver = await this.playerRepo.findByUsername(receiverUsername);
    if (!receiver) {
      const error = new Error('Receiver not found');
      error.code = 'RECEIVER_NOT_FOUND';
      throw error;
    }

    // Cannot trade with yourself
    if (receiver.playerId === senderId) {
      const error = new Error('Cannot trade with yourself');
      error.code = 'SELF_TRADE';
      throw error;
    }

    // Check trading status for sender
    const senderStatus = await this.getTradingStatus(senderId);
    if (!senderStatus.tradingEnabled) {
      const error = new Error(`Trading requires ${TRADING_CONFIG.matchesRequiredToUnlock} matches played`);
      error.code = 'TRADING_LOCKED';
      throw error;
    }

    if (senderStatus.dailyLimit.remaining <= 0) {
      const error = new Error('Daily trade limit reached');
      error.code = 'DAILY_LIMIT_REACHED';
      throw error;
    }

    // Check sender has sufficient funds
    const senderWallet = await this.playerRepo.getWallet(senderId);
    const senderBalance = senderWallet[normalizedResource] || 0;
    if (senderBalance < amount) {
      const error = new Error(`Insufficient ${normalizedResource}: have ${senderBalance}, need ${amount}`);
      error.code = 'INSUFFICIENT_FUNDS';
      throw error;
    }

    // Calculate tax
    const taxAmount = Math.floor(amount * TRADING_CONFIG.taxRate);
    const amountReceived = amount - taxAmount;

    // Execute trade in transaction
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Deduct from sender
      const newSenderBalance = senderBalance - amount;
      await client.query(
        `UPDATE player_wallet SET ${this._getDbColumnName(normalizedResource)} = $1, updated_at = NOW()
         WHERE player_id = $2`,
        [newSenderBalance, senderId]
      );

      // Add to receiver
      const receiverWallet = await this.playerRepo.getWallet(receiver.playerId);
      const receiverBalance = receiverWallet[normalizedResource] || 0;
      const newReceiverBalance = receiverBalance + amountReceived;
      await client.query(
        `UPDATE player_wallet SET ${this._getDbColumnName(normalizedResource)} = $1, updated_at = NOW()
         WHERE player_id = $2`,
        [newReceiverBalance, receiver.playerId]
      );

      // Record trade
      const tradeResult = await client.query(
        `INSERT INTO trade (sender_id, receiver_id, resource_type, amount_sent, tax_amount, amount_received, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'completed')
         RETURNING trade_id, executed_at`,
        [senderId, receiver.playerId, normalizedResource, amount, taxAmount, amountReceived]
      );

      // Update daily trade counter
      const today = new Date().toISOString().split('T')[0];
      await client.query(
        `INSERT INTO player_trade_limit (player_id, trade_date, trades_today)
         VALUES ($1, $2, 1)
         ON CONFLICT (player_id, trade_date)
         DO UPDATE SET trades_today = player_trade_limit.trades_today + 1`,
        [senderId, today]
      );

      // Record transactions for audit
      await client.query(
        `INSERT INTO wallet_transaction (player_id, txn_type, resource, amount, balance_after, source_id, source_type, description)
         VALUES ($1, 'trade_send', $2, $3, $4, $5, 'trade', $6)`,
        [senderId, normalizedResource, -amount, newSenderBalance, tradeResult.rows[0].trade_id, `Trade to ${receiverUsername}`]
      );

      await client.query(
        `INSERT INTO wallet_transaction (player_id, txn_type, resource, amount, balance_after, source_id, source_type, description)
         VALUES ($1, 'trade_receive', $2, $3, $4, $5, 'trade', $6)`,
        [receiver.playerId, normalizedResource, amountReceived, newReceiverBalance, tradeResult.rows[0].trade_id, `Trade from sender`]
      );

      await client.query('COMMIT');

      return {
        tradeId: tradeResult.rows[0].trade_id,
        senderId,
        receiverId: receiver.playerId,
        resourceType: normalizedResource,
        amountSent: amount,
        taxAmount,
        amountReceived,
        status: 'completed',
        executedAt: tradeResult.rows[0].executed_at,
        walletAfter: await this.playerRepo.getWallet(senderId),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get trade history for player
   */
  async getTradeHistory(playerId, { limit = 20, offset = 0 } = {}) {
    const result = await this.db.query(
      `SELECT t.*,
              sender.username as sender_username,
              receiver.username as receiver_username
       FROM trade t
       JOIN player sender ON t.sender_id = sender.player_id
       JOIN player receiver ON t.receiver_id = receiver.player_id
       WHERE t.sender_id = $1 OR t.receiver_id = $1
       ORDER BY t.executed_at DESC
       LIMIT $2 OFFSET $3`,
      [playerId, limit, offset]
    );

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM trade
       WHERE sender_id = $1 OR receiver_id = $1`,
      [playerId]
    );

    return {
      trades: result.rows.map(row => ({
        tradeId: row.trade_id,
        direction: row.sender_id === playerId ? 'sent' : 'received',
        otherPlayer: row.sender_id === playerId ? row.receiver_username : row.sender_username,
        resourceType: row.resource_type,
        amountSent: row.amount_sent,
        taxAmount: row.tax_amount,
        amountReceived: row.amount_received,
        status: row.status,
        executedAt: row.executed_at,
      })),
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
        hasMore: parseInt(countResult.rows[0].count) > offset + result.rows.length,
      },
    };
  }

  // Private helper methods

  _getNextMidnight() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }

  _normalizeCurrencyName(currency) {
    return toCamelCase(currency);
  }

  _getDbColumnName(camelCaseName) {
    return getDbColumnName(camelCaseName);
  }
}

module.exports = TradingService;
