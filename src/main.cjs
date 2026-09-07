const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { scan, createPowerManager } = require('./system.cjs');
let window, lastScan, scanning;
app.setName('StarOptimizer');
const page = pathToFileURL(path.join(__dirname, 'index.html')).href;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.restore(); window?.focus(); });
  app.whenReady().then(() => {
    const energy = createPowerManager(app.getPath('userData'));
    const handle = (name, fn) => ipcMain.handle(name, async (event, ...args) => {
      if (event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== page) throw new Error('Origen no permitido.');
      try { return { ok: true, data: await fn(...args) }; }
      catch (e) { return { ok: false, error: e.message }; }
    });
    handle('scan', async () => {
      if (!scanning) scanning = scan().then(data => lastScan = data).finally(() => scanning = null);
      return scanning;
    });
    handle('history', () => energy.read());
    handle('apply', async id => {
      if (typeof id !== 'string') throw Error('Plan no válido.');
      const answer = await dialog.showMessageBox(window, { type: 'question', title: 'Cambiar plan de energía', message: '¿Aplicar este plan de energía?', detail: 'Afecta al consumo, la temperatura y la autonomía. No garantiza más FPS. Guardaremos el plan actual para restaurarlo. No se borrarán archivos.', buttons: ['Cancelar', 'Aplicar cambio'], defaultId: 0, cancelId: 0 });
      if (answer.response !== 1) return null;
      return energy.apply(id);
    });
    handle('undo', id => { if (typeof id !== 'string') throw Error('Cambio no válido.'); return energy.undo(id); });
    const settings = { startup: 'ms-settings:startupapps', storage: 'ms-settings:storagesense', gaming: 'ms-settings:gaming-gamemode', update: 'ms-settings:windowsupdate', energy: 'ms-settings:powersleep' };
    handle('settings', async key => { if (!Object.hasOwn(settings, key)) throw Error('Acción no permitida.'); await shell.openExternal(settings[key]); });
    handle('export', async () => {
      if (!lastScan) throw Error('Analiza tu PC primero.');
      const choice = await dialog.showSaveDialog(window, { title: 'Guardar diagnóstico', defaultPath: 'StarOptimizer-diagnostico.json', filters: [{ name: 'Diagnóstico JSON', extensions: ['json'] }] });
      if (choice.canceled) return false;
      await fs.writeFile(choice.filePath, JSON.stringify(lastScan, null, 2));
      return true;
    });
    window = new BrowserWindow({ width: 1360, height: 940, minWidth: 960, minHeight: 700, icon: path.join(__dirname, 'assets/icon.png'), backgroundColor: '#0c0e12', title: 'StarOptimizer', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', e => e.preventDefault());
    window.webContents.session.setPermissionRequestHandler((_w, _p, callback) => callback(false));
    window.loadURL(page);
  });
}
app.on('window-all-closed', () => app.quit());
