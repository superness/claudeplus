/**
 * SHA-256 Cryptocurrency Price Provider
 * Fetches prices for SHA-256 algorithm coins from multiple APIs
 */

const { CryptoAPIClient } = require('./api-client');

// Comprehensive SHA-256 algorithm coins list
// Note: Some coins use SHA-256 in conjunction with other algorithms
const SHA256_COINS = {
  // Bitcoin and major forks
  'BTC': {
    name: 'Bitcoin',
    coingeckoId: 'bitcoin',
    coincapId: 'bitcoin',
    algorithm: 'SHA-256',
    category: 'bitcoin'
  },
  'BCH': {
    name: 'Bitcoin Cash',
    coingeckoId: 'bitcoin-cash',
    coincapId: 'bitcoin-cash',
    algorithm: 'SHA-256',
    category: 'bitcoin-fork'
  },
  'BSV': {
    name: 'Bitcoin SV',
    coingeckoId: 'bitcoin-cash-sv',
    coincapId: 'bitcoin-sv',
    algorithm: 'SHA-256',
    category: 'bitcoin-fork'
  },

  // Classic SHA-256 coins
  'NMC': {
    name: 'Namecoin',
    coingeckoId: 'namecoin',
    coincapId: 'namecoin',
    algorithm: 'SHA-256 (merged mining)',
    category: 'classic'
  },
  'PPC': {
    name: 'Peercoin',
    coingeckoId: 'peercoin',
    coincapId: 'peercoin',
    algorithm: 'SHA-256 + PoS hybrid',
    category: 'classic'
  },
  'DGB': {
    name: 'DigiByte',
    coingeckoId: 'digibyte',
    coincapId: 'digibyte',
    algorithm: 'Multi-algo (includes SHA-256)',
    category: 'multi-algo'
  },
  'SYS': {
    name: 'Syscoin',
    coingeckoId: 'syscoin',
    coincapId: 'syscoin',
    algorithm: 'SHA-256 (merged mining)',
    category: 'classic'
  },

  // Mining-focused SHA-256 coins
  'BTCZ': {
    name: 'BitcoinZ',
    coingeckoId: 'bitcoinz',
    coincapId: null,
    algorithm: 'Equihash (not SHA-256)',
    category: 'bitcoin-fork',
    note: 'Often grouped with SHA-256 mining pools'
  },

  // Wrapped/Synthetic (useful for miners tracking value)
  'WBTC': {
    name: 'Wrapped Bitcoin',
    coingeckoId: 'wrapped-bitcoin',
    coincapId: 'wrapped-bitcoin',
    algorithm: 'N/A (ERC-20)',
    category: 'wrapped'
  },

  // Stablecoins pegged to BTC ecosystem
  'RBTC': {
    name: 'RSK Smart Bitcoin',
    coingeckoId: 'rootstock',
    coincapId: null,
    algorithm: 'SHA-256 (merged mining)',
    category: 'sidechain'
  },

  // Commonly grouped with SHA-256 (different algorithms but relevant)
  'LTC': {
    name: 'Litecoin',
    coingeckoId: 'litecoin',
    coincapId: 'litecoin',
    algorithm: 'Scrypt',
    category: 'scrypt',
    note: 'Scrypt algorithm, often grouped with SHA-256 coins'
  },
  'DOGE': {
    name: 'Dogecoin',
    coingeckoId: 'dogecoin',
    coincapId: 'dogecoin',
    algorithm: 'Scrypt (merged mining with LTC)',
    category: 'scrypt',
    note: 'Scrypt algorithm, merged mined with Litecoin'
  },

  // Additional SHA-256 merge-mined coins
  'EMC': {
    name: 'Emercoin',
    coingeckoId: 'emercoin',
    coincapId: 'emercoin',
    algorithm: 'SHA-256 + PoS hybrid',
    category: 'classic'
  },

  // eCash (formerly Bitcoin Cash ABC)
  'XEC': {
    name: 'eCash',
    coingeckoId: 'ecash',
    coincapId: 'ecash',
    algorithm: 'SHA-256',
    category: 'bitcoin-fork'
  }
};

