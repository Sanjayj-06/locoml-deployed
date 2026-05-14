import React, { useState, useRef, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  CardBody,
  Button as ReactStrapButton,
  Alert,
} from "reactstrap";
import { Link, useNavigate } from "react-router-dom"; // Import Link from react-router-dom
import "../assets/css/paper-dashboard.css";
import axios from "axios";
import {
  Table,
  TableRow,
  TableCell,
  TableHead,
  TableBody,
  CircularProgress,
  Typography,
  Button,
  Modal,
  Box,
  TextField,
} from "@mui/material";

function UploadData() {
  const fileInput = useRef(null);
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [dataSets, setDataSets] = useState([]);
  const [uploadingDataset, setUploadingDataset] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [apiUrl, setApiUrl] = useState("");

  const apiBaseUrl =
    process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:5000";
  const getAllDatasetsUrl =
    process.env.REACT_APP_GET_ALL_DATASETS_URL ||
    `${apiBaseUrl}/getDatasets`;

  const [query, setQuery] = useState("");
  const [datasets, setDatasets] = useState([]);
  const [source, setSource] = useState("kaggle");
  const [cancelToken, setCancelToken] = useState(null);

  useEffect(() => {
    const fetchDatasets = async () => {
      if (query.length > 0) {
        if (cancelToken) {
          cancelToken.cancel("Operation canceled due to new request.");
        }
        const newCancelToken = axios.CancelToken.source();
        setCancelToken(newCancelToken);

        try {
          console.log("Fetching datasets for query:", query, "source:", source);
          const res = await axios.get(
            `${apiBaseUrl}/search?query=${encodeURIComponent(query)}&source=${source}`,
            {
              cancelToken: newCancelToken.token,
            }
          );
          console.log("Response received:", res.data);
          if (res.data.query === query) {
            setDatasets(res.data.datasets);
          }
        } catch (err) {
          if (axios.isCancel(err)) {
            console.log("Request canceled", err.message);
          } else {
            console.error("Error fetching datasets:", err);
            if (err.response) {
              console.error("Response data:", err.response.data);
              console.error("Response status:", err.response.status);
            }
          }
        }
      } else {
        setDatasets([]);
      }
    };

    const debounceFetch = setTimeout(fetchDatasets, 300);

    return () => clearTimeout(debounceFetch);
  }, [query, source]);

  const downloadDataset = async (dataset_name) => {
    try {
      const response = await axios.post(`${apiBaseUrl}/download`, {
        dataset_name,
        source,
      }, {
        responseType: 'blob',
      });

      // Extract the last part of the dataset name after the final "/"
      const fileName = dataset_name.split('/').pop();
      
      // Create a download link and trigger it
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fileName}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      // alert('Dataset downloaded successfully!');
    } catch (err) {
      console.error(err);
      alert("Error downloading dataset");
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    setUploadingDataset(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filesize", file.size);
    formData.append("filename", file.name);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    axios
      .post(`${apiBaseUrl}/storeDataset`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      .then((res) => {
        console.log(res);
        setSelectedFile(file);
        axios
          .get(getAllDatasetsUrl)
          .then((res) => {
            console.log(res);
            setDataSets(res.data.dataset_list);
          })
          .catch((err) => {
            console.log(err);
          });
        setUploadingDataset(false);
      })
      .catch((err) => {
        console.log(err);
        setUploadingDataset(false);
      });
  };

  const fetchDatasetFromAPI = async () => {
    setOpenModal(false);
    setUploadingDataset(true);
    let file = null;

    try {
      console.log("Fetching data from API: ", apiUrl);
      const response = await axios.get(apiUrl, { responseType: "text" }); // Ensure text response
      console.log(response);
      const data = response.data; // Assuming the response data is already in CSV format
      console.log(data);

      const formData = new FormData();
      file = new Blob([data], { type: "application/csv" });
      formData.append("file", new Blob([data], { type: "application/csv" })); // Directly use the CSV data
      // use the file name from api response
      formData.append("filename", "api_data.csv");
      formData.append("filesize", data.length);

      await axios
        .post(`${apiBaseUrl}/storeDataset`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .then((res) => {
          setSelectedFile(file);
        });

      axios
        .get(getAllDatasetsUrl)
        .then((res) => {
          console.log(res);
          setDataSets(res.data.dataset_list);
        })
        .catch((err) => {
          console.log(err);
        });
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingDataset(false);
      //setSelectedFile(file);
    }
  };

  useEffect(() => {
    axios
      .get(getAllDatasetsUrl)
      .then((res) => {
        console.log(res);
        setDataSets(res.data.dataset_list);
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

  const formatFileSize = (sizeInBytes) => {
    const megabytes = sizeInBytes / (1024 * 1024);
    return String(megabytes.toFixed(2) + " MB");
  };

  function getDateFromTimestamp(timestamp) {
    console.log(timestamp);
    var utc = new Date(timestamp.$date);
    var date = new Date(utc.getTime() + utc.getTimezoneOffset() * 60 * 1000);
    var dateString = date.toLocaleDateString();
    return dateString;
  }

  function getTimeIn12Hours(timestamp) {
    var utc = new Date(timestamp.$date);
    var date = new Date(utc.getTime() + utc.getTimezoneOffset() * 60 * 1000);
    var timeString = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return timeString;
  }

  const handleOpenModal = () => {
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  const handleApiUrlChange = (event) => {
    setApiUrl(event.target.value);
  };

  return (
    <>
      <div className="content">
        <Row>
          <Col md="4">
            <Card className="card-user half-height-card">
              <CardBody>
                <img
                  alt="..."
                  className="image-fit"
                  src={require("assets/img/localupload.png")}
                />
                <div className="d-flex justify-content-center">
                  <input
                    type="file"
                    accept=".csv, .zip"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                    ref={fileInput}
                  />
                  <ReactStrapButton
                    color="info"
                    onClick={() => {
                      fileInput.current.click();
                    }}
                  >
                    Upload data from local machine
                  </ReactStrapButton>
                </div>
                <div
                  className="d-flex justify-content-center"
                  style={{ fontSize: "12px" }}
                >
                  Note: Both .csv and .zip files are supported
                </div>
              </CardBody>
            </Card>
          </Col>
          <Col md="4">
            <Card className="card-user half-height-card">
              <CardBody>
                <img
                  alt="..."
                  className="image-fit"
                  src={require("assets/img/database.png")}
                />
                <div className="d-flex justify-content-center">
                  <ReactStrapButton color="info">
                    Connect to database
                  </ReactStrapButton>
                </div>
              </CardBody>
            </Card>
          </Col>
          <Col md="4">
            <Card className="card-user half-height-card">
              <CardBody>
                <img
                  alt="..."
                  className="image-fit"
                  src={require("assets/img/apiupload.png")}
                />
                <div className="d-flex justify-content-center">
                  <ReactStrapButton color="info" onClick={handleOpenModal}>
                    Fetch from API
                  </ReactStrapButton>
                </div>
                <div
                  className="d-flex justify-content-center"
                  style={{ fontSize: "12px" }}
                >
                  Note: Only endpoints with .csv file downloads are supported
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col md="12">
            <Card>
              <CardBody style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                padding: '2rem'
              }}>
                <h2>Search Datasets</h2>
                <div className="search-container" style={{ width: '100%', maxWidth: '600px', position: 'relative' }}>
                  <div className="search-controls" style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: '1rem'
                  }}>
                    <input
                      type="text"
                      placeholder="Enter dataset name"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="search-input"
                      style={{ flex: 1 }}
                    />
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="source-select"
                    >
                      <option value="kaggle">Kaggle</option>
                      <option value="huggingface">Hugging Face</option>
                    </select>
                  </div>
                  {datasets.length > 0 && (
                    <ul className="dataset-list" style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      backgroundColor: 'white',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      borderRadius: '4px',
                      margin: 0,
                      padding: '0.5rem',
                      listStyle: 'none',
                      maxHeight: '400px',
                      overflowY: 'auto'
                    }}>
                      {datasets.map((ds, index) => (
                        <li key={index} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem',
                          borderBottom: '1px solid #eee'
                        }}>
                          <div className="dataset-info">
                            <div className="dataset-title" style={{
                              fontWeight: 'bold',
                              marginBottom: '0.25rem'
                            }}>{ds.title}</div>
                            <div className="dataset-stats" style={{
                              fontSize: '0.875rem',
                              color: '#666'
                            }}>
                              Downloads: {ds.downloadCount} • Likes: {ds.voteCount} • Size: {ds.size}
                            </div>
                          </div>
                          <button
                            className="download-button"
                            onClick={() => downloadDataset(ds.ref)}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Download
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col>
            {uploadingDataset ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "20vh",
                }}
              >
                <CircularProgress /> <br />
                <Typography variant="h6" style={{ marginLeft: "10px" }}>
                  Uploading File <br />
                </Typography>
                <Typography variant="subtitle1" style={{ marginLeft: "10px" }}>
                  Please wait...
                </Typography>
              </div>
            ) : null}
            {!uploadingDataset && selectedFile && (
              <div>
                <Alert className="notif-button">
                  <div>
                    <span style={{ fontWeight: "bold", fontSize: "1.2em" }}>
                      File: {selectedFile.name} (
                      {formatFileSize(selectedFile.size)}) Uploaded Successfully
                    </span>
                  </div>
                  <Link to="/eda" style={{ textDecoration: "none" }}>
                    <ReactStrapButton color="primary">
                      Proceed to Exploratory data analysis
                    </ReactStrapButton>
                  </Link>
                </Alert>
              </div>
            )}
          </Col>
        </Row>
        <Row>
          <Col>
            <Typography variant="h6">Uploaded Datasets</Typography>
          </Col>
        </Row>
        <Row>
          <Col>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Dataset ID</TableCell>
                  <TableCell>Dataset Name</TableCell>
                  <TableCell>Dataset Size</TableCell>
                  <TableCell>Uploaded On</TableCell>
                  <TableCell>Perform EDA</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dataSets.map((dataSet) => (
                  <TableRow key={dataSet.dataset_id}>
                    <TableCell>{dataSet.dataset_id}</TableCell>
                    <TableCell>{dataSet.dataset_name}</TableCell>
                    <TableCell>
                      {formatFileSize(dataSet.dataset_size)}
                    </TableCell>
                    <TableCell>{dataSet.time}</TableCell>
                    <TableCell>
                      {" "}
                      <Button
                        variant="contained"
                        onClick={() =>
                          navigate("/eda", {
                            state: { datasetId: dataSet.dataset_id },
                          })
                        }
                      >
                        Select
                      </Button>{" "}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Col>
        </Row>
      </div>

      <Modal
        open={openModal}
        onClose={handleCloseModal}
        aria-labelledby="simple-modal-title"
        aria-describedby="simple-modal-description"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 400,
            bgcolor: "background.paper",
            boxShadow: 24,
            p: 4,
          }}
        >
          <Typography variant="h6" component="h2">
            Enter API URL
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            margin="normal"
            label="API URL"
            value={apiUrl}
            onChange={handleApiUrlChange}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={fetchDatasetFromAPI}
            fullWidth
          >
            Fetch Dataset
          </Button>
        </Box>
      </Modal>
    </>
  );
}

export default UploadData;