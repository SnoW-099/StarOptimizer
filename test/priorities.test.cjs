const test = require('node:test');
const assert = require('node:assert/strict');
const priorities = require('../src/priorities.js');
const normal = () => ({ errors: [], cpu: [{ LoadPercentage: 20 }], memory: { total: 100, free: 50 }, disks: [{ DeviceID: 'C:', Size: 100, FreeSpace: 50 }], startup: [] });
const balanced = '381b4222-f694-41f0-9685-ff5bb260df2e';
const saver = 'a1841308-3541-4fab-bc81-f71556f20b4a';
test('power recommendation requires AC, known saver and an existing balanced plan; clears after applying', () => {
  const s = normal(); s.onBattery = false;
  s.configuration = { values: { power: saver }, plans: [{ id: saver }, { id: balanced }] };
  assert.deepEqual(priorities(s)[0].changes, { power: balanced });
  for (const battery of [true, undefined, null]) { s.onBattery = battery; assert.deepEqual(priorities(s), []); }
  s.onBattery = false; s.configuration.values.power = balanced; assert.deepEqual(priorities(s), []);
  s.configuration.values.power = saver; s.configuration.plans = [{ id: saver }]; assert.deepEqual(priorities(s), []);
  s.configuration.plans.push({ id: balanced }); s.errors = ['plans'];
  assert.equal(priorities(s).some(p => p.changes?.power), false);
});
test('automatic visual actions include only confirmed active settings', () => {
  const s = normal(); s.configuration = { values: { animations: true, menuAnimation: false, comboAnimation: null } };
  assert.deepEqual(priorities(s)[0].changes, { animations: false });
  s.configuration.values.animations = false; assert.deepEqual(priorities(s), []);
  s.configuration.values.animations = true; s.errors = ['configuration'];
  assert.equal(priorities(s).some(p => p.changes), false);
});
test('no recommendations before a snapshot, or invented problems for normal readings', () => {
  assert.deepEqual(priorities(null), []); assert.deepEqual(priorities(normal()), []);
});
test('orders incomplete readings, resource pressure, CPU sampling and optional startup review', () => {
  const s = normal(); s.errors = ['gpu']; s.memory.free = 5; s.cpu[0].LoadPercentage = 95; s.disks[0].FreeSpace = 5; s.startup = [{ Name: 'Example' }];
  assert.deepEqual(priorities(s).map(x => x.priority), [0, 1, 1, 2, 3]);
});
test('missing and invalid metrics never become resource diagnoses', () => {
  const s = normal(); s.errors = ['cpu', 'disks', 'memory']; s.cpu[0].LoadPercentage = 99; s.disks[0].FreeSpace = 0; s.memory.free = 0;
  assert.equal(priorities(s).length, 1);
  assert.deepEqual(priorities({ errors: [], cpu: [{ LoadPercentage: null }], memory: { total: 0, free: -1 }, disks: [{ Size: 100, FreeSpace: null }] }), []);
});
test('startup entries only warrant optional review, never assumed enabled or harmful', () => {
  const s = normal(); s.startup = [{ Name: 'Security' }];
  const [item] = priorities(s); assert.equal(item.priority, 3); assert.match(item.evidence, /deshabilitadas/);
});
test('physical disk warnings take priority, unknown status is never a failure diagnosis', () => {
  const s=normal(); s.physicalDisks=[{Name:'SSD',HealthStatus:'Warning'},{Name:'Unknown disk',HealthStatus:'Unknown'}];
  const items=priorities(s); assert.equal(items.length,1); assert.equal(items[0].priority,0); assert.match(items[0].title,/Proteger/);
});