// CoinCap to standard symbol mapping
const COINCAP_SYMBOL_MAP = {
  'bitcoin': 'BTC',
  'bitcoin-cash': 'BCH',
  'bitcoin-sv': 'BSV',
  'namecoin': 'NMC',
  'peercoin': 'PPC',
  'digibyte': 'DGB',
  'syscoin': 'SYS',
  'wrapped-bitcoin': 'WBTC',
  'litecoin': 'LTC',
  'dogecoin': 'DOGE',
  'emercoin': 'EMC',
  'ecash': 'XEC'
};

/**
 * SHA-256 Coin Price Provider
 */
class SHA256PriceProvider {
  constructor(options = {}) {
    this.client = new CryptoAPIClient({
      cache: {
        defaultTTL: options.cacheTTL || 30000,
        cacheDir: options.cacheDir
      },
      timeout: options.timeout || 15000,
      retryAttempts: options.retryAttempts || 3,
      apiKeys: options.apiKeys || {}
    });

    this.coins = options.coins || Object.keys(SHA256_COINS);
    this.currency = options.currency || 'usd';
    this.includeNonSHA256 = options.includeNonSHA256 !== false; // Include Scrypt coins by default

    // Filter to only SHA-256 if requested
    if (!this.includeNonSHA256) {
      this.coins = this.coins.filter(symbol => {
        const coin = SHA256_COINS[symbol];
        return coin && coin.algorithm.includes('SHA-256');
      });
    }

    this.lastPrices = {};
    this.lastUpdate = null;
    this.listeners = [];
    this.updateInterval = options.updateInterval || 30000;
    this.intervalId = null;
  }

  /**
   * Fetch prices from CoinGecko
   */
  async fetchFromCoinGecko() {
    const ids = this.coins
      .map(symbol => SHA256_COINS[symbol]?.coingeckoId)
      .filter(Boolean)
      .join(',');

    const data = await this.client.request('coingecko', '/coins/markets', {
      vs_currency: this.currency,
      ids: ids,
      order: 'market_cap_desc',
      sparkline: 'false',
      price_change_percentage: '1h,24h,7d'
    }, { cacheTTL: 30000 });

    return this.normalizeCoinGeckoData(data);
  }

  /**
   * Fetch prices from CoinCap
   */
  async fetchFromCoinCap() {
    const ids = this.coins
      .map(symbol => SHA256_COINS[symbol]?.coincapId)
      .filter(Boolean)
      .join(',');

    const data = await this.client.request('coincap', '/assets', {
      ids: ids
    }, { cacheTTL: 30000 });

    return this.normalizeCoinCapData(data.data || []);
  }

  /**
   * Normalize CoinGecko response to common format
   */
  normalizeCoinGeckoData(data) {
    const prices = {};

    for (const coin of data) {
      const symbol = Object.keys(SHA256_COINS).find(
        s => SHA256_COINS[s].coingeckoId === coin.id
      );

      if (symbol) {
        prices[symbol] = {
          symbol,
          name: coin.name,
          price: coin.current_price,
          priceUSD: coin.current_price, // Assuming USD for now
          change1h: coin.price_change_percentage_1h_in_currency,
          change24h: coin.price_change_percentage_24h,
          change7d: coin.price_change_percentage_7d_in_currency,
          marketCap: coin.market_cap,
          marketCapRank: coin.market_cap_rank,
          volume24h: coin.total_volume,
          circulatingSupply: coin.circulating_supply,
          totalSupply: coin.total_supply,
          maxSupply: coin.max_supply,
          high24h: coin.high_24h,
          low24h: coin.low_24h,
          ath: coin.ath,
          athDate: coin.ath_date,
          atl: coin.atl,
          atlDate: coin.atl_date,
          image: coin.image,
          lastUpdated: coin.last_updated,
          source: 'coingecko',
          algorithm: SHA256_COINS[symbol].algorithm,
          category: SHA256_COINS[symbol].category
        };
      }
    }

    return prices;
  }

