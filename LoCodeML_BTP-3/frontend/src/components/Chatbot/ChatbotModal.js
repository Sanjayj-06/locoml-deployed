import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Modal, 
  IconButton, 
  Button, 
  Avatar, 
  TextField, 
  Paper, 
  Badge
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import { Margin } from '@mui/icons-material';

const style = {
  position: 'absolute',
  top: '50%',
//   left: '25%',
  transform: 'translate(+10%,-50%)',
  width: '35vw',
  bgcolor: 'background.paper',
  borderRadius: 2,
  boxShadow: 24,
  p: 0,
  outline: 'none',
  height: '80vh',
  display: 'flex',
  flexDirection: 'column'
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  p: 2,
  borderBottom: '1px solid #eee',
  bgcolor: '#f9f9f9',
  borderRadius: '8px 8px 0 0'
};

const botInfoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 2
};

const chatContainerStyle = {
  p: 2,
  flexGrow: 1,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 2
};

const inputContainerStyle = {
  p: 2,
  borderTop: '1px solid #eee',
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  position: 'sticky',
  top: 0,
  backgroundColor: 'white',
  zIndex: 1
};

const botMessageContainerStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 2,
  maxWidth: '85%',
  alignSelf: 'flex-start'
};

const botMessageStyle = {
  bgcolor: 'white',
  p: 2,
  borderRadius: '12px',
  width: '100%',
  boxShadow: '0px 2px 4px rgba(0,0,0,0.1)'
};

const userMessageStyle = {
  bgcolor: '#3345dd',
  color: '#FFFFFF',
  p: 2,
  borderRadius: '12px',
  maxWidth: '80%',
  alignSelf: 'flex-end'
};

// Style for the option buttons based on the reference image
const optionButtonStyle = {
  border: '2px solid #3345dd',
  borderRadius: '25px',
  color: '#333',
  textTransform: 'none',
  m: 0.5,
  p: '10px 15px',
  fontWeight: 'medium',
  backgroundColor: 'white',
  '&:hover': {
    backgroundColor: '#3345dd',
    borderColor: 'rgb(87, 100, 209)',
    color: '#fff',
  },
};

