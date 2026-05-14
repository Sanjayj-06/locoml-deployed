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
  const [isModelSelected, setIsModelSelected] = React.useState(false);
  const [isCodeSaved, setIsCodeSaved] = React.useState(false);
  const [isCustomModelOpen, setIsCustomModelOpen] = React.useState(false);

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
      axios.get("/getTrainedModels/regression")
        .then((response) => {
          console.log("Received regression models: ", response.data);
          var regressionModelMap = {};
          const parsedModels = response.data.trained_models.map(model => JSON.parse(model.replace(/Infinity/g, "1e1000")));
          parsedModels.forEach((model) => {
            console.log(model);
            regressionModelMap[model.model_id] = model;
          });
          if(data && data.model_id){
            if(regressionModelMap[data.model_id]){
              data.entity = regressionModelMap[data.model_id];
              setIsModelSelected(true);
            }
            else{
              data.entity = null;
              setIsModelSelected(false);
              console.warn("No model found for the given model_id: ", data.model_id);
            }
          } else{
            data.entity = null;
            setIsModelSelected(false);
          }
          setRegressionModels(regressionModelMap);
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
    data.entity = regressionModels[value];
    setIsModelSelected(true);
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
                className="selectStyle nodrag nopan"
                defaultValue={data?.model_id || ""}
                options={Object.keys(regressionModels).map((model_id) => ({
                  value: model_id,
                  label: regressionModels[model_id].model_name
                }))}
                disabled={isLoading}
                onChange={handleChange}
              // className="nodrag nopan"
              />
            </FormControl>
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
