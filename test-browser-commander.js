const WebSocket = require('ws');

// Test the browser commander integration
async function testBrowserCommander() {
  console.log('🌐 Testing Browser Commander Integration...');
  
  try {
    // Connect to the proxy server
    const ws = new WebSocket('ws://localhost:8081');
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✅ Connected to proxy server');
        resolve();
      });
      
      ws.on('error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        reject(error);
      });
    });
    
    // Set up message handler
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received message:', message.type);
        
        if (message.type === 'agent-output') {
          console.log('🤖 Agent output:', message.content);
        } else if (message.type === 'error') {
          console.log('❌ Error:', message.content);
        } else if (message.type === 'screenshot') {
          console.log('📸 Screenshot received:', message.content.title);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });
    
    // Send a test browser command
    console.log('🚀 Sending test browser command...');
    
    const testCommand = {
      type: 'execute-single-agent',
      agent: 'browser_commander',
      prompt: 'Take a screenshot of what\'s currently on screen',
      workingDirectory: '/mnt/c/github/claudeplus'
    };
    
    ws.send(JSON.stringify(testCommand));
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('✅ Browser Commander test completed');
    ws.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBrowserCommander();