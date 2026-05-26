import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { evaluateHealth } from './HealthEvaluator';
import { buildPredictionMessage, simulateRuntimeMetrics } from './RuntimeHealthEngine';

const MODEL_ENDPOINTS = {
  classification: 'http://localhost:5001/getTrainedModels/classification',
  regression: 'http://localhost:5001/getTrainedModels/regression',
  sentiment: 'http://localhost:5001/getTrainedModels/sentiment',
  imageclassification: 'http://localhost:5001/getTrainedModels/imageclassification',
  machinetranslation: 'http://localhost:5001/getTrainedModels/machinetranslation',
};

const PRE_RUN_INFERENCE_ENDPOINT = 'http://localhost:5001/preRunNodeInference';

const MODEL_NODE_TYPES = new Set([
  'classification',
  'regression',
  'sentiment',
  'imageclassification',
  'huggingface',
]);

const METRIC_PRIORITY = {
  classification: ['accuracy', 'f1', 'auc', 'precision', 'recall'],
  regression: ['r2', 'rmse', 'mae', 'mse'],
  sentiment: ['accuracy', 'f1', 'auc'],
  imageclassification: ['accuracy', 'f1', 'top1', 'top-1'],
  machinetranslation: ['bleu', 'meteor', 'chrf'],
  huggingface: ['accuracy', 'f1', 'auc'],
};

const LOWER_BETTER_HINTS = ['rmse', 'mae', 'mse', 'loss', 'wer', 'cer', 'mape'];

const normalizeText = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '');

const safeNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseResponse = (data) => {
  if (!data) {
    return [];
  }

  if (Array.isArray(data.trained_models)) {
    return data.trained_models.map((model) => {
      if (typeof model === 'string') {
        try {
          return JSON.parse(model.replace(/Infinity/g, '1e1000'));
        } catch (error) {
          return null;
        }
      }

      return model;
    }).filter(Boolean);
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
};

const buildEvaluationSignature = (nodes = [], edges = []) => JSON.stringify({
  nodes: nodes.map((node) => ({
    id: node.id,
    type: node.type,
    label: node?.data?.label || null,
    name: node?.data?.name || null,
    modelId: node?.data?.model_id || node?.data?.entity?.model_id || null,
    modelName: node?.data?.model_name || node?.data?.entity?.model_name || null,
    entityId: typeof node?.data?.entity === 'string' ? node.data.entity : node?.data?.entity?.model_id || node?.data?.entity?.id || null,
    preprocessingType: node?.data?.preprocessingType || null,
  })),
  edges: edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  })),
});

const getNodeObjective = (node) => {
  const objective = node?.type || node?.data?.objective || node?.data?.entity?.objective || node?.data?.entity?.training_mode || '';
  return String(objective).toLowerCase();
};

const getNodeTitle = (node) => {
  const title = node?.data?.name || node?.data?.label || node?.data?.entity?.model_name || node?.data?.entity?.model_id || node?.type || 'Pipeline Node';
  return typeof title === 'object' ? (title?.model_name || title?.name || title?.model_id || JSON.stringify(title)) : String(title);
};

const getEntityLabel = (entity) => {
  if (!entity) {
    return 'Not configured';
  }

  if (typeof entity === 'string') {
    return entity;
  }

  return entity.model_name || entity.estimator_type || entity.model_id || entity.name || 'Configured model';
};

const getMetricEntry = (model, objective) => {
  const metrics = Array.isArray(model?.evaluation_metrics) ? model.evaluation_metrics : [];
  const priorities = METRIC_PRIORITY[objective] || METRIC_PRIORITY.huggingface;

  for (const preferredMetric of priorities) {
    const match = metrics.find((metric) => normalizeText(metric?.metric_name || '').includes(normalizeText(preferredMetric)));
    if (match) {
      return match;
    }
  }

  return metrics.find((metric) => safeNumber(metric?.metric_value) !== null) || null;
};

const isLowerBetterMetric = (metricName = '') => {
  const normalized = normalizeText(metricName);
  return LOWER_BETTER_HINTS.some((hint) => normalized.includes(normalizeText(hint)));
};

