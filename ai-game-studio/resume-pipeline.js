#!/usr/bin/env node
/**
 * Resume Pipeline Script for AI Game Studio
 * Reconnects to the proxy and resumes an interrupted pipeline
 */

const WebSocket = require('ws');

const PROXY_URL = 'ws://localhost:8081';
const PIPELINE_ID = process.argv[2] || 'pipeline_1765642039173'; // Default to the tic-tac-toe pipeline

console.log(`\n🔄 Resuming pipeline: ${PIPELINE_ID}\n`);

const ws = new WebSocket(PROXY_URL);

ws.on('open', () => {
  console.log('✅ Connected to proxy server');

  // Send resume request
  ws.send(JSON.stringify({
    type: 'resume-pipeline',
    pipelineId: PIPELINE_ID
  }));

  console.log(`📤 Sent resume request for ${PIPELINE_ID}`);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());

    switch (msg.type) {
      case 'pipeline-resumed':
        console.log(`\n✅ Pipeline Resumed!`);
        console.log(`   Name: ${msg.pipelineName}`);
        console.log(`   Progress: ${msg.completedStages}/${msg.totalStages} stages`);
        console.log(`   Current Stage: ${msg.currentStage}`);
        console.log(`   Started: ${msg.startTime}`);
        console.log(`\n📊 Watching progress...\n`);
        break;

      case 'resume-error':
        console.error(`\n❌ Resume failed: ${msg.error}`);
        process.exit(1);
        break;

      case 'infographic-ready':
        console.log(`📊 Infographic: ${msg.infographicPath}`);
        break;

      case 'pipeline-update':
        console.log(`🔄 Stage update: ${msg.stage || msg.message}`);
        break;

      case 'stage-started':
        console.log(`▶️  Started: ${msg.stageName || msg.stageId}`);
        break;

      case 'stage-completed':
        console.log(`✅ Completed: ${msg.stageName || msg.stageId}`);
        if (msg.decision) {
          console.log(`   Decision: ${msg.decision}`);
        }
        break;

      case 'pipeline-completed':
        console.log(`\n🎉 Pipeline Completed!`);
        console.log(`   Total stages: ${msg.totalStages}`);
        console.log(`   Duration: ${msg.duration || 'N/A'}`);
        ws.close();
        process.exit(0);
        break;

      case 'pipeline-error':
        console.error(`\n❌ Pipeline error: ${msg.error}`);
        break;

      default:
        // Log other messages for debugging
        if (msg.content) {
          console.log(`📝 ${msg.type}: ${msg.content.substring(0, 100)}...`);
        }
    }
  } catch (err) {
    // Non-JSON message
    console.log(`📨 ${data.toString().substring(0, 100)}`);
  }
});

ws.on('error', (error) => {
  console.error(`❌ WebSocket error: ${error.message}`);
  console.log('\n💡 Make sure the proxy server is running: cd ../proxy && node server.js');
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n🔌 Disconnected from proxy');
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⏸️  Pausing... Pipeline state is saved and can be resumed later.');
  ws.close();
  process.exit(0);
});
