import React, { memo, useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Select, Space, Button, Modal } from "antd";
import { DeleteOutlined } from '@ant-design/icons';
import axios from "axios";
import { AppBar, Drawer, LinearProgress, Slide, Toolbar } from "@mui/material";
import Description from '@mui/icons-material/Description';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';

import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography, Accordion, AccordionSummary, AccordionDetails, Box, TextField, FormControl, InputLabel, MenuItem, Checkbox, FormControlLabel } from "@mui/material";

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

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
    setIsCodeSaved(true);
  }

  const [code, setCode] = React.useState(`
    class CustomUtility():
    def __init__(self, data, target_column, utility_mode='default', parameters=None):
        """
        Initialize the utility with data, target column, and other configurations.
        """
        self.data = data
        self.target_column = target_column
        self.utility_mode = utility_mode
        self.parameters = parameters
        self.some_internal_property = None
        # Initialize other attributes as needed

    def get_numerical_columns(self):
        """
        Identify numerical columns in the dataset excluding the target column.
        """
        numerical_columns = [col for col in self.data.columns 
                             if self.data[col].dtype in ['int64', 'float64'] and col != self.target_column]
        self.numerical_columns = numerical_columns
    
    def get_categorical_columns(self):
        """
        Identify categorical columns in the dataset.
        """
        categorical_columns = [col for col in self.data.columns 
                               if self.data[col].dtype == 'object']
        self.categorical_columns = categorical_columns

    def prepare_data(self):
        """
        Prepare the data by identifying numerical and categorical columns and processing them as needed.
        """
        self.get_numerical_columns()
        self.get_categorical_columns()
        # Add additional preprocessing steps here

    def process_target_column(self):
        """
        Process or encode the target column if necessary.
        """
        # Add logic for target column processing (e.g., Label Encoding)
        pass

    def split_data(self, test_size=0.2, random_state=42):
        """
        Split the data into training and testing sets.
        """
        X = self.data.drop(self.target_column, axis=1)
        y = self.data[self.target_column]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=random_state)
        self.X_train = X_train
        self.X_test = X_test
        self.y_train = y_train
        self.y_test = y_test

    def get_preprocessor(self):
        """
        Create a preprocessing pipeline for numerical and categorical columns.
        """
        numerical_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler())
        ])
        
        categorical_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='most_frequent')),
            ('onehot', OneHotEncoder(handle_unknown='ignore'))
        ])

        preprocessor = ColumnTransformer(
            transformers=[
                ('num', numerical_transformer, self.numerical_columns),
                ('cat', categorical_transformer, self.categorical_columns)
            ]
        )
        self.preprocessor = preprocessor

    def get_estimator(self, model):
        """
        Create an estimator pipeline using the preprocessor and the given model.
        """
        self.estimator = Pipeline(steps=[
            ('preprocessor', self.preprocessor),
            ('model', model)
        ])

    def train_model(self, model):
        """
        Train a model on the processed dataset.
        """
        self.prepare_data()
        self.get_preprocessor()
        self.get_estimator(model)
        self.estimator.fit(self.X_train, self.y_train)
        print(f"Training complete with model: {model}")

    def evaluate_model(self):
        """
        Evaluate the trained model using common metrics.
        """
        y_pred = self.estimator.predict(self.X_test)
        accuracy = accuracy_score(self.y_test, y_pred)
        print(f"Accuracy: {accuracy}")
        # Add additional evaluation metrics as needed

    def save_model(self, filepath):
        """
        Save the trained model to a file.
        """
        joblib.dump(self.estimator, filepath)
        print(f"Model saved at {filepath}")
    
    # Add more utility-specific methods as needed
  `);

  const handleCodeChange = (event) => {
    setCode(event.target.value);
  };

  React.useEffect(() => {
    const fetchData = async () => {
      axios.get("/getTrainedModels/classification")
        .then((response) => {
          console.log("Received classification models: ", response.data);
          var classificationModelMap = {};
          const parsedModels = response.data.trained_models.map(model => JSON.parse(model.replace(/Infinity/g, "1e1000")));
          parsedModels.forEach((model) => {
            classificationModelMap[model.model_id] = model;
          });
          if (data && data.model_id) {
            if (classificationModelMap[data.model_id]) {
              data.entity = classificationModelMap[data.model_id];
              setIsModelSelected(true);
            } else {
              data.entity = null;
              setIsModelSelected(false);
              console.warn("Model ID not found in classificationModels map.");
            }
          } else {
            data.entity = null;
            setIsModelSelected(false);
          }
          setClassificationModels(classificationModelMap);
          setIsLoading(false);
        })
        .catch((error) => {
          console.log(error);
        });
    }
    fetchData();
  }
    , []);

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

      <div className="switchNode" onClick={handleOpenModal} style={{ width: "140px" }}>
        {/* <div className="switchIcon" /> */}
        {!isModelSelected && !isCodeSaved ? <Description style={{ fontSize: "14px", marginLeft: "8px" }} /> : <CheckBoxIcon style={{ fontSize: "14px", marginLeft: "8px" }} />}
        {/* <Description style={{ fontSize: "14px", marginLeft: "8px" }} /> */}
        <div className="switchLabel" >Classification</div>
        <Button
          style={{ height: "15px", width: "15px", borderRadius: "0px", marginLeft: "16px", marginBottom: "2px" }}
          type="text"
          icon={<DeleteSweepIcon style={{ fontSize: '11px' }} />}
          onClick={handleDelete}
          className="deleteButton"
        />
      </div>

      {/* <Modal
        title="Select Classification Model"
        visible={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
      >
        <div >
          <Select
            className="selectStyle nodrag nopan"
            options={Object.keys(classificationModels).map((model_id) => ({
              value: model_id,
              label: classificationModels[model_id].model_name,
            }))}
            disabled={isLoading}
            onChange={handleChange}
          />
        </div>
      </Modal> */}

      <Modal visible={isModalOpen} onCancel={handleCloseModal} onOk={handleCloseModal} width='800px'>
        <Typography id="modal-modal-title" variant="h6" component="h2">
          Edit Classifier Node
          {/* <IconButton
            aria-label="close"
            onClick={handleCloseModal}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton> */}
        </Typography>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Pre-Trained Models</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FormControl style={{ width: '200px' }}>
              <Select
                className="nodrag nopan"
                defaultValue={data?.model_id || ""}
                options={Object.keys(classificationModels).map((model_id) => ({
                  value: model_id,
                  label: classificationModels[model_id].model_name,
                }))}
                disabled={isLoading}
                onChange={handleChange}
                placeholder="Select a model"
              />
            </FormControl>
          </AccordionDetails>
        </Accordion>
        <Accordion expanded={isCustomModelOpen} onChange={handleOpenCustomModel}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Custom Model</Typography>
          </AccordionSummary>
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
                <Button onClick={handleCodeSave} variant="outlined" sx={{ marginLeft: '4px' }}>Save</Button> 
              </Box>
            </Box>
            {/* <Box sx ={{display : 'flex', justifyContent: "flex-end"}}>
              <Button onClick={handleCodeSave} variant="outlined">Save</Button>
            </Box> */}
          </AccordionDetails>
        </Accordion>
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
