import axios from "axios";
import React, { useEffect } from "react";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import {
  Chip,
  CircularProgress,
  LinearProgress,
  TableRow,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Papa from "papaparse";
import { Table } from "reactstrap";
import { Table as MuiTable, TableCell } from "@mui/material";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { makeStyles } from "@mui/styles";

import { Col, Row, Button as ReactStrapButton } from "reactstrap";

function ActiveStep0(props) {
  const [datasetList, setDatasetList] = React.useState([]);
  const [selectedDatasetID, setSelectedDatasetID] = React.useState("");
  const [selectedDatasetContents, setSelectedDatasetContents] =
    React.useState(null);
  const [selectedDatasetColumns, setSelectedDatasetColumns] = React.useState(
    []
  );
  const [inputType, setInputType] = React.useState("");
  const [objective, setObjective] = React.useState("");
  const [targetColumn, setTargetColumn] = React.useState("");
  const [modelName, setModelName] = React.useState("");
  const [selectedDatasetType, setSelectedDatasetType] = React.useState("");

  useEffect(() => {
    axios
      .get(process.env.REACT_APP_GET_ALL_DATASETS_URL)
      .then((response) => {
        console.log(response.data);
        setDatasetList(response.data.dataset_list);
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);

  useEffect(() => {
    // Find the dataset that matches the selected ID
    const selectedDataset = datasetList.find(dataset => dataset.dataset_id === selectedDatasetID);
    const datasetType = selectedDataset?.dataset_type || '';
    
    axios
      .get(process.env.REACT_APP_GET_DATASET_URL + selectedDatasetID + "/" + datasetType)
      .then((response) => {
        setSelectedDatasetContents(response.data);
      })
      .catch((error) => {
        console.log(error);
      });
  }, [selectedDatasetID, datasetList]);

  useEffect(() => {
    if (selectedDatasetContents != null) {
      const parsedData = Papa.parse(selectedDatasetContents, { header: true });
      // console.log(parsedData.data);
      setSelectedDatasetColumns(Object.keys(parsedData.data[0]));
    }
  }, [selectedDatasetContents]);

  const getSelectedDatasetName = () => {
    if (selectedDatasetID == "") {
      return "";
    }
    for (var i = 0; i < datasetList.length; i++) {
      if (datasetList[i].dataset_id == selectedDatasetID) {
        return datasetList[i].dataset_name;
      }
    }
  };

  const sendDataToMainPage = () => {
    if (objective === "imageClassification") {
      props.parentCallback({
        datasetList: datasetList,
        selectedDatasetID: selectedDatasetID,
        objective: objective,
        modelName: modelName,
        inputType: inputType,
      });
    } else {
      props.parentCallback({
        datasetList: datasetList,
        selectedDatasetID: selectedDatasetID,
        objective: objective,
        targetColumn: targetColumn,
        modelName: modelName,
      });
    }
  };

  const handleSelectDataset = (e) => {
    const selectedId = e.target.value;
    setSelectedDatasetID(selectedId);
    const selectedDataset = datasetList.find(
      (dataset) => dataset.dataset_id === selectedId
    );
    const datasetType = selectedDataset?.dataset_type || "";
    setSelectedDatasetType(datasetType);
    console.log("Selected dataset type:", datasetType);
  };

  useEffect(() => {
    sendDataToMainPage();
  }, [selectedDatasetID, objective, targetColumn, modelName]);

  return (
    <>
      <div style={{ marginTop: "1.5rem" }}>
        <Typography>
          <Row className="align-items-center mb-3">
            <Col md="2">Select Dataset:</Col>
            <Col md="6">
              <FormControl fullWidth>
                <InputLabel id="datasetlabel">Dataset</InputLabel>
                <Select
                  labelId="datasetlabel"
                  label="Column"
                  fullWidth
                  value={selectedDatasetID}
                  onChange={handleSelectDataset}
                  // onChange={handleChange}
                >
                  {datasetList.map((dataset) => (
                    <MenuItem value={dataset.dataset_id}>
                      {dataset.dataset_name +
                        " (id: " +
                        dataset.dataset_id +
                        ")"}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedDatasetID != "" && selectedDatasetContents == null ? (
                <div className="mt-3">
                  <CircularProgress /> Fetching the dataset contents...
                </div>
              ) : null}
              {selectedDatasetID != "" && selectedDatasetContents != null ? (
                <div className="mt-3">
                  <CheckCircleIcon color="success" /> Dataset:{" "}
                  {getSelectedDatasetName() +
                    " (id: " +
                    selectedDatasetID +
                    ")"}{" "}
                  fetched successfully.
                </div>
              ) : null}
            </Col>
          </Row>

          <Row className="align-items-center mb-3">
            <Col md="2">Select Objective:</Col>
            <Col md="6">
              <FormControl fullWidth>
                <InputLabel id="objectivelabel">Objective</InputLabel>
                <Select
                  labelId="objectivelabel"
                  label="Column"
                  fullWidth
                  value={objective}
                  onChange={(e) => {
                    console.log("Objective select onChange:", e.target.value);
                    setObjective(e.target.value);
                  }}
                >
                  {selectedDatasetType === "image"
                    ? [
                        <MenuItem value="imageClassification" key="imgClass">
                          Image Classification
                        </MenuItem>,
                      ]
                    : [
                        <MenuItem value="classification" key="class">
                          Classification
                        </MenuItem>,
                        <MenuItem value="regression" key="reg">
                          Regression
                        </MenuItem>,
                        <MenuItem value="sentiment" key="sent">
                          Sentiment Analysis
                        </MenuItem>,
                      ]}
                </Select>
              </FormControl>
            </Col>
          </Row>
          <Row className="align-items-center mb-3">
            {selectedDatasetType != "image" ? (
              <>
                <Col md="2">Select Target Column:</Col>
                <Col md="6">
                  <FormControl fullWidth>
                    <InputLabel id="label">Target Column</InputLabel>
                    <Select
                      labelId="label"
                      label="Column"
                      fullWidth
                      value={targetColumn}
                      onChange={(e) => setTargetColumn(e.target.value)}
                    >
                      {selectedDatasetColumns.map((column) => (
                        <MenuItem value={column}>{column}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Col>
              </>
            ) : (
              <>
                <Col md="2">Select Input Type:</Col>
                <Col md="6">
                  <FormControl fullWidth>
                    <InputLabel id="label">Input Type</InputLabel>
                    <Select
                      labelId="label"
                      label="Input Type"
                      fullWidth
                      value={inputType}
                      onChange={(e) => setInputType(e.target.value)}
                    >
                      <MenuItem value="huggingFace">Hugging Face</MenuItem>
                    </Select>
                  </FormControl>
                </Col>
              </>
            )}
          </Row>
          <Row className="align-items-center mb-3">
            <Col md="2">Enter Model Name:</Col>
            <Col md="6">
              <TextField
                label="Model Name"
                variant="outlined"
                fullWidth
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
              />
            </Col>
          </Row>
        </Typography>
      </div>
    </>
  );
}

export default ActiveStep0;
