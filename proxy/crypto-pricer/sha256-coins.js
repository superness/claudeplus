/**
 * SHA-256 Altcoin Live Pricer
 * Core module for fetching cryptocurrency prices
 */

const https = require('https');

// SHA-256 algorithm coins (excluding Bitcoin itself)
const SHA256_COINS = {
  // Major SHA-256 forks and coins
  'BCH': { name: 'Bitcoin Cash', coingeckoId: 'bitcoin-cash' },
  'BSV': { name: 'Bitcoin SV', coingeckoId: 'bitcoin-cash-sv' },
  'DGB': { name: 'DigiByte', coingeckoId: 'digibyte' },
  'PPC': { name: 'Peercoin', coingeckoId: 'peercoin' },
  'NMC': { name: 'Namecoin', coingeckoId: 'namecoin' },
  'SYS': { name: 'Syscoin', coingeckoId: 'syscoin' },
  'DOGE': { name: 'Dogecoin', coingeckoId: 'dogecoin' }, // Scrypt but often grouped
  'LTC': { name: 'Litecoin', coingeckoId: 'litecoin' },  // Scrypt but often grouped

  // Include Bitcoin as reference
  'BTC': { name: 'Bitcoin', coingeckoId: 'bitcoin' },
};

// Alternative: CoinGecko API (free, no key required for basic use)
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

class CryptoPricer {
  constructor(options = {}) {
    this.coins = options.coins || Object.keys(SHA256_COINS);
    this.currency = options.currency || 'usd';
    this.updateInterval = options.updateInterval || 30000; // 30 seconds
    this.prices = {};
    this.lastUpdate = null;
    this.listeners = [];
  }

  /**
   * Fetch prices from CoinGecko API
   */
  async fetchPrices() {
    const ids = this.coins
      .map(symbol => SHA256_COINS[symbol]?.coingeckoId)
      .filter(Boolean)
      .join(',');

    const url = `${COINGECKO_API}/coins/markets?vs_currency=${this.currency}&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=1h,24h,7d`;

    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';

        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error));
              return;
            }
            resolve(json);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Update prices and notify listeners
   */
  async updatePrices() {
    try {
      const data = await this.fetchPrices();

      this.prices = {};
      data.forEach(coin => {
        const symbol = Object.keys(SHA256_COINS).find(
          s => SHA256_COINS[s].coingeckoId === coin.id
        );

        if (symbol) {
          this.prices[symbol] = {
            name: coin.name,
            symbol: coin.symbol.toUpperCase(),
            price: coin.current_price,
            change1h: coin.price_change_percentage_1h_in_currency,
            change24h: coin.price_change_percentage_24h,
            change7d: coin.price_change_percentage_7d_in_currency,
            marketCap: coin.market_cap,
            volume24h: coin.total_volume,
            circulatingSupply: coin.circulating_supply,
            high24h: coin.high_24h,
            low24h: coin.low_24h,
            lastUpdated: coin.last_updated,
            image: coin.image
          };
        }
      });

      this.lastUpdate = new Date();
      this.notifyListeners();

      return this.prices;
    } catch (error) {
      console.error('Error fetching prices:', error.message);
      throw error;
    }
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
   * Notify all listeners of price update
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.prices, this.lastUpdate);
      } catch (e) {
        console.error('Listener error:', e);
      }
    });
  }

  /**
   * Start live price updates
   */
  startLiveUpdates() {
    if (this.intervalId) {
      return;
    }

    // Initial fetch
    this.updatePrices();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.updatePrices();
    }, this.updateInterval);
  }

  /**
   * Stop live price updates
   */
  stopLiveUpdates() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get current prices
   */
  getPrices() {
    return this.prices;
  }

  /**
   * Get price for specific coin
   */
  getPrice(symbol) {
    return this.prices[symbol.toUpperCase()];
  }

  /**
   * Format price for display
   */
  static formatPrice(price, decimals = 2) {
    if (price === null || price === undefined) return 'N/A';
    if (price >= 1) {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    }
    // For small prices, show more decimals
    return `$${price.toFixed(Math.max(decimals, 6))}`;
  }

  /**
   * Format percentage change
   */
  static formatChange(change) {
    if (change === null || change === undefined) return 'N/A';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }

  /**
   * Format market cap
   */
  static formatMarketCap(cap) {
    if (!cap) return 'N/A';
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
    return `$${cap.toLocaleString()}`;
  }
}

module.exports = { CryptoPricer, SHA256_COINS };
