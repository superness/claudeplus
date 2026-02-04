#!/usr/bin/env node

/**
 * Feed Client Screenshot Capture Script
 * Uses Playwright to capture screenshots of the feed-client UI
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'http://localhost:5179';
const SCREENSHOT_DIR = join(__dirname, 'screenshots');

async function captureScreenshots() {
  console.log('Starting screenshot capture...');
  console.log('Target URL:', BASE_URL);

  // Ensure screenshot directory exists
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  try {
    // 1. Capture Main Feed View
    console.log('\n1. Capturing Main Feed View...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for React to render
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'feed-main.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: feed-main.png');

    // 2. Capture Sponsorship Page
    console.log('\n2. Capturing Sponsorship Page...');
    await page.goto(`${BASE_URL}/sponsorship`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'feed-sponsorship.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: feed-sponsorship.png');

    // 3. Capture Discover Page
    console.log('\n3. Capturing Discover Page...');
    await page.goto(`${BASE_URL}/discover`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'feed-discover.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: feed-discover.png');

    // 4. Capture Profile Page
    console.log('\n4. Capturing Profile Page...');
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'feed-profile.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: feed-profile.png');

    // 5. Try to capture a Space View (need to find a valid space ID first)
    console.log('\n5. Capturing Space View...');
    // Navigate to a test space - this might show an error if no space exists
    await page.goto(`${BASE_URL}/space/test-space`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'feed-space-view.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: feed-space-view.png');

    // 6. Capture Create Private Space page
    console.log('\n6. Capturing Create Private Space Page...');
    await page.goto(`${BASE_URL}/create-private-space`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'feed-create-space.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: feed-create-space.png');

    // 7. Capture Settings Page
    console.log('\n7. Capturing Settings Page...');
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'feed-settings.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: feed-settings.png');

    // 8. Capture Mobile View (resize viewport)
    console.log('\n8. Capturing Mobile View...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'feed-mobile.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: feed-mobile.png');

    console.log('\n✓ All screenshots captured successfully!');
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('Error capturing screenshots:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
