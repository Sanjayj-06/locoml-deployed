import React, { useState, useEffect, useRef } from "react";
import { Drawer, Box, Typography, IconButton, TextField, Button, CircularProgress, Collapse } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SendIcon from "@mui/icons-material/Send";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import PsychologyIcon from "@mui/icons-material/Psychology";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore";
import TerminalIcon from "@mui/icons-material/Terminal";
import LaunchIcon from "@mui/icons-material/Launch";
import axios from "axios";

// Helper to map validation issues to sleek structured diagnostics
const mapIssueToDiagnostic = (issue, action) => {
  const issueId = issue.id || "";
  const nodeId = issue.node_id || "";
  const severity = issue.severity || "error";

  let title = "Pipeline Configuration Warning";
  let rootCause = issue.message || "An unspecified validation issue was detected.";
  let impact = "Pipeline execution may succeed but could produce unexpected outcomes.";
  let suggestedFix = "Review the node connection and parameters.";
  let autoFixPreview = [];
  let confidence = "92% (High)";

  if (issueId === "graph_has_cycle") {
    title = "Graph Cycle Detected";
    rootCause = "The pipeline graph contains a loop (a node connects back to an upstream ancestor).";
    impact = "Pipeline execution will loop infinitely or fail during execution.";
    suggestedFix = "Remove the back-edge to restore a Directed Acyclic Graph (DAG) structure.";
    if (action) {
      autoFixPreview = [
        `Remove edge connection: ${action.source} ➔ ${action.target}`,
        "Revalidate graph structure"
      ];
    }
    confidence = "98% (Deterministic)";
  } else if (issueId.includes("missing_dataset") || issueId.includes("missing_dataset_selection")) {
    title = "Dataset Source Missing";
    rootCause = `The Inputs node "${nodeId}" has no dataset file uploaded or selected.`;
    impact = "Preprocessing and model training cannot begin without a valid data source.";
    suggestedFix = "Bind an existing dataset (CSV/ZIP) from the catalog or upload a new one.";
    if (action) {
      autoFixPreview = [
        "Auto-bind first compatible tabular dataset from user catalog",
        "Revalidate pipeline input variables"
      ];
    } else {
      autoFixPreview = [
        "Upload dataset via catalog uploader",
        "Bind uploaded dataset to inputs node"
      ];
    }
    confidence = "99% (Rule-Based)";
  } else if (issueId.includes("missing_model_selection")) {
    title = "Unbound Model Node";
    rootCause = `The Model node "${nodeId}" has no trained model selected.`;
    impact = "Pipeline predictions are blocked until an estimator model is selected.";
    suggestedFix = "Select a trained model from your repository or execute the training wizard.";
    if (action) {
      autoFixPreview = [
        "Auto-select most compatible trained estimator model",
        "Bind selected model and parameters to pipeline"
      ];
    }
    confidence = "99% (Rule-Based)";
  } else if (issueId.includes("model_task_mismatch")) {
    title = "Pipeline Task Mismatch";
    rootCause = `The dataset schema is incompatible with the selected Model type.`;
    impact = "Pipeline execution will fail at runtime due to shape or target type conflicts.";
    suggestedFix = `Replace the Model node with a compatible node type.`;
    if (action) {
      autoFixPreview = [
        `Replace model type with compatible estimator: ${action.replacement}`,
        "Automatically bind a compatible trained model from catalog",
        "Revalidate pipeline semantic schemas"
      ];
    }
    confidence = "96% (AI Verified)";
  } else if (issueId.includes("incompatible_preprocessing")) {
    title = "Incompatible Preprocessing";
    rootCause = `The Preprocessing node "${nodeId}" features operations incompatible with the dataset format.`;
    impact = "Preprocessing stage will throw runtime data format/shape exceptions.";
    suggestedFix = "Reconfigure preprocessing node properties or delete this preprocessing node.";
    if (action) {
      autoFixPreview = [
        `Delete preprocessing node "${action.node_id}" from active path`,
        "Route Inputs directly to Model stage",
        "Revalidate pipeline"
      ];
    }
    confidence = "95% (AI Verified)";
  } else if (issueId.includes("disconnected_model_node")) {
    title = "Disconnected Model Node";
    rootCause = `The model node "${nodeId}" is not connected to the active execution flow.`;
    impact = "The pipeline cannot execute end-to-end because the terminal model is isolated.";
    suggestedFix = "Connect the upstream preprocessing output to the model input.";
    confidence = "99% (Rule-Based)";
  } else if (issueId.includes("incomplete_execution_chain")) {
    title = "Incomplete Execution Chain";
    rootCause = "The pipeline does not contain a continuous Input → Preprocessing → Model execution path.";
    impact = "Semantic readiness cannot be granted until a complete execution chain exists.";
    suggestedFix = "Connect every critical execution node into a continuous graph path.";
    confidence = "99% (Rule-Based)";
  } else if (issueId.includes("unreachable_terminal_node")) {
    title = "Unreachable Terminal Node";
    rootCause = `The terminal node "${nodeId}" cannot be reached from the input chain.`;
    impact = "The model is outside the executable pipeline path.";
    suggestedFix = "Wire the model node into the main execution graph.";
    confidence = "99% (Rule-Based)";
  } else if (issueId.includes("isolated_pipeline_component")) {
    title = "Isolated Pipeline Component";
    rootCause = `The node "${nodeId}" belongs to a disconnected graph component.`;
    impact = "Disconnected components invalidate semantic readiness.";
    suggestedFix = "Merge the isolated component into the main pipeline flow.";
    confidence = "99% (Rule-Based)";
  }

  return { title, severity, rootCause, impact, suggestedFix, autoFixPreview, confidence };
};

