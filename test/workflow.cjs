// Exercises the real renderer and transaction engine against an isolated Windows adapter.
// No test-only switches or mutation bypasses are exposed by the shipped application.
const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'star-workflow-'));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const launch = process.argv[2] ? { executablePath: path.resolve(process.argv[2]), args: [] } : { args: [path.join(__dirname, '..')] };
  const app = await electron.launch({ ...launch, env });
  try {
    const page = await app.firstWindow();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.waitForSelector('#scan');
    await app.evaluate(async ({ app, ipcMain }, directory) => {
      const requireModule = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json');
      const { createOptimizer } = requireModule('./src/optimizer.cjs');
      const A = '381b4222-f694-41f0-9685-ff5bb260df2e', B = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
      const values = { power: A, animations: true, menuAnimation: true, comboAnimation: true };
      const testState = { fail: false, values, calls: [] };
      const adapter = {
        snapshot: async () => ({ values: { ...values }, plans: [{ id: A, name: 'Equilibrado', active: values.power === A }, { id: B, name: 'Alto rendimiento', active: values.power === B }] }),
        set: async (key, value) => { await new Promise(r => setTimeout(r, 150)); if (testState.fail && key === 'menuAnimation' && value === false) throw Error('Permiso de prueba denegado'); values[key] = value; testState.calls.push([key, value]); }
      };
      const manager = createOptimizer(directory, adapter);
      const scan = async () => ({ at: new Date().toISOString(), platform: 'Windows de prueba', cpu: [{ Name: 'CPU de prueba', LoadPercentage: 21 }], memory: { total: 17179869184, free: 8589934592 }, uptime: 7200, disks: [{ DeviceID: 'C:', Size: 500e9, FreeSpace: 200e9 }], processes: [{ ProcessName: '<img src=x onerror=alert(1)>', Count: 3, WorkingSet64: 3e8 }], startup: [{ Name: 'Aplicación de prueba', Location: 'Inicio de sesión' }], gpu: [], errors: [], configuration: await adapter.snapshot(), onBattery: false });
      const methods = { scan, preview: x => manager.preview(x), apply: x => manager.apply(x), undo: x => manager.undo(x), history: () => manager.history() };
      for (const [name, fn] of Object.entries(methods)) {
        ipcMain.removeHandler(name);
        ipcMain.handle(name, async (_event, value) => { try { return { ok: true, data: await fn(value) }; } catch (e) { return { ok: false, error: e.message }; } });
      }
      global.starWorkflow = testState;
    }, dir);
    await page.click('#scan');
    await page.waitForSelector('#scan-results:not([hidden])');
    await page.click('#scan-return');
    await page.waitForFunction(() => document.querySelector('#cpu-detail').textContent === 'CPU de prueba');
    await page.click('[data-view="recommendations"]');
    await page.click('[data-profile="fluid"]');
    await page.click('#review');
    await page.waitForSelector('#review-dialog[open]');
    await page.click('#cancel-review');
    assert.equal(await app.evaluate(() => global.starWorkflow.calls.length), 0);
    await page.click('#review'); await page.click('#confirm-apply');
    await page.waitForSelector('#operation:not([hidden])');
    assert.equal(await page.locator('main').evaluate(el => el.inert), true);
    await page.waitForSelector('#operation', { state: 'hidden' });
    assert.deepEqual(await app.evaluate(() => Object.values(global.starWorkflow.values).slice(1)), [false, false, false]);
    await page.click('[data-view="history"]');
    await page.getByRole('button', { name: 'Restaurar valores originales' }).click();
    await page.waitForSelector('#operation', { state: 'hidden' });
    assert.deepEqual(await app.evaluate(() => Object.values(global.starWorkflow.values).slice(1)), [true, true, true]);
    assert.ok((await page.textContent('#history-list')).includes('Restaurado'));
    await app.evaluate(() => global.starWorkflow.fail = true);
    await page.click('[data-view="recommendations"]'); await page.click('[data-profile="fluid"]');
    await page.click('#review'); await page.click('#confirm-apply');
    await page.waitForSelector('#operation', { state: 'hidden' });
    await page.waitForSelector('#history:not([hidden])');
    assert.deepEqual(await app.evaluate(() => Object.values(global.starWorkflow.values).slice(1)), [true, true, true]);
    assert.ok((await page.textContent('#history-list')).includes('Recuperado automáticamente'));
    await fs.mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/history-workflow.png', fullPage: true });
    await page.click('[data-view="processes"]');
    assert.equal(await page.locator('#process-list img').count(), 0);
    assert.ok((await page.textContent('#process-list')).includes('<img src=x'));
    assert.deepEqual(errors, []);
    console.log('PASS: preview cancellation, batch apply, restore, automatic rollback, recovery UI, inert state, text injection protection; isolated adapter only.');
  } finally {
    await app.close();
    const resolved = path.resolve(dir);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('star-workflow-'));
    await fs.rm(resolved, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
