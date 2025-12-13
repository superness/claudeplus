#!/usr/bin/env node

/**
 * Infographic Viewer Server
 * Serves the infographic viewer and provides an endpoint to generate stories on demand
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const url = require('url');

const PORT = 3005;
const BASE_DIR = '/mnt/c/github/claudeplus';

// MIME type mapping
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

  // Add CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle story generation endpoint
  if (pathname === '/api/generate-story' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { pipelineId } = JSON.parse(body);

        if (!pipelineId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing pipelineId' }));
          return;
        }

        console.log(`[STORY] Generating story for pipeline: ${pipelineId}`);

        // Execute: cd proxy && node test-narrator.js <pipeline-id>
        const narratorProcess = spawn('node', ['test-narrator.js', pipelineId], {
          cwd: path.join(BASE_DIR, 'proxy'),
          stdio: 'inherit' // Show output in console
        });

        // Don't wait for completion - return immediately
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Story generation started',
          pipelineId
        }));

        narratorProcess.on('close', (code) => {
          console.log(`[STORY] Narrator process exited with code ${code}`);
        });

      } catch (error) {
        console.error('[STORY] Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = path.join(BASE_DIR, pathname === '/' ? '/infographic-viewer.html' : pathname);

  // Security check: ensure path is within BASE_DIR
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  // Get MIME type
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Read and serve file
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    console.error('[ERROR] Failed to read file:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`🎨 Infographic Viewer Server running on http://localhost:${PORT}`);
  console.log(`📊 Open: http://localhost:${PORT}/infographic-viewer.html`);
  console.log(`🔌 Story generation API: POST /api/generate-story`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});
