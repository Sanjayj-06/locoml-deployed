const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hashString = (value = '') => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

const normalizeType = (node) => (node?.type || node?.data?.type || node?.data?.label || 'default').toLowerCase();

const profileByType = {
  inputdata: { latency: 92, cpu: 24, gpu: 4, memory: 26, throughput: 88, queue: 1, retries: 0 },
  preprocessing: { latency: 138, cpu: 46, gpu: 18, memory: 34, throughput: 74, queue: 2, retries: 1 },
  adapter: { latency: 124, cpu: 39, gpu: 12, memory: 31, throughput: 70, queue: 1, retries: 1 },
  classification: { latency: 156, cpu: 58, gpu: 42, memory: 38, throughput: 62, queue: 2, retries: 1 },
  regression: { latency: 148, cpu: 54, gpu: 36, memory: 37, throughput: 64, queue: 2, retries: 1 },
  sentiment: { latency: 162, cpu: 56, gpu: 40, memory: 39, throughput: 60, queue: 2, retries: 1 },
  huggingface: { latency: 184, cpu: 61, gpu: 52, memory: 43, throughput: 56, queue: 3, retries: 2 },
  imageclassification: { latency: 174, cpu: 63, gpu: 68, memory: 46, throughput: 54, queue: 3, retries: 2 },
  default: { latency: 128, cpu: 42, gpu: 20, memory: 33, throughput: 68, queue: 1, retries: 1 },
};

const deriveModelName = (node) => {
  const entity = node?.data?.entity;

  if (!entity) {
    return node?.data?.model_name || 'Auto-managed runtime';
  }

  return entity.model_name || entity.name || entity.model_id || node?.data?.model_name || 'Auto-managed runtime';
};

const deriveCurrentAction = (node, pipelineRunning, pipelinePaused) => {
  if (pipelinePaused) {
    return 'Awaiting resume';
  }

  if (pipelineRunning) {
    return node?.data?.currentAction || 'Executing runtime task';
  }

  const nodeType = normalizeType(node);

  if (nodeType === 'inputdata') {
    return 'Dataset intake';
  }

  if (nodeType === 'preprocessing') {
    return 'Feature preparation';
  }

  if (nodeType === 'adapter') {
    return 'Payload adaptation';
  }

  return node?.data?.currentAction || 'Standby for inference';
};

