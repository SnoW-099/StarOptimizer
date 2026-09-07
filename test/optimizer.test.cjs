const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createOptimizer } = require('../src/optimizer.cjs');
const A = '381b4222-f694-41f0-9685-ff5bb260df2e', B = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', C = 'a1841308-3541-4fab-bc81-f71556f20b4a';
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'star-optimizer-test-'));
  t.after(async () => {
    const resolved = path.resolve(directory), temp = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(resolved.startsWith(temp) && path.basename(resolved).startsWith('star-optimizer-test-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  const values = { power: A, animations: true, menuAnimation: true, comboAnimation: true };
  let time = Date.now(), beforeSet, afterSet;
  const calls = [];
  const adapter = {
    snapshot: async () => ({ values: { ...values }, plans: [A, B, C].map(id => ({ id, name: id === A ? 'Equilibrado' : 'Otro plan', active: values.power === id })) }),
    set: async (key, value) => {
      const persisted = JSON.parse(await fs.readFile(path.join(directory, 'optimization-journal.json'), 'utf8'));
      assert.ok(persisted.some(e => ['pending', 'recovering'].includes(e.status)), 'durable journal must precede every write');
      await beforeSet?.(key, value); calls.push([key, value]); values[key] = value; await afterSet?.(key, value);
    }
  };
  const optimizer = createOptimizer(directory, adapter, () => time);
  return { directory, values, adapter, optimizer, calls, advance: ms => time += ms, beforeSet: fn => beforeSet = fn, afterSet: fn => afterSet = fn };
}
test('preview is read-only, concrete, and skips already matching values', async t => {
  const f = await fixture(t);
  const p = await f.optimizer.preview({ power: A, animations: false });
  assert.equal(p.changes.length, 1); assert.equal(p.changes[0].before, true); assert.equal(p.changes[0].after, false);
  assert.deepEqual(f.calls, []); assert.deepEqual(await f.optimizer.history(), []);
});
test('applies a batch and restores exact original values after restart', async t => {
  const f = await fixture(t);
  const p = await f.optimizer.preview({ power: B, animations: false, menuAnimation: false, comboAnimation: false });
  const result = await f.optimizer.apply(p.token); assert.equal(result.changed, 4);
  assert.equal((await f.optimizer.history())[0].status, 'applied');
  await createOptimizer(f.directory, f.adapter).undo(result.id);
  assert.deepEqual(f.values, { power: A, animations: true, menuAnimation: true, comboAnimation: true });
  assert.equal((await f.optimizer.history())[0].status, 'restored');
});
test('rejects arbitrary keys, types and unknown plans before writes', async t => {
  const f = await fixture(t);
  for (const value of [null, [], { cmd: 'calc' }, { animations: 'false' }, { power: '00000000-0000-0000-0000-000000000000' }, { power: B + '& calc' }]) await assert.rejects(f.optimizer.preview(value));
  assert.deepEqual(f.calls, []);
});
test('expired, forged and reused tokens cannot apply', async t => {
  const f = await fixture(t); const p = await f.optimizer.preview({ animations: false });
  f.advance(300001); await assert.rejects(f.optimizer.apply(p.token));
  await assert.rejects(f.optimizer.apply('forged'));
  const fresh = await f.optimizer.preview({ animations: false }); await f.optimizer.apply(fresh.token);
  await assert.rejects(f.optimizer.apply(fresh.token)); assert.equal(f.calls.length, 1);
});
test('fresh external changes invalidate preview without mutation', async t => {
  const f = await fixture(t); const p = await f.optimizer.preview({ power: B });
  f.values.power = C; await assert.rejects(f.optimizer.apply(p.token)); assert.deepEqual(f.calls, []);
});
test('batch failure rolls back only attempted adjustments', async t => {
  const f = await fixture(t);
  f.beforeSet((key, value) => { if (key === 'menuAnimation' && value === false) throw Error('permission denied'); });
  const p = await f.optimizer.preview({ power: B, menuAnimation: false, comboAnimation: false });
  await assert.rejects(f.optimizer.apply(p.token));
  assert.equal(f.values.power, A); assert.equal(f.values.menuAnimation, true); assert.equal(f.values.comboAnimation, true);
  assert.deepEqual(f.calls, [['power', B], ['power', A]]);
  assert.equal((await f.optimizer.history())[0].status, 'rolled-back');
});
test('failure after Windows writes still restores the changed value', async t => {
  const f = await fixture(t);
  f.afterSet((key, value) => { if (value === false) throw Error('interrupted after write'); });
  const p = await f.optimizer.preview({ animations: false }); await assert.rejects(f.optimizer.apply(p.token));
  assert.equal(f.values.animations, true); assert.equal((await f.optimizer.history())[0].status, 'rolled-back');
});
test('failed rollback remains recoverable and blocks further optimization', async t => {
  const f = await fixture(t);
  f.beforeSet((key, value) => { if (key === 'menuAnimation' || key === 'animations' && value === true) throw Error('restricted'); });
  const p = await f.optimizer.preview({ animations: false, menuAnimation: false });
  await assert.rejects(f.optimizer.apply(p.token));
  const entry = (await f.optimizer.history())[0]; assert.equal(entry.status, 'recovery-needed');
  await assert.rejects(f.optimizer.preview({ power: B }));
  f.beforeSet(null); await createOptimizer(f.directory, f.adapter).undo(entry.id);
  assert.equal(f.values.animations, true); assert.equal((await f.optimizer.history())[0].status, 'restored');
});
test('restoration preserves external power choice and can be retried later', async t => {
  const f = await fixture(t); const p = await f.optimizer.preview({ power: B }); const result = await f.optimizer.apply(p.token);
  f.values.power = C; await assert.rejects(f.optimizer.undo(result.id)); assert.equal(f.values.power, C);
  f.values.power = B; await f.optimizer.undo(result.id); assert.equal(f.values.power, A);
});
test('unavailable API and corrupt histories fail closed', async t => {
  const f = await fixture(t); f.values.animations = null;
  await assert.rejects(f.optimizer.preview({ animations: false }));
  await fs.writeFile(path.join(f.directory, 'optimization-journal.json'), '[{"id":"bad"}]');
  await assert.rejects(f.optimizer.preview({ power: B })); assert.deepEqual(f.calls, []);
});
test('unwritable recovery storage prevents mutation', async t => {
  const f = await fixture(t); const p = await f.optimizer.preview({ power: B });
  await fs.mkdir(path.join(f.directory, 'optimization-journal.json.tmp'));
  await assert.rejects(f.optimizer.apply(p.token)); assert.deepEqual(f.calls, []);
});
test('independent optimizations can coexist and be restored separately', async t => {
  const f = await fixture(t); const p = await f.optimizer.preview({ power: B }); const first = await f.optimizer.apply(p.token);
  const visual = await f.optimizer.preview({ animations: false }); await f.optimizer.apply(visual.token);
  await f.optimizer.undo(first.id); assert.equal(f.values.power, A); assert.equal(f.values.animations, false);
});
test('an active key cannot be overwritten by another optimization', async t => {
  const f = await fixture(t); const p = await f.optimizer.preview({ power: B }); await f.optimizer.apply(p.token);
  await assert.rejects(f.optimizer.preview({ power: C })); assert.equal(f.calls.length, 1);
});
test('legacy energy history remains recoverable without deleting it', async t => {
  const f = await fixture(t), id = randomUUID(); f.values.power = B;
  const legacyFile = path.join(f.directory, 'energy-journal.json');
  await fs.writeFile(legacyFile, JSON.stringify([{ id, before: A, after: B, status: 'applied', at: new Date().toISOString() }]));
  assert.equal((await f.optimizer.history())[0].id, id); await f.optimizer.undo(id);
  assert.equal(f.values.power, A); assert.equal((await fs.stat(legacyFile)).isFile(), true);
});
test('overlapping apply calls are serialized by rejecting the second', async t => {
  const f = await fixture(t); const p1 = await f.optimizer.preview({ power: B }), p2 = await f.optimizer.preview({ animations: false });
  const first = f.optimizer.apply(p1.token);
  await assert.rejects(f.optimizer.apply(p2.token)); await first;
  assert.equal(f.values.animations, true);
});
