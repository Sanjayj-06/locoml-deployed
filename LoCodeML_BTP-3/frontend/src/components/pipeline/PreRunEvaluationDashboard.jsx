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

const getNodeTitle = (node) => node?.data?.name || node?.data?.label || node?.data?.entity?.model_name || node?.data?.entity?.model_id || node?.type || 'Pipeline Node';

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

  if (data.name) summary.push(['Name', data.name]);
  if (data.label) summary.push(['Label', data.label]);
  if (data.preprocessingType) summary.push(['Preprocessing Type', data.preprocessingType]);
  if (data.task_name) summary.push(['Task', data.task_name]);
  if (data.model_name) summary.push(['Model Name', data.model_name]);
  if (data.model_id) summary.push(['Model ID', data.model_id]);

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

        const runtimeMetrics = simulateRuntimeMetrics(node, { tick: index, pipelineRunning: false, pipelinePaused: false });
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

            recommendation = {
                shouldRoute: (lowPerformanceSignal || hasNoScore) && !!selectedModel,
              currentModel: getEntityLabel(currentModel),
              currentScore,
                bestModel: selectedModel,
                bestScore: selectedScore,
                reason: lowPerformanceSignal
                  ? `Model routing auto-triggered: runtime degraded (${healthState.label}). Switching to ${getEntityLabel(selectedModel)} (${getEstimatorType(selectedModel)}).`
                  : hasNoScore
                  ? `Routing prefers ${getEntityLabel(selectedModel)} because the current model is not configured or has no score.`
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
      if (lastEvaluationSignatureRef.current !== evaluationSignature) {
        lastEvaluationSignatureRef.current = evaluationSignature;
        onEvaluationCompleteRef.current?.(evaluationSignature);
      }
    } catch (error) {
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

    if (routeCount > 0 && hasDegradation) {
      // Auto-apply routing for degraded nodes
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
                            <Typography variant="body2">Latency: {formatMetricValue(row.runtimeMetrics.latency)} ms</Typography>
                            <Typography variant="body2">CPU: {formatMetricValue(row.runtimeMetrics.cpuUsage)}%</Typography>
                            <Typography variant="body2">GPU: {formatMetricValue(row.runtimeMetrics.gpuUsage)}%</Typography>
                            <Typography variant="body2">Memory: {formatMetricValue(row.runtimeMetrics.memoryUsage)}%</Typography>
                            <Typography variant="body2">Throughput: {formatMetricValue(row.runtimeMetrics.throughput)}</Typography>
                            <Typography variant="body2">Risk: {row.runtimeMetrics.predictedRuntimeRisk}</Typography>
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
                            <Typography variant="body2">
                              Current metric: {row.recommendation.currentScore ? `${row.recommendation.currentScore.metricName} = ${formatMetricValue(row.recommendation.currentScore.metricValue)}` : 'n/a'}
                            </Typography>
                            <Typography variant="body2">
                              Recommended: {getEntityLabel(row.recommendation.bestModel)}
                            </Typography>
                            <Typography variant="body2">
                              Recommended metric: {row.recommendation.bestScore ? `${row.recommendation.bestScore.metricName} = ${formatMetricValue(row.recommendation.bestScore.metricValue)}` : 'n/a'}
                            </Typography>
                            <Chip
                              size="small"
                              label={row.recommendation.shouldRoute ? 'Route model' : 'Keep model'}
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