const ResolverAssistantPanel = ({
  open,
  onClose,
  nodes,
  edges,
  datasetInfo,
  validationResult,
  triggerValidation,
  pipelineMode = "INFERENCE",
  onHighlightNode,
  messages = [],
  setMessages,
  selectedIssue = null,
  setSelectedIssue,
  applyGraphAction,
  applyGraphActionsBatch,
  setResolverStatus
}) => {
  const [collapsedDetails, setCollapsedDetails] = useState({});
  const [expandedExplanations, setExpandedExplanations] = useState({});
  const [fixingAll, setFixingAll] = useState(false);

  const hasInputSelection = () => {
    const inputNode = nodes.find(n => n.type === 'inputData' || n.data?.label === 'Inputs');
    if (!inputNode) return false;
    
    const entity = inputNode.data?.entity;
    const isManual = inputNode.data?.dataset_type === 'manual' || 
                     (entity && typeof entity === 'object' && entity.manual_inputs);
    
    const hasDataset = !!(inputNode.data?.dataset_id || 
                         (entity && typeof entity === 'object' && (entity.dataset_id || entity.id || entity.name || entity.filename)) ||
                         (typeof entity === 'string' && entity));
    
    return !!(isManual || hasDataset);
  };

  const hasFixableIssues = () => {
    return issues.some(issue => {
      const issueId = issue.id || "";
      if (issueId.includes("missing_inputs_node") || issueId.includes("missing_dataset") || issueId.includes("missing_dataset_selection")) {
        return false;
      }
      if (issueId.includes("missing_model_selection") || issueId.includes("missing_model")) {
        return hasInputSelection();
      }
      return true;
    });
  };

  const handleFixAllIssues = async () => {
    setFixingAll(true);
    if (typeof setResolverStatus === 'function') {
      setResolverStatus("FIXING");
    }

    let batchApplied = false;
    try {
      const allActions = [];

      // 1. Check for missing model selection and autoselect model
      const modelIssue = issues.find(issue => issue.id?.includes("missing_model_selection") || issue.id?.includes("missing_model"));
      if (modelIssue && hasInputSelection()) {
        allActions.push({
          type: "auto_select_model",
          node_id: modelIssue.node_id
        });
      }

      // 2. Check for other structural issues and fix via LLM
      const structuralIssues = issues.filter(issue => {
        const id = issue.id || "";
        return !id.includes("missing_inputs_node") && 
               !id.includes("missing_dataset") && 
               !id.includes("missing_dataset_selection") &&
               !id.includes("missing_model");
      });

      if (structuralIssues.length > 0) {
        const inputNode = nodes.find(n => n.type === 'inputData' || n.data?.label === 'Inputs');
        const dsInfo = inputNode?.data?.entity;

        const payload = {
          nodes: nodes,
          edges: edges,
          dataset_id: dsInfo,
          original_filename: dsInfo?.filename || dsInfo?.name,
          pipeline_mode: pipelineMode,
          message: `Please fix all pipeline validation issues. Generate structured repair actions to resolve disconnected nodes, cycles, and isolated components.`
        };

        const response = await axios.post(`${(process.env.REACT_APP_MASTER_SERVER_URL || ((process.env.REACT_APP_API_BASE_URL || "http://localhost:5000") + "/proxy/master-server"))}/resolver-assistant/chat`, payload);
        const data = response.data;

        if (data && Array.isArray(data.actions) && data.actions.length > 0) {
          allActions.push(...data.actions);
        }
      }

      if (allActions.length > 0) {
        if (typeof applyGraphActionsBatch === 'function') {
          await applyGraphActionsBatch(allActions);
          batchApplied = true;
        } else {
          for (const action of allActions) {
            if (typeof applyGraphAction === 'function') {
              await applyGraphAction(action);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to fix issues automatically:", err);
      alert("AI Auto Fix encountered an error. Some issues may need manual adjustment.");
    } finally {
      setFixingAll(false);
      if (typeof setResolverStatus === 'function') {
        setResolverStatus("IDLE");
      }
      if (!batchApplied && typeof triggerValidation === 'function') {
        triggerValidation();
      }
    }
  };

  const toggleExplanation = (idx) => {
    setExpandedExplanations(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const toggleDetails = (idx) => {
    setCollapsedDetails(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Extract variables safely
  const isEmptyWorkspace = !nodes || nodes.length === 0;
  const valid = isEmptyWorkspace ? true : (validationResult ? validationResult.valid : true);
  const issues = isEmptyWorkspace ? [] : (validationResult ? validationResult.issues || [] : []);

  // Helper to highlight a node in ReactFlow
  const highlightNode = (nodeId) => {
    if (nodeId && typeof onHighlightNode === 'function') {
      onHighlightNode(nodeId);
    }
  };

  // Generate GitHub-actions style timeline validation steps
  const getTimelineSteps = () => {
    if (isEmptyWorkspace) {
      return [
        {
          label: "Graph Structure Check",
          description: "No components in workspace",
          status: "pending"
        },
        {
          label: "Semantic Integrity",
          description: "Execution chain is empty",
          status: "pending"
        },
        {
          label: "Inputs & Bindings",
          description: "No input node defined",
          status: "pending"
        },
        {
          label: "Readiness Status",
          description: "Add components to start",
          status: "pending"
        }
      ];
    }

    const hasCycle = issues.some(i => i.id === "graph_has_cycle");
    const hasSemanticError = issues.some(i => i.id?.includes("mismatch") || i.id?.includes("incompatible"));
    const hasMissingNode = issues.some(i => i.id?.includes("missing_dataset") || i.id?.includes("missing_model"));
    const hasStructuralBlocker = issues.some(i =>
      i.id?.includes("disconnected_model_node") ||
      i.id?.includes("incomplete_execution_chain") ||
      i.id?.includes("unreachable_terminal_node") ||
      i.id?.includes("isolated_pipeline_component") ||
      i.id?.includes("disconnected_graph")
    );

    return [
      {
        label: "Graph Structure Check",
        description: hasCycle ? "Cycles detected in execution graph" : (hasStructuralBlocker ? "Execution graph has disconnected components" : "Execution graph is cycle-free"),
        status: hasCycle || hasStructuralBlocker ? "warning" : "success"
      },
      {
        label: "Semantic Integrity",
        description: hasSemanticError ? "Task or node type mismatch found" : (hasStructuralBlocker ? "Execution chain is incomplete" : "Pipeline node compatibility verified"),
        status: hasCycle || hasStructuralBlocker ? "warning" : (hasSemanticError ? "warning" : "success")
      },
      {
        label: "Inputs & Bindings",
        description: hasMissingNode ? "Required inputs or model selection missing" : (hasStructuralBlocker ? "A critical node is not connected to the execution flow" : "Dataset and models bound correctly"),
        status: (hasCycle || hasSemanticError) ? "pending" : ((hasMissingNode || hasStructuralBlocker) ? "warning" : "success")
      },
      {
        label: "Readiness Status",
        description: valid ? "All checks passed. Pipeline is run-ready." : "Pipeline execution blocked",
        status: valid ? "success" : "warning"
      }
    ];
  };

  // Dynamically generate detailed explanations with exactly 5 key diagnostic sections
  const getDetailedExplanation = (issue) => {
    const issueId = issue.id || "";
    const nodeId = issue.node_id || "";
    const severity = issue.severity || "error";

    let rootCause = "";
    let impact = "";
    let recommendedActions = [];
    let suggestedRepairStrategy = "";

    if (issueId === "graph_has_cycle") {
      rootCause = "The pipeline graph contains a loop (a node connects back to an upstream ancestor).";
      impact = "Pipeline execution will loop infinitely or fail during execution.";
      recommendedActions = [
        "Remove the cyclical feedback connection (back-edge).",
        "Ensure data flows in a Directed Acyclic Graph (DAG) pattern.",
        "Re-route connections to establish a clean left-to-right flow."
      ];
      suggestedRepairStrategy = "Identify the cycle back-edge in the pipeline editor, delete the edge, and revalidate the schema topology.";
    } else if (issueId.includes("missing_dataset") || issueId.includes("missing_dataset_selection")) {
      rootCause = `The Inputs node "${nodeId}" has no dataset file uploaded or selected.`;
      impact = "Preprocessing and model training cannot begin without a valid data source.";
      recommendedActions = [
        "Select an existing dataset (CSV/ZIP) from the catalog.",
        "Upload a new dataset via the catalog uploader.",
        "Auto-bind the first compatible tabular dataset from the user catalog."
      ];
      suggestedRepairStrategy = "Upload or select a valid dataset file to populate columns and types for downstream nodes.";
    } else if (issueId.includes("missing_model_selection")) {
      rootCause = `The Model node "${nodeId}" has no trained estimator model selected.`;
      impact = "Pipeline predictions are blocked until an estimator model is selected.";
      recommendedActions = [
        "Select a trained model from your repository.",
        "Execute the training wizard to generate a new trained model.",
        "Auto-select the most compatible trained estimator model matching this task type."
      ];
      suggestedRepairStrategy = "Bind a trained model artifact matching your pipeline task type (e.g., classification or regression).";
    } else if (issueId.includes("model_task_mismatch")) {
      rootCause = "The dataset schema or task type is incompatible with the selected Model type.";
      impact = "Pipeline execution will fail at runtime due to shape or target type conflicts.";
      recommendedActions = [
        "Replace the current Model node with a compatible estimator node type.",
        "Automatically bind a compatible trained model from the catalog.",
        "Verify target variable data types match model expectations (e.g., categorical vs continuous)."
      ];
      suggestedRepairStrategy = "Swap the Model node with a compatible estimator type or align target variables.";
    } else if (issueId.includes("incompatible_preprocessing")) {
      rootCause = `The Preprocessing node "${nodeId}" features operations incompatible with the dataset format.`;
      impact = "Preprocessing stage will throw runtime data format or shape exceptions, crashing the pipeline.";
      recommendedActions = [
        "Modify preprocessing node properties (e.g., column selections, scaler type).",
        "Remove the incompatible preprocessing node entirely.",
        "Connect the Inputs node directly to the Model node."
      ];
      suggestedRepairStrategy = "Delete the incompatible preprocessing node or update its configurations to align with column schemas.";
    } else {
      rootCause = issue.message || "An unspecified pipeline validation issue has occurred.";
      impact = "Downstream stages might behave unpredictably or raise exceptions during execution.";
      recommendedActions = [
        "Inspect the properties of the highlighted node.",
        "Verify all input and output connections are correct.",
        "Run local pipeline validation to trace constraints."
      ];
      suggestedRepairStrategy = "Review the node connection paths and parameters in the properties panel.";
    }

    return {
      rootCause,
      impact,
      recommendedActions,
      technicalContext: {
        nodeId: nodeId || "Graph Level",
        severity: severity === "error" ? "Blocker Error" : "Warning",
        rule: issueId
      },
      suggestedRepairStrategy
    };
  };

  const steps = getTimelineSteps();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        style: {
          width: "480px",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.06)",
          borderLeft: "1px solid #E5E7EB",
          backgroundColor: "#FAFAFA",
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }
      }}
    >
      {/* Top Compact Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        p={2}
        style={{
          background: "#FFFFFF",
          color: "#0F172A",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <Box display="flex" flexDirection="column">
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6" style={{ fontWeight: 600, fontSize: "15px", letterSpacing: "-0.02em", color: "#0F172A" }}>
              Resolver Workstation
            </Typography>
          </Box>
        </Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <IconButton onClick={() => triggerValidation(null, null, true)} size="small" style={{ color: "#64748B" }} title="Run Re-validation Check">
            <RefreshIcon style={{ fontSize: "18px" }} />
          </IconButton>
          <IconButton onClick={onClose} size="small" style={{ color: "#64748B" }}>
            <CloseIcon style={{ fontSize: "18px" }} />
          </IconButton>
        </Box>
      </Box>

      {/* Main Container */}
      <Box style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Section 1: Compact Pipeline Status */}
        <Box
          style={{
            padding: "16px",
            backgroundColor: isEmptyWorkspace ? "#F8FAFC" : (valid ? "#ECFDF5" : "#FEF3C7"),
            border: isEmptyWorkspace ? "1px solid #E2E8F0" : (valid ? "1px solid #D1FAE5" : "1px solid #FDE68A"),
            borderRadius: "14px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}
        >
          <Box display="flex" flexDirection="column" gap="4px">
            <Box display="flex" alignItems="center" gap={1}>
              {isEmptyWorkspace ? (
                <HelpOutlineIcon style={{ color: "#64748B", fontSize: "18px" }} />
              ) : valid ? (
                <CheckCircleOutlineIcon style={{ color: "#059669", fontSize: "18px" }} />
              ) : (
                <WarningAmberIcon style={{ color: "#D97706", fontSize: "18px" }} />
              )}
              <Typography variant="subtitle2" style={{ fontWeight: 600, color: isEmptyWorkspace ? "#475569" : (valid ? "#065F46" : "#92400E"), fontSize: "13px" }}>
                {isEmptyWorkspace ? "No Pipeline Detected" : (valid ? "Pipeline Semantically Sound" : `${issues.length} Blocker Issue${issues.length > 1 ? "s" : ""} Detected`)}
              </Typography>
            </Box>
            <Typography variant="body2" style={{ color: isEmptyWorkspace ? "#64748B" : (valid ? "#047857" : "#B45309"), fontSize: "12px", paddingLeft: "26px", lineHeight: "1.4" }}>
              {isEmptyWorkspace 
                ? "Add components to the canvas to compile and validate your machine learning workflow." 
                : (valid 
                  ? "All validation checks passed. The pipeline is fully configured and ready for execution." 
                  : "Review the diagnostics and recommended repairs below to fix structural anomalies."
                )
              }
            </Typography>
          </Box>
          {!valid && hasFixableIssues() && (
            <Button
              variant="contained"
              disabled={fixingAll}
              onClick={handleFixAllIssues}
              startIcon={fixingAll ? <CircularProgress size={16} color="inherit" /> : undefined}
              style={{
                backgroundColor: "#4F46E5",
                color: "#FFFFFF",
                textTransform: "none",
                fontWeight: 600,
                fontSize: "12px",
                borderRadius: "8px",
                padding: "6px 12px",
                width: "100%",
                boxShadow: "0 2px 4px rgba(79, 70, 229, 0.15)"
              }}
            >
              {fixingAll ? "Fixing Issues..." : "Fix Issues"}
            </Button>
          )}
        </Box>

        {/* Section 3: Validation Timeline (CI/CD Style) */}
        <Box 
          style={{ 
            padding: "16px", 
            backgroundColor: "#FFFFFF", 
            borderRadius: "14px", 
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)" 
          }}
        >
          <Typography variant="subtitle2" style={{ fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748B", marginBottom: "16px" }}>
            Validation Pipeline
          </Typography>
          <Box style={{ display: "flex", flexDirection: "column", gap: "16px", position: "relative" }}>
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1;
              return (
                <Box key={idx} style={{ display: "flex", gap: "12px", alignItems: "flex-start", position: "relative" }}>
                  {/* Connector Line */}
                  {!isLast && (
                    <div style={{
                      position: "absolute",
                      left: "9px",
                      top: "22px",
                      bottom: "-10px",
                      width: "2px",
                      backgroundColor: step.status === "success" ? "#10B981" : "#E2E8F0",
                      zIndex: 1
                    }} />
                  )}
                  {/* Dot Icon */}
                  <div style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                    backgroundColor: step.status === "success" ? "#ECFDF5" : step.status === "warning" ? "#FFFBEB" : "#F8FAFC",
                    color: step.status === "success" ? "#059669" : step.status === "warning" ? "#D97706" : "#94A3B8",
                    border: step.status === "pending" ? "1.5px solid #CBD5E1" : "none",
                    fontSize: "11px",
                    fontWeight: "bold"
                  }}>
                    {step.status === "success" ? "✓" : step.status === "warning" ? "!" : idx + 1}
                  </div>
                  {/* Labels */}
                  <Box style={{ paddingTop: "1px" }}>
                    <Typography variant="body2" style={{ fontWeight: 600, fontSize: "13px", color: step.status === "pending" ? "#94A3B8" : "#1E293B" }}>
                      {step.label}
                    </Typography>
                    <Typography variant="caption" style={{ color: "#64748B", fontSize: "11px" }}>
                      {step.description}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {isEmptyWorkspace && (
          <Box
            style={{
              padding: "24px",
              textAlign: "center",
              backgroundColor: "#FFFFFF",
              border: "1px dashed #E5E7EB",
              borderRadius: "14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
            }}
          >
            <PsychologyIcon style={{ fontSize: "40px", color: "#94A3B8" }} />
            <Typography variant="subtitle2" style={{ fontWeight: 600, color: "#1E293B", fontSize: "14px" }}>
              Workspace is Empty
            </Typography>
            <Typography variant="body2" style={{ color: "#64748B", fontSize: "12px", lineHeight: "1.5" }}>
              Drag and drop components (Presets or Custom nodes) from the left sidebar to start building your machine learning pipeline.
            </Typography>
          </Box>
        )}

        {/* Section 2: AI Diagnostics Cards */}
        {!valid && issues.length > 0 && (
          <Box display="flex" flexDirection="column" gap="16px">
            <Typography variant="subtitle2" style={{ fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748B" }}>
              Active AI Diagnostics
            </Typography>
            
            {issues.map((issue, idx) => {
              const diag = mapIssueToDiagnostic(issue);
              const isCollapsed = !collapsedDetails[idx];
              const detailedDiag = getDetailedExplanation(issue);

              return (
                <Box
                  key={idx}
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: diag.severity === "error" ? "1px solid #FEE2E2" : "1px solid #FEF3C7",
                    borderRadius: "14px",
                    padding: "16px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
                  }}
                >
                  {/* Header Pill */}
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      backgroundColor: diag.severity === "error" ? "#FEE2E2" : "#FEF3C7",
                      color: diag.severity === "error" ? "#991B1B" : "#92400E"
                    }}>
                      {diag.severity === "error" ? "Blocker Error" : "Warning"}
                    </span>
                  </Box>

                  {/* Core Diagnostic Section */}
                  <Box display="flex" flexDirection="column" gap="8px">
                    <Typography variant="body1" style={{ fontWeight: 600, fontSize: "14px", color: "#1E293B" }}>
                      {diag.title}
                    </Typography>
                    
                    {/* Root Cause */}
                    <Box>
                      <Typography variant="caption" style={{ fontWeight: 600, textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.05em", color: "#64748B", display: "block" }}>
                        Root Cause
                      </Typography>
                      <Typography variant="body2" style={{ fontSize: "13px", color: "#334155", marginTop: "2px", lineHeight: "1.4" }}>
                        {diag.rootCause}
                      </Typography>
                    </Box>

                    {/* Impact */}
                    <Box>
                      <Typography variant="caption" style={{ fontWeight: 600, textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.05em", color: "#64748B", display: "block" }}>
                        Impact
                      </Typography>
                      <Typography variant="body2" style={{ fontSize: "13px", color: "#475569", marginTop: "2px", lineHeight: "1.4" }}>
                        {diag.impact}
                      </Typography>
                    </Box>

                    {/* Suggested Fix */}
                    <Box>
                      <Typography variant="caption" style={{ fontWeight: 600, textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.05em", color: "#64748B", display: "block" }}>
                        Suggested Fix
                      </Typography>
                      <Typography variant="body2" style={{ fontSize: "13px", color: "#0F172A", marginTop: "2px", lineHeight: "1.4", fontWeight: 500 }}>
                        {diag.suggestedFix}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Technical Details Collapsible Box */}
                  <Collapse in={!isCollapsed}>
                    <Box 
                      style={{ 
                        marginTop: "4px", 
                        padding: "10px 12px", 
                        backgroundColor: "#F8FAFC", 
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0",
                        fontFamily: "Courier, monospace",
                        fontSize: "11px",
                        color: "#475569",
                        wordBreak: "break-word",
                        lineHeight: "1.4"
                      }}
                    >
                      <div>Error code: {issue.id}</div>
                      {issue.node_id && <div>Failing Node ID: {issue.node_id}</div>}
                      <div>Severity level: {issue.severity}</div>
                    </Box>
                  </Collapse>

                  {/* Expanded AI Issue Explanation Panel */}
                  <Collapse in={!!expandedExplanations[idx]}>
                    <Box
                      style={{
                        marginTop: "4px",
                        padding: "16px",
                        backgroundColor: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        borderRadius: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px"
                      }}
                    >
                      {/* Root Cause */}
                      <Box>
                        <Typography variant="caption" style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.05em", color: "#64748B", display: "block" }}>
                          Root Cause
                        </Typography>
                        <Typography variant="body2" style={{ fontSize: "13px", color: "#1E293B", marginTop: "2px", lineHeight: "1.4" }}>
                          {detailedDiag.rootCause}
                        </Typography>
                      </Box>

                      {/* Impact */}
                      <Box>
                        <Typography variant="caption" style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.05em", color: "#64748B", display: "block" }}>
                          Impact
                        </Typography>
                        <Typography variant="body2" style={{ fontSize: "13px", color: "#475569", marginTop: "2px", lineHeight: "1.4" }}>
                          {detailedDiag.impact}
                        </Typography>
                      </Box>

                      {/* Recommended Actions */}
                      <Box>
                        <Typography variant="caption" style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.05em", color: "#64748B", display: "block" }}>
                          Recommended Actions
                        </Typography>
                        <Box style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                          {detailedDiag.recommendedActions.map((act, actIdx) => (
                            <Typography key={actIdx} variant="body2" style={{ fontSize: "12px", color: "#334155", display: "flex", alignItems: "flex-start", gap: "6px", lineHeight: "1.4" }}>
                              <span style={{ color: "#4F46E5", fontWeight: "bold", marginRight: "4px" }}>•</span>
                              {act}
                            </Typography>
                          ))}
                        </Box>
                      </Box>

                      {/* Technical Context */}
                      <Box>
                        <Typography variant="caption" style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.05em", color: "#64748B", display: "block", marginBottom: "4px" }}>
                          Technical Context
                        </Typography>
                        <Box 
                          style={{ 
                            padding: "10px 12px", 
                            backgroundColor: "#1E293B", 
                            borderRadius: "8px",
                            fontFamily: 'Consolas, "Fira Code", monospace',
                            fontSize: "11px",
                            color: "#E2E8F0",
                            wordBreak: "break-word",
                            lineHeight: "1.4"
                          }}
                        >
                          <div>Node ID: {detailedDiag.technicalContext.nodeId}</div>
                          <div>Severity: {detailedDiag.technicalContext.severity}</div>
                          <div>Validation Rule: {detailedDiag.technicalContext.rule}</div>
                        </Box>
                      </Box>

                      {/* Suggested Repair Strategy */}
                      <Box>
                        <Typography variant="caption" style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.05em", color: "#64748B", display: "block" }}>
                          Suggested Repair Strategy
                        </Typography>
                        <Typography variant="body2" style={{ fontSize: "13px", color: "#0F172A", marginTop: "2px", lineHeight: "1.4", fontWeight: 500 }}>
                          {detailedDiag.suggestedRepairStrategy}
                        </Typography>
                      </Box>
                    </Box>
                  </Collapse>

                  {/* Diagnostics Cards Interactive Action Bar */}
                  <Box 
                    display="flex" 
                    gap={1} 
                    style={{ 
                      borderTop: "1px solid #F1F5F9", 
                      paddingTop: "10px", 
                      marginTop: "4px" 
                    }}
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => toggleExplanation(idx)}
                      startIcon={expandedExplanations[idx] ? <CloseIcon style={{ fontSize: "13px" }} /> : <HelpOutlineIcon style={{ fontSize: "13px" }} />}
                      style={{
                        borderColor: "#E2E8F0",
                        color: expandedExplanations[idx] ? "#E11D48" : "#475569",
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: "11px",
                        borderRadius: "6px",
                        padding: "3px 8px"
                      }}
                    >
                      {expandedExplanations[idx] ? "Close" : "Explain Issue"}
                    </Button>

                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => toggleDetails(idx)}
                      style={{
                        borderColor: "#E2E8F0",
                        color: "#64748B",
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: "11px",
                        borderRadius: "6px",
                        padding: "3px 8px",
                        marginLeft: "auto"
                      }}
                    >
                      {isCollapsed ? "View Details" : "Hide Details"}
                    </Button>
                  </Box>

                </Box>
              );
            })}
          </Box>
        )}

        {/* Empty space at the bottom of drawer */}
        <Box style={{ flexGrow: 1 }} />

      </Box>
    </Drawer>
  );
};

export default ResolverAssistantPanel;
