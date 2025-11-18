#!/usr/bin/env node

/**
 * Puppeteer Connect-Only Console Logger
 *
 * USAGE:
 * 1. First, run start-chrome-debug.bat on Windows to launch Chrome with debug port
 * 2. Then run this script from WSL to connect and capture console logs
 *
 * This avoids the WSL→Windows Chrome spawn issues.
 */

const puppeteer = require('puppeteer-core');

const DEBUG_PORT = 9222;

async function main() {
  console.log('=== PUPPETEER CONNECT-ONLY TEST ===\n');

  let browser = null;

  try {
    // Connect to existing Chrome instance
    console.log(`Connecting to Chrome on http://localhost:${DEBUG_PORT}...`);

    browser = await puppeteer.connect({
      browserURL: `http://localhost:${DEBUG_PORT}`,
      defaultViewport: null
    });

    console.log('✅ Connected to Chrome!\n');

    // Get all open pages
    const pages = await browser.pages();
    console.log(`Found ${pages.length} open page(s)`);

    // Find the test page or use the first one
    const page = pages.find(p => p.url().includes('test-console-logging.html')) || pages[0];

    if (!page) {
      throw new Error('No pages found in Chrome');
    }

    console.log(`Using page: ${page.url()}\n`);

    // Set up console log capture
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

    // Reload the page to trigger logs
    console.log('Reloading page to trigger console logs...\n');
    await page.reload({ waitUntil: 'networkidle2' });

    // Wait for delayed logs
    console.log('\nWaiting 3 seconds for delayed logs...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n=== TEST COMPLETE ===');
    console.log('✅ Console logs captured successfully!');
    console.log('\nPress Ctrl+C to disconnect (Chrome will keep running)');

    // Keep running to capture more logs
    await new Promise(() => {}); // Wait forever

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);

    if (error.message.includes('Failed to fetch browser webSocket URL')) {
      console.error('\n💡 SOLUTION:');
      console.error('   1. Make sure Chrome is running with --remote-debugging-port=9222');
      console.error('   2. Run start-chrome-debug.bat on Windows first');
      console.error('   3. Then run this script');
    }

    console.error('\n', error.stack);
  } finally {
    if (browser) {
      console.log('\nDisconnecting from Chrome...');
      await browser.disconnect();
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT, disconnecting...');
  process.exit(0);
});

main();
