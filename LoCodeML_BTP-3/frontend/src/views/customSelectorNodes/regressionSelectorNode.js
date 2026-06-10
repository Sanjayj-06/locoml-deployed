import React, { memo } from "react";
import { Handle, Position } from "reactflow";
import { Select, Space, Button, Modal } from "antd";
import { DeleteOutlined } from '@ant-design/icons'; import axios from "axios";
import Description from '@mui/icons-material/Description';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
// import { IconButton } from "rsuite";
import { Accordion, AccordionDetails, AccordionSummary, Box, TextField, Typography } from "@mui/material";
import { FormControl } from "@mui/base";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const parseTrainedModels = (responseData) => {
  const normalizedResponse = typeof responseData === "string"
    ? (() => {
        try {
          return JSON.parse(responseData);
        } catch (error) {
          return {};
        }
      })()
    : responseData;

  const trainedModels = Array.isArray(normalizedResponse?.trained_models) ? normalizedResponse.trained_models : [];

  return trainedModels
    .map((model) => {
      if (typeof model === "string") {
        try {
          return JSON.parse(model.replace(/Infinity/g, "1e1000"));
        } catch (error) {
          console.warn("Skipping invalid model payload:", error);
          return null;
        }
      }

      return model;
    })
    .filter(Boolean);
};

