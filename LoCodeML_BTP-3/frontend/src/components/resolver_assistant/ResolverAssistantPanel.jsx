import React, { useState, useEffect, useRef } from "react";
import { Drawer, Box, Typography, IconButton, TextField, Button, CircularProgress, Divider, Paper } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import PsychologyIcon from "@mui/icons-material/Psychology";
import axios from "axios";
import ChatMessage from "./ChatMessage";
import ValidationIssues from "./ValidationIssues";
import SuggestedActions from "./SuggestedActions";

const ResolverAssistantPanel = ({
  open,
  onClose,
  nodes,
  edges,
  datasetInfo,
  onApplyFix,
  validationResult,
  triggerValidation,
  pipelineMode = "INFERENCE"
}) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState([]);
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // When panel opens and there are validation issues, auto-fetch introductory explanation
  useEffect(() => {
    if (open && messages.length === 0 && validationResult && !validationResult.valid) {
      autoFetchExplanation();
    }
  }, [open, validationResult]);

  const autoFetchExplanation = async () => {
    setLoading(true);
    const welcomeMsg = {
      sender: "assistant",
      text: "Hello! I am your Resolver. I've detected some deterministic validation issues in your pipeline. Let me analyze them for you..."
    };
    setMessages([welcomeMsg]);

    try {
      const response = await axios.post("http://localhost:5001/resolver-assistant/chat", {
        nodes: nodes,
        edges: edges,
        dataset_id: datasetInfo,
        message: "Explain the current validation errors and suggest how to fix them.",
        pipeline_mode: pipelineMode
      });

      if (response.data && response.data.success) {
        setMessages((prev) => [
          ...prev,
          { sender: "assistant", text: response.data.response }
        ]);
        if (response.data.actions && response.data.actions.length > 0) {
          setSuggestedActions(response.data.actions);
        }
      }
    } catch (err) {
      console.error("Resolver Assistant auto-fetch failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: "I encountered an error trying to analyze the pipeline. Please make sure the backend is running."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userText = inputText.trim();
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setInputText("");
    setLoading(true);

    try {
      const response = await axios.post("http://localhost:5001/resolver-assistant/chat", {
        nodes: nodes,
        edges: edges,
        dataset_id: datasetInfo,
        message: userText,
        pipeline_mode: pipelineMode
      });

      if (response.data && response.data.success) {
        setMessages((prev) => [
          ...prev,
          { sender: "assistant", text: response.data.response }
        ]);
        if (response.data.actions && response.data.actions.length > 0) {
          // Merge or overwrite suggested actions
          setSuggestedActions(response.data.actions);
        } else {
          setSuggestedActions([]);
        }
      } else {
        throw new Error(response.data.error || "Unknown server error");
      }
    } catch (err) {
      console.error("Resolver Assistant message failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: `Error calling assistant: ${err.message || err}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAction = (action) => {
    onApplyFix(action);
    // Remove the applied action from suggested list
    setSuggestedActions((prev) => prev.filter((a) => a !== action));
    
    // Give feedback in chat
    setMessages((prev) => [
      ...prev,
      {
        sender: "assistant",
        text: `Applied change: ${action.type === 'replace_node' ? `Replaced node with ${action.replacement}` : action.type}. Let me revalidate the pipeline...`
      }
    ]);

    // Triggers local re-validation after mutation
    setTimeout(() => {
      triggerValidation();
    }, 400);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        style: {
          width: "480px",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          boxShadow: "-5px 0 25px rgba(0,0,0,0.15)",
          borderLeft: "1px solid #e5e7eb"
        }
      }}
    >
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        p={2.5}
        style={{
          background: "linear-gradient(135deg, #1e1b4b, #312e81)",
          color: "#ffffff"
        }}
      >
        <Box display="flex" alignItems="center">
          <Typography variant="h6" style={{ fontWeight: "bold", fontSize: "16px" }}>
            Resolver
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" style={{ color: "#ffffff" }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Main Container */}
      <Box style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {/* Deterministic Validation Results Panel */}
        {validationResult && (
          <ValidationIssues
            issues={validationResult.issues}
            valid={validationResult.valid}
          />
        )}

        <Divider style={{ margin: "16px 0" }} />

        {/* Chat History */}
        <Typography variant="caption" style={{ fontWeight: "bold", textTransform: "uppercase", color: "#6b7280", display: "block", marginBottom: "12px" }}>
          Copilot Thread
        </Typography>

        <Box display="flex" flexDirection="column">
          {messages.map((msg, index) => (
            <ChatMessage key={index} message={msg} />
          ))}

          {loading && (
            <Box display="flex" justifyContent="center" my={2}>
              <CircularProgress size={24} style={{ color: "#6366f1" }} />
              <Typography variant="body2" color="textSecondary" style={{ marginLeft: "8px", fontStyle: "italic" }}>
                Analyzing issues and drafting repairs...
              </Typography>
            </Box>
          )}
          <div ref={chatEndRef} />
        </Box>

        {/* Suggested Actions Approval list */}
        {suggestedActions.length > 0 && (
          <SuggestedActions
            actions={suggestedActions}
            onApply={handleApplyAction}
          />
        )}
      </Box>

      {/* Input Footer */}
      <Paper
        elevation={4}
        style={{
          padding: "16px",
          borderTop: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb"
        }}
      >
        <form onSubmit={handleSendMessage}>
          <Box display="flex">
            <TextField
              fullWidth
              size="small"
              placeholder="Ask a question or request a repair..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={loading}
              variant="outlined"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "8px"
              }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !inputText.trim()}
              style={{
                marginLeft: "8px",
                backgroundColor: "#6366f1",
                color: "#ffffff",
                minWidth: "48px",
                width: "48px",
                height: "40px",
                borderRadius: "8px"
              }}
            >
              <SendIcon fontSize="small" />
            </Button>
          </Box>
        </form>
      </Paper>
    </Drawer>
  );
};

export default ResolverAssistantPanel;
