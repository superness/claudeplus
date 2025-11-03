const WebSocket = require('ws');

// Test the browser commander integration with longer wait time
async function testBrowserCommander() {
  console.log('🌐 Testing Browser Commander Integration (Extended)...');
  
  try {
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
    
    let responseCount = 0;
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        responseCount++;
        console.log(`📨 [${responseCount}] Received ${message.type}:`, 
                   message.type === 'agent-output' ? 
                   (message.content.output || message.content.message || message.content.type || 'status') : 
                   'other');
        
        if (message.type === 'agent-output' && message.content.completed) {
          console.log('🎉 Agent completed! Output length:', message.content.output?.length || 0);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });
    
    console.log('🚀 Sending browser command: "Open browser to google.com"');
    
    const testCommand = {
      type: 'execute-single-agent',
      agent: 'browser_commander',
      prompt: 'Open browser to google.com and take a screenshot',
      workingDirectory: '/mnt/c/github/claudeplus'
    };
    
    ws.send(JSON.stringify(testCommand));
    
    // Wait longer for full response
    console.log('⏳ Waiting 30 seconds for response...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    console.log(`✅ Browser Commander test completed. Received ${responseCount} messages.`);
    ws.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testBrowserCommander();