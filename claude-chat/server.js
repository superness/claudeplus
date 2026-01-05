/**
 * Claude Chat - Simple HTTP server to serve the frontend
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3009;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Handle CORS for POST requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle POST to /save-history - writes full chat history to file
  if (req.method === 'POST' && req.url === '/save-history') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { tabName, history, workingDirectory } = JSON.parse(body);

        // Sanitize tab name for filename
        const safeTabName = (tabName || 'default').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const filename = `.chat-history-${safeTabName}.md`;

        // Use working directory if provided, otherwise use a default
        const targetDir = workingDirectory || '/mnt/c/github/developingwithai';
        const filePath = path.join(targetDir, filename);

        // Format history as markdown
        let markdown = `# Chat History: ${tabName || 'Default'}\n\n`;
        markdown += `*Last updated: ${new Date().toISOString()}*\n\n---\n\n`;

        if (history && Array.isArray(history)) {
          for (const msg of history) {
            const role = msg.type === 'user' ? 'H' : 'A';
            markdown += `${role}: ${msg.content}\n\n---\n\n`;
          }
        }

        fs.writeFile(filePath, markdown, (err) => {
          if (err) {
            console.error('Error writing history file:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          } else {
            console.log(`Saved chat history to ${filePath}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, path: filePath }));
          }
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Parse URL
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  // Resolve file path
  const filePath = path.join(ROOT_DIR, urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    // Get MIME type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Serve file
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Claude Chat server running at http://localhost:${PORT}`);
  console.log('Make sure the proxy server is running on port 8081');
});
