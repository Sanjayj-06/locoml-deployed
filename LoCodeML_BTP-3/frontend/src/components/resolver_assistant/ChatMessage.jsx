import React from "react";
import { Avatar, Typography, Box } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import PsychologyIcon from "@mui/icons-material/Psychology";

const ChatMessage = ({ message }) => {
  const isUser = message.sender === "user";

  return (
    <Box
      display="flex"
      flexDirection={isUser ? "row-reverse" : "row"}
      alignItems="flex-start"
      mb={2}
      width="100%"
    >
      <Avatar
        style={{
          backgroundColor: isUser ? "#6366f1" : "#10b981",
          marginRight: isUser ? 0 : "10px",
          marginLeft: isUser ? "10px" : 0,
          width: 32,
          height: 32
        }}
      >
        {isUser ? <PersonIcon fontSize="small" /> : <PsychologyIcon fontSize="small" />}
      </Avatar>

      <Box
        style={{
          maxWidth: "75%",
          backgroundColor: isUser ? "#e0e7ff" : "#f3f4f6",
          color: isUser ? "#1e1b4b" : "#1f2937",
          padding: "10px 14px",
          borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
        }}
      >
        <Typography
          variant="caption"
          style={{
            fontWeight: "bold",
            display: "block",
            color: isUser ? "#4f46e5" : "#059669",
            marginBottom: "4px"
          }}
        >
          {isUser ? "You" : "Resolver Assistant"}
        </Typography>
        <Typography
          variant="body2"
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            lineHeight: 1.5
          }}
        >
          {message.text}
        </Typography>
      </Box>
    </Box>
  );
};

export default ChatMessage;
