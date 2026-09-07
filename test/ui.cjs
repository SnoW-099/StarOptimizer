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
    assert.deepEqual(security.bridge.sort(), ['apply', 'export', 'history', 'onBusyClose', 'preview', 'scan', 'settings', 'telemetry', 'undo']);
    const rejected = await page.evaluate(() => window.star.settings('https://example.com'));
    assert.equal(rejected.ok, false);
    await page.click('[data-view="recommendations"]');
    await page.click('[data-profile="fluid"]');
    if (await page.locator('#review').isEnabled()) {
      await page.click('#review');
      await page.waitForSelector('#review-dialog[open]');
      assert.ok((await page.textContent('#review-list')).includes('→'));
      await page.screenshot({ path: 'artifacts/review.png' });
      await page.click('#cancel-review');
      assert.equal(await page.locator('#review-dialog').isVisible(), false);
    }
    await page.screenshot({ path: 'artifacts/optimization.png', fullPage: true });
    await page.click('[data-view="processes"]');
    await page.fill('#process-search', 'no-such-process-12345');
    assert.ok((await page.textContent('#process-list')).includes('No hay procesos'));
    await page.fill('#process-search', '');
    const wasSimple = await page.locator('body').evaluate(el => el.classList.contains('simple'));
    await page.click('#appearance');
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('simple')), !wasSimple);
    await page.click('#appearance');
    await page.click('[data-view="overview"]');
    await page.locator('#nova').focus();
    await page.locator('#nova').press('Enter');
    assert.ok((await page.textContent('#nova-caption')).includes('Estoy contigo'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.nova-button').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 760));
    await page.screenshot({ path: 'artifacts/compact.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log('PASS: real Windows scan, all views, isolated renderer, settings allowlist; no Windows settings changed.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
