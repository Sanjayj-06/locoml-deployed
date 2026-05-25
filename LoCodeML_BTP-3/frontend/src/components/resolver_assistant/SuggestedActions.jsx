import React from "react";
import { Paper, Typography, Button, Box, List, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

const SuggestedActions = ({ actions, onApply }) => {
  if (!actions || actions.length === 0) return null;

  const getActionDescription = (action) => {
    switch (action.type) {
      case "replace_node":
        return `Replace node "${action.node_id}" with model "${action.replacement}"`;
      case "delete_node":
        return `Delete node "${action.node_id}" from the pipeline`;
      case "add_node":
        return `Add new "${action.node_type}" node named "${action.label}"`;
      case "add_edge":
        return `Draw connection from "${action.source}" to "${action.target}"`;
      case "delete_edge":
        return `Remove connection between "${action.source}" and "${action.target}"`;
      default:
        return `Perform custom mutation: ${JSON.stringify(action)}`;
    }
  };

  const getActionIcon = (type) => {
    switch (type) {
      case "replace_node":
        return <SwapHorizIcon style={{ color: "#6366f1" }} />;
      case "delete_node":
        return <DeleteIcon style={{ color: "#ef4444" }} />;
      case "add_node":
        return <AddCircleIcon style={{ color: "#10b981" }} />;
      case "add_edge":
        return <ArrowRightAltIcon style={{ color: "#f59e0b" }} />;
      case "delete_edge":
        return <DeleteIcon style={{ color: "#f59e0b" }} />;
      default:
        return <AutoFixHighIcon style={{ color: "#8b5cf6" }} />;
    }
  };

  return (
    <Paper
      elevation={2}
      style={{
        padding: "16px",
        borderRadius: "12px",
        backgroundColor: "#fefefe",
        border: "1px solid #e5e7eb",
        marginTop: "16px"
      }}
    >
      <Box display="flex" alignItems="center" mb={1.5}>
        <Typography variant="subtitle1" style={{ fontWeight: "bold", color: "#1f2937" }}>
          Suggested Fixes
        </Typography>
      </Box>

      <Typography variant="body2" color="textSecondary" mb={1.5}>
        The assistant suggested the following actions. You can selectively review and apply them:
      </Typography>

      <List dense disablePadding>
        {actions.map((action, idx) => (
          <ListItem
            key={idx}
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              backgroundColor: "#f9fafb",
              border: "1px solid #f3f4f6",
              marginBottom: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <Box display="flex" alignItems="center" style={{ flex: 1, marginRight: "8px" }}>
              <ListItemIcon style={{ minWidth: "36px" }}>
                {getActionIcon(action.type)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" style={{ fontWeight: 550, color: "#374151" }}>
                    {getActionDescription(action)}
                  </Typography>
                }
              />
            </Box>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => onApply(action)}
              style={{
                borderRadius: "16px",
                textTransform: "none",
                fontWeight: "bold",
                fontSize: "11px",
                borderColor: "#6366f1",
                color: "#6366f1"
              }}
            >
              Apply Fix
            </Button>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default SuggestedActions;
