#!/usr/bin/env node

/**
 * Build Visualizer Screenshot Capture Script
 * Uses Playwright to capture screenshots of the Build Visualizer UI
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'http://localhost:3008';
const SCREENSHOT_DIR = join(__dirname, 'screenshots');

async function captureScreenshots() {
  console.log('Starting Build Visualizer screenshot capture...');
  console.log('Target URL:', BASE_URL);

  // Ensure screenshot directory exists
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  try {
    // Capture Build Visualizer
    console.log('\nCapturing Build Visualizer...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // Wait for any animations

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `build-visualizer-${timestamp}.png`;

    await page.screenshot({
      path: join(SCREENSHOT_DIR, filename),
      fullPage: true
    });
    console.log(`   ✓ Saved: ${filename}`);

    console.log('\n✓ Screenshot captured successfully!');
    console.log(`Screenshot saved to: ${join(SCREENSHOT_DIR, filename)}`);

  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
