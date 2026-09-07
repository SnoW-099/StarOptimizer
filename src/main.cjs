const { app, BrowserWindow, ipcMain, shell, dialog, powerMonitor } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { scan, optimizationAdapter, telemetry } = require('./system.cjs');
const { createOptimizer } = require('./optimizer.cjs');
let window, lastScan, scanning, sampling, mutation = false;
app.setName('StarOptimizer');
const page = pathToFileURL(path.join(__dirname, 'index.html')).href;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.restore(); window?.focus(); });
  app.whenReady().then(() => {
    const optimizer = createOptimizer(app.getPath('userData'), optimizationAdapter);
    const handle = (name, fn) => ipcMain.handle(name, async (event, ...args) => {
      if (event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== page) throw new Error('Origen no permitido.');
      try { return { ok: true, data: await fn(...args) }; }
      catch (e) { return { ok: false, error: e.message }; }
    });
    handle('scan', async () => {
      if (!scanning) scanning = Promise.all([scan(), optimizer.state()]).then(([data, state]) => {
        if (Object.values(state.values).some(value => value === null)) data.errors.push('configuration');
        return lastScan = { ...data, configuration: state, onBattery: powerMonitor.isOnBatteryPower() };
      }).finally(() => scanning = null);
      return scanning;
    });
    handle('history', () => optimizer.history());
    handle('preview', selection => optimizer.preview(selection));
    const mutate = async fn => {
      if (mutation) throw Error('Ya hay una operación en curso.');
      mutation = true;
      try { return await fn(); } finally { mutation = false; }
    };
    handle('apply', token => mutate(() => optimizer.apply(token)));
    handle('undo', id => mutate(() => optimizer.undo(id)));
    handle('telemetry', async () => {
      if (!sampling) sampling = telemetry().finally(() => sampling = null);
      return sampling;
    });
    const settings = { startup: 'ms-settings:startupapps', storage: 'ms-settings:storagesense', gaming: 'ms-settings:gaming-gamemode', update: 'ms-settings:windowsupdate', energy: 'ms-settings:powersleep', display: 'ms-settings:display-advancedgraphics', visual: 'ms-settings:easeofaccess-visualeffects', apps: 'ms-settings:appsfeatures' };
    handle('settings', async key => { if (!Object.hasOwn(settings, key)) throw Error('Acción no permitida.'); await shell.openExternal(settings[key]); });
    handle('export', async () => {
      if (!lastScan) throw Error('Analiza tu PC primero.');
      const choice = await dialog.showSaveDialog(window, { title: 'Guardar diagnóstico', defaultPath: 'StarOptimizer-diagnostico.json', filters: [{ name: 'Diagnóstico JSON', extensions: ['json'] }] });
      if (choice.canceled) return false;
      await fs.writeFile(choice.filePath, JSON.stringify({ ...lastScan, history: await optimizer.history() }, null, 2));
      return true;
    });
    window = new BrowserWindow({ width: 1360, height: 940, minWidth: 920, minHeight: 700, icon: path.join(__dirname, 'assets/icon.png'), backgroundColor: '#f5f5f7', title: 'StarOptimizer', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    window.on('close', event => {
      if (mutation) { event.preventDefault(); window.webContents.send('operation-running'); }
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', e => e.preventDefault());
    window.webContents.session.setPermissionRequestHandler((_w, _p, callback) => callback(false));
    window.loadURL(page);
  });
}
app.on('window-all-closed', () => app.quit());
