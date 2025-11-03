const WebSocket = require('ws');

// Automate the full game world pipeline setup as requested by the user
async function automateGameWorldPipeline() {
  console.log('🎮 Automating Game World Pipeline Setup...');
  
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
    
    let stepCount = 0;
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'agent-output') {
          stepCount++;
          console.log(`📸 [Step ${stepCount}] Browser action in progress...`);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });
    
    // Step 1: Open the pipeline designer page
    console.log('🌐 Step 1: Opening pipeline designer page...');
    ws.send(JSON.stringify({
      type: 'execute-single-agent',
      agent: 'browser_commander',
      prompt: 'Open browser to http://localhost:3003 (the pipeline designer page)',
      workingDirectory: '/mnt/c/github/claudeplus'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 2: Load the living game world pipeline
    console.log('🏗️ Step 2: Loading the living game world pipeline...');
    ws.send(JSON.stringify({
      type: 'execute-single-agent',
      agent: 'browser_commander',
      prompt: 'Click on the "Load Template" button and select "Living Game World v1" from the template list',
      workingDirectory: '/mnt/c/github/claudeplus'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Add commentator to canvas and arrange nodes
    console.log('🎭 Step 3: Adding commentator and arranging nodes...');
    ws.send(JSON.stringify({
      type: 'execute-single-agent',
      agent: 'browser_commander',
      prompt: 'From the agents panel on the right, find "commentator" and drag it onto the canvas. Position all nodes to fit in the minimum space required so they are all visible and properly connected.',
      workingDirectory: '/mnt/c/github/claudeplus'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 4: Configure the working directory
    console.log('📁 Step 4: Setting working directory...');
    ws.send(JSON.stringify({
      type: 'execute-single-agent',
      agent: 'browser_commander',
      prompt: 'Click on "Pipeline Configuration" button and in the working directory field, enter "c:\\\\github\\\\spaceship-simulator"',
      workingDirectory: '/mnt/c/github/claudeplus'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Enter the comprehensive game development prompt
    console.log('🚀 Step 5: Starting the pipeline with game development prompt...');
    
    const gamePrompt = `Work on our existing docs and systems for superstarships and bring this world to life using our existing game mechanics. We need working player flows from spawn to gathering and crafting and build their ships and their equipment for them. There should be more than just our solar system to explore and become delighted by a quantum universe. We need combat systems and big bads to defeat. We need friendly factions to work with. We need captivating story and characters and reasons to complete ever increasing and meaningful objectives in our EVE Online / Zero Wing 'All your base are belong to us' meme inspired space video game where users have experiences in quantum space while building more and more badass spaceships and tackling bigger and badder guys.`;
    
    ws.send(JSON.stringify({
      type: 'execute-single-agent',
      agent: 'browser_commander',
      prompt: `In the user context/prompt field, enter this comprehensive game development request: "${gamePrompt}" and then click the "Execute Pipeline" button to start the automated game world creation.`,
      workingDirectory: '/mnt/c/github/claudeplus'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 6: Take final screenshot of the running pipeline
    console.log('📸 Step 6: Capturing final pipeline state...');
    ws.send(JSON.stringify({
      type: 'execute-single-agent',
      agent: 'browser_commander',
      prompt: 'Take a screenshot showing the pipeline running with all agents working on the game world creation. Scroll to show as much of the active pipeline as possible.',
      workingDirectory: '/mnt/c/github/claudeplus'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🎉 Game World Pipeline Automation Complete!');
    console.log('🎮 The living game world pipeline should now be running...');
    console.log('🏗️ Agents are working on:');
    console.log('   - Spaceship systems and mechanics');
    console.log('   - Player progression flows');
    console.log('   - Quantum universe exploration');
    console.log('   - Combat systems and enemy design');
    console.log('   - Faction relationships and storylines');
    console.log('   - Progressive objectives and missions');
    console.log('📊 Check the pipeline designer to see agent progress!');
    
    ws.close();
    
  } catch (error) {
    console.error('❌ Automation failed:', error);
  }
}

// Start the automation
automateGameWorldPipeline();