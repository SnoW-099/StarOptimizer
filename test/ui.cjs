const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
(async () => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const launch = process.argv[2] ? { executablePath: path.resolve(process.argv[2]), args: [] } : { args: [path.join(__dirname, '..')] };
  const app = await electron.launch({ ...launch, env });
  try {
    const page = await app.firstWindow(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#scan'); await fs.mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/dashboard-before.png' });
    await page.click('#scan');
    await page.waitForFunction(() => document.querySelector('#last-scan').textContent.includes('Última lectura'), { timeout: 60000 });
    assert.ok((await page.textContent('#memory-value')).includes('GB'));
    await page.screenshot({ path: 'artifacts/dashboard.png' });
    for (const view of ['recommendations', 'startup', 'processes', 'history']) {
      await page.click(`[data-view="${view}"]`);
      assert.equal(await page.locator(`#${view}`).isVisible(), true);
    }
    const security = await page.evaluate(() => ({ node: typeof require, process: typeof process, bridge: Object.keys(window.star) }));
    assert.equal(security.node, 'undefined'); assert.equal(security.process, 'undefined');
    assert.deepEqual(security.bridge.sort(), ['apply', 'export', 'history', 'scan', 'settings', 'undo']);
    const rejected = await page.evaluate(() => window.star.settings('https://example.com'));
    assert.equal(rejected.ok, false);
    assert.deepEqual(errors, []);
    console.log('PASS: real Windows scan, all views, isolated renderer, settings allowlist; no Windows settings changed.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
