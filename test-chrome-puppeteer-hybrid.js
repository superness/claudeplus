#!/usr/bin/env node

/**
 * Hybrid Chrome + Puppeteer Console Logger
 *
 * Option B: Spawn Windows Chrome with debugging port, then connect Puppeteer
 *
 * Benefits:
 * - Uses actual Windows Chrome (not Chromium)
 * - Puppeteer captures console logs easily
 * - No manual CDP connection code needed
 * - Can still use WebSocket automation
 */

const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;
const TEST_URL = 'file:///C:/github/claudeplus/test-console-logging.html';

let chromeProcess = null;
let browser = null;
let page = null;

async function main() {
  console.log('=== HYBRID CHROME + PUPPETEER TEST ===\n');

  try {
    // Step 1: Launch Windows Chrome with debugging port via cmd.exe
    console.log('Step 1: Launching Windows Chrome on debug port', DEBUG_PORT);
    chromeProcess = spawn('cmd.exe', [
      '/c', 'start', '/min', '',
      CHROME_PATH,
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--user-data-dir=C:\\Temp\\chrome-test-profile',
      TEST_URL
    ]);

    chromeProcess.on('error', (err) => {
      console.error('Chrome spawn error:', err);
    });

    // Wait for Chrome to start and check debug port
    console.log('Waiting for Chrome to start...');

    // Poll for debug port to be ready
    let retries = 10;
    let connected = false;
    while (retries > 0 && !connected) {
      try {
        const response = await fetch(`http://localhost:${DEBUG_PORT}/json/version`);
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Chrome debug port ready - ${data['User-Agent']}`);
          connected = true;
        }
      } catch (err) {
        console.log(`Waiting for port ${DEBUG_PORT}... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries--;
      }
    }

    if (!connected) {
      throw new Error(`Chrome debug port ${DEBUG_PORT} never became ready`);
    }

    // Step 2: Connect Puppeteer to existing Chrome
    console.log('\nStep 2: Connecting Puppeteer to existing Chrome');
    browser = await puppeteer.connect({
      browserURL: `http://localhost:${DEBUG_PORT}`,
      defaultViewport: null
    });

    console.log('✅ Puppeteer connected to Chrome!');

    // Step 3: Get the page (Chrome already opened TEST_URL)
    const pages = await browser.pages();
    page = pages.find(p => p.url().includes('test-console-logging.html')) || pages[0];

    console.log(`\nStep 3: Found page - ${page.url()}\n`);

    // Step 4: Set up console log capture
    console.log('=== CONSOLE LOGS ===\n');

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();

      console.log(`[${type.toUpperCase()}] ${text}`);
      if (location && location.url) {
        console.log(`  └─ ${location.url}:${location.lineNumber}`);
      }
    });

    page.on('pageerror', error => {
      console.error('[PAGE ERROR]', error.message);
    });

    // Step 5: Navigate to test page (triggers console logs)
    console.log('Navigating to test page...\n');
    await page.goto(TEST_URL, { waitUntil: 'networkidle2' });

    // Wait for delayed logs
    console.log('\nWaiting 3 seconds for delayed logs...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n=== TEST COMPLETE ===');
    console.log('✅ Console logs captured successfully!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    if (browser) {
      console.log('\nClosing Puppeteer connection...');
      await browser.disconnect();
    }

    if (chromeProcess) {
      console.log('Killing Chrome process...');
      chromeProcess.kill();
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT, cleaning up...');
  if (browser) await browser.disconnect();
  if (chromeProcess) chromeProcess.kill();
  process.exit(0);
});

main();