const isRegressionModel = (model) => {
  if (!model) return false;
  const objective = String(
    model?.objective || model?.training_mode || model?.task_type || model?.model_task || ''
  ).toLowerCase();
  const estimatorType = String(
    model?.estimator_type || model?.estimator || model?.estimatorType || ''
  ).toLowerCase();
  const candidates = [objective, estimatorType, JSON.stringify(model || {})].join(' ');

  return candidates.includes('regress') || objective === 'regression' || objective.includes('regression');
};

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

  const [regressionModels, setRegressionModels] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isCodeSaved, setIsCodeSaved] = React.useState(false);
  const [isCustomModelOpen, setIsCustomModelOpen] = React.useState(false);

  const isModelSelected = !!(data?.model_id || data?.entity);

  const [recommendation, setRecommendation] = React.useState(null);
  const [isFetchingRec, setIsFetchingRec] = React.useState(false);

  const fetchRecommendation = async (modelId) => {
    if (!modelId) {
      setRecommendation(null);
      return;
    }
    setIsFetchingRec(true);
    try {
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const response = await axios.get(`${apiBase}/getRecommendation?model_id=${modelId}`);
      if (response.data && response.data.success && response.data.has_recommendation) {
        setRecommendation(response.data.recommendation);
      } else {
        setRecommendation(null);
      }
    } catch (error) {
      console.error("Error fetching recommendation:", error);
      setRecommendation(null);
    } finally {
      setIsFetchingRec(false);
    }
  };

  React.useEffect(() => {
    if (data?.model_id) {
      fetchRecommendation(data.model_id);
    } else {
      setRecommendation(null);
    }
  }, [data?.model_id]);

  const handleUseRecommendation = () => {
    if (!recommendation) return;
    const recModelObj = {
      model_id: recommendation.model_id,
      model_name: recommendation.model_name,
      estimator_type: recommendation.estimator_type,
      objective: recommendation.objective,
      target_column: recommendation.target_column,
      evaluation_metrics: [
        { metric_name: recommendation.metric_name, metric_value: recommendation.metric_value }
      ]
    };
    setRegressionModels(prev => ({
      ...prev,
      [recommendation.model_id]: recModelObj
    }));
    data.entity = recModelObj;
    data.model_id = recommendation.model_id;
    if (data.onModelBind) {
      data.onModelBind(id, recModelObj);
    }
    if (data.onModelSelect) {
      data.onModelSelect(recModelObj);
    }
    handleCloseModal();
  };

  // React.useEffect(() => {
  //   if(data && data.entity){
  //     if(regressionModels[data.model_id]){
  //       data.entity = regressionModels[data.model_id];
  //       setIsModelSelected(true);
  //     }
  //     else{
  //       data.entity = null;
  //       setIsModelSelected(false);
  //       console.warn("No model found for the given model_id: ", data.model_id);
  //     }
  //   } else{
  //     data.entity = null;
  //     setIsModelSelected(false);
  //   }

  // }, [data, regressionModels]);

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
      try {
        const [regressionResponse, allModelsResponse] = await Promise.all([
          axios.get(`${apiBaseUrl}/getTrainedModels/regression`),
          axios.get(`${apiBaseUrl}/getTrainedModels`),
        ]);

        const parsedRegressionModels = parseTrainedModels(regressionResponse.data);
        const parsedAllModels = parseTrainedModels(allModelsResponse.data);
        const visibleModels = parsedRegressionModels.length > 0
          ? parsedRegressionModels
          : parsedAllModels.filter(isRegressionModel);
        const fallbackModels = visibleModels.length > 0 ? visibleModels : parsedAllModels;

        const regressionModelMap = {};
        fallbackModels.forEach((model) => {
          if (model?.model_id) {
            regressionModelMap[model.model_id] = model;
          }
        });

        if (data && data.model_id) {
          if (regressionModelMap[data.model_id]) {
            const selectedModel = regressionModelMap[data.model_id];
            data.entity = selectedModel;
            if (data.onModelBind) {
              data.onModelBind(id, selectedModel);
            }
            if (data.onModelSelect) {
              data.onModelSelect(selectedModel);
            }
          } else {
            data.entity = null;
            console.warn("No model found for the given model_id: ", data.model_id);
          }
        } else {
          data.entity = null;
        }

        setRegressionModels(regressionModelMap);
      } catch (error) {
        console.log(error);
        setRegressionModels({});
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }
    , []);

  const handleChange = (value) => {
    const selectedModel = regressionModels[value];
    data.entity = selectedModel;
    data.model_id = value;
    if (data.onModelBind) {
      data.onModelBind(id, selectedModel);
    }
    if (data.onModelSelect) {
      data.onModelSelect(selectedModel);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    data.onDelete(id);
  }

  const handleCodeSave = () => {
    setIsCodeSaved(true);
  };

  const handleOpenCustomModel = () => {
    setIsCustomModelOpen(!isCustomModelOpen);
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

      <div className="switchNode" onClick={handleOpenModal} style={{ width: "130px" }}>
        {/* <div className="switchIcon" /> */}
        {isModelSelected ? <CheckBoxIcon style={{ fontSize: "14px", marginLeft: "8px" }} /> : <Description style={{ fontSize: "14px", marginLeft: "8px" }} />}
        {/* <Description style={{ fontSize: "14px", marginLeft: "8px" }} /> */}
        <div className="switchLabel" >Regression</div>
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
          Edit Regressor Node
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
                style={{ width: '100%' }}
                value={data?.model_id || undefined}
                options={Object.keys(regressionModels).map((model_id) => ({
                  value: model_id,
                  label: regressionModels[model_id].model_name || regressionModels[model_id].name || model_id
                }))}
                disabled={isLoading}
                onChange={handleChange}
                placeholder="Select a model"
              />
            </FormControl>
            {recommendation && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                border: '1px solid #dcdcdc',
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                transition: 'all 0.3s ease',
                fontFamily: '"Outfit", "Inter", sans-serif',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px', marginRight: '8px' }}>💡</span>
                  <h5 style={{ margin: 0, fontWeight: 600, color: '#333', fontSize: '15px' }}>AI Model Recommendation</h5>
                  <span style={{
                    marginLeft: 'auto',
                    background: '#4caf50',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    Better Performance
                  </span>
                </div>
                
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#555', lineHeight: '1.5' }}>
                  Another user, <strong>{recommendation.user.name}</strong> ({recommendation.user.company}), 
                  used the model <strong>{recommendation.model_name}</strong> ({recommendation.estimator_type}) 
                  for a similar use case (target: <code>{recommendation.target_column}</code>) and achieved 
                  an outstanding <strong>{(recommendation.metric_value * 100).toFixed(2)}% {recommendation.metric_name}</strong>.
                </p>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.6)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  fontSize: '12px'
                }}>
                  <div>
                    <span>Your model: <strong>{(recommendation.chosen_metric_value * 100).toFixed(2)}%</strong></span>
                  </div>
                  <div>
                    <span>Recommended: <strong>{(recommendation.metric_value * 100).toFixed(2)}%</strong></span>
                  </div>
                  <div style={{ color: recommendation.difference >= 0 ? '#2e7d32' : '#c62828', fontWeight: 'bold' }}>
                    {recommendation.difference >= 0 ? '+' : ''}{(recommendation.difference * 100).toFixed(2)}% Improvement
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button 
                    type="primary" 
                    onClick={handleUseRecommendation}
                    style={{
                      background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                      border: 0,
                      color: 'white',
                      boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 600,
                      height: '32px'
                    }}
                  >
                    Use Recommended Model
                  </Button>
                </div>
              </div>
            )}
          </AccordionDetails>
        </Accordion>
        <Accordion>
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
                whiteSpace: 'pre-wrap'
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
            </Box>
            <Box sx ={{display : 'flex', justifyContent: "flex-end", marginTop: '8px'}}>
              <Button onClick={handleCodeSave} variant="outlined">Save</Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Modal>


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
