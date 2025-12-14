/**
 * Economy Service
 * Handles wallet, transactions, and currency conversion
 */

const PlayerWallet = require('../models/PlayerWallet');
const PlayerRepository = require('../data/PlayerRepository');
const { toCamelCase } = require('../utils/currency');

class EconomyService {
  constructor(db) {
    this.playerRepo = new PlayerRepository(db);
  }

  /**
   * Get player wallet
   */
  async getWallet(playerId) {
    const wallet = await this.playerRepo.getWallet(playerId);
    if (!wallet) {
      const error = new Error('Wallet not found');
      error.code = 'NOT_FOUND';
      throw error;
    }
    return wallet;
  }

  /**
   * Add currency to wallet
   */
  async addCurrency(playerId, currency, amount, source = {}) {
    const wallet = await this.getWallet(playerId);

    // Apply cap for rare currencies
    const cap = PlayerWallet.CAPS[currency];
    const currentAmount = wallet[currency] || 0;
    let actualAmount = amount;

    if (cap !== undefined) {
      actualAmount = Math.min(amount, cap - currentAmount);
    }

    if (actualAmount <= 0) {
      return { wallet, amountAdded: 0, capped: amount > actualAmount };
    }

    const newBalance = currentAmount + actualAmount;

    await this.playerRepo.updateWallet(playerId, { [currency]: newBalance });

    // Record transaction
    await this._recordTransaction({
      playerId,
      type: source.type || 'reward',
      resource: currency,
      amount: actualAmount,
      balanceAfter: newBalance,
      sourceId: source.id,
      sourceType: source.sourceType,
      description: source.description,
    });

    return {
      wallet: await this.getWallet(playerId),
      amountAdded: actualAmount,
      capped: amount > actualAmount,
    };
  }

  /**
   * Spend currency from wallet
   */
  async spendCurrency(playerId, currency, amount, source = {}) {
    const wallet = await this.getWallet(playerId);

    const currentAmount = wallet[currency] || 0;
    if (currentAmount < amount) {
      const error = new Error(`Insufficient ${currency}: have ${currentAmount}, need ${amount}`);
      error.code = 'INSUFFICIENT_FUNDS';
      throw error;
    }

    const newBalance = currentAmount - amount;
    await this.playerRepo.updateWallet(playerId, { [currency]: newBalance });

    // Record transaction
    await this._recordTransaction({
      playerId,
      type: source.type || 'purchase',
      resource: currency,
      amount: -amount,
      balanceAfter: newBalance,
      sourceId: source.id,
      sourceType: source.sourceType,
      description: source.description,
    });

    return { wallet: await this.getWallet(playerId) };
  }

  /**
   * Get transaction history
   */
  async getTransactions({ playerId, limit = 50, offset = 0, filters = {} }) {
    let query = `SELECT * FROM wallet_transaction WHERE player_id = $1`;
    const params = [playerId];
    let paramIndex = 2;

    if (filters.type) {
      query += ` AND txn_type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }
    if (filters.currency) {
      query += ` AND resource = $${paramIndex}`;
      params.push(filters.currency);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.playerRepo.query(query, params);

    const countResult = await this.playerRepo.query(
      `SELECT COUNT(*) as count FROM wallet_transaction WHERE player_id = $1`,
      [playerId]
    );

    return {
      transactions: result.rows.map(this._mapTransaction),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Convert currencies
   * Supports both camelCase (cosmicEssence) and snake_case (cosmic_essence) currency names
   */
  async convertCurrency({ playerId, fromCurrency, toCurrency, amount }) {
    // Normalize currency names to camelCase for internal use
    const normalizedFrom = this._normalizeCurrencyName(fromCurrency);
    const normalizedTo = this._normalizeCurrencyName(toCurrency);

    // Define conversion rates using camelCase (intentionally inefficient)
    const rates = {
      'cosmicEssence:starlightOrbs': { rate: '50:1', ratio: 1 / 50 },
      'cosmicEssence:shadowShards': { rate: '50:1', ratio: 1 / 50 },
      'starlightOrbs:cosmicEssence': { rate: '1:25', ratio: 25 },
      'shadowShards:cosmicEssence': { rate: '1:25', ratio: 25 },
    };

    const key = `${normalizedFrom}:${normalizedTo}`;
    const conversion = rates[key];

    if (!conversion) {
      const error = new Error('Invalid conversion pair');
      error.code = 'INVALID_CONVERSION';
      throw error;
    }

    // Check sufficient balance
    const wallet = await this.getWallet(playerId);
    const fromAmount = wallet[normalizedFrom] || 0;

    if (fromAmount < amount) {
      const error = new Error(`Insufficient ${normalizedFrom}`);
      error.code = 'INSUFFICIENT_FUNDS';
      throw error;
    }

    const toAmount = Math.floor(amount * conversion.ratio);

    // Execute conversion using normalized currency names
    await this.spendCurrency(playerId, normalizedFrom, amount, {
      type: 'conversion',
      description: `Converted to ${normalizedTo}`,
    });

    await this.addCurrency(playerId, normalizedTo, toAmount, {
      type: 'conversion',
      description: `Converted from ${normalizedFrom}`,
    });

    return {
      toAmount,
      rate: conversion.rate,
      walletAfter: await this.getWallet(playerId),
    };
  }

  // Private helper methods

  async _recordTransaction(data) {
    await this.playerRepo.query(
      `INSERT INTO wallet_transaction
       (player_id, txn_type, resource, amount, balance_after, source_id, source_type, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        data.playerId,
        data.type,
        data.resource,
        data.amount,
        data.balanceAfter,
        data.sourceId,
        data.sourceType,
        data.description,
      ]
    );
  }

  _mapTransaction(row) {
    return {
      txnId: row.txn_id,
      txnType: row.txn_type,
      resource: row.resource,
      amount: row.amount,
      balanceAfter: row.balance_after,
      sourceType: row.source_type,
      sourceId: row.source_id,
      description: row.description,
      createdAt: row.created_at,
    };
  }

  /**
   * Normalize currency name to camelCase
   */
  _normalizeCurrencyName(currency) {
    return toCamelCase(currency);
  }
}

module.exports = EconomyService;
