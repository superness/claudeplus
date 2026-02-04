#!/usr/bin/env node

/**
 * Build Visualizer Server
 * Serves the build visualizer HTML and provides API to read build state
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3008;
const BUILD_STATE_PATH = '/mnt/c/github/claudeplus/multi-drive/feature-owner-system/build-state.json';
const VISUALIZER_PATH = path.join(__dirname, 'build-visualizer.html');

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Serve build state JSON
  if (url.pathname === '/api/state' || url.pathname === '/api/file') {
    try {
      const filePath = url.searchParams.get('path') || BUILD_STATE_PATH;
      const data = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Serve HTML
  if (url.pathname === '/' || url.pathname === '/build-visualizer.html') {
    try {
      const html = fs.readFileSync(VISUALIZER_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading visualizer: ' + err.message);
    }
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║          BUILD VISUALIZER SERVER                           ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  🌐 Open in browser:  http://localhost:${PORT}              ║
║                                                            ║
║  📊 Watching:  build-state.json                            ║
║  🔄 Auto-refresh:  Every 2 seconds                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
});
