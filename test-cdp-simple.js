const { spawn } = require('child_process');
const http = require('http');

console.log('Step 1: Launching Windows Chrome with debugging enabled...');

// Launch Chrome with a specific command
const chrome = spawn('cmd.exe', ['/c',
  '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"',
  '--remote-debugging-port=9222',
  '--user-data-dir=C:\\temp\\chrome-debug-test',
  '--new-window',
  'https://www.google.com'
]);

console.log('✅ Chrome launch command sent');
console.log('   You should see a NEW Chrome window open on Windows');
console.log('   (it uses a separate profile at C:\\temp\\chrome-debug-test)');

// Try connecting every second for 15 seconds
let attempts = 0;
const maxAttempts = 15;

const tryConnect = () => {
  attempts++;
  console.log(`\nAttempt ${attempts}/${maxAttempts}: Checking if CDP is ready...`);

  http.get('http://localhost:9222/json', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const targets = JSON.parse(data);
        console.log(`✅ SUCCESS! CDP is ready with ${targets.length} target(s)`);
        console.log('\nAvailable targets:');
        targets.forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.type}: ${t.url}`);
        });
        console.log('\n🎉 Your Windows Chrome is ready for automation!');
        console.log('   The WebSocket URL is:', targets[0]?.webSocketDebuggerUrl);
        process.exit(0);
      } catch (err) {
        console.error('Error parsing response:', err.message);
      }
    });
  }).on('error', (err) => {
    if (attempts >= maxAttempts) {
      console.error('\n❌ Failed to connect after', maxAttempts, 'attempts');
      console.error('   Make sure Chrome launched successfully');
      console.error('   Check if another Chrome instance is using port 9222');
      process.exit(1);
    } else {
      console.log('   Not ready yet... (', err.code, ')');
      setTimeout(tryConnect, 1000);
    }
  });
};

// Start trying to connect after 2 seconds
setTimeout(tryConnect, 2000);
