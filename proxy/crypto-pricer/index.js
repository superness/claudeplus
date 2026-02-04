/**
 * SHA-256 Altcoin Price API
 * Main entry point for the crypto-pricer module
 */

const { SHA256PriceProvider, SHA256_COINS, COINCAP_SYMBOL_MAP } = require('./sha256-provider');
const { CryptoAPIClient, RateLimiter, CacheManager, API_PROVIDERS } = require('./api-client');

// Re-export the legacy CryptoPricer for backward compatibility
const { CryptoPricer } = require('./sha256-coins');

module.exports = {
  // Primary exports
  SHA256PriceProvider,
  SHA256_COINS,

  // API infrastructure
  CryptoAPIClient,
  RateLimiter,
  CacheManager,
  API_PROVIDERS,

  // Legacy support
  CryptoPricer,

  // Utility mappings
  COINCAP_SYMBOL_MAP,

  // Factory function for quick setup
  createPriceProvider(options = {}) {
    return new SHA256PriceProvider(options);
  }
};
