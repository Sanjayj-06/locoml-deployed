import { Typography, Button, CircularProgress, LinearProgress, Table, TableHead, TableRow, TableCell, TableBody, Box, Chip, MenuItem, TextField, Checkbox } from "@mui/material";
import axios from "axios";
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import React, { useEffect, useState, useRef } from "react";
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Paper from '@mui/material/Paper';
import { Col, Row, Button as ReactStrapButton, Collapse } from "reactstrap";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Table as ReactStrapTable } from "reactstrap";
import ShortModelInfoComponent from "components/ModelInfo/ShortModelInfoComponent";
import ChangeHyperparameters from "components/UpdateModelJSComponents/ChangeHyperparameters";
import ChangeEstimatorType from "components/UpdateModelJSComponents/ChangeEstimatorType";
const updateModes = {
    '0': 'Train on more data',
    '1': 'Change the hyperparameters',
    '2': 'Change the Estimator type'
}

function CustomTabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    <Typography>{children}</Typography>
                </Box>
            )}
        </div>
    );
}

CustomTabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired,
};

function a11yProps(index) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

const UpdateModel = () => {
    const model_id = window.location.pathname.split("/")[3];
    const [loading, setLoading] = React.useState(true);
    const [trainLoading, setTrainLoading] = React.useState(false);
    const [modelDetails, setModelDetails] = React.useState({});
    const [updateMode, setUpdateMode] = React.useState('');
    const [allClassifiers, setAllClassifiers] = React.useState([]);
    const [classifierMap, setClassifierMap] = React.useState({})
    const [allRegressors, setAllRegressors] = React.useState([]);
    const [selectedClassifier, setSelectedClassifier] = React.useState('')
    const [hyperparameters, setHyperparameters] = React.useState({})
    const [textBoxValues, setTextBoxValues] = React.useState([])
    const [trainingResponse, setTrainingResponse] = React.useState({})
    const [trainingStatus, setTrainingStatus] = React.useState({
        progress: 0,
        status: 'Initialising',
        model: '',
        estimated_time_left: 'Calculating'
    })
    const fileInput = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showDatasetFormat, setShowDatasetFormat] = useState(false);
    const [trainingCompleted, setTrainingCompleted] = React.useState(false);
    const [showDetails, setShowDetails] = React.useState(false);
    const [value, setValue] = React.useState(0);

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    React.useEffect(() => {
        // wait for 3 seconds
        // const timer = setTimeout(() => {
        //     setLoading(false);
        // }, 1000);
        // setModelDetails(JSON.parse(localStorage.getItem("modelDetails")));
        axios.get(process.env.REACT_APP_GET_TRAINED_MODELS_URL + '/' + model_id)
            .then(async (response) => {
                // if (response.data) {
                //     localStorage.setItem("modelDetails", JSON.stringify(response.data))
                // }
                console.log(response.data);
                setModelDetails(response.data);
                setLoading(false)
            })
            .catch((error) => {
                console.log(error);
            })

        // return () => clearTimeout(timer);
    }, []);

    const updateChangeHyperparameterVariables = (data) => {
        console.log(data)
        setHyperparameters(data.hyperparameters)
        setTextBoxValues(data.textBoxValues)
    }

    const updateChangeEstimatorTypeVariables = (data) => {
        console.log(data)
        setSelectedClassifier(data.selectedClassifier)
        setHyperparameters(data.hyperparameters)
        setTextBoxValues(data.textBoxValues)
    }

    const StartTrainingForMode0 = () => {
        setTrainingCompleted(false);
        setTrainLoading(true);

        const eventSource = new EventSource("/stream?channel=mychannel");

        setTrainingStatus({
            progress: 0,
            status: 'Initialising',
            model: '',
            estimated_time_left: 'Calculating'
        })

        eventSource.onmessage = (event) => {
            console.log(event.data);
            setTrainingStatus(JSON.parse(event.data));
        };
        const modelDetailsToSend = {}
        modelDetailsToSend['model_id'] = modelDetails.model_id
        modelDetailsToSend['model_name'] = modelDetails.model_name
        modelDetailsToSend['target_column'] = modelDetails.target_column
        modelDetailsToSend['objective'] = modelDetails.objective
        modelDetailsToSend['metric_mode'] = modelDetails.metric_mode
        modelDetailsToSend['metric_type'] = modelDetails.metric_type
        modelDetailsToSend['training_mode'] = modelDetails.training_mode
        modelDetailsToSend['model_type'] = modelDetails.estimator_type

        console.log(modelDetailsToSend)
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('filesize', selectedFile.size)
        formData.append('filename', selectedFile.name);
        formData.append('original_dataset_id', modelDetails.dataset_id);
        for (var key in modelDetailsToSend) {
            formData.append(key, modelDetailsToSend[key])
        }
        console.log(formData)
        axios.post('/trainOnMoreData', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                // set max size
                // maxContentLength: 1000000000,
                // maxBodyLength: 1000000000,
            }
        }
        )
            .then(response => {
                console.log(response.data)
                let tempResponse;
                if (typeof(response.data) !== 'string')
                {
                    tempResponse = JSON.stringify(response.data);
                    console.log("Object detected")
                }
                else
                {
                    tempResponse = response.data;
                }
            
                const responseData = JSON.parse(tempResponse.replace(/Infinity/g,"1e1000"));
                setTrainingResponse(responseData)
                // setTrainingResponse(response.data)
                setTrainLoading(false)
                setTrainingCompleted(true)
            })
            .catch(err => {
                console.log(err)
            })

        // axios.post('http://127.0.0.1:5000/trainOnMoreData', {
        //     'model_details' : modelDetails,
        //     'original_dataset_id' : modelDetails.dataset_id,
        //     // 'file' : selectedFile
        // }).then(res => {
        //     console.log(res)
        // })
        // .catch(err => {
        //     console.log(err)
        // })
        // axios.post('http://127.0.0.1:5000/trainOnMoreData', formData, {
        //     headers: {
        //         'Content-Type': 'multipart/form-data',
        //         'Access-Control-Allow-Origin': 'http://127.0.0.1:5000/',
        //     }
        // }).then(response => {
        //     setTrainingResponse(response.data)
        //     setTrainLoading(false)
        //     setTrainingCompleted(true)
        // }).catch(err => {
        //     console.log(err)
        // })
    }

    const StartTrainingForMode1 = () => {
        setTrainingCompleted(false);
        setTrainLoading(true);
        console.log(hyperparameters)
        console.log(textBoxValues)
        const hyperparameter_dict = {}
        for (var i = 0; i < Object.keys(hyperparameters).length; i++) {
            // check if the hyperparameter is a number
            if (isNaN(textBoxValues[i]) || typeof textBoxValues[i] == "boolean" || textBoxValues[i] == null) {
                hyperparameter_dict[Object.keys(hyperparameters)[i]] = textBoxValues[i]
            }
            else {
                hyperparameter_dict[Object.keys(hyperparameters)[i]] = parseFloat(textBoxValues[i])
            }
            // hyperparameter_dict[Object.keys(hyperparameters)[i]] = textBoxValues[i]
        }
        console.log(hyperparameter_dict)
        const eventSource = new EventSource("/stream?channel=mychannel");

        setTrainingStatus({
            progress: 0,
            status: 'Initialising',
            model: '',
            estimated_time_left: 'Calculating'
        })

        eventSource.onmessage = (event) => {
            console.log(event.data);
            setTrainingStatus(JSON.parse(event.data));
        };

        axios.post('/changeHyperparameters', {
            'model_details': modelDetails,
            'new_hyperparameters': hyperparameter_dict
        }).then(response => {
            console.log(response.data)
            console.log(typeof (response.data))
            let tempResponse;
            if (typeof(response.data) !== 'string')
            {
                tempResponse = JSON.stringify(response.data);
                console.log("Object detected")
            }
            else
            {
                tempResponse = response.data;
            }

            const responseData = JSON.parse(tempResponse.replace(/Infinity/g,"1e1000"));
            setTrainingResponse(responseData)
            // setTrainingResponse(response.data)
            setTrainLoading(false)
            setTrainingCompleted(true)
            axios.get(process.env.REACT_APP_GET_TRAINED_MODELS_URL + '/' + model_id)
                .then(async (response) => {
                    // if (response.data) {
                    //     localStorage.setItem("modelDetails", JSON.stringify(response.data))
                    // }
                    setModelDetails(response.data);
                    // setLoading(false)
                    console.log(response.data);
                })
                .catch((error) => {
                    console.log(error);
                })
        }).catch(err => {
            console.log(err)
        })
    }

    const StartTrainingForMode2 = () => {
        setTrainingCompleted(false);
        setTrainLoading(true);
        const hyperparameter_dict = {}
        for (var i = 0; i < Object.keys(hyperparameters).length; i++) {
            if (isNaN(textBoxValues[i])) {
                hyperparameter_dict[Object.keys(hyperparameters)[i]] = textBoxValues[i]
            }
            else {
                hyperparameter_dict[Object.keys(hyperparameters)[i]] = parseFloat(textBoxValues[i])
            }
        }
        console.log(hyperparameter_dict)
        const eventSource = new EventSource("/stream?channel=mychannel");

        setTrainingStatus({
            progress: 0,
            status: 'Initialising',
            model: '',
            estimated_time_left: 'Calculating'
        })

        eventSource.onmessage = (event) => {
            console.log(event.data);
            setTrainingStatus(JSON.parse(event.data));
        };

        axios.post('/changeEstimatorType', {
            'model_details': modelDetails,
            'new_hyperparameters': hyperparameter_dict,
            'estimator_type': selectedClassifier,
        }).then(response => {
            console.log("Here is the response: ", typeof(response.data))
            let tempResponse;
            if (typeof(response.data) !== 'string')
            {
                tempResponse = JSON.stringify(response.data);
                console.log("Object detected")
            }
            else
            {
                tempResponse = response.data;
            }

            const responseData = JSON.parse(tempResponse.replace(/Infinity/g,"1e1000"));
            setTrainingResponse(responseData)
            setTrainLoading(false)
            setTrainingCompleted(true)
            axios.get(process.env.REACT_APP_GET_TRAINED_MODELS_URL + '/' + model_id)
                .then(async (response) => {
                    // if (response.data) {
                    //     localStorage.setItem("modelDetails", JSON.stringify(response.data))
                    // }
                    setModelDetails(response.data);
                    // setLoading(false)
                    console.log(response.data);
                })
                .catch((error) => {
                    console.log(error);
                })
        }).catch(err => {
            console.log(err)
        })
    }

    const handleFinish = () => {
        // localStorage.setItem("trainingResponse", JSON.stringify(trainingResponse))
        setShowDetails(true);
    }

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        console.log("This the file", file);
        setSelectedFile(file);
        console.log(file);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('filesize', file.size)
        formData.append('filename', file.name);
    }



    return (
        <div className="content">
            <Typography>
                <Row>
                    <Col>
                        <Button
                            onClick={() => { window.history.back() }}
                            style={{
                                marginTop: "0",
                                marginBottom: "1rem"
                            }}
                        >
                            Go Back
                        </Button>
                    </Col>
                </Row>

                {loading ?
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
                        <CircularProgress /> <br />
                        <Typography variant="body1" style={{ marginLeft: '10px' }}>
                            Fetching Model details for {model_id} <br />
                        </Typography>
                        <Typography variant="subtitle1" style={{ marginLeft: '10px' }}>
                            Please wait...
                        </Typography>
                    </div> :
                    <div>
                        <Row>
                            <Col md="6">
                                {
                                    Object.keys(modelDetails).length > 0 && <ShortModelInfoComponent modelDetails={modelDetails} />
                                }
                            </Col>
                            <Col md="6">
                                <Typography variant="h5" component="h5" gutterBottom

                                >
                                    Update Model
                                </Typography>
                                {
                                    updateMode == '' ? (
                                        <div>
                                            <Typography
                                                style={{
                                                    marginBottom: "1rem"
                                                }}
                                            >
                                                Select how would you want to update your model.
                                            </Typography>
                                            <Typography
                                                style={{
                                                    fontSize: "20px"
                                                }}
                                            >
                                                <Table>
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell style={{ fontSize: '20px' }}>Mode</TableCell>
                                                            <TableCell style={{ fontSize: '20px' }}>Description</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell style={{ fontSize: '16px' }}>
                                                                <ReactStrapButton color="info" style={{ color: "black" }} onClick={() => { setUpdateMode('0') }}>Train on more data</ReactStrapButton>
                                                            </TableCell>
                                                            <TableCell style={{ fontSize: '16px' }}>
                                                                Train the same model on more data to improve the accuracy (performance) of the model. You cannot change the hyperparameters of the model in this mode.
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell style={{ fontSize: '16px' }}>
                                                                <ReactStrapButton color="info" style={{ color: "black" }} onClick={() => { setUpdateMode('1') }}>Change the hyperparameters</ReactStrapButton>
                                                            </TableCell>
                                                            <TableCell style={{ fontSize: '16px' }}>
                                                                Change the hyperparameters of the model and retrain the model from scratch. You can either change the hyperparameters manually or let the system perform an exhaustive search over and output the best set of hyperparameters.
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell style={{ fontSize: '16px' }}>
                                                                <ReactStrapButton color="info" style={{ color: "black" }} onClick={() => { setUpdateMode('2') }}>Change the Estimator type</ReactStrapButton>
                                                            </TableCell>
                                                            <TableCell style={{ fontSize: '16px' }}>
                                                                Change the type of the estimator (classifier/regressor) and retrain the model from scratch.
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </Typography>

                                            {/* <Row>
                                                <Col md="6">
                                                    <ReactStrapButton color="info" style={{ color: "black" }}
                                                        onClick={async () => { setUpdateMode('Manual'); await getClassifiersAndHyperparameters(); }}
                                                    >Update the hyperparameters manually</ReactStrapButton>
                                                    <Typography>
                                                        Using manual mode, you can set the values of various hyperparameters (list of hyperparameters which you can change can be found in the left part) manually
                                                        and see the effect on your model.
                                                    </Typography>
                                                </Col>
                                                <Col md="6">
                                                    <ReactStrapButton color="info" style={{ color: "black" }}
                                                        onClick={() => { setUpdateMode('Auto') }}
                                                    >Automatic optimal hyperparameter search</ReactStrapButton>
                                                    <Typography>
                                                        In automatic mode, you can specify the different values of the hyperparameters and let the system perform an exhaustive grid search over all possible combinations
                                                        and output the best set of hyperparameters.
                                                    </Typography>
                                                </Col>
                                            </Row> */}
                                        </div>
                                    ) : (
                                        <div>
                                            {!trainLoading && !trainingCompleted &&
                                                <></>
                                                // <ReactStrapButton
                                                //     color='info'
                                                //     onClick={() => { setUpdateMode('') }}
                                                //     style={{
                                                //         marginBottom: '2rem'
                                                //     }}
                                                // >Back</ReactStrapButton>
                                            }
                                            <Typography
                                                variant="h6"
                                                style={{
                                                    marginBottom: '1rem'
                                                }}
                                            >
                                                {updateModes[updateMode]}
                                            </Typography>
                                            {
                                                updateMode === '0' ? (
                                                    <div>

                                                        {!trainLoading && !trainingCompleted && !showDetails && (<><Typography>
                                                            <ReactStrapButton color="info" style={{ color: "black" }}
                                                                onClick={() => {
                                                                    setUpdateMode('')

                                                                }}
                                                            >Back</ReactStrapButton>
                                                            <Typography>
                                                                Please upload a .csv file following the same format as the original dataset.
                                                            </Typography>

                                                            <input
                                                                type="file"
                                                                accept=".csv"
                                                                style={{ display: 'none' }}
                                                                onChange={handleFileChange}
                                                                ref={fileInput}
                                                            />
                                                            <ReactStrapButton color="info"
                                                                onClick={() => { fileInput.current.click() }}
                                                            >
                                                                Upload csv file
                                                            </ReactStrapButton>
                                                        </Typography>
                                                            <Typography gutterBottom>
                                                                {
                                                                    selectedFile != null ? (
                                                                        <div>
                                                                            <Typography>
                                                                                <CheckCircleIcon color='success' /> File: {selectedFile.name} selected successfully.
                                                                            </Typography>
                                                                            <Typography>
                                                                                <CheckCircleIcon color='success' /> File size: {selectedFile.size} bytes.
                                                                            </Typography>
                                                                            <ReactStrapButton color="info" style={{ color: "black" }} onClick={() => { StartTrainingForMode0() }}>Start Training</ReactStrapButton>
                                                                        </div>
                                                                    ) : (
                                                                        null
                                                                    )
                                                                }
                                                            </Typography>
                                                            <Typography gutterBottom>
                                                                <Button
                                                                    onClick={() => { setShowDatasetFormat(!showDatasetFormat) }}
                                                                >
                                                                    {showDatasetFormat ? 'Hide' : 'Show'} original dataset format
                                                                </Button>
                                                            </Typography>
                                                                {console.log(modelDetails)}
                                                            <Collapse isOpen={showDatasetFormat}>
                                                                <ReactStrapTable striped>
                                                                    {
                                                                        modelDetails.input_schema.map((column, index) => {
                                                                            return (
                                                                                <tr key={index}>
                                                                                    <td>{column.column_name}</td>
                                                                                    <td>{column.column_type}</td>
                                                                                </tr>
                                                                            )
                                                                        }
                                                                        )
                                                                    }
                                                                </ReactStrapTable>
                                                            </Collapse>
                                                        </>
                                                        )
                                                        }
                                                        {trainLoading && !trainingCompleted && !showDetails && (
                                                            <>
                                                                <Typography>
                                                                    File: {selectedFile.name}
                                                                </Typography>
                                                                <Typography>
                                                                    File size: {selectedFile.size} bytes.
                                                                </Typography>
                                                                <LinearProgress />
                                                                <Typography variant="body2" mt="1rem">
                                                                    Please wait while the model is being trained...
                                                                </Typography>
                                                                <Row className="justify-content-center align-items-center">
                                                                    <Col>
                                                                        <Typography variant="subtitle1">
                                                                            Current Status: {trainingStatus.status}
                                                                        </Typography>
                                                                    </Col>
                                                                </Row>
                                                            </>
                                                        )}
                                                        {!trainLoading && trainingCompleted && !showDetails && (
                                                            <div>
                                                                <Typography variant="h6" style={{ color: 'green' }}>
                                                                    <CheckCircleIcon color='success' /> Training Completed Successfully.
                                                                </Typography>
                                                                Click on Finish to view the model details.
                                                                <div />
                                                                <ReactStrapButton color="info" style={{ color: "black" }} onClick={handleFinish}>Finish</ReactStrapButton>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    null
                                                )
                                            }
                                            {

                                                updateMode === '1' ? (
                                                    <div>
                                                        {!trainLoading && !trainingCompleted && !showDetails && (
                                                            <div>
                                                                <ReactStrapButton color="info" style={{ color: "black" }}
                                                                    onClick={() => {
                                                                        setUpdateMode('')

                                                                    }}
                                                                >Back</ReactStrapButton>
                                                                <Row>
                                                                    <Col md="12">
                                                                        <ChangeHyperparameters modelDetails={modelDetails} parentCallback={updateChangeHyperparameterVariables} />
                                                                    </Col>
                                                                </Row>
                                                                <Row>
                                                                    <Col md="12">
                                                                        <ReactStrapButton color="info" style={{ color: "black" }} onClick={() => { StartTrainingForMode1() }}>Start Training</ReactStrapButton>
                                                                    </Col>
                                                                </Row>
                                                            </div>
                                                        )}

                                                        {trainLoading && !trainingCompleted && !showDetails && (
                                                            <div>
                                                                <Typography variant="subtitle1"
                                                                    style={{
                                                                        marginBottom: '1.5rem'
                                                                    }}
                                                                >New Hyperparameters selected:</Typography>
                                                                {
                                                                    Object.keys(hyperparameters).map((key, i) => {
                                                                        return (
                                                                            <Row className="align-items-center mb-3">
                                                                                <Col md="4">
                                                                                    <Typography>{key}</Typography>
                                                                                </Col>
                                                                                <Col md="6">
                                                                                    <Typography> {textBoxValues[i]} </Typography>
                                                                                </Col>
                                                                            </Row>
                                                                        )
                                                                    })
                                                                }
                                                                <LinearProgress />
                                                                <Typography variant="body2" mt="1rem">
                                                                    Please wait while the model is being trained...
                                                                </Typography>
                                                                <Row className="justify-content-center align-items-center">
                                                                    <Col>
                                                                        <Typography variant="subtitle1">
                                                                            Current Status: {trainingStatus.status}
                                                                        </Typography>
                                                                    </Col>
                                                                </Row>
                                                            </div>
                                                        )}
                                                        {!trainLoading && trainingCompleted && !showDetails && (
                                                            <div>
                                                                <Typography variant="h6" style={{ color: 'green' }}>
                                                                    <CheckCircleIcon color='success' /> Training Completed Successfully.
                                                                </Typography>
                                                                Click on Finish to view the model details.
                                                                <div />
                                                                <ReactStrapButton color="info" style={{ color: "black" }} onClick={handleFinish}>Finish</ReactStrapButton>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    null
                                                )
                                            }
                                            {
                                                updateMode == '2' ? (
                                                    <div>
                                                        {!trainLoading && !trainingCompleted && !showDetails && (
                                                            <div>
                                                                <ReactStrapButton color="info" style={{ color: "black" }}
                                                                    onClick={() => {
                                                                        setUpdateMode('')

                                                                    }}
                                                                >Back</ReactStrapButton>
                                                                <Row>
                                                                    <Col md="12">
                                                                        <ChangeEstimatorType modelDetails={modelDetails} parentCallback={updateChangeEstimatorTypeVariables} />
                                                                    </Col>
                                                                </Row>
                                                                <Row>
                                                                    <Col md="12">
                                                                        <ReactStrapButton color="info" style={{ color: "black" }} onClick={() => { StartTrainingForMode2() }}>Start Training</ReactStrapButton>
                                                                    </Col>
                                                                </Row>
                                                            </div>
                                                        )}
                                                        {trainLoading && !trainingCompleted && !showDetails && (
                                                            <div>
                                                                <Typography variant="subtitle1"
                                                                    style={{
                                                                        marginBottom: '1.5rem'
                                                                    }}
                                                                >New Estimator type : {selectedClassifier} </Typography>
                                                                <Typography variant="subtitle1"
                                                                    style={{
                                                                        marginBottom: '1.5rem'
                                                                    }}
                                                                >Hyperparameters selected:</Typography>
                                                                {
                                                                    Object.keys(hyperparameters).map((key, i) => {
                                                                        return (
                                                                            <Row className="align-items-center mb-3">
                                                                                <Col md="4">
                                                                                    <Typography>{key}</Typography>
                                                                                </Col>
                                                                                <Col md="6">
                                                                                    <Typography> {textBoxValues[i]} </Typography>
                                                                                </Col>
                                                                            </Row>
                                                                        )
                                                                    })
                                                                }
                                                                <LinearProgress />
                                                                <Typography variant="body2" mt="1rem">
                                                                    Please wait while the model is being trained...
                                                                </Typography>
                                                                <Row className="justify-content-center align-items-center">
                                                                    <Col>
                                                                        <Typography variant="subtitle1">
                                                                            Current Status: {trainingStatus.status}
                                                                        </Typography>
                                                                    </Col>
                                                                </Row>
                                                            </div>
                                                        )}
                                                        {!trainLoading && trainingCompleted && !showDetails && (
                                                            <div>
                                                                <Typography variant="h6" style={{ color: 'green' }}>
                                                                    <CheckCircleIcon color='success' /> Training Completed Successfully.
                                                                </Typography>
                                                                Click on Finish to view the model details.
                                                                <div />
                                                                <ReactStrapButton color="info" style={{ color: "black" }} onClick={handleFinish}>Finish</ReactStrapButton>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (null)
                                            }

                                        </div>
                                    )
                                }
                                {
                                    showDetails && Object.keys(trainingResponse).length > 0 && (
                                        <div>
                                            <Typography variant="h6" style={{ color: 'green' }}>
                                                Results
                                            </Typography>
                                            <Row>
                                                {console.log(typeof (trainingResponse))}
                                                {console.log(trainingResponse)}
                                                {console.log(trainingResponse['estimator_type'])}
                                                <Col>
                                                    <Typography>Estimator Type: {trainingResponse.estimator_type}</Typography>
                                                    <Typography>Model ID: {trainingResponse.model_id}</Typography>
                                                    <Typography>Version Number: {trainingResponse.version_number}</Typography>

                                                </Col>
                                            </Row>
                                            <Row>
                                                <Col>
                                                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                                        <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                                                            <Tab label="Metrics" {...a11yProps(0)} />
                                                            <Tab label="Parameters" {...a11yProps(1)} />
                                                        </Tabs>
                                                    </Box>
                                                    <CustomTabPanel value={value} index={0}>
                                                        <ReactStrapTable striped>
                                                            <thead>
                                                                <tr>
                                                                    <th>Metric</th>
                                                                    <th>Value</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {trainingResponse['evaluation_metrics'].map((metric, index) => {

                                                                    if (metric.metric_name != 'classifier') {
                                                                        return (
                                                                            <tr key={index}>
                                                                                <td>{metric.metric_name}</td>
                                                                                <td>{metric.metric_value}</td>
                                                                            </tr>)
                                                                    }
                                                                    else {
                                                                        return null;
                                                                    }
                                                                    ;
                                                                })}
                                                            </tbody>
                                                        </ReactStrapTable>
                                                    </CustomTabPanel>
                                                    <CustomTabPanel value={value} index={1}>
                                                        <ReactStrapTable striped>
                                                            <thead>
                                                                <tr>
                                                                    <th>Parameter</th>
                                                                    <th>Value</th>
                                                                </tr>
                                                            </thead>
                                                            <TableBody>
                                                                {trainingResponse.parameters.map((parameter, index) => {
                                                                    return (
                                                                        <tr hover size='small' key={index}>
                                                                            <td>{parameter.parameter_name}</td>
                                                                            <td>{parameter.parameter_value}</td>
                                                                        </tr>
                                                                    );
                                                                }
                                                                )}
                                                            </TableBody>
                                                        </ReactStrapTable>
                                                    </CustomTabPanel>
                                                </Col>
                                            </Row>
                                        </div>
                                    )
                                }
                            </Col>
                        </Row>

                    </div>

                }
            </Typography>
        </div >
    )
}

export default UpdateModel;