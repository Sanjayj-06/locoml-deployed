import axios from 'axios';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import React, { useState, useEffect } from 'react';
import FormControlLabel from '@mui/material/FormControlLabel';
import { makeStyles } from '@mui/styles';
import { Row, Col, Card, CardBody, Button, CardHeader, CardTitle, Table, } from "reactstrap";
import "../assets/css/paper-dashboard.css"
import { LinearProgress, Typography } from "@mui/material";
import { useNavigate } from 'react-router-dom';


const useStyles = makeStyles({
    formGroup: {
        alignItems: 'left'
    }
});

function DataPreprocessing() {

    const [loading, setLoading] = React.useState(false)
    const [selectedDataset, setSelectedDataset] = useState("");
    const [preprocessingCompleted, setPreprocessingCompleted] = useState(false);
    const [preProcessingType, setPreProcessingType] = useState("Automatic");
    const [isZipfile, setZipfile] = useState(false);
    const [datasets, setDatasets] = useState([]);
    const [selectedLabels, setSelectedLabels] = useState(["Drop Duplicate Rows"]);
    const [preprocessingTasks, setPreprocessingTasks] = useState([]);
    const [checkedState, setCheckedState] = useState({
        'Drop Duplicate Rows': true,
        'Interpolate Missing Values': false,
        'Normalise Features': false,
    });

    const [preprocessedData, setPreprocessedData] = useState([{}]);

    const [imageCheckedState, setImageCheckedState] = useState({
        'Convert Color Mode': false,
        'Convert to Grayscale': false,
        'Handle Alpha Channel': false,
        'Normalize': false,
        'Resize Images': false,
        'Standardize Aspect Ratio': false,
        'Grayscale Option for RGB': false
    });

    const [colorModeLabel, setColorModeLabel] = useState("");
    const [showColorMode, setShowColorMode] = useState(false);

    const classes = useStyles();
    const navigate = useNavigate();

    const apiBaseUrl =
        process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:5000";
    const getAllDatasetsUrl =
        process.env.REACT_APP_GET_ALL_DATASETS_URL ||
        `${apiBaseUrl}/getDatasets`;
    const preprocessingUrl =
        process.env.REACT_APP_PREPROCESSING_URL || `${apiBaseUrl}/preprocess`;

    useEffect(() => {
        // Get Datasets List
        axios.get(getAllDatasetsUrl)
            .then((response) => {
                console.log(response.data);
                let dataset_list = response.data['dataset_list'];
                setDatasets(dataset_list);
            })
            .catch((error) => {
                console.log(error);
            });
    }, []);



    const handleClickAuto = () => {
        setPreProcessingType("Automatic");
    }

    const handleClickManual = () => {
        setPreProcessingType("Manual");
    }

    const handleLabelChange = (event) => {
        const { name, checked } = event.target;
        if (checked) {
            setSelectedLabels((prevSelectedLabels) => [...prevSelectedLabels, name]);
        } else {
            setSelectedLabels((prevSelectedLabels) =>
                prevSelectedLabels.filter((label) => label !== name)
            );
        }

        setCheckedState({
            ...checkedState,
            [event.target.name]: event.target.checked,
        });
    };

    const handleImageTaskChange = (event) => {
        const { name, checked } = event.target;
        setImageCheckedState({
            ...imageCheckedState,
            [name]: checked,
        });
    };

    const handleCancel = () => {
        setSelectedDataset("");
        setPreProcessingType("Automatic");
        setSelectedLabels(["Drop Duplicate Rows"]);
        checkedState['Drop Duplicate Rows'] = true;
        checkedState['Interpolate Missing Values'] = false;
        checkedState['Normalise Features'] = false;
    }

    const handlePreProcessing = async () => {
        if (isZipfile) {
            // Handle image preprocessing
            try {
                setLoading(true);
                const preprocessingParams = {
                    color_mode_info: {
                        is_mixed: preprocessingTasks.color_mode_info?.is_mixed,
                        handle_conversion: imageCheckedState['Color Mode Conversion'],
                        conversion_target: preprocessingTasks.color_mode_info?.conversion_target
                    },
                    handle_alpha_channel: imageCheckedState['Handle Alpha Channel'],
                    normalize: imageCheckedState['Normalize'],
                    resize: imageCheckedState['Resize Images'],
                    suggested_resolution: preprocessingTasks.suggested_resolution,
                    standardize_aspect_ratio: imageCheckedState['Standardize Aspect Ratio']
                };

                const response = await axios.post(
                    `http://127.0.0.1:5000/apply_preprocess/${selectedDataset.dataset_id}`,
                    preprocessingParams
                );

                console.log(response.data);
                setLoading(false);
                setPreprocessingCompleted(true);
                setPreprocessedData({
                    output_path: response.data.output_path,
                    message: response.data.message,
                    processed_splits: response.data.processed_splits  // Add this line
                });

            } catch (error) {
                console.error('Image preprocessing error:', error);
                setLoading(false);
            }
            return;
        }

        // Existing code for non-image datasets
        let finalTasks = ["Drop Duplicate Rows", "Interpolate Missing Values", "Normalise Features"];
        if (preProcessingType === "Manual") {
            finalTasks = selectedLabels;
        }

        try {
            setLoading(true);
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error('API error:', error);
        } finally {
            // Send request to backend to begin preprocessing
            axios.post(preprocessingUrl, {
                dataset_id: selectedDataset["dataset_id"],
                tasks: finalTasks
            })
                .then((response) => {
                    console.log(response.data);
                    setLoading(false);
                    setPreprocessingCompleted(true);

                    const normalized_columns = response.data['normalized_columns'];
                    const num_duplicate = response.data['num_duplicate'];
                    const num_interpolate = response.data['num_interpolate'];

                    setPreprocessedData({
                        normalized_columns: normalized_columns,
                        num_duplicate: num_duplicate,
                        num_interpolate: num_interpolate
                    });
                })
                .catch((error) => {
                    console.log(error);
                });
        }
    }

    const handleTraining = () => {
        navigate("/train");
    }

    const handleSelect = async (dataset) => {
        try {
            const fileName = dataset.dataset_name;
            const fileExtension = fileName.split('.').pop().toLowerCase();
            if (fileExtension === "zip") {
                setLoading(true);
                setZipfile(true);
                
                // Using direct URL instead of environment variable
                const response = await axios.get(`http://127.0.0.1:5000/preprocessing_tasks/${dataset['dataset_id']}`);
                const preprocessingSuggestions = response.data;
                
                setPreprocessingTasks(preprocessingSuggestions);

                // Update the checkbox label and state based on color mode info
                const colorModeInfo = preprocessingSuggestions.color_mode_info;
                let colorModeLabel = "";
                let showColorModeOption = false;

                if (colorModeInfo.is_mixed) {
                    colorModeLabel = `Convert to ${colorModeInfo.conversion_target}`;
                    showColorModeOption = true;
                } else if (colorModeInfo.conversion_target) {
                    colorModeLabel = `Convert to ${colorModeInfo.conversion_target}`;
                    showColorModeOption = true;
                }

                // Update state with new color mode information
                setImageCheckedState({
                    ...imageCheckedState,
                    'Color Mode Conversion': preprocessingSuggestions.color_mode_info.is_mixed,
                    'Handle Alpha Channel': preprocessingSuggestions.handle_alpha_channel,
                    'Normalize': preprocessingSuggestions.normalize,
                    'Resize Images': preprocessingSuggestions.resize,
                    'Standardize Aspect Ratio': preprocessingSuggestions.standardize_aspect_ratio,
                });

                setColorModeLabel(colorModeLabel);
                setShowColorMode(showColorModeOption);

                setLoading(false);
            }
        } catch (error) {
            console.log(error);
            setLoading(false);
        }
        setSelectedDataset(dataset);
    }

    const getTaskLabel = (taskName, isNeeded) => {
        const labels = {
            'Handle Alpha Channel': {
                active: 'Handle Alpha Channel',
                inactive: 'Alpha Channel Not Present'
            },
            'Normalize': {
                active: 'Normalize Images',
                inactive: 'Images Already Normalized'
            },
            'Resize Images': {
                active: 'Resize Images',
                inactive: 'Images Already Uniformly Sized'
            },
            'Color Mode Conversion': {
                active: colorModeLabel,
                inactive: 'Multiple Color Modes Detected, Conversion Required'
            }
        };
        return isNeeded ? labels[taskName].active : labels[taskName].inactive;
    };

    // First, add a new function to handle editing preprocessing tasks
    const handleEditPreprocessing = () => {
        setPreprocessingCompleted(false);
    };

    return (
        <>
            {!isZipfile ? (
                <>
                    <div className="content">
                        <Typography>
                            <Row>
                                <Col md="12">
                                    {selectedDataset !== "" ? (
                                        (preprocessingCompleted === true ? (
                                            <>
                                                <Card className="card-plain">
                                                    <CardHeader>
                                                        <CardTitle tag="h2">Preprocessing Completed</CardTitle>
                                                    </CardHeader>
                                                    <CardBody>
                                                        {console.log(preprocessedData)}
                                                        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                                            <tr>
                                                                <th style={{ border: '1px solid black', padding: '8px' }}>Number of Duplicate Rows Dropped</th>
                                                                <td style={{ border: '1px solid black', padding: '8px' }}>{preprocessedData['num_duplicate']}</td>
                                                            </tr>
                                                            <tr>
                                                                <th style={{ border: '1px solid black', padding: '8px' }}>Number of Rows Interpolated</th>
                                                                <td style={{ border: '1px solid black', padding: '8px' }}>{preprocessedData['num_interpolate']}</td>
                                                            </tr>
                                                            <tr>
                                                                <th style={{ border: '1px solid black', padding: '8px' }}>Normalized Features</th>
                                                                <td style={{ border: '1px solid black', padding: '8px' }}>
                                                                    <ul>
                                                                        {preprocessedData['normalized_columns'].map((column, index) => (
                                                                            <li key={index}>{column}</li>
                                                                        ))}
                                                                    </ul>
                                                                </td>
                                                            </tr>
                                                        </table>

                                                        <Button color="success" onClick={handleTraining}>Begin Training</Button>

                                                    </CardBody>
                                                </Card>
                                            </>
                                        ) : (
                                            <>
                                                <Card className="card-plain">
                                                    <CardHeader>
                                                        <CardTitle tag="h2">{selectedDataset.dataset_name}</CardTitle>
                                                    </CardHeader>
                                                    <CardBody>
                                                        <Row>
                                                            <Col md="6">
                                                                <div className="d-flex justify-content-center">
                                                                    {
                                                                        preProcessingType === "Automatic" ? (
                                                                            <Button color="info" onClick={handleClickAuto}>Automatic</Button>
                                                                        ) : (
                                                                            <Button color="secondary" onClick={handleClickAuto}>Automatic</Button>
                                                                        )
                                                                    }
                                                                </div>
                                                            </Col>
                                                            <Col md="6">
                                                                <div className="d-flex justify-content-center">
                                                                    {
                                                                        preProcessingType === "Manual" ? (
                                                                            <Button color="info" onClick={handleClickManual}>Manual</Button>
                                                                        ) : (
                                                                            <Button color="secondary" onClick={handleClickManual}>Manual</Button>
                                                                        )
                                                                    }
                                                                </div>
                                                            </Col>
                                                        </Row>
                                                        <Row>
                                                            {preProcessingType === "Manual" ? (
                                                                <>
                                                                    <Col md="12">
                                                                        <FormGroup className={classes.formGroup} style={{ marginTop: '30px' }}>
                                                                            <FormControlLabel control={<Checkbox checked={checkedState['Drop Duplicate Rows']} onChange={handleLabelChange} name="Drop Duplicate Rows" />} label="Drop Duplicate Rows" style={{ color: 'black' }} />
                                                                            <FormControlLabel control={<Checkbox checked={checkedState['Interpolate Missing Values']} onChange={handleLabelChange} name="Interpolate Missing Values" />} label="Interpolate Missing Values" style={{ color: 'black' }} />
                                                                            <FormControlLabel control={<Checkbox checked={checkedState['Normalise Features']} onChange={handleLabelChange} name="Normalise Features" />} label="Normalise Features" style={{ color: 'black' }} />
                                                                        </FormGroup>
                                                                    </Col>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Col md="12">
                                                                        <FormGroup className={classes.formGroup} style={{ marginTop: '30px' }}>
                                                                            <FormControlLabel control={<Checkbox checked={true} onChange={handleLabelChange} name="Drop Duplicate Rows" />} label="Drop Duplicate Rows" style={{ color: 'black' }} />
                                                                            <FormControlLabel control={<Checkbox checked={true} onChange={handleLabelChange} name="Interpolate Missing Values" />} label="Interpolate Missing Values" style={{ color: 'black' }} />
                                                                            <FormControlLabel control={<Checkbox checked={true} onChange={handleLabelChange} name="Normalise Features" />} label="Normalise Features" style={{ color: 'black' }} />
                                                                        </FormGroup>
                                                                    </Col>
                                                                </>
                                                            )}
                                                        </Row>
                                                        <Row>
                                                            <Col>
                                                                {loading ? <LinearProgress /> : null}
                                                            </Col>
                                                        </Row>
                                                        <Row>
                                                            <Col md="6">
                                                                <div className="d-flex justify-content-center">
                                                                    <Button color="danger" onClick={handleCancel} style={{ marginRight: "5px" }}>Cancel</Button>
                                                                </div>
                                                            </Col>
                                                            <Col md="6">
                                                                <div className="d-flex justify-content-center">
                                                                    <Button color="success" onClick={handlePreProcessing}>Begin Preprocessing</Button>
                                                                </div>
                                                            </Col>
                                                        </Row>

                                                    </CardBody>
                                                </Card>
                                            </>
                                        ))) : (
                                        <>
                                            <Card className="card-plain">
                                                <CardHeader>
                                                    <CardTitle tag="h2">Datasets</CardTitle>
                                                </CardHeader>
                                                <CardBody>
                                                    <Table responsive>
                                                        <thead className="text-primary">
                                                            <tr>
                                                                <th className="text-center" style={{ color: 'black' }}>Name</th>
                                                                <th className="text-center" style={{ color: 'black' }}>Option</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {datasets.map((dataset, index) => (
                                                                <tr key={index}>
                                                                    <td className="text-center">{dataset["dataset_name"]}</td>
                                                                    <td className="text-center">
                                                                        <Button color="info" onClick={() => handleSelect(dataset)}>Select</Button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </Table>
                                                </CardBody>
                                            </Card>
                                        </>
                                    )}
                                </Col>
                            </Row>
                        </Typography>
                    </div>
                </>
            ) : (
                <>
                    {preprocessingCompleted ? (
                        <div className="content">
                            <Typography>
                                <Row>
                                    <Col md="12">
                                        <Card className="card-plain">
                                            <CardHeader>
                                                <CardTitle tag="h2">Image Preprocessing Configuration Complete</CardTitle>
                                            </CardHeader>
                                            <CardBody>
                                                <div style={{ marginBottom: '20px' }}>
                                                    <h4>Selected Preprocessing Tasks:</h4>
                                                    <ul style={{ listStyleType: 'none', padding: '0' }}>
                                                        {Object.entries(imageCheckedState)
                                                            .filter(([_, checked]) => checked)
                                                            .map(([task]) => (
                                                                <li key={task} style={{ 
                                                                    padding: '8px', 
                                                                    margin: '4px 0',
                                                                    backgroundColor: '#f8f9fa',
                                                                    borderRadius: '4px'
                                                                }}>
                                                                    ✓ {task}
                                                                </li>
                                                            ))
                                                        }
                                                    </ul>
                                                </div>
                                                <div className="d-flex justify-content-center">
                                                    <Button 
                                                        color="primary" 
                                                        onClick={handleTraining}
                                                        style={{ marginRight: '10px' }}
                                                    >
                                                        Proceed to Training
                                                    </Button>
                                                    <Button 
                                                        color="secondary" 
                                                        onClick={handleEditPreprocessing}
                                                    >
                                                        Edit Preprocessing Tasks
                                                    </Button>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                </Row>
                            </Typography>
                        </div>
                    ) : (
                        <div className="content">
                            <Typography>
                                <Row>
                                    <Col md="12">
                                        <Card className="card-plain">
                                            <CardHeader>
                                                <CardTitle tag="h2">Image Preprocessing Tasks</CardTitle>
                                            </CardHeader>
                                            <CardBody>
                                                {loading ? (
                                                    <LinearProgress />
                                                ) : (
                                                    <>
                                                        <FormGroup className={classes.formGroup}>
                                                            {showColorMode && (
                                                                <FormControlLabel
                                                                    control={
                                                                        <Checkbox
                                                                            checked={imageCheckedState['Color Mode Conversion']}
                                                                            onChange={handleImageTaskChange}
                                                                            name="Color Mode Conversion"
                                                                            disabled={preprocessingTasks.color_mode_info.is_mixed}
                                                                        />
                                                                    }
                                                                    label={getTaskLabel('Color Mode Conversion', !preprocessingTasks.color_mode_info.is_mixed)}
                                                                    style={{ 
                                                                        color: 'black', 
                                                                        display: 'block', 
                                                                        marginBottom: '10px',
                                                                        opacity: !preprocessingTasks.color_mode_info.is_mixed ? 1 : 0.6
                                                                    }}
                                                                />
                                                            )}
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={imageCheckedState['Handle Alpha Channel']}
                                                                        onChange={handleImageTaskChange}
                                                                        name="Handle Alpha Channel"
                                                                        disabled={!preprocessingTasks.handle_alpha_channel}
                                                                    />
                                                                }
                                                                label={getTaskLabel('Handle Alpha Channel', preprocessingTasks.handle_alpha_channel)}
                                                                style={{ 
                                                                    color: 'black', 
                                                                    display: 'block', 
                                                                    marginBottom: '10px',
                                                                    opacity: preprocessingTasks.handle_alpha_channel ? 1 : 0.6
                                                                }}
                                                            />
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={imageCheckedState['Normalize']}
                                                                        onChange={handleImageTaskChange}
                                                                        name="Normalize"
                                                                        disabled={!preprocessingTasks.normalize}
                                                                    />
                                                                }
                                                                label={getTaskLabel('Normalize', preprocessingTasks.normalize)}
                                                                style={{ 
                                                                    color: 'black', 
                                                                    display: 'block', 
                                                                    marginBottom: '10px',
                                                                    opacity: preprocessingTasks.normalize ? 1 : 0.6
                                                                }}
                                                            />
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={imageCheckedState['Resize Images']}
                                                                        onChange={handleImageTaskChange}
                                                                        name="Resize Images"
                                                                        disabled={!preprocessingTasks.resize}
                                                                    />
                                                                }
                                                                label={getTaskLabel('Resize Images', preprocessingTasks.resize)}
                                                                style={{ 
                                                                    color: 'black', 
                                                                    display: 'block', 
                                                                    marginBottom: '10px',
                                                                    opacity: preprocessingTasks.resize ? 1 : 0.6
                                                                }}
                                                            />
                                                        </FormGroup>
                                                        <Row>
                                                            <Col md="6">
                                                                <div className="d-flex justify-content-center">
                                                                    <Button color="danger" onClick={handleCancel} style={{ marginRight: "5px" }}>Cancel</Button>
                                                                </div>
                                                            </Col>
                                                            <Col md="6">
                                                                <div className="d-flex justify-content-center">
                                                                    <Button color="success" onClick={handlePreProcessing}>Begin Preprocessing</Button>
                                                                </div>
                                                            </Col>
                                                        </Row>
                                                    </>
                                                )}
                                            </CardBody>
                                        </Card>
                                    </Col>
                                </Row>
                            </Typography>
                        </div>
                    )}
                </>
            )}
        </>
    )
}

export default DataPreprocessing;