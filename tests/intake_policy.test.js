const test = require('node:test');
const assert = require('node:assert/strict');
const { intakeDisposition } = require('../api/_intake-policy');

test('disabled and missing prerequisites never admit work', () => {
  for (const options of [{}, { enabled: true }, { enabled: 'true', contractReady: true, durableStoreReady: true }]) {
    assert.deepEqual(intakeDisposition(options), { action: 'disabled' });
  }
});

test('spam and canary never compete with genuine lead admission', () => {
  const ready = { enabled: true, contractReady: true, durableStoreReady: true };
  assert.equal(intakeDisposition({ ...ready, traffic: 'spam' }).action, 'discard');
  assert.equal(intakeDisposition({ ...ready, traffic: 'canary' }).action, 'discard');
  assert.equal(intakeDisposition({ ...ready, traffic: 'genuine' }).action, 'enqueue');
  assert.equal(intakeDisposition({ ...ready, traffic: 'unknown' }).action, 'discard');
});

test('auth/config failures remain recoverable pending work', () => {
  const ready = { enabled: true, contractReady: true, durableStoreReady: true, traffic: 'genuine' };
  for (const outcome of ['wrong-secret', 'invalid-config', 'invalid-event', 'timeout', 'rate-limited', 'network-error']) {
    assert.deepEqual(intakeDisposition({ ...ready, outcome }), { action: 'retain', reason: outcome });
  }
  assert.deepEqual(intakeDisposition({ ...ready, outcome: 'durably-accepted' }), { action: 'complete' });
  assert.deepEqual(intakeDisposition({ ...ready, outcome: 'unexpected' }), { action: 'retain', reason: 'unknown-outcome' });
});
