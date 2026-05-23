import React from "react";
import { Paper, Typography, Box, Alert, AlertTitle } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

const ValidationIssues = ({ issues, valid }) => {
  if (valid || !issues || issues.length === 0) {
    return (
      <Box mb={2}>
        <Alert severity="success" icon={<CheckCircleOutlineIcon />} style={{ borderRadius: "10px" }}>
          <AlertTitle style={{ fontWeight: "bold" }}>✔ Pipeline Valid</AlertTitle>
          All deterministic validation checks passed successfully.
        </Alert>
      </Box>
    );
  }

  return (
    <Box mb={2}>
      <Typography variant="subtitle2" style={{ fontWeight: "bold", marginBottom: "8px", color: "#374151" }}>
        Detected Pipeline Issues ({issues.length})
      </Typography>
      {issues.map((issue, index) => (
        <Alert
          key={index}
          severity={issue.severity === "error" ? "error" : "warning"}
          icon={issue.severity === "error" ? <ErrorOutlineIcon /> : <WarningAmberIcon />}
          style={{
            marginBottom: "8px",
            borderRadius: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}
        >
          <AlertTitle style={{ fontWeight: "bold", textTransform: "capitalize" }}>
            {issue.severity === "error" ? "Blocker Error" : "Pipeline Warning"}
          </AlertTitle>
          <Typography variant="body2" style={{ fontSize: "12px", lineHeight: 1.4 }}>
            {issue.message}
          </Typography>
          {issue.node_id && (
            <Typography
              variant="caption"
              style={{
                display: "block",
                marginTop: "4px",
                color: "#6b7280",
                fontFamily: "monospace"
              }}
            >
              Node ID: {issue.node_id}
            </Typography>
          )}
        </Alert>
      ))}
    </Box>
  );
};

export default ValidationIssues;