export const simulateRuntimeMetrics = (node, { tick = 0, pipelineRunning = false, pipelinePaused = false, realTelemetry = null } = {}) => {
  const type = normalizeType(node);
  const profile = profileByType[type] || profileByType.default;
  const seed = hashString(`${node?.id || 'node'}:${type}`);
  const pulse = Math.sin((tick / 4) + (seed % 11));
  const jitter = Math.cos((tick / 6) + (seed % 7));
  const hasEntity = !!(node?.data?.entity || node?.data?.model_name);

  if (!hasEntity) {
    return {
      nodeName: node?.data?.name || node?.data?.label || node?.type || 'Runtime Node',
      modelName: 'Unconfigured',
      currentAction: 'Pending configuration',
      executionStatus: 'Idle',
      latency: null,
      cpuUsage: null,
      gpuUsage: null,
      memoryUsage: null,
      throughput: null,
      queueSize: null,
      retryCount: null,
      failureProbability: null,
      healthScore: null,
      stabilityIndex: null,
      predictedRuntimeRisk: 'Low',
      trendSeries: [0, 0, 0, 0, 0, 0, 0, 0],
    };
  }

  const entityBias = -0.07;
  const runningBias = pipelineRunning ? 0.06 : 0;
  const pausedBias = pipelinePaused ? 0.05 : 0;

  const latency = Math.max(18, Math.round(profile.latency + (pulse * 18) + (pipelineRunning ? 10 : -6) + (entityBias * 100)));

  // Use real telemetry if available, otherwise mock
  const cpuUsage = realTelemetry?.cpuUsage ?? clamp(Math.round(profile.cpu + (pulse * 8) + (jitter * 5) + (pipelineRunning ? 8 : -3) + (entityBias * 42)), 0, 100);
  const memoryUsage = realTelemetry?.memoryUsage ?? clamp(Math.round(profile.memory + (pulse * 6) + (jitter * 4) + (pipelineRunning ? 6 : -2) + (entityBias * 28)), 0, 100);
  const gpuUsage = clamp(Math.round(profile.gpu + (pulse * 10) + (jitter * 7) + (pipelineRunning ? 9 : -4) + (entityBias * 38)), 0, 100);
  const retryCount = clamp(Math.round(profile.retries + Math.max(0, (latency - 135) / 55) + Math.max(0, gpuUsage - 70) / 28 + (pipelineRunning ? 1 : 0)), 0, 8);
  const queueSize = clamp(Math.round(profile.queue + Math.max(0, (latency - 120) / 32) + Math.max(0, gpuUsage - 74) / 18 + retryCount / 2 + (pipelineRunning ? 1 : 0)), 0, 12);
  const throughput = clamp(Math.round(profile.throughput - Math.max(0, latency - 130) / 4 - Math.max(0, queueSize - 2) * 2 + (pulse * 5) + (pipelinePaused ? -6 : 0)), 1, 99);
  const timeoutFrequency = clamp(((latency - 125) / 260) + (queueSize / 18) + (retryCount / 14) + runningBias + pausedBias, 0, 1);
  const failureProbability = clamp(
    ((latency / 420) * 0.3)
    + ((cpuUsage / 100) * 0.15)
    + ((gpuUsage / 100) * 0.2)
    + ((queueSize / 12) * 0.15)
    + ((retryCount / 8) * 0.12)
    + (timeoutFrequency * 0.08)
    + (entityBias > 0 ? entityBias : entityBias * 0.4),
    0,
    1,
  );
  const healthScore = Math.round(clamp(100 - (failureProbability * 100) - Math.max(0, latency - 180) * 0.05, 0, 100));
  const stabilityIndex = Math.round(clamp(100 - (failureProbability * 75) - Math.abs(cpuUsage - 54) * 0.25 - Math.abs(gpuUsage - 48) * 0.2, 0, 100));
  const predictedRuntimeRisk = failureProbability >= 0.62 ? 'High' : failureProbability >= 0.28 ? 'Moderate' : 'Low';
  const trendSeries = Array.from({ length: 8 }, (_, index) => {
    const trendPulse = Math.sin((tick / 4) + index * 0.75 + (seed % 9));
    return clamp(Math.round((failureProbability * 70) + ((trendPulse + 1) * 10)), 5, 95);
  });

  return {
    nodeName: node?.data?.name || node?.data?.label || node?.type || 'Runtime Node',
    modelName: deriveModelName(node),
    currentAction: deriveCurrentAction(node, pipelineRunning, pipelinePaused),
    executionStatus: pipelinePaused ? 'Paused' : pipelineRunning ? 'Running' : node?.data?.runtimeStatus || (node?.data?.entity ? 'Configured' : 'Idle'),
    latency,
    cpuUsage,
    gpuUsage,
    memoryUsage,
    throughput,
    queueSize,
    retryCount,
    failureProbability,
    healthScore,
    stabilityIndex,
    predictedRuntimeRisk,
    trendSeries,
  };
};

export const buildPredictionMessage = (metrics) => {
  if (!metrics) {
    return 'No runtime signal available';
  }

  if (metrics.failureProbability >= 0.65 || metrics.healthScore < 45) {
    return 'Potential inference instability detected';
  }

  if (metrics.queueSize >= 4 || metrics.retryCount >= 2 || metrics.latency >= 170) {
    return 'Latency increasing and queue pressure rising';
  }

  if (metrics.healthScore >= 80) {
    return 'Node stable';
  }

  return 'Runtime risk trending upward';
};