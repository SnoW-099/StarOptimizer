const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: [path.join(__dirname, '..')], env });
  try {
    const page = await app.firstWindow(); await page.waitForSelector('#scan');
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('scan');
      ipcMain.handle('scan', () => new Promise(resolve => { global.finishScan = resolve; }));
    });
    const finish = async (failure = false) => app.evaluate((_electron, fail) => global.finishScan(fail ? { ok: false, error: 'Lectura no disponible' } : { ok: true, data: {
      at: new Date().toISOString(), platform: 'Windows fixture', errors: ['gpu'], cpu: [{ Name: 'CPU fixture', LoadPercentage: 95 }],
      memory: { total: 100e9, free: 5e9 }, disks: [{ DeviceID: 'C:', Size: 100e9, FreeSpace: 4e9 }], startup: [{ Name: 'Example', Location: 'Windows' }], processes: [], gpu: [], uptime: 100,
      configuration: { plans: [], values: {} }, onBattery: false
    } }), failure);
    await page.click('#scan'); await page.waitForSelector('#scan-dialog[open]');
    assert.equal(await page.locator('[data-view="recommended"]').isDisabled(), true);
    await finish(true); await page.waitForSelector('[data-stage="error"]');
    await page.click('#scan-return');
    assert.equal(await page.locator('[data-view="recommended"]').isDisabled(), true);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 760));
    await page.click('#scan');
    await page.screenshot({ path: 'artifacts/scan-thinking.png' });
    await page.waitForSelector('[data-stage="reading"]');
    await page.screenshot({ path: 'artifacts/scan-reading.png' });
    assert.equal(await page.locator('#scan-results').isVisible(), false);
    await finish(); await page.waitForSelector('[data-stage="idea"]');
    await page.screenshot({ path: 'artifacts/scan-idea.png' });
    await page.waitForSelector('#scan-results:not([hidden])');
    assert.equal(await page.evaluate(() => document.querySelector('#scan-dialog').scrollWidth <= document.querySelector('#scan-dialog').clientWidth), true);
    assert.match(await page.textContent('#scan-title'), /pendientes/);
    await page.click('#scan-results');
    assert.equal(await page.locator('#recommended').isVisible(), true);
    assert.equal(await page.locator('.priority-item').count(), 5);
    await page.screenshot({ path: 'artifacts/priorities.png', animations: 'disabled' });
    await page.click('[data-view="overview"]'); await page.click('#scan');
    await page.click('#scan-return'); await finish();
    await page.waitForFunction(() => !document.querySelector('#scan').disabled);
    assert.equal(await page.locator('#scan-dialog').isVisible(), false);
    assert.equal(await page.locator('#nova').count(), 1);
    assert.equal(await page.locator('#nova-space').evaluate(el => el.parentElement.className), 'nova-home-slot');
    assert.deepEqual(errors, []);
    console.log('PASS: failed initial scan stays locked, thinking/reading/idea/result stages, partial priorities, background completion and single Nova.');
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
