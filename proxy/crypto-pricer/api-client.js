/**
 * Cryptocurrency Price API Client
 * Multi-provider integration with rate limiting and caching
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// API Provider configurations
const API_PROVIDERS = {
  coingecko: {
    name: 'CoinGecko',
    baseUrl: 'https://api.coingecko.com/api/v3',
    rateLimit: {
      requestsPerMinute: 10,  // Free tier conservative limit
      burstLimit: 5
    },
    priority: 1
  },
  coincap: {
    name: 'CoinCap',
    baseUrl: 'https://api.coincap.io/v2',
    rateLimit: {
      requestsPerMinute: 200,  // More generous
      burstLimit: 10
    },
    priority: 2
  }
};

/**
 * Token Bucket Rate Limiter
 * Controls request rate to prevent API throttling
 */
class RateLimiter {
  constructor(options = {}) {
    this.tokensPerInterval = options.tokensPerInterval || 10;
    this.interval = options.interval || 60000; // 1 minute
    this.maxTokens = options.maxTokens || this.tokensPerInterval;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.queue = [];
    this.processing = false;
  }

  refillTokens() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed / this.interval * this.tokensPerInterval);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  async acquire() {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const process = () => {
      this.refillTokens();

      while (this.queue.length > 0 && this.tokens > 0) {
        this.tokens--;
        const resolve = this.queue.shift();
        resolve();
      }

      if (this.queue.length > 0) {
        // Calculate wait time until next token
        const waitTime = Math.ceil(this.interval / this.tokensPerInterval);
        setTimeout(process, waitTime);
      } else {
        this.processing = false;
      }
    };

    process();
  }

  getStatus() {
    this.refillTokens();
    return {
      availableTokens: this.tokens,
      maxTokens: this.maxTokens,
      queueLength: this.queue.length
    };
  }
}

/**
 * Multi-tier Cache Manager
 * Memory cache with file-based persistence
 */
class CacheManager {
  constructor(options = {}) {
    this.memoryCache = new Map();
    this.cacheDir = options.cacheDir || path.join(__dirname, '.cache');
    this.defaultTTL = options.defaultTTL || 30000; // 30 seconds
    this.maxMemoryItems = options.maxMemoryItems || 100;

    // Create cache directory if it doesn't exist
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Load persisted cache on startup
    this.loadPersistedCache();
  }

  generateKey(provider, endpoint, params = {}) {
    const paramStr = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    return `${provider}:${endpoint}:${paramStr}`;
  }

  get(key) {
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key);
      if (Date.now() < entry.expiresAt) {
        return { data: entry.data, source: 'memory' };
      }
      this.memoryCache.delete(key);
    }

    // Check file cache
    const filePath = this.getCacheFilePath(key);
    if (fs.existsSync(filePath)) {
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Date.now() < content.expiresAt) {
          // Promote to memory cache
          this.memoryCache.set(key, content);
          return { data: content.data, source: 'file' };
        }
        // Expired, remove file
        fs.unlinkSync(filePath);
      } catch (e) {
        // Corrupted cache file, ignore
      }
    }

    return null;
  }

  set(key, data, ttl = this.defaultTTL) {
    const entry = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl
    };

    // Memory cache with LRU eviction
    if (this.memoryCache.size >= this.maxMemoryItems) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }
    this.memoryCache.set(key, entry);

    // Persist to file for longer-term storage
    const filePath = this.getCacheFilePath(key);
    try {
      fs.writeFileSync(filePath, JSON.stringify(entry));
    } catch (e) {
      console.warn('Cache write failed:', e.message);
    }
  }

  getCacheFilePath(key) {
    // Create a safe, short filename using hash
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  loadPersistedCache() {
    // With hash-based filenames, we can't reconstruct the original key
    // Cache will be populated on first use instead
    // This avoids issues with the old base64 approach
    try {
      const files = fs.readdirSync(this.cacheDir);
      // Just count existing cache files for logging
      const cacheFileCount = files.filter(f => f.endsWith('.json')).length;
      if (cacheFileCount > 0) {
        console.log(`Found ${cacheFileCount} cache files`);
      }
    } catch (e) {
      // Cache directory might not exist yet
    }
  }

  clear() {
    this.memoryCache.clear();

    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
    } catch (e) {
      // Ignore errors during cleanup
    }
  }

  getStats() {
    return {
      memoryEntries: this.memoryCache.size,
      maxMemoryItems: this.maxMemoryItems
    };
  }
}

