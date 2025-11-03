const WebSocket = require('ws');

console.log('🧪 Testing CEREBRO pipeline detection...');

const ws = new WebSocket('ws://localhost:8081');

ws.on('open', () => {
  console.log('✅ Connected to proxy');
  
  // Send check-active-pipelines request
  ws.send(JSON.stringify({
    type: 'check-active-pipelines'
  }));
  
  console.log('📤 Sent check-active-pipelines request');
});

ws.on('message', (data) => {
  try {
    const response = JSON.parse(data);
    console.log('📥 Received response:', JSON.stringify(response, null, 2));
    
    if (response.type === 'active-pipelines') {
      console.log(`🔍 Found ${response.pipelines.length} active pipeline(s)`);
      if (response.pipelines.length > 0) {
        response.pipelines.forEach(pipeline => {
          console.log(`  📊 ${pipeline.id}: ${pipeline.name} (${pipeline.status})`);
          console.log(`  📈 ${pipeline.progress}`);
        });
      }
    }
    
    ws.close();
  } catch (err) {
    console.error('❌ Error parsing response:', err);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
});