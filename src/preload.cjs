const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('star', Object.freeze({
  scan: () => ipcRenderer.invoke('scan'),
  measurements: () => ipcRenderer.invoke('measurements'),
  measure: kind => ipcRenderer.invoke('measure', kind),
  history: () => ipcRenderer.invoke('history'),
  preview: selection => ipcRenderer.invoke('preview', selection),
  apply: token => ipcRenderer.invoke('apply', token),
  telemetry: () => ipcRenderer.invoke('telemetry'),
  undo: id => ipcRenderer.invoke('undo', id),
  settings: key => ipcRenderer.invoke('settings', key),
  export: () => ipcRenderer.invoke('export'),
  onBusyClose: callback => { ipcRenderer.on('operation-running', () => callback()); }
}));
