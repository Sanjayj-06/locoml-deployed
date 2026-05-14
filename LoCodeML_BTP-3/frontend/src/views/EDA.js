import { AlignHorizontalLeftSharp } from "@mui/icons-material";
import { Typography } from "@mui/material";
import axios from "axios";
import React, { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  CardBody,
  Button,
  CardHeader,
  CardTitle,
  Table,
} from "reactstrap";
import { useNavigate, useLocation } from 'react-router-dom';

function EDA() {
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [loading, setLoading] = useState(false); // Controls the loading state
  const [datasetData, setDatasetData] = useState(null); // Will be null until data is set
  const navigate = useNavigate();
  const location = useLocation();

  const apiBaseUrl =
    process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:5000";
  const getAllDatasetsUrl =
    process.env.REACT_APP_GET_ALL_DATASETS_URL ||
    `${apiBaseUrl}/getDatasets`;
  const preprocessingUrl =
    process.env.REACT_APP_PREPROCESSING_URL || `${apiBaseUrl}/preprocess`;

  // Fetch datasets when the component loads
  useEffect(() => {
    axios
      .get(getAllDatasetsUrl)
      .then((response) => {
        const dataset_list = response.data["dataset_list"];
        setDatasets(dataset_list);
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);

  useEffect(() => {
    const datasetId = location.state?.datasetId;
    if (!datasetId || datasets.length === 0) {
      return;
    }

    const match = datasets.find(
      (dataset) => dataset.dataset_id === datasetId
    );
    if (match) {
      handleSelect(match);
    }
  }, [datasets, location.state]);

  // Function to handle dataset selection
  const handleSelect = async (dataset) => {
    setSelectedDataset(dataset);
    setLoading(true); // Show loading state
    try {
      const fileName = dataset.dataset_name;
      const fileExtension = fileName.split('.').pop().toLowerCase();
      if (fileExtension === "csv") {
        const response = await axios.get(
          `${apiBaseUrl}/eda/${dataset.dataset_id}`
        );
        console.log('API response:', response.data['column_details']);
        if (response.data && response.data["column_details"]) {
          setDatasetData(response.data); // Set datasetData only when data is available
        } else {
          console.error("Invalid dataset response structure:", response.data['column_details']);
          setDatasetData(null);
        }
      } else if (fileExtension === "zip") {
        // Handle zip files...
        const response = await axios.get(
          `${apiBaseUrl}/img_eda/${dataset.dataset_id}`
        );
        console.log(response.data);
        console.log('API response:', response.data['column_details']);
        if (response.data && response.data["class_details"]) {
          setDatasetData(response.data); // Set datasetData only when data is available
        } else {
          console.error("Invalid dataset response structure:", response.data['class_details']);
          setDatasetData(null);
        }
      }
      setLoading(false); // Stop loading
    } catch (error) {
      console.log(error);
      setDatasetData(null); // Handle any error scenario
      setLoading(false); // Stop loading even in case of an error
    }
  };

  // Provide preprocessing suggestions as buttons based on column details
  const getPreprocessingSuggestions = (column) => {
    const suggestions = [];
    if (column.num_missing_values > 0) {
      suggestions.push(
        <Button color="warning" key="interpolate" onClick={() => handleSuggestionClick("Interpolate Missing Values")}>
          Interpolate missing values
        </Button>
      );
    }
    if (column.num_unique_values === column.index) {
      suggestions.push(
        <Button color="info" key="drop_duplicates" onClick={() => handleSuggestionClick("Drop Duplicate Rows")}>
          Drop duplicate values
        </Button>
      );
    }
    if (column.column_type === 'numerical') {
      suggestions.push(
        <Button color="success" key="normalize" onClick={() => handleSuggestionClick("Normalize Features")}>
          Normalize
        </Button>
      );
    }
    return suggestions;
  };
  const handleBeginPreprocessing = () => {
    if (!selectedDataset) return;
    navigate('/data-preprocessing');
  };
  const handleSuggestionClick = async (suggestion) => {
    if (!selectedDataset) {
      console.error("No dataset selected");
      return;
    }

    const payload = {
      dataset_id: selectedDataset["dataset_id"],
      tasks: suggestion,
    };

    try {
      const response = await axios.post(preprocessingUrl, payload);
      console.log("Preprocessing response:", response.data);
      // Handle the response as needed
    } catch (error) {
      console.error("Error in preprocessing:", error);
    }
  };

  return (
    <>
      <div className="content">
        <Typography>
          <Row>
            <Col md="12">
              {selectedDataset !== "" ? (
                <Card className="card-plain">
                  <CardHeader>
                    <CardTitle tag="h2">
                      {selectedDataset["dataset_name"]} (ID: {selectedDataset["dataset_id"]})
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    {loading ? (
                      <div>Loading...</div>
                    ) : datasetData && datasetData["column_details"] ? (
                      <Table responsive>
                        <thead>
                          <tr>
                            <th>Column Name</th>
                            <th>Index</th>
                            <th>Column Type</th>
                            <th>Number of Unique Values</th>
                            <th>Mean</th>
                            <th>Standard Deviation</th>
                            <th>Median</th>
                            <th>Min</th>
                            <th>Max</th>
                            <th>Number of Missing Values</th>
                            <th>Range</th>
                            <th>Preprocessing Suggestions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {datasetData &&
                            Object.keys(datasetData["column_details"]).map(
                              (column_name, index) => {
                                const column =
                                  datasetData["column_details"][column_name];
                                return (
                                  <tr key={index}>
                                    <td>{column_name}</td>
                                    <td>{column.index}</td>
                                    <td>{column.column_type}</td>
                                    <td>{column.num_unique_values}</td>
                                    <td>{column.mean !== undefined ? column.mean : ''}</td>
                                    <td>{column.std_dev !== undefined ? column.std_dev : ''}</td>
                                    <td>{column.median !== undefined ? column.median : ''}</td>
                                    <td>{column.min !== undefined ? column.min : ''}</td>
                                    <td>{column.max !== undefined ? column.max : ''}</td>
                                    <td>{column.num_missing_values}</td>
                                    <td>{column.range !== undefined ? column.range : ''}</td>
                                    <td>{getPreprocessingSuggestions(column)}</td>
                                  </tr>
                                );
                              }
                            )}
                        </tbody>
                      </Table>
                    ) : datasetData && datasetData["class_details"] ? (
                      <>
                        {/* Display metadata if available */
                          console.log(datasetData["metadata"])
                        }
                        {datasetData["metadata"] && (
                          <div className="metadata-section">
                            <h4>Metadata</h4>
                            <p>Total Images: {datasetData["metadata"].total_images}</p>
                            <p>Corrupt Images: {datasetData["metadata"].corrupt_images}</p>
                            <p>Total Classes: {datasetData["metadata"].total_classes}</p>
                            <p>Class Balance: {datasetData["metadata"].class_balance}</p>
                          </div>
                        )}

                        {/* Class Details Table */}
                        <Table responsive>
                          <thead>
                            <tr>
                              <th>Class Name</th>
                              <th>Index</th>
                              <th>Type</th>
                              <th>Number of Images</th>
                              <th>Dominant Aspect Ratio</th>
                              <th>Aspect Ratio Variation</th>
                              <th>Color Mode</th>
                              <th>Average File Size</th>
                              <th>Number of Missing Values</th>
                            </tr>
                          </thead>
                          <tbody>
                            {datasetData &&
                              Object.keys(datasetData["class_details"]).map(
                                (class_name, index) => {
                                  const classes =
                                    datasetData["class_details"][class_name];
                                  return (
                                    <tr key={index}>
                                      <td>{classes.class_name}</td>
                                      <td>{classes.index}</td>
                                      <td>{classes.type}</td>
                                      <td>{classes.number_of_images}</td>
                                      <td>{classes.dominant_aspect_ratio}</td>
                                      <td>{classes.aspect_ratio_variation}</td>
                                      <td>{classes.color_mode}</td>
                                      <td>{classes.average_file_size_kb}</td>
                                      <td>{classes.number_of_missing_values}</td>
                                    </tr>
                                  );
                                }
                              )}
                          </tbody>
                        </Table>

                        {/* Add Preprocessing Suggestions Section */}
                        {datasetData["preprocessing_suggestions"] && (
                          <div className="preprocessing-section mt-4">
                            <h4>Preprocessing Suggestions</h4>
                            <Table responsive>
                              <thead>
                                <tr>
                                  <th>Type</th>
                                  <th>Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {datasetData["preprocessing_suggestions"].normalize && (
                                  <tr>
                                    <td>Normalization</td>
                                    <td>Images should be normalized to [0,1] range</td>
                                  </tr>
                                )}
                                {datasetData["preprocessing_suggestions"].standardize_aspect_ratio && (
                                  <tr>
                                    <td>Aspect Ratio</td>
                                    <td>Standardize image aspect ratios</td>
                                  </tr>
                                )}
                                {datasetData["preprocessing_suggestions"].resize && (
                                  <tr>
                                    <td>Resize Images</td>
                                    <td>
                                      Resize all images to {datasetData["preprocessing_suggestions"].suggested_resolution[0]} x{" "}
                                      {datasetData["preprocessing_suggestions"].suggested_resolution[1]}
                                    </td>
                                  </tr>
                                )}
                                {datasetData["preprocessing_suggestions"].color_mode_info.is_mixed && (
                                  <tr>
                                    <td>Color Mode</td>
                                    <td>
                                      Standardize color mode to {datasetData["preprocessing_suggestions"].color_mode_info.conversion_target}
                                    </td>
                                  </tr>
                                )}
                                {datasetData["preprocessing_suggestions"].handle_alpha_channel && (
                                  <tr>
                                    <td>Alpha Channel</td>
                                    <td>Handle alpha channel in images</td>
                                  </tr>
                                )}
                              </tbody>
                            </Table>
                            <div className="text-center mt-4">
                              <Button
                                color="primary"
                                size="lg"
                                onClick={handleBeginPreprocessing}
                              >
                                Begin Preprocessing
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div>No data available for this dataset.</div>
                    )}
                  </CardBody>
                </Card>
              ) : (
                <Card className="card-plain">
                  <CardHeader>
                    <CardTitle tag="h2">Datasets</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <Table responsive>
                      <thead className="text-primary">
                        <tr>
                          <th className="text-center" style={{ color: "black" }}>
                            Name
                          </th>
                          <th className="text-center" style={{ color: "black" }}>
                            Option
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {datasets.map((dataset, index) => (
                          <tr key={index}>
                            <td className="text-center">
                              {dataset["dataset_name"]}
                            </td>
                            <td className="text-center">
                              <Button
                                color="info"
                                onClick={() => handleSelect(dataset)}
                              >
                                Select
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </CardBody>
                </Card>
              )}
            </Col>
          </Row>
        </Typography>
      </div>
    </>
  );
}

export default EDA;