const scoreModel = (model, objective) => {
  const metricEntry = getMetricEntry(model, objective);
  if (!metricEntry) {
    return {
      metricName: 'unavailable',
      metricValue: null,
      lowerIsBetter: false,
      routeScore: Number.NEGATIVE_INFINITY,
    };
  }

  const metricValue = safeNumber(metricEntry.metric_value);
  const lowerIsBetter = isLowerBetterMetric(metricEntry.metric_name);

  if (metricValue === null) {
    return {
      metricName: metricEntry.metric_name || 'metric',
      metricValue: null,
      lowerIsBetter,
      routeScore: Number.NEGATIVE_INFINITY,
    };
  }

  return {
    metricName: metricEntry.metric_name || 'metric',
    metricValue,
    lowerIsBetter,
    routeScore: lowerIsBetter ? -metricValue : metricValue,
  };
};

const buildInputSummary = (node) => {
  const summary = [];
  const data = node?.data || {};

  if (data.name) summary.push(['Name', typeof data.name === 'object' ? JSON.stringify(data.name) : String(data.name)]);
  if (data.label) summary.push(['Label', typeof data.label === 'object' ? (data.label.model_name || data.label.name || data.label.label || JSON.stringify(data.label)) : String(data.label)]);
  if (data.preprocessingType) summary.push(['Preprocessing Type', typeof data.preprocessingType === 'object' ? JSON.stringify(data.preprocessingType) : String(data.preprocessingType)]);
  if (data.task_name) summary.push(['Task', typeof data.task_name === 'object' ? JSON.stringify(data.task_name) : String(data.task_name)]);
  if (data.model_name) summary.push(['Model Name', typeof data.model_name === 'object' ? JSON.stringify(data.model_name) : String(data.model_name)]);
  if (data.model_id) summary.push(['Model ID', typeof data.model_id === 'object' ? JSON.stringify(data.model_id) : String(data.model_id)]);

  if (data.entity) {
    if (typeof data.entity === 'string') {
      summary.push(['Entity', data.entity]);
    } else {
      summary.push(['Entity', getEntityLabel(data.entity)]);
      if (data.entity.objective) summary.push(['Objective', data.entity.objective]);
      if (data.entity.metric_type) summary.push(['Metric', data.entity.metric_type]);
    }
  }

  if (summary.length === 0) {
    summary.push(['Status', 'No input captured yet']);
  }

  return summary;
};

const formatMetricValue = (value) => {
  if (value === null || value === undefined) {
    return 'n/a';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(3);
  }

  return String(value);
};

const getRuntimeRows = (row) => {
  const metrics = row?.runtimeMetrics;
  if (!metrics) {
    return [];
  }

  const inputOnlyRows = [
    ['Latency', `${formatMetricValue(metrics.latency)} ms`],
    ['CPU', `${formatMetricValue(metrics.cpuUsage)}%`],
    ['Memory', `${formatMetricValue(metrics.memoryUsage)}%`],
  ];

  const fullRows = [
    ...inputOnlyRows,
    ['GPU', `${formatMetricValue(metrics.gpuUsage)}%`],
    ['Throughput', formatMetricValue(metrics.throughput)],
    ['Score', `${formatMetricValue(metrics.score)} / 100`],
    ['Risk', metrics.predictedRuntimeRisk || 'Unknown'],
  ];

  return row?.nodeType === 'inputData' ? inputOnlyRows : fullRows;
};

const hashString = (value = '') => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

const normalizeNodeType = (node) => String(node?.type || node?.data?.label || 'default').toLowerCase();