  /**
   * Normalize CoinCap response to common format
   */
  normalizeCoinCapData(data) {
    const prices = {};

    for (const coin of data) {
      const symbol = COINCAP_SYMBOL_MAP[coin.id];

      if (symbol && SHA256_COINS[symbol]) {
        prices[symbol] = {
          symbol,
          name: coin.name,
          price: parseFloat(coin.priceUsd),
          priceUSD: parseFloat(coin.priceUsd),
          change24h: parseFloat(coin.changePercent24Hr),
          marketCap: parseFloat(coin.marketCapUsd),
          marketCapRank: parseInt(coin.rank),
          volume24h: parseFloat(coin.volumeUsd24Hr),
          circulatingSupply: parseFloat(coin.supply),
          maxSupply: coin.maxSupply ? parseFloat(coin.maxSupply) : null,
          vwap24h: parseFloat(coin.vwap24Hr),
          lastUpdated: new Date().toISOString(),
          source: 'coincap',
          algorithm: SHA256_COINS[symbol].algorithm,
          category: SHA256_COINS[symbol].category
        };
      }
    }

    return prices;
  }

  /**
   * Fetch prices with automatic fallback
   */
  async fetchPrices() {
    try {
      // Try CoinGecko first (more detailed data)
      return await this.fetchFromCoinGecko();
    } catch (error) {
      console.warn('CoinGecko failed, trying CoinCap:', error.message);

      try {
        // Fallback to CoinCap
        return await this.fetchFromCoinCap();
      } catch (fallbackError) {
        console.error('All providers failed:', fallbackError.message);
        throw fallbackError;
      }
    }
  }

  /**
   * Update prices and notify listeners
   */
  async updatePrices() {
    try {
      this.lastPrices = await this.fetchPrices();
      this.lastUpdate = new Date();
      this.notifyListeners();
      return this.lastPrices;
    } catch (error) {
      console.error('Price update failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current prices (uses cache if available)
   */
  getPrices() {
    return this.lastPrices;
  }

  /**
   * Get price for specific coin
   */
  getPrice(symbol) {
    return this.lastPrices[symbol.toUpperCase()];
  }

  /**
   * Get coins by category
   */
  getPricesByCategory(category) {
    const result = {};
    for (const [symbol, price] of Object.entries(this.lastPrices)) {
      if (price.category === category) {
        result[symbol] = price;
      }
    }
    return result;
  }

  /**
   * Get only SHA-256 algorithm coins
   */
  getSHA256Only() {
    const result = {};
    for (const [symbol, price] of Object.entries(this.lastPrices)) {
      if (price.algorithm.includes('SHA-256')) {
        result[symbol] = price;
      }
    }
    return result;
  }

  /**
   * Subscribe to price updates
   */
  onUpdate(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify all listeners
   */
  notifyListeners() {
    for (const callback of this.listeners) {
      try {
        callback(this.lastPrices, this.lastUpdate);
      } catch (e) {
        console.error('Listener error:', e);
      }
    }
  }

  /**
   * Start automatic price updates
   */
  startLiveUpdates() {
    if (this.intervalId) return;

    // Initial fetch
    this.updatePrices().catch(e => console.error('Initial fetch failed:', e));

    // Periodic updates
    this.intervalId = setInterval(() => {
      this.updatePrices().catch(e => console.error('Update failed:', e));
    }, this.updateInterval);

    console.log(`Live updates started (every ${this.updateInterval / 1000}s)`);
  }

  /**
   * Stop automatic updates
   */
  stopLiveUpdates() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Live updates stopped');
    }
  }

  /**
   * Get API client status
   */
  getStatus() {
    return {
      ...this.client.getStatus(),
      lastUpdate: this.lastUpdate,
      coinsTracked: Object.keys(this.lastPrices).length,
      isLive: this.intervalId !== null
    };
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.client.clearCache();
  }

  /**
   * Get available coins
   */
  static getAvailableCoins() {
    return SHA256_COINS;
  }

  /**
   * Format helpers
   */
  static formatPrice(price, decimals = 2) {
    if (price === null || price === undefined) return 'N/A';
    if (price >= 1) {
      return `$${price.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })}`;
    }
    return `$${price.toFixed(Math.max(decimals, 8))}`;
  }

  static formatChange(change) {
    if (change === null || change === undefined) return 'N/A';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }

  static formatMarketCap(cap) {
    if (!cap) return 'N/A';
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
    if (cap >= 1e3) return `$${(cap / 1e3).toFixed(2)}K`;
    return `$${cap.toFixed(2)}`;
  }

  static formatVolume(volume) {
    return SHA256PriceProvider.formatMarketCap(volume);
  }
}

module.exports = {
  SHA256PriceProvider,
  SHA256_COINS,
  COINCAP_SYMBOL_MAP
};
