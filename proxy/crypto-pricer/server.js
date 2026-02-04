/**
 * Crypto Pricer HTTP Server
 * Serves price data via REST API for the web UI
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { SHA256PriceProvider, SHA256_COINS } = require('./sha256-provider');

const PORT = process.env.PORT || 3020;

// Initialize price provider
const priceProvider = new SHA256PriceProvider({
  updateInterval: 30000,
  cacheTTL: 25000
});

// Content type mapping
const CONTENT_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// CORS headers for API responses
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// JSON response helper
function jsonResponse(res, data, statusCode = 200) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Serve static files
function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // API Routes
  if (pathname === '/api/prices') {
    try {
      const prices = priceProvider.getPrices();

      // If no cached prices, fetch fresh
      if (Object.keys(prices).length === 0) {
        const freshPrices = await priceProvider.fetchPrices();
        jsonResponse(res, {
          success: true,
          data: freshPrices,
          lastUpdate: new Date().toISOString(),
          source: 'fresh'
        });
      } else {
        jsonResponse(res, {
          success: true,
          data: prices,
          lastUpdate: priceProvider.lastUpdate?.toISOString(),
          source: 'cache'
        });
      }
    } catch (error) {
      jsonResponse(res, {
        success: false,
        error: error.message
      }, 500);
    }
    return;
  }

  if (pathname === '/api/prices/refresh') {
    try {
      const prices = await priceProvider.updatePrices();
      jsonResponse(res, {
        success: true,
        data: prices,
        lastUpdate: priceProvider.lastUpdate?.toISOString(),
        source: 'fresh'
      });
    } catch (error) {
      jsonResponse(res, {
        success: false,
        error: error.message
      }, 500);
    }
    return;
  }

  if (pathname === '/api/coins') {
    jsonResponse(res, {
      success: true,
      data: SHA256_COINS
    });
    return;
  }

  if (pathname === '/api/status') {
    jsonResponse(res, {
      success: true,
      data: priceProvider.getStatus()
    });
    return;
  }

  // Serve static files
  if (pathname === '/' || pathname === '/index.html') {
    serveStatic(res, path.join(__dirname, 'display.html'));
    return;
  }

  // Other static files
  const staticPath = path.join(__dirname, pathname);
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    serveStatic(res, staticPath);
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// Start server
server.listen(PORT, () => {
  console.log(`\n🚀 Crypto Pricer Server running at http://localhost:${PORT}`);
  console.log(`   📊 Web UI: http://localhost:${PORT}/`);
  console.log(`   📡 API: http://localhost:${PORT}/api/prices`);
  console.log(`   🔄 Refresh: http://localhost:${PORT}/api/prices/refresh`);
  console.log(`   📋 Coins: http://localhost:${PORT}/api/coins`);
  console.log(`   📈 Status: http://localhost:${PORT}/api/status\n`);

  // Start live updates
  priceProvider.startLiveUpdates();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down...');
  priceProvider.stopLiveUpdates();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { server, priceProvider };