const ChatbotModal = (props) => {
  const open = props.open;
  const handleClose = props.handleClose;
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      text: "Hello, I am an Assistant to help you in building the pipelline.👋", 
      sender: "bot" 
    },
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [showOptions, setShowOptions] = useState(true);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Auto-scroll to the latest message whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Ensure the chat is scrolled to the bottom when the modal opens
  useEffect(() => {
    if (open && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [open]);

  const buildResponse = (message) => {
    let response = "";
    const dataset_name = message.dataset_name || '';
    const dataset_type = message.dataset_type || '';
    const preprocessing_steps = message.preprocessing_steps || '';
    const task = message.task || '';
    const model_type = message.model_type || '';
    const additional_info = message.additional_info || '';
    if(dataset_name){
      response += `Dataset (Model trained on): ${dataset_name}`;
    }
    if(preprocessing_steps){
      response += `\nPreprocessing Steps: ${preprocessing_steps}`;
    }
    if(task){
      response += `\nTask: ${task}`;
    }
    if(model_type){
      response += `\nModel Type: ${model_type}`;
    }
    if(additional_info){
      response += `\nAdditional Info: ${additional_info}`;
    }
    return response;
  };

  const handleSend = () => {
    if (inputValue.trim()) {
      // Add user message to chat
      setMessages([...messages, { id: messages.length + 1, text: inputValue, sender: 'user' }]);
      setInputValue('');
      setShowOptions(false);
      const user_messeges = messages.filter(msg => msg.sender === 'user');
      const messages_text = user_messeges.map(msg => msg.text);
      console.log(messages_text);
      fetch('/processQuery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: inputValue,
          previous_messages: messages_text,
        })
      })
      .then(response => response.json())
      .then(data => {
        if(data.success){
          const message = data.data;
          if(data.got_required_params){
            setMessages(prev => [...prev, {
              id: prev.length + 1,
              text: "Based on your requirements, please confirm the following details:",
              sender: 'bot'
            }]);
            const response = buildResponse(message);
            setMessages(prev => [...prev, {
              id: prev.length + 1,
              text: response,
              sender: 'bot',
              showGeneratePipeline: true
            }]);
          }
          else{
            const response = message;
            setMessages(prev => [...prev, {
              id: prev.length + 1,
              text: response,
              sender: 'bot',
            }]);
          }
        }
        else{
          setMessages(prev => [...prev, {
            id: prev.length + 1,
            text: "Sorry, I couldn't generate the pipeline: " + data.error,
            sender: 'bot'
          }]);
        }
      })
      .catch(error => {
        console.error('Error:', error);
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          text: "Sorry, there was an error communicating with the server.",
          sender: 'bot'
        }]);
      });
    }
  };

  const handlegeneratePipeline = () => {
    setMessages(prev => [...prev, {
      id: prev.length + 1,
      text: "Generating pipeline, please wait...",
      sender: 'bot'
    }]);
    fetch('/generatePipeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(response => response.json())
    .then(data => {
      console.log("Inside generate pipeline", data);
      if (data.success && data.data.pipeline) {
        props.onSendMessage(data.data);
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          text: "I've generated a pipeline based on your request. You can view it in your workspace. Please remember to upload the test dataset before running the pipeline.",          sender: 'bot'
        }]);
      } else {
        // Handle error
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          text: `Sorry, I couldn't generate the pipeline: ${data.error}`,
          sender: 'bot'
        }]);
      }
    })
    .catch(error => {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: prev.length + 1,
        text: "Sorry, there was an error communicating with the server.",
        sender: 'bot'
      }]);
    });
  }
  

  // Create a bot avatar component for reuse
  const BotAvatar = () => (
    <Avatar 
      alt="Bot Avatar" 
      sx={{ 
        width: 36, 
        height: 36,
        bgcolor: '#4CAF50'
      }}
    >
      <img src={require('./../../assets/img/chatbotChat.jpg')} alt="chatbot" />
    </Avatar>
  );

  return (
    <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="pipeline-chatbot"
        aria-describedby="pipeline-assistant-chatbot"
        BackdropComponent={() => (
        <Box
            onClick={handleClose}
            sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'transparent',
            display: 'flex'
            }}
        >
            <Box 
            sx={{
                width: '42vw',
                height: '100%',
                bgcolor: 'rgba(0, 0, 0, 0.5)'
            }}
            />
            <Box 
            sx={{
                width: '50%',
                height: '100%',
                bgcolor: 'transparent'
            }}
            />
        </Box>
        )}
    >

      <Box sx={style}>
        {/* Header */}
        <Box sx={headerStyle}>
          <Box sx={botInfoStyle}>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              variant="dot"
              color="success"
            >
              <Avatar alt="Bot Avatar" sx={{ width: 40, height: 40 }}>
                <img src={require('./../../assets/img/chatbotChat.jpg')} alt="chatbot" />
              </Avatar>
            </Badge>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                Pipeline LLM
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        
        {/* Messages Container */}
        <Box sx={chatContainerStyle} ref={chatContainerRef}>
          {messages.map((message) => (
            <React.Fragment key={message.id}>
              {message.sender === 'bot' && !message.isOptions ? (
                <Box sx={botMessageContainerStyle}>
                  <BotAvatar />
                  <Paper elevation={0} sx={botMessageStyle}>
                    <Typography variant="body1" style={{ whiteSpace: "pre-wrap" }}>
                      {message.text}
                    </Typography>
                  </Paper>
                </Box>
              ) : message.sender === 'user' ? (
                <Paper elevation={0} sx={userMessageStyle}>
                  <Typography variant="body1" style={{ whiteSpace: "pre-wrap" }}>
                    {message.text}
                  </Typography>
                </Paper>
              ) : null}
              {message.showGeneratePipeline && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                  <Button
                    variant="outlined"
                    sx={optionButtonStyle}
                    onClick={handlegeneratePipeline}
                  >
                    Generate Pipeline
                  </Button>
                </Box>
              )}
            </React.Fragment>
          ))}
          {/* This empty div serves as a reference for scrolling to the latest message */}
          <div ref={messagesEndRef} />
        </Box>
        
        {/* Input Area - now positioned to stay at the bottom */}
        <Box sx={inputContainerStyle}>
          <TextField
            fullWidth
            placeholder="Send a message..."
            variant="outlined"
            size="small"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <IconButton color="primary" onClick={handleSend}>
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
    </Modal>
  );
};

export default ChatbotModal;