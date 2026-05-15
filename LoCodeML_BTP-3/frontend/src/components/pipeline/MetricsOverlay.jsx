import React, { useEffect, useMemo, useState } from 'react';
import NodeMetricsTooltip from './NodeMetricsTooltip';
import { simulateRuntimeMetrics, buildPredictionMessage } from './RuntimeHealthEngine';
import { evaluateHealth } from './HealthEvaluator';
import axios from 'axios';

const MetricsOverlay = ({ hoveredNodeInfo, pipelineRunning = false, pipelinePaused = false }) => {
  const [activeNodeInfo, setActiveNodeInfo] = useState(null);
  const [visible, setVisible] = useState(false);
  const [tick, setTick] = useState(0);
  const [realTelemetry, setRealTelemetry] = useState(null);

  useEffect(() => {
    if (hoveredNodeInfo) {
      setActiveNodeInfo(hoveredNodeInfo);
      requestAnimationFrame(() => setVisible(true));
      return undefined;
    }

    setVisible(false);
    const hideTimer = window.setTimeout(() => setActiveNodeInfo(null), 150);
    return () => window.clearTimeout(hideTimer);
  }, [hoveredNodeInfo]);

  useEffect(() => {
    if (!activeNodeInfo) {
      setRealTelemetry(null);
      return undefined;
    }

    const fetchTelemetry = async () => {
      try {
        const nodeType = activeNodeInfo.node?.type || 'default';
        const response = await axios.get(`http://localhost:5001/telemetry/${nodeType}`);
        setRealTelemetry(response.data);
      } catch (err) {
        // Silent fail on telemetry fetch error
      }
    };

    fetchTelemetry();
    const interval = window.setInterval(() => {
      setTick((currentTick) => currentTick + 1);
      fetchTelemetry();
    }, 900);
    return () => window.clearInterval(interval);
  }, [activeNodeInfo]);

  const metrics = useMemo(() => {
    if (!activeNodeInfo?.node) {
      return null;
    }

    const simulatedMetrics = simulateRuntimeMetrics(activeNodeInfo.node, {
      tick,
      pipelineRunning,
      pipelinePaused,
      realTelemetry,
    });

    const healthState = evaluateHealth(simulatedMetrics);

    return {
      ...simulatedMetrics,
      healthState,
      predictionMessage: buildPredictionMessage(simulatedMetrics),
    };
  }, [activeNodeInfo, tick, pipelineRunning, pipelinePaused, realTelemetry]);

  if (!activeNodeInfo || !metrics) {
    return null;
  }

  return (
    <NodeMetricsTooltip
      node={activeNodeInfo.node}
      metrics={metrics}
      healthState={metrics.healthState}
      position={activeNodeInfo.position}
      nodeHeight={activeNodeInfo.nodeHeight}
      placement={activeNodeInfo.placement}
      visible={visible}
    />
  );
};

export default MetricsOverlay;