const HEALTH_STATES = {
  healthy: {
    key: 'healthy',
    label: 'Healthy Runtime State',
    accent: '#4ade80',
    glow: 'rgba(74, 222, 128, 0.35)',
    background: 'rgba(10, 36, 21, 0.92)',
    border: 'rgba(74, 222, 128, 0.55)',
    badge: 'rgba(74, 222, 128, 0.18)',
  },
  degraded: {
    key: 'degraded',
    label: 'Performance Degradation Detected',
    accent: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.36)',
    background: 'rgba(39, 30, 6, 0.96)',
    border: 'rgba(251, 191, 36, 0.58)',
    badge: 'rgba(251, 191, 36, 0.18)',
  },
  critical: {
    key: 'critical',
    label: 'Critical Runtime Risk',
    accent: '#f87171',
    glow: 'rgba(248, 113, 113, 0.36)',
    background: 'rgba(41, 10, 13, 0.96)',
    border: 'rgba(248, 113, 113, 0.62)',
    badge: 'rgba(248, 113, 113, 0.18)',
  },
};

export const evaluateHealth = (metrics = {}) => {
  const failureProbability = metrics.failureProbability || 0;
  const latency = metrics.latency || 0;
  const retryCount = metrics.retryCount || 0;
  const queueSize = metrics.queueSize || 0;
  const gpuUsage = metrics.gpuUsage || 0;
  const cpuUsage = metrics.cpuUsage || 0;

  if (failureProbability >= 0.65 || latency >= 320 || queueSize >= 7 || (retryCount >= 4 && gpuUsage >= 80)) {
    return HEALTH_STATES.critical;
  }

  if (failureProbability >= 0.28 || latency >= 165 || retryCount >= 2 || queueSize >= 3 || gpuUsage >= 75 || cpuUsage >= 82) {
    return HEALTH_STATES.degraded;
  }

  return HEALTH_STATES.healthy;
};

export { HEALTH_STATES };