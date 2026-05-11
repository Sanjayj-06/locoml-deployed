import React, { memo } from "react";
import { Handle, Position } from "reactflow";
import { Select, Space, Button, Modal } from "antd";
import { DeleteOutlined } from '@ant-design/icons';
import axios from "axios";
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';

import { Typography, Accordion, AccordionSummary, AccordionDetails, Box, TextField, Stack, Grid, Paper } from "@mui/material";

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { Table } from "reactstrap";

export default memo(({ id, data, isConnectable, nodeType }) => {
  React.useEffect(() => {
    window.addEventListener('error', e => {
      if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
        const resizeObserverErrDiv = document.getElementById(
          'webpack-dev-server-client-overlay-div'
        );
        const resizeObserverErr = document.getElementById(
          'webpack-dev-server-client-overlay'
        );
        if (resizeObserverErr) {
          resizeObserverErr.setAttribute('style', 'display: none');
        }
        if (resizeObserverErrDiv) {
          resizeObserverErrDiv.setAttribute('style', 'display: none');
        }
      }
    });
  }, []);


  const [classificationModels, setClassificationModels] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const [isModelSelected, setIsModelSelected] = React.useState(false);
  const [isCustomModelOpen, setIsCustomModelOpen] = React.useState(false);
  const [isCodeSaved, setIsCodeSaved] = React.useState(false);
  const [datasetDetails, setDatasetDetails] = React.useState("");
  const [datasetsDetailsError, setDatasetsDetailsError] = React.useState(true);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleOpenCustomModel = () => {
    setIsCustomModelOpen(!isCustomModelOpen);
  };

  const handleCodeSave = () => {
    console.log("Code to be saved:", code)
    try {
      axios.post(process.env.REACT_APP_MASTER_SERVER_SAVE_ADAPTER_CODE, {
        adapter_code: code
      })
        .then((response) => {
          console.log(response.data.message);
          setIsCodeSaved(true);
        }
        ).catch((error) => {
          console.log(error);
        });
    }
    catch (error) {
      console.error("Error saving code:", error);
    }

  }

  const fetchDatasetDetails = () => {
    try {
      axios.get(process.env.REACT_APP_MASTER_SERVER_GET_DATASET_DETAILS)
        .then((response) => {
          console.log(response.data.message);
          if (response.data.status === "error") {
            setDatasetsDetailsError(true);
          } else {
            setDatasetsDetailsError(false);
          }
          setDatasetDetails(response.data.message)
        }
        ).catch((error) => {
          console.log(error);
        });
    } catch (error) {
      console.error("Error fetching dataset details:", error);
      // Optionally, display an error message to the user
    }
  }

  const [code, setCode] = React.useState(`
def adaptInputForOutput():
    # df is the output dataframe from the previous node
    output_df = df.copy()

    # The output should be a dataframe with the following columns:
    # 'text' : the column on which inference will be performed
    # any other columns

    # ========= Add your custom code =========


    # ========================================

    final_df = [output_df.columns.tolist()]
    final_df.extend(output_df.values.tolist())

  `);

  const handleCodeChange = (event) => {
    setCode(event.target.value);
  };

  const handleChange = (value) => {
    // Pass selected value to parent component
    data.entity = classificationModels[value];
    setIsModelSelected(true);
  };

  const handleDelete = () => {
    data.onDelete(id);
  }

  // const [name, setName] = React.useState('Y-axis');
  // const [property, setProperty] = React.useState('msg. payload.acceleration.y');

  const handleOpenCodeEditor = () => {
    const codeContent = code; // Get the current code from the state
    const newWindow = window.open("", "_blank"); // Open a new tab/window
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Custom Model Code Editor</title>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.11/codemirror.min.css">  </link>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.11/codemirror.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.11/mode/python/python.min.js"></script>

          <style>
            .CodeMirror {
              height: 100%;
              width: 100%;
              font-family: monospace;
            }
            html, body {
                height: 100%;
                margin: 0;
            }
          </style>
        </head>
        <body>

        <textarea id="code-editor">${codeContent}</textarea>

        <script>
          var editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
            mode: "python",
            lineNumbers: true,
            theme: "default" // You can change the theme
          });
        </script>

        </body>
        </html>
      `);
      newWindow.document.close();
    } else {
      // Handle popup blocker or other issues preventing window opening
      alert("Please disable your popup blocker to open the code editor.");
    }

  };

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        // style={{ background: "#555" }}
        onConnect={(params) => console.log("handle onConnect", params)}
        isConnectable={isConnectable}
      />

      <div className="switchNode" onClick={handleOpenModal} style={{ width: "116px" }}>
        {/* <div className="switchIcon" /> */}
        {!isModelSelected && !isCodeSaved ? <AccountTreeIcon style={{ fontSize: "14px", marginLeft: "8px" }} /> : <CheckBoxIcon style={{ fontSize: "14px", marginLeft: "8px" }} />}
        {/* <Description style={{ fontSize: "14px", marginLeft: "8px" }} /> */}
        <div className="switchLabel" >Adapter</div>
        <Button
          style={{ height: "15px", width: "15px", borderRadius: "0px", marginLeft: "16px", marginBottom: "2px" }}
          type="text"
          icon={<DeleteSweepIcon style={{ fontSize: '11px' }} />}
          onClick={handleDelete}
          className="deleteButton"
        />
      </div>

      <Modal visible={isModalOpen} onCancel={handleCloseModal} onOk={handleCloseModal} width='800px'>
        <Typography id="modal-modal-title" variant="h6" component="h2">
          Edit Adapter Node
        </Typography>
        <Box sx={{ marginTop: '16px' }}>  {/* Add some spacing */}
          <Button
            onClick={fetchDatasetDetails}
            variant="outlined"
            sx={{ marginRight: '4px', marginBottom: '15px' }} // Add spacing
          >
            Fetch Dataset Details
          </Button>

          {datasetsDetailsError ? (
            <Typography variant="body2" color="error">{datasetDetails}</Typography>
          ) : (
            <Box sx={{ marginTop: '16px' }}>
              <Typography variant="h6" gutterBottom>Dataset Details (Columns)</Typography>
              <Grid container spacing={1} sx={{ maxWidth: '100%' }}>
                {Object.entries(datasetDetails).map(([key, value]) => (
                  <Grid item xs={6} sm={4} md={3} key={key}>
                    <Paper elevation={1} sx={{ padding: '2px', textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{key}</Typography>
                      <Typography variant="body2">
                        {value.replace("<class '", '').replace("'>", '')}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

        </Box>

        <AccordionDetails>
          <Box
            sx={{
              backgroundColor: '#f5f5f5',
              padding: '16px',
              borderRadius: '8px',
              overflowX: 'auto',
              fontFamily: 'Monospace',
              fontSize: '0.875rem',
              border: '1px solid #ddd',
              whiteSpace: 'pre-wrap',
              marginTop: '8px',
              marginBottom: '8px',
            }}
          >
            <TextField
              value={code}
              onChange={handleCodeChange}
              multiline
              fullWidth
              rows={20}  // Adjust the number of rows to fit the code block
              InputProps={{
                style: { fontFamily: 'Monospace', fontSize: '0.875rem' }
              }}
              variant="outlined"
              sx={{
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                border: 'none',
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', marginBottom: '-7px' }}>
              <Button onClick={handleOpenCodeEditor} variant="outlined">Open in Editor</Button> {/* New Button */}
              <Button onClick={handleCodeSave} variant="outlined" sx={{ marginLeft: '4px' }}>
                {isCodeSaved ? 'Saved' : 'Save'}
              </Button>
            </Box>
          </Box>
          {/* <Box sx ={{display : 'flex', justifyContent: "flex-end"}}>
              <Button onClick={handleCodeSave} variant="outlined">Save</Button>
            </Box> */}
        </AccordionDetails>
        {/* </Accordion> */}
      </Modal>

      {/* <Drawer
        anchor="right"
        open={isModalOpen}
        // onClose={onClose}
        variant="temporary"
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          '& .MuiDrawer-paper': {
            width: '400px',
            boxSizing: 'border-box',
          },
        }}
      >
        <Slide direction="left" in={isModalOpen} mountOnEnter unmountOnExit>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <AppBar position="static" color="default" elevation={0}>
              <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Edit switch node
                </Typography>
                <Button color="inherit" onClick={handleCloseModal}>Cancel</Button>
                <Button color="primary" onClick={handleCloseModal}>Done</Button>
              </Toolbar>
            </AppBar>

            <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
              <Button variant="outlined" color="error" sx={{ mb: 2 }}>
                Delete
              </Button>

              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>node properties</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <FormControl style={{width: '200px'}}>
                    <Select
                      className="nopan"
                      options={Object.keys(classificationModels).map((model_id) => ({
                        value: model_id,
                        label: classificationModels[model_id].model_name,
                      }))}
                      disabled={isLoading}
                      onChange={handleChange}
                    >
                    </Select>
                  </FormControl> */}
      {/* <TextField
                      label="Name"
                      variant="outlined"
                      fullWidth
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <FormControl fullWidth>
                      <InputLabel>Property</InputLabel>
                      <Select
                        value={property}
                        onChange={(e) => setProperty(e.target.value)}
                        label="Property"
                      >
                        <MenuItem value="msg. payload.acceleration.y">msg. payload.acceleration.y</MenuItem>
                      </Select>
                    </FormControl>
                    <Box sx={{ border: 1, borderColor: 'grey.300', p: 2, borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Select defaultValue=">" size="small" sx={{ mr: 1, minWidth: '60px' }}>
                          <MenuItem value=">">{'>'}</MenuItem>
                        </Select>
                        <TextField defaultValue="9.2" size="small" sx={{ width: '100px', mr: 1 }} />
                        <Typography sx={{ mr: 1 }}>→ 1</Typography>
                        <IconButton size="small">
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Button variant="outlined" size="small">+ add</Button>
                    </Box>
                    <FormControl fullWidth>
                      <InputLabel>Rule processing</InputLabel>
                      <Select defaultValue="checking" label="Rule processing">
                        <MenuItem value="checking">checking all rules</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControlLabel
                      control={<Checkbox />}
                      label="recreate message sequences"
                    /> */}

      {/* </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>node settings</Typography>
                </AccordionSummary>
                <AccordionDetails>
  
                </AccordionDetails>
              </Accordion>
            </Box>
          </Box>
        </Slide>
      </Drawer> */}

      {/* <div className="nodeContainer">
        <div className="nodeHeader">
          <div className="nodeTitle">Classification</div>
          <Button
            type="text"
            icon={<DeleteOutlined style={{ fontSize: '12px' }} />}
            onClick={handleDelete}
            className="deleteButton"
          />
        </div>
        <Select
          className="selectStyle nodrag nopan"
          options={Object.keys(classificationModels).map((model_id) => ({
            value: model_id,
            label: classificationModels[model_id].model_name
          }))}
          // className="nodrag nopan"
          disabled={isLoading}
          onChange={handleChange}
        />
      </div> */}

      <Handle
        type="source"
        position={Position.Right}
        id="b"
        // style={{ bottom: 10, top: "auto", background: "#555" }}
        isConnectable={isConnectable}
      />
    </>
  );
});