const localEstimateNodeMetrics = (node, index, totalNodes) => {
  const nodeType = normalizeNodeType(node);
  const seed = hashString(`${node?.id || 'node'}:${nodeType}`);
  const pulse = Math.sin((index / 3) + (seed % 11));
  const jitter = Math.cos((index / 5) + (seed % 7));
  const hasEntity = !!(node?.data?.entity || node?.data?.model_name);

  if (!hasEntity) {
    return {
      latency: null,
      cpuUsage: null,
      gpuUsage: null,
      memoryUsage: null,
      throughput: null,
      predictedRuntimeRisk: 'Low',
      failureProbability: 0,
    };
  }

  const profiles = {
    inputdata: { latency: 92, cpu: 24, gpu: 4, memory: 26, throughput: 88 },
    preprocessing: { latency: 138, cpu: 46, gpu: 18, memory: 34, throughput: 74 },
    adapter: { latency: 124, cpu: 39, gpu: 12, memory: 31, throughput: 70 },
    classification: { latency: 156, cpu: 58, gpu: 42, memory: 38, throughput: 62 },
    regression: { latency: 148, cpu: 54, gpu: 36, memory: 37, throughput: 64 },
    sentiment: { latency: 162, cpu: 56, gpu: 40, memory: 39, throughput: 60 },
    huggingface: { latency: 184, cpu: 61, gpu: 52, memory: 43, throughput: 56 },
    imageclassification: { latency: 174, cpu: 63, gpu: 68, memory: 46, throughput: 54 },
    default: { latency: 128, cpu: 42, gpu: 20, memory: 33, throughput: 68 },
  };

  const profile = profiles[nodeType] || profiles.default;
  const complexity = ['huggingface', 'imageclassification'].includes(nodeType) ? 0.8 : ['classification', 'regression', 'sentiment'].includes(nodeType) ? 0.45 : 0.15;
  const depthFactor = index / Math.max(1, totalNodes - 1);

  const latency = Math.max(18, Math.round(profile.latency + (pulse * 18) + (complexity * 22) + (depthFactor * 14)));
  const cpuUsage = Math.min(100, Math.max(0, Math.round(profile.cpu + (pulse * 8) + (jitter * 5) + (complexity * 12) + (depthFactor * 8))));
  const memoryUsage = Math.min(100, Math.max(0, Math.round(profile.memory + (pulse * 6) + (jitter * 4) + (complexity * 10) + (depthFactor * 7))));
  const gpuUsage = Math.min(100, Math.max(0, Math.round(profile.gpu + (pulse * 10) + (jitter * 7) + (complexity * 16) + (depthFactor * 10))));
  const throughput = Math.max(1, Math.round(profile.throughput - Math.max(0, latency - 130) / 4 + (pulse * 5)));
  const failureProbability = Math.min(1, Math.max(0, ((latency / 420) * 0.3) + ((cpuUsage / 100) * 0.15) + ((gpuUsage / 100) * 0.2) + ((memoryUsage / 100) * 0.15)));
  const score = Math.max(0, Math.min(100, Math.round(100 - (failureProbability * 100))));

  return {
    latency,
    cpuUsage,
    gpuUsage,
    memoryUsage,
    throughput,
    score,
    failureProbability,
    predictedRuntimeRisk: failureProbability >= 0.62 ? 'High' : failureProbability >= 0.28 ? 'Moderate' : 'Low',
  };
};

const getEstimatorType = (model) => {
  if (!model) {
    return '';
  }

  return normalizeText(model.estimator_type || model.model_type || model.algorithm || model.name || model.model_name || '');
};

