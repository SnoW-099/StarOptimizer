const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os'), fs = require('node:fs/promises');
(async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'star-measure-ui-'));
  const env={...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  const launch = process.argv[2] ? { executablePath: path.resolve(process.argv[2]), args: [`--user-data-dir=${dir}`] } : { args: [path.join(__dirname,'..'),`--user-data-dir=${dir}`] };
  let app=await electron.launch({...launch,env});
  try {
    let page=await app.firstWindow(); await page.waitForSelector('#measure-before',{state:'attached'});
    assert.equal(await page.locator('#measure-before').isDisabled(),true);
    assert.equal((await page.evaluate(()=>window.star.measure('invalid'))).ok,false);
    await page.evaluate(()=>analyze()); await page.click('[data-view="tuneup"]');
    await page.click('#measure-before');
    await page.waitForFunction(()=>document.querySelector('#measurement-status').textContent.includes('Midiendo'));
    await page.waitForTimeout(150);
    assert.equal((await page.evaluate(()=>window.star.apply('invalid-token'))).ok,false);
    assert.equal((await page.evaluate(()=>window.star.measure('before'))).ok,false);
    await page.waitForFunction(()=>document.querySelector('#measurement-status').textContent.includes('Medición guardada'),{timeout:30000});
    assert.equal((await page.evaluate(()=>window.star.measurements())).data.length,1);
    await app.close(); app=await electron.launch({...launch,env}); page=await app.firstWindow(); await page.waitForSelector('#measure-before',{state:'attached'});
    await page.evaluate(()=>analyze()); await page.click('[data-view="tuneup"]');
    await page.click('#measure-after');
    await page.waitForFunction(()=>document.querySelector('#measurement-status').textContent.includes('Medición guardada'),{timeout:30000});
    const history=(await page.evaluate(()=>window.star.measurements())).data;
    assert.deepEqual(history.map(e=>e.kind),['before','after']); assert.ok(history.every(e=>e.summary.samples===12));
    assert.match(await page.textContent('#measurement-results'),/Diferencia de CPU media/);
    await page.screenshot({path:'artifacts/tuneup.png',fullPage:true,animations:'disabled'});
    await app.evaluate(({ BrowserWindow })=>BrowserWindow.getAllWindows()[0].setSize(960,760));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    console.log('PASS: actual measurements, IPC overlap protection, persisted baseline after restart, comparison and compact layout; isolated data directory.');
  } finally { await app.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
