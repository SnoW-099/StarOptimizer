const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('star', Object.freeze({
  scan: () => ipcRenderer.invoke('scan'),
  history: () => ipcRenderer.invoke('history'),
  apply: id => ipcRenderer.invoke('apply', id),
  undo: id => ipcRenderer.invoke('undo', id),
  settings: key => ipcRenderer.invoke('settings', key),
  export: () => ipcRenderer.invoke('export')
}));
