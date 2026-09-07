const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createPowerManager } = require('../src/system.cjs');
const A = '381b4222-f694-41f0-9685-ff5bb260df2e';
const B = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const C = 'a1841308-3541-4fab-bc81-f71556f20b4a';
async function fixture(t, failure = false) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'star-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let active = A, calls = 0;
  const adapter = { plans: async () => [A, B, C].map(id => ({ id, active: active === id })), power: async args => {
    calls++;
    const entries = JSON.parse(await fs.readFile(path.join(dir, 'energy-journal.json')));
    assert.ok(entries.some(x => ['pending', 'undoing'].includes(x.status)), 'journal exists before mutation');
    if (failure) throw Error('Simulated interruption');
    active = args[1];
  } };
  return { dir, adapter, manager: createPowerManager(dir, adapter), active: () => active, calls: () => calls, external: id => active = id };
}
test('applies a listed plan and restores original after app restart', async t => {
  const f = await fixture(t); const journal = await f.manager.apply(B);
  assert.equal(f.active(), B); assert.equal(journal[0].status, 'applied');
  const reopened = createPowerManager(f.dir, f.adapter);
  const result = await reopened.undo(journal[0].id);
  assert.equal(f.active(), A); assert.equal(result[0].status, 'restored');
});
test('rejects invalid, missing and already active plans without executing', async t => {
  const f = await fixture(t);
  for (const id of ['& calc', '00000000-0000-0000-0000-000000000000', A]) await assert.rejects(f.manager.apply(id));
  assert.equal(f.calls(), 0);
});
test('failed command retains durable recovery entry', async t => {
  const f = await fixture(t, true); await assert.rejects(f.manager.apply(B));
  const journal = await f.manager.read(); assert.equal(journal[0].before, A); assert.equal(journal[0].status, 'pending');
  await f.manager.undo(journal[0].id); assert.equal((await f.manager.read())[0].status, 'restored');
});
test('blocks overlapping changes and avoids overwriting external choice', async t => {
  const f = await fixture(t); const journal = await f.manager.apply(B);
  await assert.rejects(f.manager.apply(C)); f.external(C);
  await assert.rejects(f.manager.undo(journal[0].id)); assert.equal(f.active(), C);
});
test('corrupt journal fails closed before mutation', async t => {
  const f = await fixture(t); await fs.writeFile(path.join(f.dir, 'energy-journal.json'), '{broken');
  await assert.rejects(f.manager.apply(B)); assert.equal(f.calls(), 0);
});
test('unwritable journal prevents Windows mutation', async t => {
  const f = await fixture(t); const blocker = path.join(f.dir, 'not-directory'); await fs.writeFile(blocker, 'x');
  const manager = createPowerManager(blocker, f.adapter); await assert.rejects(manager.apply(B)); assert.equal(f.calls(), 0);
});
test('recovers after Windows changed but completion was interrupted', async t => {
  const f = await fixture(t);
  const originalPower = f.adapter.power;
  f.adapter.power = async args => { await originalPower(args); throw Error('Interrupted after mutation'); };
  await assert.rejects(f.manager.apply(B)); assert.equal(f.active(), B);
  const journal = await f.manager.read(); assert.equal(journal[0].status, 'pending');
  f.adapter.power = originalPower;
  await createPowerManager(f.dir, f.adapter).undo(journal[0].id);
  assert.equal(f.active(), A);
});
test('missing original plan prevents restoration without another mutation', async t => {
  const f = await fixture(t); const journal = await f.manager.apply(B);
  f.adapter.plans = async () => [{ id: B, active: true }];
  await assert.rejects(f.manager.undo(journal[0].id)); assert.equal(f.calls(), 1);
});
