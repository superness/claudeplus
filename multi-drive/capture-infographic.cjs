const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function captureInfographic() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set viewport to capture full infographic
  await page.setViewport({
    width: 1400,
    height: 1000,
    deviceScaleFactor: 2 // High DPI for crisp screenshot
  });

  // Load the local HTML file
  const htmlPath = path.resolve(__dirname, 'maestro-holistic-infographic.html');
  console.log(`Loading: file://${htmlPath}`);

  await page.goto(`file://${htmlPath}`, {
    waitUntil: 'networkidle0'
  });

  // Wait a moment for any CSS transitions
  await new Promise(r => setTimeout(r, 500));

  // Take screenshot
  const screenshotPath = path.join(__dirname, 'maestro-infographic-screenshot.png');
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });

  console.log(`Screenshot saved to: ${screenshotPath}`);

  await browser.close();
  return screenshotPath;
}

captureInfographic()
  .then(path => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
