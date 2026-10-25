// Dormant policy only. No handler imports this module. A future adapter must
// supply verified prerequisites and persist each retain/complete transition.
// This does not provide a durable queue or define the hub's wire protocol.
const RECOVERABLE = new Set([
  'wrong-secret', 'invalid-config', 'invalid-event', 'timeout',
  'rate-limited', 'network-error',
]);

function intakeDisposition(options = {}) {
  if (options.enabled !== true || options.contractReady !== true || options.durableStoreReady !== true) {
    return { action: 'disabled' };
  }
  // Do not enqueue spam/canary work in the genuine-lead queue. A separately
  // approved bounded quarantine may be introduced with the hub contract.
  if (options.traffic !== 'genuine') return { action: 'discard' };
  if (options.outcome === undefined) return { action: 'enqueue' };
  // The future protocol adapter owns verifying a durable acknowledgment;
  // receiving an arbitrary HTTP 2xx is insufficient to supply this outcome.
  if (options.outcome === 'durably-accepted') return { action: 'complete' };
  return {
    action: 'retain',
    reason: RECOVERABLE.has(options.outcome) ? options.outcome : 'unknown-outcome',
  };
}

module.exports = { intakeDisposition };