/**
 * API Client with multi-provider support
 */
class CryptoAPIClient {
  constructor(options = {}) {
    this.providers = {};
    this.rateLimiters = {};
    this.cache = new CacheManager(options.cache || {});
    this.timeout = options.timeout || 10000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;

    // Initialize providers and rate limiters
    for (const [id, config] of Object.entries(API_PROVIDERS)) {
      this.providers[id] = config;
      this.rateLimiters[id] = new RateLimiter({
        tokensPerInterval: config.rateLimit.requestsPerMinute,
        interval: 60000,
        maxTokens: config.rateLimit.burstLimit
      });
    }

    // API key support (optional)
    this.apiKeys = options.apiKeys || {};
  }

  /**
   * Make HTTP request with timeout
   */
  async httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const defaultHeaders = {
        'User-Agent': 'CryptoPricer/1.0 (SHA256-Altcoin-Tracker)',
        'Accept': 'application/json'
      };

      const request = https.get(url, {
        headers: { ...defaultHeaders, ...options.headers },
        timeout: this.timeout
      }, (res) => {
        let data = '';

        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 429) {
            reject(new Error('RATE_LIMITED'));
            return;
          }

          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }

          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Parse error: ${e.message}`));
          }
        });
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('TIMEOUT'));
      });

      request.on('error', reject);
    });
  }

  /**
   * Execute request with rate limiting and caching
   */
  async request(provider, endpoint, params = {}, options = {}) {
    const cacheKey = this.cache.generateKey(provider, endpoint, params);
    const cacheTTL = options.cacheTTL || 30000;

    // Check cache first
    if (!options.skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        // Return cached data as-is, with metadata for arrays or merged for objects
        const data = cached.data;
        if (Array.isArray(data)) {
          // For arrays, return the array directly (preserve structure)
          return data;
        }
        return { ...data, _cached: true, _cacheSource: cached.source };
      }
    }

    // Acquire rate limit token
    await this.rateLimiters[provider].acquire();

    // Build URL
    const config = this.providers[provider];
    const queryStr = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
    const url = `${config.baseUrl}${endpoint}${queryStr ? '?' + queryStr : ''}`;

    // Add API key if available
    const headers = {};
    if (this.apiKeys[provider]) {
      if (provider === 'coingecko') {
        headers['x-cg-demo-api-key'] = this.apiKeys[provider];
      }
    }

    // Make request with retry logic
    let lastError;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const data = await this.httpRequest(url, { headers });

        // Cache successful response
        this.cache.set(cacheKey, data, cacheTTL);

        return data;
      } catch (error) {
        lastError = error;

        if (error.message === 'RATE_LIMITED') {
          // Exponential backoff for rate limits
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.warn(`Rate limited on ${provider}, waiting ${delay}ms...`);
          await this.sleep(delay);
        } else if (attempt < this.retryAttempts) {
          await this.sleep(this.retryDelay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Request with automatic fallback to alternative providers
   */
  async requestWithFallback(requests) {
    // Sort by priority
    const sortedRequests = [...requests].sort((a, b) =>
      (this.providers[a.provider]?.priority || 99) - (this.providers[b.provider]?.priority || 99)
    );

    let lastError;
    for (const req of sortedRequests) {
      try {
        return await this.request(req.provider, req.endpoint, req.params, req.options);
      } catch (error) {
        lastError = error;
        console.warn(`Provider ${req.provider} failed:`, error.message);
      }
    }

    throw lastError || new Error('All providers failed');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    const status = {
      cache: this.cache.getStats(),
      rateLimiters: {}
    };

    for (const [id, limiter] of Object.entries(this.rateLimiters)) {
      status.rateLimiters[id] = limiter.getStatus();
    }

    return status;
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = {
  CryptoAPIClient,
  RateLimiter,
  CacheManager,
  API_PROVIDERS
};