function PreRunEvaluationDashboard({
  open,
  nodes = [],
  edges = [],
  onClose,
  onApplyRouting,
  onEvaluationComplete,
}) {
  const [loading, setLoading] = useState(false);
  const [catalogByObjective, setCatalogByObjective] = useState({});
  const [evaluationRows, setEvaluationRows] = useState([]);
  const [routingApplied, setRoutingApplied] = useState(false);
  const [preRunMeta, setPreRunMeta] = useState(null);
  const onEvaluationCompleteRef = useRef(onEvaluationComplete);
  const lastEvaluationSignatureRef = useRef('');

  useEffect(() => {
    onEvaluationCompleteRef.current = onEvaluationComplete;
  }, [onEvaluationComplete]);

  const evaluationSignature = useMemo(() => buildEvaluationSignature(nodes, edges), [nodes, edges]);

  const runEvaluation = useCallback(async () => {
    if (!open) {
      return;
    }

    setLoading(true);

    try {
      let preRunData = {};
      let estimateByNodeId = {};

      try {
        const preRunResponse = await axios.post(PRE_RUN_INFERENCE_ENDPOINT, {
          nodes,
          edges,
        });
        preRunData = preRunResponse?.data || {};
        const estimateRows = Array.isArray(preRunData.estimates) ? preRunData.estimates : [];
        estimateByNodeId = estimateRows.reduce((accumulator, entry) => {
          if (entry?.node_id) {
            accumulator[entry.node_id] = entry.metrics || null;
          }
          return accumulator;
        }, {});
      } catch (preRunError) {
        const localRows = nodes.map((node, index) => ({
          node_id: node.id,
          metrics: localEstimateNodeMetrics(node, index, nodes.length),
        }));
        estimateByNodeId = localRows.reduce((accumulator, entry) => {
          accumulator[entry.node_id] = entry.metrics;
          return accumulator;
        }, {});
        preRunData = {
          pipeline_signature: '',
          generated_at: null,
          summary: {
            fallbackMode: true,
            message: 'Using local pre-run estimation because the backend pre-run endpoint is unavailable.',
          },
        };
      }

      const fetchCatalog = async (objective) => {
        const endpoint = MODEL_ENDPOINTS[objective];
        if (!endpoint) {
          return [];
        }

        const response = await axios.get(endpoint);
        return parseResponse(response.data);
      };

      const modelObjectives = Array.from(new Set(nodes.map((node) => getNodeObjective(node)).filter((objective) => MODEL_NODE_TYPES.has(objective))));
      const nextCatalog = {};

      await Promise.all(
        modelObjectives.map(async (objective) => {
          if (!objective || nextCatalog[objective]) {
            return;
          }

          try {
            nextCatalog[objective] = await fetchCatalog(objective);
          } catch (error) {
            nextCatalog[objective] = [];
          }
        }),
      );

      const seenNodeIds = new Set();
      const rows = nodes.map((node, index) => {
        // Skip duplicate node IDs
        if (seenNodeIds.has(node.id)) {
          return null;
        }
        seenNodeIds.add(node.id);

        const estimatedMetrics = estimateByNodeId[node.id] || null;
        const runtimeMetrics = estimatedMetrics || simulateRuntimeMetrics(node, { tick: index, pipelineRunning: false, pipelinePaused: false });
        const healthState = evaluateHealth(runtimeMetrics);
        const objective = getNodeObjective(node);
        const modelCatalog = nextCatalog[objective] || [];
        const currentModel = node?.data?.entity;
        const currentScore = currentModel ? scoreModel(currentModel, objective) : null;

        let recommendation = null;

        if (MODEL_NODE_TYPES.has(node?.type) && modelCatalog.length > 0) {
          const rankedCandidates = modelCatalog
            .map((candidate) => ({
              candidate,
              score: scoreModel(candidate, objective),
            }))
            .filter(({ score }) => score.metricValue !== null)
            .sort((left, right) => right.score.routeScore - left.score.routeScore);

          const bestCandidate = rankedCandidates[0] || null;
          const bestModel = bestCandidate?.candidate || null;
          const bestScore = bestCandidate?.score || null;
            const currentAlgorithm = getEstimatorType(currentModel);
            const alternativeCandidate = rankedCandidates.find(({ candidate }) => getEstimatorType(candidate) && getEstimatorType(candidate) !== currentAlgorithm) || bestCandidate;
            const alternativeModel = alternativeCandidate?.candidate || null;
            const alternativeScore = alternativeCandidate?.score || null;

            const lowPerformanceSignal = healthState.key !== 'healthy'
              || (currentScore && currentScore.metricValue !== null && bestScore && currentScore.routeScore + 0.0001 < bestScore.routeScore);

            if (bestModel && bestScore) {
              const hasNoScore = !currentScore || currentScore.metricValue === null;
              const shouldRoute = lowPerformanceSignal || hasNoScore;

              const selectedModel = shouldRoute && alternativeModel ? alternativeModel : bestModel;
              const selectedScore = shouldRoute && alternativeScore ? alternativeScore : bestScore;
              const selectedAlgorithm = getEstimatorType(selectedModel);
              const algorithmChanged = !!currentAlgorithm && !!selectedAlgorithm && currentAlgorithm !== selectedAlgorithm;

            recommendation = {
                shouldRoute: (lowPerformanceSignal || hasNoScore) && !!selectedModel,
              currentModel: getEntityLabel(currentModel),
              currentAlgorithm: currentAlgorithm,
              currentScore,
                bestModel: selectedModel,
                bestScore: selectedScore,
                selectedAlgorithm,
                algorithmChanged,
                reason: lowPerformanceSignal
                  ? `Model routing auto-triggered: runtime degraded (${healthState.label}). Switching from ${currentAlgorithm || 'unknown'} to ${selectedAlgorithm || 'unknown'}.`
                  : hasNoScore
                  ? (algorithmChanged
                    ? `Routing prefers ${getEntityLabel(selectedModel)} because the current model is not configured or has no score.`
                    : `The best-scoring option uses the same algorithm as the current model, so there is no alternate algorithm to route to.`)
                  : `Current model ${getEntityLabel(currentModel)} remains the best fit for this pipeline step.`,
            };
          }
        } else if (healthState.key !== 'healthy') {
          // Show degradation warning for non-model nodes or nodes without catalogs
          recommendation = {
            shouldRoute: false,
            currentModel: node?.data?.name || node?.type || 'Node',
            currentScore: null,
            bestModel: null,
            bestScore: null,
            reason: `Runtime degradation detected (${healthState.label}). Monitor this node during execution.`,
          };
        }

        return {
          nodeId: node.id,
          nodeType: node.type,
          title: getNodeTitle(node),
          inputSummary: buildInputSummary(node),
          runtimeMetrics,
          healthState,
          predictionMessage: buildPredictionMessage(runtimeMetrics),
          objective,
          recommendation,
        };
      }).filter(Boolean);

      setCatalogByObjective(nextCatalog);
      setEvaluationRows(rows);
      setPreRunMeta({
        pipelineSignature: preRunData.pipeline_signature || '',
        generatedAt: preRunData.generated_at || null,
        summary: preRunData.summary || null,
      });
      if (lastEvaluationSignatureRef.current !== evaluationSignature) {
        lastEvaluationSignatureRef.current = evaluationSignature;
        onEvaluationCompleteRef.current?.({
          localSignature: evaluationSignature,
          serverSignature: preRunData.pipeline_signature || evaluationSignature,
          generatedAt: preRunData.generated_at || null,
        });
      }
    } catch (error) {
      setPreRunMeta(null);
      setEvaluationRows([
        {
          nodeId: 'error',
          nodeType: 'error',
          title: 'Evaluation failed',
          inputSummary: [['Error', error?.message || 'Unable to evaluate the current pipeline']],
          runtimeMetrics: null,
          healthState: {
            key: 'critical',
            label: 'Evaluation failed',
            accent: '#f87171',
            background: 'rgba(41, 10, 13, 0.96)',
            border: 'rgba(248, 113, 113, 0.62)',
          },
          predictionMessage: 'Unable to build a pre-run evaluation snapshot',
          objective: '',
          recommendation: null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [evaluationSignature, nodes, open]);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setCatalogByObjective({});
      setEvaluationRows([]);
      setRoutingApplied(false);
      setPreRunMeta(null);
      return undefined;
    }

    runEvaluation();
  }, [open, runEvaluation]);

  useEffect(() => {
    if (evaluationRows.length === 0 || loading || routingApplied) {
      return;
    }

    const routeCount = evaluationRows.filter((row) => row.recommendation?.shouldRoute).length;
    const hasDegradation = evaluationRows.some((row) => row.healthState?.key === 'degraded' || row.healthState?.key === 'critical');
    const hasHighRisk = evaluationRows.some((row) => row.runtimeMetrics?.predictedRuntimeRisk === 'High');

    if ((routeCount > 0 && hasDegradation) || hasHighRisk) {
      // Auto-apply routing for degraded nodes
      const updatedNodes = nodes.map((node) => {
        const row = evaluationRows.find((evaluationRow) => evaluationRow.nodeId === node.id);
        const recommendedModel = row?.recommendation?.bestModel;
        // If the node is High risk, auto-apply regardless of shouldRoute
        const forceRoute = row?.runtimeMetrics?.predictedRuntimeRisk === 'High';

        if (!recommendedModel || (!row?.recommendation?.shouldRoute && !forceRoute)) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            entity: recommendedModel,
            model_id: recommendedModel.model_id || node.data?.model_id || null,
            model_name: recommendedModel.model_name || recommendedModel.estimator_type || node.data?.model_name || null,
          },
        };
      });

      setRoutingApplied(true);
      onApplyRouting?.(updatedNodes);
    }
  }, [evaluationRows, loading, routingApplied, nodes, onApplyRouting]);

  const applyRouting = () => {
    if (!onApplyRouting || routeCount === 0) {
      return;
    }

    const updatedNodes = nodes.map((node) => {
      const row = evaluationRows.find((evaluationRow) => evaluationRow.nodeId === node.id);
      const recommendedModel = row?.recommendation?.bestModel;

      if (!recommendedModel || !row?.recommendation?.shouldRoute) {
        return node;
      }

      return {
        ...node,
        data: {
          ...node.data,
          entity: recommendedModel,
          model_id: recommendedModel.model_id || node.data?.model_id || null,
          model_name: recommendedModel.model_name || recommendedModel.estimator_type || node.data?.model_name || null,
          estimator_type: recommendedModel.estimator_type || node.data?.estimator_type || null,
          estimator: recommendedModel.estimator_type || recommendedModel.estimator || node.data?.estimator || null,
          algorithm: recommendedModel.estimator_type || recommendedModel.algorithm || node.data?.algorithm || null,
        },
      };
    });

    setRoutingApplied(true);
    onApplyRouting(updatedNodes);
  };

  const routeSingleNode = (nodeId) => {
    if (!onApplyRouting) return;
    const row = evaluationRows.find((r) => r.nodeId === nodeId);
    const recommendedModel = row?.recommendation?.bestModel;
    if (!recommendedModel) return;

    const updatedNodes = nodes.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          entity: recommendedModel,
          model_id: recommendedModel.model_id || node.data?.model_id || null,
          model_name: recommendedModel.model_name || recommendedModel.estimator_type || node.data?.model_name || null,
          estimator_type: recommendedModel.estimator_type || node.data?.estimator_type || null,
          estimator: recommendedModel.estimator_type || recommendedModel.estimator || node.data?.estimator || null,
          algorithm: recommendedModel.estimator_type || recommendedModel.algorithm || node.data?.algorithm || null,
        },
      };
    });

    setRoutingApplied(true);
    onApplyRouting(updatedNodes);
  };

  const routeCount = evaluationRows.filter((row) => row.recommendation?.shouldRoute).length;
  const modelRows = evaluationRows.filter((row) => MODEL_NODE_TYPES.has(row.nodeType));
  const healthyRows = evaluationRows.filter((row) => row.healthState?.key === 'healthy').length;
  const degradedRows = evaluationRows.filter((row) => row.healthState?.key === 'degraded').length;
  const criticalRows = evaluationRows.filter((row) => row.healthState?.key === 'critical').length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Pre-run Model Evaluation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The dashboard inspects the collected pipeline inputs, scores each model node, and reroutes weak choices before run.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Chip icon={<CheckCircleIcon />} label={`${healthyRows} healthy`} color="success" variant="outlined" />
            <Chip icon={<WarningAmberIcon />} label={`${degradedRows} degraded`} color="warning" variant="outlined" />
            <Chip icon={<WarningAmberIcon />} label={`${criticalRows} critical`} color="error" variant="outlined" />
            <Chip icon={<AutorenewIcon />} label={`${routeCount} routing changes`} color={routeCount > 0 ? 'warning' : 'default'} variant="outlined" />
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ maxHeight: '78vh' }}>
        {loading ? (
          <Box sx={{ minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <CircularProgress />
            <Typography variant="body1">Collecting inputs and running the routing score...</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gap: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', background: 'background.paper' }}>
                <Typography variant="overline" color="text.secondary">Pipeline Nodes</Typography>
                <Typography variant="h5" fontWeight={700}>{evaluationRows.length}</Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', background: 'background.paper' }}>
                <Typography variant="overline" color="text.secondary">Model Nodes</Typography>
                <Typography variant="h5" fontWeight={700}>{modelRows.length}</Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', background: 'background.paper' }}>
                <Typography variant="overline" color="text.secondary">Model Catalogs</Typography>
                <Typography variant="h5" fontWeight={700}>{Object.keys(catalogByObjective).length}</Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', background: 'background.paper' }}>
                <Typography variant="overline" color="text.secondary">Routing Applied</Typography>
                <Typography variant="h5" fontWeight={700}>{routingApplied ? 'Yes' : 'No'}</Typography>
              </Box>
            </Box>

            {preRunMeta?.generatedAt ? (
              <Typography variant="caption" color="text.secondary">
                Pre-run inference generated at: {preRunMeta.generatedAt}
              </Typography>
            ) : null}

            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Collected Inputs and Runtime Signal
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Node</TableCell>
                    <TableCell>Collected Inputs</TableCell>
                    <TableCell>Runtime</TableCell>
                    <TableCell>Recommendation</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {evaluationRows.map((row) => (
                    <TableRow key={row.nodeId} hover>
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Typography variant="subtitle2" fontWeight={700}>{row.title}</Typography>
                        <Chip size="small" label={row.nodeType} sx={{ mt: 1 }} />
                        {row.objective ? (
                          <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
                            Objective: {row.objective}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top', minWidth: 240 }}>
                        {row.inputSummary.map(([label, value]) => (
                          <Typography key={`${row.nodeId}-${label}`} variant="body2">
                            <strong>{label}:</strong> {String(value)}
                          </Typography>
                        ))}
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top', minWidth: 240 }}>
                        <Chip
                          size="small"
                          label={row.healthState?.label || 'Unknown'}
                          color={row.healthState?.key === 'healthy' ? 'success' : row.healthState?.key === 'degraded' ? 'warning' : 'error'}
                          variant="outlined"
                          sx={{ mb: 1 }}
                        />
                        {row.runtimeMetrics ? (
                          <Box sx={{ display: 'grid', gap: 0.25 }}>
                            {getRuntimeRows(row).map(([label, value]) => (
                              <Typography key={`${row.nodeId}-${label}`} variant="body2">
                                {label}: {value}
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2">No runtime metrics available.</Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                          {row.predictionMessage}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top', minWidth: 260 }}>
                        {row.recommendation ? (
                          <Box sx={{ display: 'grid', gap: 0.75 }}>
                            <Typography variant="body2">Current: {row.recommendation.currentModel}</Typography>
                            {row.recommendation.currentAlgorithm ? (
                              <Typography variant="caption" color="text.secondary">Algorithm: {row.recommendation.currentAlgorithm} {row.recommendation.selectedAlgorithm ? `→ ${row.recommendation.selectedAlgorithm}` : ''}</Typography>
                            ) : null}
                            <Typography variant="body2">
                              Current metric: {row.recommendation.currentScore ? `${row.recommendation.currentScore.metricName} = ${formatMetricValue(row.recommendation.currentScore.metricValue)}` : 'n/a'}
                            </Typography>
                            <Typography variant="body2">
                              Recommended: {getEntityLabel(row.recommendation.bestModel)}
                            </Typography>
                            <Typography variant="body2">
                              Recommended metric: {row.recommendation.bestScore ? `${row.recommendation.bestScore.metricName} = ${formatMetricValue(row.recommendation.bestScore.metricValue)}` : 'n/a'}
                            </Typography>
                            {row.runtimeMetrics?.predictedRuntimeRisk === 'Moderate' && row.recommendation.algorithmChanged ? (
                              <Button size="small" variant="contained" onClick={() => routeSingleNode(row.nodeId)}>
                                Route
                              </Button>
                            ) : null}
                            {row.runtimeMetrics?.predictedRuntimeRisk === 'Moderate' && !row.recommendation.algorithmChanged ? (
                              <Typography variant="caption" color="text.secondary">
                                No alternate algorithm is available for this model set.
                              </Typography>
                            ) : null}
                            <Chip
                              size="small"
                              label={row.recommendation.shouldRoute ? (row.recommendation.algorithmChanged ? 'Route model' : 'Route keeps same algorithm') : 'Keep model'}
                              color={row.recommendation.shouldRoute ? 'warning' : 'success'}
                              variant="outlined"
                            />
                            <Typography variant="caption" color="text.secondary">
                              {row.recommendation.reason}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No model routing required for this node.
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>

            <Divider />

            <Box sx={{ display: 'grid', gap: 1 }}>
              <Typography variant="h6">Routing Summary</Typography>
              <Typography variant="body2" color="text.secondary">
                {routeCount === 0
                  ? 'No routing changes are required. The current model choices are stable enough to proceed.'
                  : `The dashboard found ${routeCount} model node(s) that should be rerouted before run. Apply the suggested route and recheck the pipeline once more.`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Score = 100 - (failure probability × 100). Risk is High when failure probability is at least 0.60 or score is below 40, Moderate when failure probability is at least 0.30 or score is below 70, otherwise Low.
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        <Button onClick={runEvaluation} variant="outlined" startIcon={<AutorenewIcon />} disabled={loading}>
          Re-evaluate
        </Button>
        {routingApplied ? (
          <Button variant="contained" color="success" disabled>
            Routing Applied ✓
          </Button>
        ) : (
          <Button onClick={applyRouting} variant="contained" color="warning" disabled={loading || routeCount === 0 || !onApplyRouting}>
            Apply Routing & Recheck
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default PreRunEvaluationDashboard;
export { buildEvaluationSignature };