const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const fs = require('fs');

let mainWindow;
let wsClient;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true, // Restore default frame temporarily
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false // Don't show until ready
  });

  // Remove default menu
  mainWindow.setMenu(null);

  mainWindow.loadFile('src/index.html');
  
  // Show window with fade-in effect once ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.webContents.setZoomFactor(1.0);
  });

  // Connect to WSL proxy after renderer is ready
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      connectToProxy();
    }, 1000); // Longer delay to ensure renderer is fully initialized
  });
}

function connectToProxy() {
  try {
    console.log('[ELECTRON] Attempting to connect to proxy...');
    wsClient = new WebSocket('ws://localhost:8081');
    
    wsClient.on('open', () => {
      console.log('[ELECTRON] WebSocket opened - Connected to WSL proxy');
      // Send immediate connection confirmation
      mainWindow.webContents.send('proxy-connected');
      // Also send after a short delay to ensure renderer is ready
      setTimeout(() => {
        mainWindow.webContents.send('proxy-connected');
      }, 100);
    });
    
    wsClient.on('message', (data) => {
      console.log('[ELECTRON] Received message from proxy:', data.toString());
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'system' && message.content === 'Connected to proxy server') {
          console.log('[ELECTRON] Received system connection confirmation');
          mainWindow.webContents.send('proxy-connected');
        } else {
          mainWindow.webContents.send('claude-response', message);
        }
      } catch (error) {
        console.log('[ELECTRON] Error parsing message:', error);
      }
    });
    
    wsClient.on('error', (error) => {
      console.log('[ELECTRON] Proxy connection error:', error);
      mainWindow.webContents.send('proxy-error', error.message);
    });

    wsClient.on('close', () => {
      console.log('[ELECTRON] Connection to proxy closed');
    });
    
  } catch (error) {
    console.log('[ELECTRON] Failed to connect to proxy:', error);
  }
}

// Handle messages from renderer
ipcMain.on('send-to-claude', (event, message) => {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({ type: 'user-message', content: message }));
  }
});

// Window control handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  console.log('[MAIN] Close button clicked - forcing app exit');
  if (mainWindow) {
    mainWindow.destroy();
  }
  app.quit();
  process.exit(0);
});

// DRAGON ORCHESTRATOR - Screenshot and Vision System
ipcMain.handle('dragon-take-screenshot', async () => {
  if (!mainWindow) return null;
  
  try {
    console.log('[DRAGON] 🐉 Taking screenshot to analyze user experience...');
    
    // Capture the window contents
    const image = await mainWindow.webContents.capturePage();
    const buffer = image.toPNG();
    
    // Save screenshot for the dragon to analyze
    const screenshotPath = path.join(__dirname, '..', 'dragon-vision', `screenshot-${Date.now()}.png`);
    
    // Ensure dragon-vision directory exists
    const dragonDir = path.join(__dirname, '..', 'dragon-vision');
    if (!fs.existsSync(dragonDir)) {
      fs.mkdirSync(dragonDir, { recursive: true });
    }
    
    fs.writeFileSync(screenshotPath, buffer);
    
    console.log('[DRAGON] 🐉 Screenshot captured and saved for dragon analysis:', screenshotPath);
    
    // Return both the path and base64 data for the dragon to analyze
    return {
      path: screenshotPath,
      base64: `data:image/png;base64,${buffer.toString('base64')}`,
      timestamp: Date.now(),
      windowSize: mainWindow.getSize(),
      message: '🐉 Dragon has captured visual evidence of user experience!'
    };
  } catch (error) {
    console.error('[DRAGON] 🐉 Screenshot failed:', error);
    return { error: error.message };
  }
});

// Dragon orchestrator communication
ipcMain.handle('dragon-orchestrate', async (event, data) => {
  console.log('[DRAGON] 🐉 Dragon is orchestrating the experience:', data);
  
  // Send dragon commands through the proxy to affect the multi-agent system
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({ 
      type: 'dragon-command', 
      content: data,
      timestamp: Date.now()
    }));
  }
  
  return { success: true, message: '🐉 Dragon commands transmitted!' };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});