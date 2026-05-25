import React from 'react';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';

const formatPercent = (value) => value == null ? 'N/A' : `${Math.round(value)}%`;
const formatLatency = (value) => value == null ? 'N/A' : `${Math.round(value)}ms`;
const formatConfidence = (value) => value == null ? 'N/A' : `${Math.round(value)}%`;

const getStatusLabel = (failureRisk) => {
  if (failureRisk === 'High') return 'Critical';
  if (failureRisk === 'Moderate') return 'Degraded';
  return 'Stable';
};

const getBadgeLabel = (healthState) => {
  if (healthState?.key === 'critical') return 'CRITICAL';
  if (healthState?.key === 'degraded') return 'WARNING';
  return 'HEALTHY';
};

const StatusIcon = ({ failureRisk }) => {
  if (failureRisk === 'High') {
    return <ErrorIcon fontSize="small" style={{ color: '#f87171' }} />;
  }
  if (failureRisk === 'Moderate') {
    return <WarningIcon fontSize="small" style={{ color: '#fbbf24' }} />;
  }
  return <CheckCircleIcon fontSize="small" style={{ color: '#4ade80' }} />;
};

const metricRows = (metrics) => ([
  { label: 'Latency', value: formatLatency(metrics.latency) },
  { label: 'CPU', value: formatPercent(metrics.cpuUsage) },
  { label: 'GPU', value: formatPercent(metrics.gpuUsage) },
  { label: 'Memory', value: formatPercent(metrics.memoryUsage) },
]);

const NodeMetricsTooltip = ({
  node,
  metrics,
  healthState,
  position,
  nodeHeight = 0,
  placement = 'above',
  visible = false,
}) => {
  if (!node || !metrics || !healthState) {
    return null;
  }

  const runtimeStatus = metrics.predictionMessage || getStatusLabel(metrics.predictedRuntimeRisk);
  const verticalTransform = placement === 'below'
    ? 'translate(-50%, 8px)'
    : 'translate(-50%, calc(-100% - 8px))';

  const predictionConfidence = metrics.failureProbability == null ? null : Math.round((1 - metrics.failureProbability) * 100);

  return (
    <div
      className="runtime-health-tooltip"
      style={{
        left: position.x,
        top: placement === 'below' ? (position.y + nodeHeight + 8) : position.y,
        transform: `${verticalTransform} scale(${visible ? 1 : 0.96})`,
        opacity: visible ? 1 : 0,
        borderColor: healthState.border,
        pointerEvents: 'none',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div className="runtime-health-tooltip__header">
        <div className="runtime-health-tooltip__titleRow">
          <div className="runtime-health-tooltip__titleCopy">
            <div className="runtime-health-tooltip__nodeName">{metrics.nodeName}</div>
            <div className="runtime-health-tooltip__modelName">{metrics.modelName}</div>
          </div>
        </div>
        <div
          className="runtime-health-tooltip__badge"
          style={{
            color: healthState.accent,
            borderColor: healthState.accent,
          }}
        >
          {getBadgeLabel(healthState)}
        </div>
      </div>

      <div className="runtime-health-tooltip__metrics">
        {metricRows(metrics).map(({ label, value }) => (
          <div className="runtime-health-tooltip__metricRow" key={label}>
            <span className="runtime-health-tooltip__metricLabel">{label}</span>
            <span className="runtime-health-tooltip__metricValue">{value}</span>
          </div>
        ))}
      </div>

      <div className="runtime-health-tooltip__riskPanel">
        <div className="runtime-health-tooltip__riskSection">
          <span className="runtime-health-tooltip__riskLabel">Failure Risk</span>
          <span
            className="runtime-health-tooltip__riskValue"
            style={{ color: healthState.accent }}
          >
            {metrics.predictedRuntimeRisk}
          </span>
          <div className="runtime-health-tooltip__confidenceRow">
            <span className="runtime-health-tooltip__confidenceLabel">Prediction Confidence</span>
            <span className="runtime-health-tooltip__confidenceValue">{formatConfidence(predictionConfidence)}</span>
          </div>
        </div>
      </div>

      <div className="runtime-health-tooltip__statusStrip">
        <StatusIcon failureRisk={metrics.predictedRuntimeRisk} />
        <span className="runtime-health-tooltip__statusStripLabel">Runtime Status</span>
        <span className="runtime-health-tooltip__statusStripValue">{runtimeStatus}</span>
      </div>
    </div>
  );
};

export default NodeMetricsTooltip;