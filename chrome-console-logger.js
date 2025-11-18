#!/usr/bin/env node

/**
 * Chrome Console Logger - Uses Chrome's built-in logging
 *
 * NO CDP, NO WEBSOCKETS, NO PUPPETEER NEEDED!
 * Chrome writes its own debug log. We just read it.
 *
 * Usage:
 *   node chrome-console-logger.js <url> [duration_seconds]
 *
 * Example:
 *   node chrome-console-logger.js http://localhost:8080 10
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse arguments
const url = process.argv[2];
const duration = parseInt(process.argv[3]) || 30; // Default 30 seconds

if (!url) {
  console.error('Usage: node chrome-console-logger.js <url> [duration_seconds]');
  console.error('Example: node chrome-console-logger.js http://localhost:8080 10');
  process.exit(1);
}

// Determine Chrome log location (Windows path accessed from WSL)
// Use an ISOLATED Chrome profile to avoid interfering with existing Chrome sessions
const username = process.env.USER || 'User';
const timestamp = Date.now();
const isolatedProfileDir = `C:\\Users\\${username}\\AppData\\Local\\Temp\\ChromeTestProfile_${timestamp}`;
// Chrome writes chrome_debug.log INSIDE the user-data-dir when --enable-logging is used
const chromeLogPath = `/mnt/c/Users/${username}/AppData/Local/Temp/ChromeTestProfile_${timestamp}/chrome_debug.log`;

console.log('[chrome-logger] === Chrome Console Logger Started ===');
console.log(`[chrome-logger] URL: ${url}`);
console.log(`[chrome-logger] Duration: ${duration} seconds`);
console.log(`[chrome-logger] Chrome profile (isolated): ${isolatedProfileDir}`);
console.log(`[chrome-logger] Chrome log: ${chromeLogPath}`);

// Kill only Chrome instances with testMode=true in URL (safe - won't kill user's normal Chrome)
console.log('[chrome-logger] Clearing any existing test Chrome instances (testMode=true)...');
try {
  const { execSync } = require('child_process');
  // This only targets Chrome with "testMode=true" in command line - user's normal Chrome is safe
  execSync('taskkill /F /FI "COMMANDLINE like %testMode=true%" /IM chrome.exe 2>nul', {
    stdio: 'ignore',
    shell: true
  });
  console.log('[chrome-logger] Cleared old test instances');
} catch (err) {
  // No matching processes - fine
}

console.log('[chrome-logger] NOTE: Using isolated profile + --app mode for clean single-window test');

// Delete old Chrome log file if it exists
try {
  if (fs.existsSync(chromeLogPath)) {
    fs.unlinkSync(chromeLogPath);
    console.log('[chrome-logger] Deleted old chrome_debug.log');
  }
} catch (err) {
  console.log('[chrome-logger] Could not delete old log:', err.message);
}

// Launch Chrome with built-in logging enabled
console.log('[chrome-logger] Launching Chrome with logging enabled...\n');

// Build full Chrome command as a single string for cmd.exe
// Use --app= flag to launch in standalone app mode (prevents tab restoration entirely)
// This creates a minimal browser window with ONLY the specified URL, no tabs, no session restore
const chromeCommand = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --enable-logging --v=1 --no-first-run --no-default-browser-check --user-data-dir="${isolatedProfileDir}" --app="${url}"`;

// Launch Chrome from WSL by calling cmd.exe
const chromeProcess = spawn('cmd.exe', ['/c', chromeCommand], {
  detached: true,
  stdio: 'ignore',
  shell: true
});

chromeProcess.unref();

// Wait for Chrome log file to be created
console.log('[chrome-logger] Waiting for Chrome log file...');
let logFileReady = false;
const maxWait = 10000; // 10 seconds
const startTime = Date.now();

const waitForLog = setInterval(() => {
  if (fs.existsSync(chromeLogPath)) {
    logFileReady = true;
    clearInterval(waitForLog);
    console.log('[chrome-logger] Log file detected!\n');
    startLogCapture();
  } else if (Date.now() - startTime > maxWait) {
    clearInterval(waitForLog);
    console.error('[chrome-logger] ERROR: Log file did not appear within 10 seconds');
    killChrome();
    process.exit(1);
  }
}, 200);

function startLogCapture() {
  const captureStart = Date.now();
  let lastSize = 0;
  const consoleMessages = [];
  const outputFile = path.join(process.cwd(), 'chrome-console-output.json');

  console.log('[chrome-logger] Capturing console output...\n');

  const captureInterval = setInterval(() => {
    try {
      const stats = fs.statSync(chromeLogPath);

      if (stats.size > lastSize) {
        const buffer = Buffer.alloc(stats.size - lastSize);
        const fd = fs.openSync(chromeLogPath, 'r');
        fs.readSync(fd, buffer, 0, stats.size - lastSize, lastSize);
        fs.closeSync(fd);

        const newContent = buffer.toString('utf8');
        const lines = newContent.split('\n');

        lines.forEach(line => {
          // Parse console messages: [pid:tid:timestamp:LEVEL:CONSOLE:line] "message", source: file.js (line)
          const consoleMatch = line.match(/\[.*?CONSOLE.*?\]\s+"(.+?)",\s+source:\s+(.+?)\s+\((\d+)\)/);
          if (consoleMatch) {
            const logEntry = {
              timestamp: new Date().toISOString(),
              message: consoleMatch[1],
              source: consoleMatch[2],
              line: consoleMatch[3]
            };

            consoleMessages.push(logEntry);
            console.log(`[CONSOLE] ${logEntry.message} (${logEntry.source}:${logEntry.line})`);
          }

          // Capture JavaScript errors
          const errorMatch = line.match(/\[.*?ERROR.*?\]\s+(.+)/);
          if (errorMatch && !errorMatch[1].includes('CONSOLE')) {
            console.log(`[ERROR] ${errorMatch[1]}`);
          }
        });

        lastSize = stats.size;
      }

      // Check if duration elapsed
      if (Date.now() - captureStart >= duration * 1000) {
        clearInterval(captureInterval);

        console.log(`\n[chrome-logger] === Capture Complete ===`);
        console.log(`[chrome-logger] Duration: ${duration}s`);
        console.log(`[chrome-logger] Console messages captured: ${consoleMessages.length}`);

        // Save to JSON file
        fs.writeFileSync(outputFile, JSON.stringify(consoleMessages, null, 2));
        console.log(`[chrome-logger] Saved to: ${outputFile}`);

        killChrome();
        process.exit(0);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('[chrome-logger] Error reading log:', err.message);
      }
    }
  }, 100); // Check every 100ms
}

function killChrome() {
  console.log('[chrome-logger] Closing test Chrome instance...');

  // Kill Chrome by finding the process using our specific isolated profile directory
  // This ensures we only kill the test Chrome, not user's main Chrome instances
  const profilePath = isolatedProfileDir.replace(/\\/g, '\\\\');

  try {
    // Use taskkill to kill Chrome processes using our test profile
    // This is safer than killing by PID because it targets only our test instance
    const { execSync } = require('child_process');

    // Kill all Chrome processes with our specific user-data-dir
    execSync(`taskkill /F /FI "COMMANDLINE eq *${profilePath}*" /IM chrome.exe 2>nul`, {
      stdio: 'ignore',
      shell: true
    });

    console.log('[chrome-logger] Test Chrome instance closed');
  } catch (err) {
    // Chrome may have already closed or taskkill not found
    // This is not critical, just log it
    if (err.status !== 128) { // 128 = no matching processes found
      console.log('[chrome-logger] Note: Chrome may have already closed');
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[chrome-logger] Interrupted. Cleaning up...');
  killChrome();
  process.exit(0);
});
