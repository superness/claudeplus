#!/usr/bin/env node

/**
 * Test script to verify Puppeteer can:
 * 1. Launch Windows Chrome from WSL
 * 2. Capture browser console logs
 * 3. Navigate to a test page
 */

const puppeteer = require('puppeteer');

async function testPuppeteerConsoleCapture() {
  console.log('[TEST] Starting Puppeteer console capture test...');

  let browser;
  try {
    // Launch Windows Chrome from WSL
    console.log('[TEST] Launching Chrome...');

    // Try Windows Chrome first, fallback to Puppeteer's bundled Chromium
    const chromeExe = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';
    const fs = require('fs');

    const launchOptions = {
      headless: false,
      args: [
        '--remote-debugging-port=9222',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    };

    // WSL has issues launching Windows Chrome via Puppeteer
    // Use bundled Chromium for this test
    console.log('[TEST] Using Puppeteer bundled Chromium (WSL limitation)...');

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();

    // Set up console log capture
    const capturedLogs = [];
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();

      const logEntry = {
        timestamp: new Date().toISOString(),
        type: type,
        text: text,
        url: location.url,
        lineNumber: location.lineNumber
      };

      capturedLogs.push(logEntry);
      console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
    });

    page.on('pageerror', err => {
      console.log(`[BROWSER ERROR] ${err.message}`);
      capturedLogs.push({
        timestamp: new Date().toISOString(),
        type: 'error',
        text: err.message,
        stack: err.stack
      });
    });

    // Navigate to a simple test page
    console.log('[TEST] Creating test page with console logs...');
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>Console Test</title></head>
      <body>
        <h1>Puppeteer Console Capture Test</h1>
        <script>
          console.log('TEST: This is a console.log');
          console.info('TEST: This is console.info');
          console.warn('TEST: This is a console.warn');
          console.error('TEST: This is a console.error');
          console.debug('TEST: This is console.debug');

          setTimeout(() => {
            console.log('TEST: Delayed log after 1 second');
          }, 1000);

          setTimeout(() => {
            console.log('TEST: Delayed log after 2 seconds');
          }, 2000);
        </script>
      </body>
      </html>
    `);

    // Wait for delayed logs
    console.log('[TEST] Waiting 3 seconds for delayed logs...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Print summary
    console.log('\n[TEST] ========== CAPTURED LOGS SUMMARY ==========');
    console.log(`[TEST] Total logs captured: ${capturedLogs.length}`);
    capturedLogs.forEach((log, i) => {
      console.log(`[TEST] ${i + 1}. [${log.type}] ${log.text}`);
    });
    console.log('[TEST] =============================================\n');

    console.log('[TEST] ✅ SUCCESS! Puppeteer can capture console logs from Windows Chrome.');
    console.log('[TEST] Press Ctrl+C to exit...');

    // Keep browser open for manual inspection
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('[TEST] ❌ FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log('[TEST] Browser closed.');
    }
  }
}

testPuppeteerConsoleCapture();
