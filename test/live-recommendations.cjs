const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict'); const path = require('node:path');
(async () => {
 const env={...process.env}; delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:[path.join(__dirname,'..')],env});
 try {
  const page=await app.firstWindow(); await page.waitForSelector('#scan');
  await page.waitForFunction(()=>typeof analyze==='function');
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({ipcMain})=>{
   global.liveFixture={free:5,reads:0,enabled:true,previews:0};
   const s=()=>({at:new Date().toISOString(),platform:'Test',cpu:[{Name:'CPU',LoadPercentage:10,Samples:8}],memory:{total:100,free:global.liveFixture.free},disks:[],startup:[],processes:[],gpu:[],errors:[],uptime:0,configuration:{plans:[],values:{animations:global.liveFixture.enabled}},onBattery:false});
   for(const [name,fn] of Object.entries({scan:()=>s(),history:()=>[],telemetry:()=>{global.liveFixture.reads++;return {at:new Date().toISOString(),cpu:10,memory:{total:100,free:global.liveFixture.free}};},preview:()=>{global.liveFixture.previews++;return {token:'fixture',changes:[{key:'animations',label:'Animaciones',beforeLabel:'Activadas',afterLabel:'Desactivadas'}]};}})) {ipcMain.removeHandler(name);ipcMain.handle(name,async()=>({ok:true,data:await fn()}));}
  });
  await page.evaluate(()=>analyze()); await page.click('[data-view="recommended"]');
  assert.match(await page.textContent('#priority-list'),/memoria/);
  await app.evaluate(()=>{global.liveFixture.free=70;});
  await page.waitForFunction(()=>!document.querySelector('#priority-list').textContent.includes('aplicaciones que ocupan memoria'),{timeout:12000});
  await page.getByRole('button',{name:'Revisar aplicación automática',exact:true}).click();
  await page.waitForSelector('#review-dialog[open]');
  assert.equal(await app.evaluate(()=>global.liveFixture.previews),1);
  assert.equal(await app.evaluate(()=>global.liveFixture.enabled),true,'preview cannot modify Windows');
  const reads=await app.evaluate(()=>global.liveFixture.reads);
  await page.waitForTimeout(5500); assert.equal(await app.evaluate(()=>global.liveFixture.reads),reads,'pause while approving');
  await page.click('#cancel-review');
  await page.uncheck('#recommendation-live'); await page.waitForTimeout(5500);
  assert.equal(await app.evaluate(()=>global.liveFixture.reads),reads,'user can pause');
  await app.evaluate(()=>{global.liveFixture.enabled=false;});
  await page.evaluate(()=>analyze());
  assert.equal(await page.getByRole('button',{name:'Revisar aplicación automática',exact:true}).count(),0,'re-scan removes already applied action');
  assert.deepEqual(errors,[]);
  console.log('PASS: live recommendation resolves, explicit preview, pause during approval, user opt-out and refreshed applied state; fixture only.');
 } finally {await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
