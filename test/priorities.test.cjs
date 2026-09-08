const test = require('node:test');
const assert = require('node:assert/strict');
const priorities = require('../src/priorities.js');
const normal = () => ({ errors: [], cpu: [{ LoadPercentage: 20 }], memory: { total: 100, free: 50 }, disks: [{ DeviceID: 'C:', Size: 100, FreeSpace: 50 }], startup: [] });
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
