const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendToClaude: (message) => ipcRenderer.send('send-to-claude', message),
  onClaudeResponse: (callback) => ipcRenderer.on('claude-response', callback),
  onProxyConnected: (callback) => ipcRenderer.on('proxy-connected', callback),
  onProxyError: (callback) => ipcRenderer.on('proxy-error', callback),
  
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  
  // DRAGON ORCHESTRATOR POWERS 🐉
  dragonTakeScreenshot: () => ipcRenderer.invoke('dragon-take-screenshot'),
  dragonOrchestrate: (command) => ipcRenderer.invoke('dragon-orchestrate', command)
});