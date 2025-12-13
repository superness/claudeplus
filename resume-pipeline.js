#!/usr/bin/env node

/**
 * Resume Pipeline Script
 *
 * Usage: node resume-pipeline.js <pipeline-id>
 * Example: node resume-pipeline.js pipeline_1763596109198
 */

const WebSocket = require('ws');

const pipelineId = process.argv[2];

if (!pipelineId) {
  console.error('Usage: node resume-pipeline.js <pipeline-id>');
  console.error('Example: node resume-pipeline.js pipeline_1763596109198');
  process.exit(1);
}

console.log(`Connecting to proxy server to resume pipeline: ${pipelineId}`);

const ws = new WebSocket('ws://localhost:8081');

ws.on('open', () => {
  console.log('Connected to proxy server');

  // Send resume request
  ws.send(JSON.stringify({
    type: 'resume-pipeline',
    pipelineId: pipelineId
  }));

  console.log(`Resume request sent for pipeline: ${pipelineId}`);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'pipeline-resumed':
        console.log(`\n✅ Pipeline resumed successfully!`);
        console.log(`   Pipeline: ${message.pipelineName}`);
        console.log(`   Current Stage: ${message.currentStage}`);
        console.log(`   Completed: ${message.completedStages}/${message.totalStages} stages`);
        console.log(`   Start Time: ${message.startTime}\n`);
        break;

      case 'pipeline-status':
        const { agent, type: statusType, message: statusMessage } = message.content;
        console.log(`[${agent}] ${statusType}: ${statusMessage}`);
        break;

      case 'agent-output':
        const { agent: outputAgent, stageName, output } = message.content;
        console.log(`\n--- ${outputAgent} (${stageName}) ---`);
        console.log(output.substring(0, 500) + (output.length > 500 ? '...' : ''));
        console.log(`--- End of ${outputAgent} output (${output.length} chars) ---\n`);
        break;

      case 'pipeline-completed':
        console.log(`\n✅ Pipeline completed successfully!`);
        console.log(`   Results: ${message.results.join(', ')}\n`);
        process.exit(0);
        break;

      case 'resume-error':
        console.error(`\n❌ Failed to resume pipeline: ${message.error}\n`);
        process.exit(1);
        break;

      case 'infographic-ready':
        console.log(`📊 Infographic ready: ${message.infographicUrl}`);
        break;

      default:
        // Ignore other message types
        break;
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error(`WebSocket error: ${error.message}`);
  process.exit(1);
});

ws.on('close', () => {
  console.log('Connection closed');
  process.exit(0);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\nClosing connection...');
  ws.close();
  process.exit(0);
});
