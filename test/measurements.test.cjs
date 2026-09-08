const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { createMeasurements, summarize } = require('../src/measurements.cjs');
const sample = () => ({ cpu: 30, memory: { total: 100, free: 40 } });
const context = async () => ({ cpu: 'fixture', onBattery: false });
test('summaries use all samples and reject missing or invalid readings', () => {
  const values = Array.from({length:12},sample); values[0].cpu = 90;
  assert.equal(summarize(values).cpuMean,35); assert.equal(summarize(values).cpuPeak,90);
  assert.throws(() => summarize([sample()])); values[1].cpu=null; assert.throws(() => summarize(values));
});
test('before/after measurements survive restart without replacing older baselines', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'star-measure-'));
  const manager=createMeasurements(dir,sample,context);
  await assert.rejects(manager.measure('after')); await assert.rejects(manager.measure('invalid'));
  await manager.measure('before'); await createMeasurements(dir,sample,context).measure('after'); await manager.measure('before');
  assert.deepEqual((await manager.history()).map(e=>e.kind),['before','after','before']);
});
test('failed sampling preserves the previous measurements and releases the lock', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'star-measure-')); let fail=false;
  const manager=createMeasurements(dir,() => {if(fail) throw Error('No reading'); return sample();},context);
  await manager.measure('before'); fail=true; await assert.rejects(manager.measure('after'));
  assert.equal((await manager.history()).length,1); fail=false; await manager.measure('after');
});
test('corrupt history is not overwritten and concurrent measurements are rejected', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'star-measure-'));
  await fs.writeFile(path.join(dir,'measurements.json'),'broken');
  const manager=createMeasurements(dir,sample,context); await assert.rejects(manager.measure('before'));
  assert.equal(await fs.readFile(path.join(dir,'measurements.json'),'utf8'),'broken');
  const dir2=await fs.mkdtemp(path.join(os.tmpdir(),'star-measure-')); let release;
  const other=createMeasurements(dir2,sample,()=>new Promise(r=>{release=r;})); const pending=other.measure('before');
  await assert.rejects(other.measure('before')); while(!release) await new Promise(r=>setTimeout(r,1)); release(await context()); await pending;
});
