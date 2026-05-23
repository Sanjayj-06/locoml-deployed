import React from "react";
import { Button, CircularProgress } from "@mui/material";
import PsychologyIcon from "@mui/icons-material/Psychology";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

const ResolverAssistantButton = ({ onClick, status = "IDLE" }) => {
  // Define styles based on the status state machine
  let background = "linear-gradient(45deg, #6366f1, #4f46e5)"; // IDLE (Blue)
  let boxShadow = "0 4px 10px rgba(99, 102, 241, 0.3)";
  
  if (status === "INVALID") {
    background = "linear-gradient(45deg, #d32f2f, #ef5350)"; // INVALID (Red)
    boxShadow = "0 4px 10px rgba(211, 47, 47, 0.4)";
  } else if (status === "FIXING") {
    background = "linear-gradient(45deg, #f59e0b, #fbbf24)"; // FIXING (Orange)
    boxShadow = "0 4px 10px rgba(245, 158, 11, 0.4)";
  } else if (status === "VALID") {
    background = "linear-gradient(45deg, #10b981, #34d399)"; // VALID (Green)
    boxShadow = "0 4px 10px rgba(16, 185, 129, 0.4)";
  }

  // Determine the start icon
  const getStartIcon = () => {
    if (status === "FIXING") {
      return <CircularProgress size={16} style={{ color: "#ffffff", marginRight: "4px" }} />;
    }
    return <PsychologyIcon />;
  };

  return (
    <Button
      onClick={onClick}
      variant="contained"
      startIcon={getStartIcon()}
      style={{
        borderRadius: 20,
        background: background,
        color: "#ffffff",
        padding: "6px 14px",
        fontSize: "12px",
        fontWeight: "bold",
        marginRight: "5px",
        textTransform: "none",
        boxShadow: boxShadow,
        transition: "all 0.3s ease-in-out",
        position: "relative"
      }}
    >
      RESOLVER ASSISTANT
      {status === "INVALID" && (
        <FiberManualRecordIcon
          style={{
            color: "#ff1744",
            fontSize: "10px",
            position: "absolute",
            top: "-2px",
            right: "-2px",
            animation: "pulse 1.5s infinite"
          }}
        />
      )}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.9; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.9; }
        }
      `}</style>
    </Button>
  );
};

export default ResolverAssistantButton;
