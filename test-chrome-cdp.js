const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');

// Kill any existing Chrome instances
console.log('Closing existing Chrome instances...');
const killChrome = spawn('powershell.exe', ['-Command', 'Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue']);

killChrome.on('close', () => {
  setTimeout(() => {
    console.log('Launching Windows Chrome with remote debugging on port 9222...');

    // Launch Chrome with debugging (direct path to avoid conflicts)
    const chrome = spawn('/mnt/c/Program Files/Google/Chrome/Application/chrome.exe', [
      '--remote-debugging-port=9222',
      '--user-data-dir=C:\\temp\\chrome-debug',
      '--new-window',
      'https://www.google.com'
    ], {
      detached: true,
      stdio: 'ignore'
    });

    chrome.unref();
    console.log('✅ Chrome launched (you should see it on Windows!)');

    // Wait for Chrome to start
    setTimeout(() => {
      console.log('Fetching CDP targets...');

      // Get the WebSocket debugger URL
      http.get('http://localhost:9222/json', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const targets = JSON.parse(data);

        console.log('Available targets:', targets.length);

        if (targets.length === 0) {
          console.error('No targets found!');
          return;
        }

        const pageTarget = targets.find(t => t.type === 'page') || targets[0];
        console.log('Connecting to:', pageTarget.url);
        console.log('WebSocket URL:', pageTarget.webSocketDebuggerUrl);

        // Connect to WebSocket
        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

        ws.on('open', () => {
          console.log('✅ Connected to Chrome DevTools Protocol!');

          // Step 1: Get document title
          ws.send(JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: { expression: 'document.title' }
          }));

          // Step 2: Type in search box (after title)
          setTimeout(() => {
            ws.send(JSON.stringify({
              id: 2,
              method: 'Runtime.evaluate',
              params: {
                expression: `
                  const input = document.querySelector('textarea[name="q"]');
                  if (input) {
                    input.value = 'Hello from WSL automation!';
                    input.focus();
                    'Search box updated';
                  } else {
                    'Search box not found';
                  }
                `
              }
            }));
          }, 2000);
        });

        ws.on('message', (data) => {
          const response = JSON.parse(data);

          if (response.id === 1 && response.result) {
            console.log('✅ Page title:', response.result.result.value);
          }

          if (response.id === 2 && response.result) {
            console.log('✅ Automation result:', response.result.result.value);
            console.log('\n🎉 SUCCESS! Your Windows Chrome is being automated from WSL!');
            console.log('👀 Check the Chrome window - you should see text in the search box.');
            console.log('\nLeaving Chrome open. Press Ctrl+C to exit.');
          }
        });

        ws.on('error', (err) => {
          console.error('WebSocket error:', err);
        });

          } catch (err) {
            console.error('Failed to parse targets:', err.message);
          }
        });
      }).on('error', (err) => {
        console.error('Failed to connect to CDP:', err.message);
      });
    }, 8000); // Wait 8 seconds for Chrome to fully start

  }, 3000); // Wait 3 seconds after killing Chrome
});
