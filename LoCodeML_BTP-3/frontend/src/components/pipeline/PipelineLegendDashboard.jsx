import React, { useEffect, useState } from 'react';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const getDynamicAction = (nodeType, pipelineRunning, pipelinePaused, tick, hasEntity) => {
  if (!hasEntity) {
    return "Pending configuration";
  }
  if (pipelinePaused) {
    return "Awaiting resume...";
  }
  if (!pipelineRunning) {
    return "Standby - Ready";
  }

  const cycle = tick % 3;
  const type = String(nodeType || "").toLowerCase();
  switch (type) {
    case 'inputdata':
      if (cycle === 0) return "Streaming raw batch columns...";
      if (cycle === 1) return "Validating schema integrity...";
      return "Feeding dataset forward...";
    case 'preprocessing':
      if (cycle === 0) return "Applying standard scaler...";
      if (cycle === 1) return "Imputing missing values...";
      return "Transforming features...";
    case 'adapter':
      if (cycle === 0) return "Reshaping array dimensions...";
      if (cycle === 1) return "Mapping request payload...";
      return "Normalizing input tensors...";
    case 'classification':
    case 'regression':
    case 'sentiment':
    case 'imageclassification':
    case 'huggingface':
      if (cycle === 0) return "Running tensor forward pass...";
      if (cycle === 1) return "Synthesizing inference weights...";
      return "Generating predictions...";
    default:
      return "Executing runtime task...";
  }
};

const getStatusDetails = (hasEntity, pipelineRunning, pipelinePaused) => {
  if (!hasEntity) {
    return {
      label: 'UNCONFIGURED',
      color: '#94a3b8', // slate-400
      glow: 'rgba(148, 163, 184, 0.15)',
      statusClass: 'pipeline-legend__status--pending'
    };
  }
  if (pipelinePaused) {
    return {
      label: 'PAUSED',
      color: '#fbbf24', // amber-400
      glow: 'rgba(251, 191, 36, 0.3)',
      statusClass: 'pipeline-legend__status--paused'
    };
  }
  if (pipelineRunning) {
    return {
      label: 'RUNNING',
      color: '#3b82f6', // blue-500
      glow: 'rgba(59, 130, 246, 0.45)',
      statusClass: 'pipeline-legend__status--running'
    };
  }
  return {
    label: 'READY',
    color: '#10b981', // emerald-500
    glow: 'rgba(16, 185, 129, 0.3)',
    statusClass: 'pipeline-legend__status--ready'
  };
};

const PipelineLegendDashboard = ({ nodes = [], edges = [], pipelineRunning = false, pipelinePaused = false }) => {
  const [tick, setTick] = useState(0);
  const [position, setPosition] = useState({ x: 20, y: 120 });
  const [size, setSize] = useState({ width: 340, height: 320 });

  useEffect(() => {
    if (!pipelineRunning) {
      return undefined;
    }
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1200);
    return () => clearInterval(interval);
  }, [pipelineRunning]);

  const handleHeaderMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (moveEvent) => {
      setPosition({
        x: Math.max(0, moveEvent.clientX - startX),
        y: Math.max(0, moveEvent.clientY - startY),
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMouseDown = (e, direction) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const startWidth = size.width;
    const startHeight = size.height;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosX = position.x;
    const startPosY = position.y;

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startPosX;
      let newY = startPosY;

      // Width and X calculations
      if (direction === 'br' || direction === 'tr') {
        newWidth = Math.max(260, startWidth + dx);
      } else if (direction === 'bl' || direction === 'tl') {
        newWidth = Math.max(260, startWidth - dx);
        if (newWidth > 260) {
          newX = startPosX + dx;
        }
      }

      // Height and Y calculations
      if (direction === 'br' || direction === 'bl') {
        newHeight = Math.max(180, startHeight + dy);
      } else if (direction === 'tr' || direction === 'tl') {
        newHeight = Math.max(180, startHeight - dy);
        if (newHeight > 180) {
          newY = startPosY + dy;
        }
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      className="pipeline-legend-dashboard"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      <div 
        className="pipeline-legend__header"
        onMouseDown={handleHeaderMouseDown}
        style={{ cursor: 'move', userSelect: 'none' }}
      >
        <div className="pipeline-legend__titleRow">
          <span className="pipeline-legend__title">Pipeline Dashboard</span>
        </div>
        {(pipelineRunning || pipelinePaused) && (
          <div className="pipeline-legend__systemStatus">
            <span className={`pipeline-legend__pulse ${pipelineRunning ? 'pipeline-legend__pulse--active' : ''}`} />
            <span className="pipeline-legend__statusLabel">
              {pipelineRunning ? 'RUNNING' : 'PAUSED'}
            </span>
          </div>
        )}
      </div>

      <div className="pipeline-legend__nodesList">
        {nodes.length === 0 ? (
          <div className="pipeline-legend__emptyState">
            <span className="pipeline-legend__emptyText">No active nodes in workspace</span>
            <span className="pipeline-legend__emptySubtext">Drag & drop components to construct flow</span>
          </div>
        ) : (
          nodes.map((node) => {
            const hasEntity = !!(node.data?.entity || node.data?.model_name || node.data?.preprocessingType || node.data?.scalerType || node.data?.bound_model);
            const status = getStatusDetails(hasEntity, pipelineRunning, pipelinePaused);
            const actionText = getDynamicAction(node.type, pipelineRunning, pipelinePaused, tick, hasEntity);
            const typeColor = node.style?.backgroundColor || '#cbd5e1';

            return (
              <div className="pipeline-legend__nodeRow" key={node.id}>
                <div className="pipeline-legend__nodeMeta">
                  <span 
                    className="pipeline-legend__nodeColorBadge" 
                    style={{ backgroundColor: typeColor }}
                  />
                  <div className="pipeline-legend__nodeNames">
                    <span className="pipeline-legend__nodeLabel">{node.data?.label || node.type}</span>
                    <span className="pipeline-legend__nodeAction" style={{ color: hasEntity ? '#475569' : '#94a3b8' }}>
                      {actionText}
                    </span>
                  </div>
                </div>

                <div 
                  className={`pipeline-legend__nodeBadge ${status.statusClass}`}
                  style={{
                    color: status.color,
                    borderColor: status.color,
                    boxShadow: `0 0 8px ${status.glow}`
                  }}
                >
                  {status.label}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="pipeline-legend__resizeHandle pipeline-legend__resizeHandle--tl" onMouseDown={(e) => handleResizeMouseDown(e, 'tl')} />
      <div className="pipeline-legend__resizeHandle pipeline-legend__resizeHandle--tr" onMouseDown={(e) => handleResizeMouseDown(e, 'tr')} />
      <div className="pipeline-legend__resizeHandle pipeline-legend__resizeHandle--bl" onMouseDown={(e) => handleResizeMouseDown(e, 'bl')} />
      <div className="pipeline-legend__resizeHandle pipeline-legend__resizeHandle--br" onMouseDown={(e) => handleResizeMouseDown(e, 'br')} />
    </div>
  );
};

export default PipelineLegendDashboard;
