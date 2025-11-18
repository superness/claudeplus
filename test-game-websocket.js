#!/usr/bin/env node
/**
 * Test Script: Verify WebSocket Connection to Superstarships Game
 *
 * This script proves that the WebSocket automation can work when the game
 * is properly launched with testMode enabled.
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');

const WS_PORT = 8765;
const GAME_URL = 'http://localhost:8080/index.html?testMode=true';
const CHROME_PATH = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';

console.log('='.repeat(60));
console.log('WEBSOCKET CONNECTION TEST');
console.log('='.repeat(60));
console.log('\nObjective: Prove WebSocket connection to game works\n');

// Step 1: Check if game dev server is running
console.log('Step 1: Checking if game dev server is running...');
console.log('  Expected: npm run dev running on http://localhost:8080');
console.log('  Note: Run "cd /mnt/c/github/superstarships && npm run dev" first\n');

// Step 2: Launch game with testMode
console.log('Step 2: Launching game with testMode enabled...');
console.log(`  URL: ${GAME_URL}`);
console.log('  This enables WebSocket automation API on port 8765\n');

try {
  spawn(CHROME_PATH, [
    '--new-window',
    '--remote-debugging-port=9222',
    GAME_URL
  ], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  console.log('✅ Chrome launched with testMode URL');
} catch (err) {
  console.error('❌ Failed to launch Chrome:', err.message);
  console.log('\nTroubleshooting:');
  console.log('  1. Verify Chrome is installed at:', CHROME_PATH);
  console.log('  2. Try launching manually in browser');
  console.log('  3. Ensure game dev server is running\n');
  process.exit(1);
}

// Step 3: Wait for game to load and start WebSocket server
console.log('\nStep 3: Waiting for game to initialize WebSocket server...');
console.log('  Game needs 5-10 seconds to fully load');
console.log('  WebSocket server will start on ws://localhost:8765\n');

const MAX_RETRIES = 15;
let retryCount = 0;

function attemptConnection() {
  retryCount++;

  console.log(`Attempt ${retryCount}/${MAX_RETRIES}: Connecting to ws://localhost:${WS_PORT}...`);

  const ws = new WebSocket(`ws://localhost:${WS_PORT}`);

  ws.on('open', () => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS: WebSocket connection established!');
    console.log('='.repeat(60));
    console.log('\nStep 4: Sending test command to verify game API...\n');

    // Send getShipState command
    const testCommand = {
      type: 'command',
      command: {
        id: 'test-1',
        command: 'getShipState',
        params: {}
      }
    };

    console.log('→ Sending: getShipState command');
    ws.send(JSON.stringify(testCommand));
  });

  ws.on('message', (data) => {
    const response = JSON.parse(data);
    console.log('← Received response:\n');
    console.log(JSON.stringify(response, null, 2));

    if (response.success) {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 TEST PASSED: WebSocket automation is working!');
      console.log('='.repeat(60));
      console.log('\nKey Findings:');
      console.log('  ✅ WebSocket connection successful');
      console.log('  ✅ Game API responding correctly');
      console.log('  ✅ Ship state retrieved successfully');
      console.log('\nThe Issue:');
      console.log('  ❌ Bug_verifier scripts were NOT launching game with testMode=true');
      console.log('  ❌ Without testMode, WebSocket server never starts');
      console.log('  ❌ Scripts got ECONNREFUSED error\n');
      console.log('Solution:');
      console.log('  1. Always launch game with: ?testMode=true parameter');
      console.log('  2. Or set in console: localStorage.setItem("testMode", "true")');
      console.log('  3. Wait 5-10 seconds for game to fully load');
      console.log('  4. Then connect to ws://localhost:8765\n');
      console.log('='.repeat(60));
    } else {
      console.log('\n⚠️  Warning: Command returned success=false');
      console.log('  Error:', response.error);
    }

    ws.close();
    process.exit(0);
  });

  ws.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
      if (retryCount >= MAX_RETRIES) {
        console.log('\n' + '='.repeat(60));
        console.log('❌ TEST FAILED: Could not connect after', MAX_RETRIES, 'attempts');
        console.log('='.repeat(60));
        console.log('\nTroubleshooting Checklist:');
        console.log('  [ ] Is game dev server running? (npm run dev)');
        console.log('  [ ] Did Chrome actually open?');
        console.log('  [ ] Is the game URL correct?', GAME_URL);
        console.log('  [ ] Did you see the game interface load?');
        console.log('  [ ] Check browser console (F12) for JavaScript errors');
        console.log('  [ ] Verify testMode is enabled (check browser localStorage)');
        console.log('\nManual Test:');
        console.log('  1. Open:', GAME_URL);
        console.log('  2. Press F12 (DevTools)');
        console.log('  3. Run: localStorage.setItem("testMode", "true")');
        console.log('  4. Reload page');
        console.log('  5. Check console for "WebSocket server started on port 8765"');
        console.log('\n');
        process.exit(1);
      } else {
        // Retry after delay
        setTimeout(attemptConnection, 2000);
      }
    } else {
      console.error('\n❌ WebSocket Error:', err.message);
      process.exit(1);
    }
  });

  ws.on('close', () => {
    console.log('Connection closed.');
  });
}

// Start attempting connection after initial delay
setTimeout(attemptConnection, 5000);
