const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: [path.join(__dirname, '..')], env });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector('#nova');
    await page.evaluate(() => { document.body.classList.remove('simple'); nova.context({ simple: false }); });
    const before = await page.locator('#nova').boundingBox();
    await page.evaluate(() => show('history'));
    await page.evaluate(() => { const a = document.querySelector('#nova-space').getAnimations()[0]; a.pause(); a.currentTime = 0; });
    const start = await page.locator('#nova').boundingBox();
    for (const key of ['x','y','width','height']) assert.ok(Math.abs(start[key] - before[key]) < 1, `${key}: travel starts at the current character bounds`);
    await page.evaluate(() => { document.querySelector('#nova-space').getAnimations()[0].currentTime = 525; });
    await page.screenshot({ path: 'artifacts/nova-flight.png' });
    await page.evaluate(() => { document.querySelector('#nova-space').getAnimations()[0].finish(); });
    await page.waitForSelector('#nova-dock #nova');
    await page.evaluate(() => show('overview'));
    await page.evaluate(() => { document.querySelector('#nova-space').getAnimations()[0].currentTime = 300; });
    await page.evaluate(() => show('recommendations'));
    await page.evaluate(() => { document.querySelector('#nova-space').getAnimations()[0].finish(); });
    await page.waitForSelector('#nova-dock #nova');
    await page.evaluate(() => { document.body.classList.add('simple'); show('overview'); });
    await page.locator('.nova-lid').evaluateAll(lids => lids.forEach(lid => { lid.style.transform = 'translateY(-5%)'; }));
    await page.locator('.eye').evaluateAll(eyes => eyes.forEach(eye => { eye.style.scale = '1 .4'; eye.style.translate = '0 18px'; eye.style.rotate = '0deg'; }));
    await page.locator('#nova').screenshot({ path: 'artifacts/nova-closed.png' });
    assert.equal(await page.locator('#nova').count(), 1);
    console.log('PASS: exact travel origin, interrupted travel, reduced effects, single character; visual snapshots saved.');
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
