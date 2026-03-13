function createMetrics() {
  return {
    startedAt: Date.now(),
    endedAt: null,
    iflowCount: 0,
    apiCalls: 0,
    retries: 0,
    warnings: 0,
    errors: 0
  };
}

function finalizeMetrics(metrics) {
  const endedAt = Date.now();
  return {
    ...metrics,
    endedAt,
    durationMs: endedAt - metrics.startedAt
  };
}

module.exports = {
  createMetrics,
  finalizeMetrics
};
