import { Typography, Button, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody, Box, Chip, Checkbox } from "@mui/material";
import axios from "axios";
import React, { useEffect, version } from "react";
import { Col, Row, Button as ReactStrapButton } from "reactstrap";
import { Table as ReactStrapTable, Collapse } from "reactstrap";
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Paper from '@mui/material/Paper';
import ConfusionMatrix from "components/Charts/Classification/ConfusionMatrix";
import FeatureImportance from "components/Charts/Classification/FeatureImportance";
import PrecisionRecall from "components/Charts/Classification/PrecisionRecall";
import RocCurve from "components/Charts/Classification/RocCurve";
import ScatterPlot from "components/Charts/Regression/ScatterPlot";
import ResidualPlot from "components/Charts/Regression/ResidualPlot";
import ClassDistribution from "components/Charts/ImageClassification/ClassDistribution";
import SamplePredictions from "components/Charts/ImageClassification/SamplePredictions";
import TrainingHistory from "components/Charts/ImageClassification/TrainingHistory";


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
                    <Box>{children}</Box>
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

function getMetricValue(metric_arr, metric_type) {
    for (var i = 0; i < metric_arr.length; i++) {
        if (metric_arr[i].metric_name === metric_type) {
            return metric_arr[i].metric_value;
        }
    }
}

function getDateFromTimestamp(timestamp) {
    console.log(timestamp.$date)
    // get local timestamp
    var utc = new Date(timestamp.$date);
    var date = new Date(utc.getTime() + utc.getTimezoneOffset() * 60 * 1000);
    var dateString = date.toLocaleDateString();
    return dateString;
}

function getTimeIn12Hours(timestamp) {
    var utc = new Date(timestamp.$date);
    var date = new Date(utc.getTime() + utc.getTimezoneOffset() * 60 * 1000);
    // get timestring in 12 hours format (get only hours and minutes)
    var timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return timeString;
}

function ModelInfoComponent(props) {
    let tempModelDetails;
    if (typeof (props.modelDetails) !== 'string') {
        tempModelDetails = JSON.stringify(props.modelDetails);
        console.log("Object detected")
    }
    else {
        tempModelDetails = props.modelDetails;
    }

    const parsedModelDetails = JSON.parse(tempModelDetails.replace(/Infinity/g, "1e1000"));
    const modelDetails = {
        parameters: [],
        evaluation_metrics: [],
        all_models_results: [],
        versions: [],
        graph_data: {},
        output_mapping: {},
        objective: '',
        training_mode: '',
        ...parsedModelDetails,
    };
    modelDetails.parameters = Array.isArray(modelDetails.parameters) ? modelDetails.parameters : [];
    modelDetails.evaluation_metrics = Array.isArray(modelDetails.evaluation_metrics) ? modelDetails.evaluation_metrics : [];
    modelDetails.all_models_results = Array.isArray(modelDetails.all_models_results) ? modelDetails.all_models_results : [];
    modelDetails.versions = Array.isArray(modelDetails.versions) ? modelDetails.versions : [];
    modelDetails.graph_data = modelDetails.graph_data && typeof modelDetails.graph_data === 'object' ? modelDetails.graph_data : {};
    modelDetails.output_mapping = modelDetails.output_mapping && typeof modelDetails.output_mapping === 'object' ? modelDetails.output_mapping : {};
    modelDetails.objective = typeof modelDetails.objective === 'string' ? modelDetails.objective : '';
    modelDetails.training_mode = typeof modelDetails.training_mode === 'string' ? modelDetails.training_mode : '';
    const objectiveLower = (modelDetails.objective || '').toLowerCase();
    const trainingModeLower = (modelDetails.training_mode || '').toLowerCase();
    const [value, setValue] = React.useState(0);
    const [checkBoxStates, setCheckBoxStates] = React.useState(modelDetails.versions.map((version) => false));
    const [twoCheckBoxSelected, setTwoCheckBoxSelected] = React.useState(false);
    const [compareView, setCompareView] = React.useState(false);
    const [selectedForCompare, setSelectedForCompare] = React.useState([]);
    const [compareTab, setCompareTab] = React.useState(0);

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    const [isOpen, setIsOpen] = React.useState(false);
    const [valueVersion, setValueVersion] = React.useState(0);
    const handleChangeVersion = (event, newValue) => {
        setValueVersion(newValue);
    }

    const [openRows, setOpenRows] = React.useState({});

    const toggleRow = (index) => {
        setOpenRows((prevState) => ({
            ...prevState,
            [index]: !prevState[index] || false,
        }));
    };

    useEffect(() => {

        var count = 0;

        // checkBoxStates.map((state) => {
        //     if (state) {
        //         count++;
        //     }
        // })
        for (var i = 0; i < checkBoxStates.length; i++) {
            if (checkBoxStates[i])
                count++;
        }
        if (count == 2) {
            setTwoCheckBoxSelected(true);
            setSelectedForCompare(getSelectedForComparison());
        }
        else {
            setTwoCheckBoxSelected(false);
        }

    }, [checkBoxStates])

    const getSelectedForComparison = () => {

        var selected = [];
        checkBoxStates.forEach((state, index) => {
            if (state) {
                selected.push(index);
            }
        })
        // sort the selected array
        selected.sort((a, b) => a - b);
        console.log(selected);
        return selected;
    }

    const getChange = (a, b) => {
        return (((a - b) / a) * 100).toFixed(2)
    }

    const clearCheckBoxState = () => {
        var temp = []
        for (var i = 0; i < checkBoxStates.length; i++) {
            temp.push(false);
        }
        setCheckBoxStates([...temp]);
    }

    return (
        <div className="content">
            <Row>
                <Col>
                    <Typography variant="h5" component="h5" gutterBottom>
                        Model Details
                    </Typography>
                </Col>
            </Row>
            <Paper elevation={3}
                style={{
                    padding: "1rem",
                    marginBottom: "1rem",
                    backgroundColor: "transparent",
                }}
            >
                <Box>
                    <Row style={{ marginBottom: "0.5rem" }}>
                        <Col>
                            Dataset: {modelDetails.dataset_id}
                        </Col>
                    </Row>
                    <Row style={{ marginBottom: "0.5rem" }}>
                        <Col>
                            Model ID: {modelDetails.model_id}
                        </Col>
                    </Row>
                    <Row style={{ marginBottom: "0.5rem" }}>
                        <Col md="6">
                            Model Name: {modelDetails.model_name}
                        </Col>
                        <Col md="6">
                            Model Type: {modelDetails.estimator_type}
                        </Col>
                    </Row>
                    <Row style={{ marginBottom: "0.5rem" }}>
                        <Col md="6">
                            Training Mode: <Chip variant='outlined' label={modelDetails.training_mode} />
                        </Col>
                        <Col md="6">
                            Objective: {modelDetails.objective}
                        </Col>
                    </Row>
                    <Row style={{ marginBottom: "0.5rem" }}>
                        <Col md="6">
                            Target Column: {modelDetails.target_column}
                        </Col>
                        <Col md="6">
                            Metric: {modelDetails.metric_type}
                        </Col>
                    </Row>
                    <Row style={{ marginBottom: "0.5rem" }}>
                        <Col md="6">
                            Version Number: 1
                        </Col>
                    </Row>
                </Box>
            </Paper>
            <Row>
                <Col>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                            <Tab label="Metrics" {...a11yProps(0)} />
                            <Tab label="Visualizations" {...a11yProps(1)} />
                            <Tab label="Parameters" {...a11yProps(2)} />
                            <Tab label="All Models Results" {...a11yProps(3)} />
                            <Tab label="Versions" {...a11yProps(4)} />
                        </Tabs>
                    </Box>
                    <CustomTabPanel value={value} index={2}>
                        <ReactStrapTable striped>
                            <thead>
                                <tr>
                                    <th>Parameter</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <TableBody>
                                {Array.isArray(modelDetails.parameters) ? modelDetails.parameters.map((parameter, index) => {
                                    return (
                                        <tr hover size='small' key={index}>
                                            <td>{parameter.parameter_name}</td>
                                            <td>{parameter.parameter_value}</td>
                                        </tr>
                                    );
                                }) : null}
                            </TableBody>
                        </ReactStrapTable>
                    </CustomTabPanel>
                    <CustomTabPanel value={value} index={0}>
                        <ReactStrapTable striped>
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {modelDetails.evaluation_metrics.map((metric, index) => {
                                    if (metric.metric_name != 'classifier') {
                                        return (
                                            <tr key={index}>
                                                <td>{metric.metric_name}</td>
                                                <td>{metric.metric_value}</td>
                                            </tr>
                                        );
                                    }
                                    return null;
                                })}
                            </tbody>
                        </ReactStrapTable>
                    </CustomTabPanel>
                    <CustomTabPanel value={value} index={1}>
                        {objectiveLower === 'classification' ? (
                            <>
                                <Row>
                                    <Col md="6">
                                        <ConfusionMatrix cm={modelDetails.graph_data.confusion_matrix} output_mapping={modelDetails.output_mapping} />
                                    </Col>
                                    <Col md="6">
                                        <FeatureImportance fi={modelDetails.graph_data.feature_importance} />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md="6">
                                        <PrecisionRecall pr_data={modelDetails.graph_data.precision_recall_data} />
                                    </Col>
                                    <Col md="6">
                                        <RocCurve auc_data={modelDetails.graph_data.auc_data} />
                                    </Col>
                                </Row>
                            </>
                        ) : objectiveLower === 'sentiment' ? (
                            <>
                                <Row>
                                    <Col md="6">
                                        <ConfusionMatrix cm={modelDetails.graph_data.confusion_matrix} output_mapping={modelDetails.output_mapping} />
                                    </Col>
                                </Row>
                            </>
                        ) : objectiveLower === 'machinetranslation' ? (
                            <>
                                <Row>
                                    <Col md="12">
                                        <Typography variant="h6" gutterBottom>
                                            Machine Translation Summary
                                        </Typography>
                                    </Col>
                                </Row>
                                <Row style={{ marginBottom: '1rem' }}>
                                    <Col md="12">
                                        <ReactStrapTable striped>
                                            <thead>
                                                <tr>
                                                    <th>Metric</th>
                                                    <th>Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {modelDetails.evaluation_metrics.map((metric, index) => (
                                                    <tr key={index}>
                                                        <td>{metric.metric_name}</td>
                                                        <td>{metric.metric_value}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </ReactStrapTable>
                                    </Col>
                                </Row>
                                {Array.isArray(modelDetails.graph_data.sample_predictions) && modelDetails.graph_data.sample_predictions.length > 0 ? (
                                    <Row>
                                        <Col md="12">
                                            <ReactStrapTable striped>
                                                <thead>
                                                    <tr>
                                                        <th>Input</th>
                                                        <th>Model</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {modelDetails.graph_data.sample_predictions.map((sample, index) => (
                                                        <tr key={index}>
                                                            <td>{sample.input}</td>
                                                            <td>{sample.model}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </ReactStrapTable>
                                        </Col>
                                    </Row>
                                ) : (
                                    <Typography>No sample predictions available.</Typography>
                                )}
                            </>
                        ) : objectiveLower === 'imageclassification' ? (
                            <>
                                <Row>
                                    <Col md="12">
                                        <ClassDistribution distribution_data={modelDetails.graph_data.class_distribution} />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md="12">
                                        <SamplePredictions predictions_data={modelDetails.graph_data.sample_predictions} />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md="12">
                                        <TrainingHistory history_data={modelDetails.graph_data.training_history} />
                                    </Col>
                                </Row>
                            </>
                        ) : (
                            <>
                                <Row style={{ marginBottom: '1.5rem' }}>
                                    <Col md="6">
                                        <FeatureImportance fi={modelDetails.graph_data.feature_importance} />
                                    </Col>
                                    <Col md="6">
                                        <ScatterPlot scatter_plot_data={modelDetails.graph_data.scatter_plot_data} />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col>
                                        <ResidualPlot residual_plot_data={modelDetails.graph_data.residual_plot_data} />
                                    </Col>
                                </Row>
                            </>
                        )}
                    </CustomTabPanel>
                    <CustomTabPanel value={value} index={3}>
                        {trainingModeLower == 'automl' && modelDetails.all_models_results.length > 0 ? <ReactStrapTable striped>
                            <thead>
                                <tr>
                                    {
                                        Object.keys(modelDetails.all_models_results[0])
                                            .map((metric) => {
                                                return (
                                                    <>
                                                        <th>{metric}</th>
                                                    </>
                                                )
                                            }
                                            )
                                    }
                                </tr>
                            </thead>
                            <tbody>
                                {modelDetails.all_models_results.map((model) => (
                                    <tr>
                                        {
                                            Object.keys(model).map((metric) => {
                                                return (
                                                    <>
                                                        <td>{model[metric]}</td>
                                                    </>
                                                )
                                            }
                                            )
                                        }
                                    </tr>
                                ))}
                            </tbody>
                        </ReactStrapTable> : trainingModeLower == 'automl' ? <Typography>No AutoML sweep results were returned for this model.</Typography> : null}
                        {
                            trainingModeLower == 'custom' && <>
                                <Typography>
                                    This model was not trained on AutoML mode.
                                </Typography>
                            </>
                        }
                    </CustomTabPanel>
                    <CustomTabPanel value={value} index={4}>
                        <Typography style={{ marginBottom: '1rem' }}>
                            {!compareView && <>Select any two versions to compare</>}. {
                                twoCheckBoxSelected ?
                                    <Button color="info" variant="contained" onClick={() => { setCompareView(!compareView); if (compareView) { clearCheckBoxState() } }}>{!compareView ? 'Compare' : 'Back'}</Button>
                                    : null
                            }
                        </Typography>
                        {!compareView ? (
                            <ReactStrapTable striped>
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>Model ID</th>
                                        <th>Created at</th>
                                        <th>Model Type</th>
                                        <th>Metric</th>
                                        <th>Metric Score</th>
                                        <th>Version Number</th>
                                        <th>Show details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modelDetails.versions.length === 0 ? (
                                        <tr>
                                            <td colSpan={8}>There are no versions of this model.</td>
                                        </tr>
                                    ) : (
                                        modelDetails.versions.map((version, index) => (
                                            <React.Fragment key={version.model_id || index}>
                                                <tr>
                                                    <td>
                                                        <Checkbox
                                                            checked={checkBoxStates[index]}
                                                            inputProps={{ 'aria-label': 'controlled' }}
                                                            onChange={() => {
                                                                var temp = [...checkBoxStates]
                                                                temp[index] = !temp[index]
                                                                setCheckBoxStates([...temp])
                                                            }}
                                                        />
                                                    </td>
                                                    <td>{version.model_id}</td>
                                                    <td>{getDateFromTimestamp(version.time) + ' ' + getTimeIn12Hours(version.time)}</td>
                                                    <td>{version.estimator_type}</td>
                                                    <td>{modelDetails.metric_type}</td>
                                                    <td>{getMetricValue(version.evaluation_metrics, modelDetails.metric_type)}</td>
                                                    <td>{version.version_number}</td>
                                                    <td><Button onClick={() => { toggleRow(index) }} > {openRows[index] ? 'Show Less Details' : 'Show More Details'}</Button></td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={8}>
                                                        <Collapse isOpen={openRows[index]} style={{ width: '100%' }}>
                                                            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                                                <Tabs value={valueVersion} onChange={handleChangeVersion} aria-label="basic tabs example">
                                                                    <Tab label="Metrics" {...a11yProps(0)} />
                                                                    <Tab label="Visualizations" {...a11yProps(1)} />
                                                                    <Tab label="Parameters" {...a11yProps(2)} />
                                                                </Tabs>
                                                            </Box>
                                                            <CustomTabPanel value={valueVersion} index={0}>
                                                                <ReactStrapTable striped>
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Metric</th>
                                                                            <th>Value</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {version.evaluation_metrics.map((metric, metricIndex) => (
                                                                            metric.metric_name != 'classifier' ? (
                                                                                <tr key={metricIndex}>
                                                                                    <td>{metric.metric_name}</td>
                                                                                    <td>{metric.metric_value}</td>
                                                                                </tr>
                                                                            ) : null
                                                                        ))}
                                                                    </tbody>
                                                                </ReactStrapTable>
                                                            </CustomTabPanel>
                                                            <CustomTabPanel value={valueVersion} index={1}>
                                                                {objectiveLower === 'classification' ? (
                                                                    <>
                                                                        <Row>
                                                                            <Col md="6">
                                                                                <ConfusionMatrix cm={version.graph_data.confusion_matrix} output_mapping={version.output_mapping} />
                                                                            </Col>
                                                                            <Col md="6">
                                                                                <FeatureImportance fi={version.graph_data.feature_importance} />
                                                                            </Col>
                                                                        </Row>
                                                                        <Row>
                                                                            <Col md="6">
                                                                                <PrecisionRecall pr_data={version.graph_data.precision_recall_data} />
                                                                            </Col>
                                                                            <Col md="6">
                                                                                <RocCurve auc_data={version.graph_data.auc_data} />
                                                                            </Col>
                                                                        </Row>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Row style={{ marginBottom: '1.5rem' }}>
                                                                            <Col md="6">
                                                                                <FeatureImportance fi={version.graph_data.feature_importance} />
                                                                            </Col>
                                                                            <Col md="6">
                                                                                <ScatterPlot scatter_plot_data={version.graph_data.scatter_plot_data} />
                                                                            </Col>
                                                                        </Row>
                                                                        <Row>
                                                                            <Col>
                                                                                <ResidualPlot residual_plot_data={version.graph_data.residual_plot_data} />
                                                                            </Col>
                                                                        </Row>
                                                                    </>
                                                                )}
                                                            </CustomTabPanel>
                                                            <CustomTabPanel value={valueVersion} index={2}>
                                                                <ReactStrapTable striped>
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Parameter</th>
                                                                            <th>Value</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <TableBody>
                                                                        {(Array.isArray(version.parameters) ? version.parameters : []).map((parameter, parameterIndex) => (
                                                                            <tr hover size='small' key={parameterIndex}>
                                                                                <td>{parameter.parameter_name}</td>
                                                                                <td>{parameter.parameter_value}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </TableBody>
                                                                </ReactStrapTable>
                                                            </CustomTabPanel>
                                                        </Collapse>
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        ))
                                    )}
                                </tbody>
                            </ReactStrapTable>
                        ) : null}
                        {
                            compareView && selectedForCompare.length == 2 &&
                            <>
                                <Row>
                                    {console.log(selectedForCompare)}
                                    <Col md="12">
                                        <Typography variant="h5" style={{ 'textAlign': 'center' }}>
                                            Version Comparison: Version {modelDetails.versions[selectedForCompare[0]].version_number} Vs Version {modelDetails.versions[selectedForCompare[1]].version_number}
                                        </Typography>
                                        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                            <Tabs value={compareTab} onChange={(event, newValue) => { setCompareTab(newValue) }} aria-label="basic tabs example">
                                                <Tab label="Metrics" {...a11yProps(0)} />
                                                <Tab label="Parameters" {...a11yProps(1)} />
                                                <Tab label="Visualizations" {...a11yProps(2)} />
                                            </Tabs>
                                        </Box>
                                        <CustomTabPanel value={compareTab} index={0}>
                                            <ReactStrapTable striped>
                                                <thead>
                                                    <tr>
                                                        <th>Metric</th>
                                                        <th>Version {modelDetails.versions[selectedForCompare[0]].version_number}</th>
                                                        <th>Version {modelDetails.versions[selectedForCompare[1]].version_number}</th>
                                                        <th>Change</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(Array.isArray(modelDetails.versions[selectedForCompare[0]]?.evaluation_metrics) ? modelDetails.versions[selectedForCompare[0]].evaluation_metrics : []).map((metric, index) => {

                                                        if (metric.metric_name != 'classifier') {
                                                            return (
                                                                <tr key={index}>
                                                                    <td>{metric.metric_name}</td>
                                                                    <td>{metric.metric_value}</td>
                                                                    {console.log(index)}
                                                                    {console.log(modelDetails.versions[selectedForCompare[1]].evaluation_metrics)}
                                                                    <td>{modelDetails.versions[selectedForCompare[1]].evaluation_metrics[index].metric_value} </td>
                                                                    <td>
                                                                        <span style={{ color: getChange(metric.metric_value, modelDetails.versions[selectedForCompare[1]].evaluation_metrics[index].metric_value) >= 0 ? 'green' : 'red' }}>
                                                                            {
                                                                                getChange(metric.metric_value, modelDetails.versions[selectedForCompare[1]].evaluation_metrics[index].metric_value)
                                                                            }%
                                                                        </span>
                                                                    </td>
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
                                        <CustomTabPanel value={compareTab} index={1}>
                                            <Typography>
                                                Parameters having different values have been highlighted.
                                            </Typography>
                                            {

                                                modelDetails.versions[selectedForCompare[0]].estimator_type == modelDetails.versions[selectedForCompare[1]].estimator_type ?
                                                    <ReactStrapTable striped>
                                                        <thead>
                                                            <tr>
                                                                <th>Parameter</th>
                                                                <th>Version: {modelDetails.versions[selectedForCompare[0]].version_number}</th>
                                                                <th>Version: {modelDetails.versions[selectedForCompare[1]].version_number}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {modelDetails.versions[selectedForCompare[0]].parameters.map((parameter, index) => {
                                                                const version1Value = parameter.parameter_value;
                                                                const version2Value = modelDetails.versions[selectedForCompare[1]].parameters[index].parameter_value;
                                                                const isDifferent = version1Value != version2Value;

                                                                return (
                                                                    <tr hover size='small' key={index} style={isDifferent ? { backgroundColor: '#fffd9b' } : {}}>
                                                                        <td>{parameter.parameter_name}</td>
                                                                        <td>{version1Value}</td>
                                                                        <td>{version2Value}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </ReactStrapTable>
                                                    :
                                                    <Typography>
                                                        Parameters cannot be compared as these two versions correspond to different kind of estimators ({modelDetails.versions[selectedForCompare[0]].estimator_type}, {modelDetails.versions[selectedForCompare[1]].estimator_type})
                                                    </Typography>
                                            }
                                        </CustomTabPanel>
                                        <CustomTabPanel value={compareTab} index={2}>
                                            {
                                                                                objectiveLower == 'classification' ?
                                                    <>
                                                        <Row>
                                                            <Col md="6">
                                                                <Typography variant="h6" style={{ textAlign: 'center' }} gutterBottom>
                                                                    Version: {modelDetails.versions[selectedForCompare[0]].version_number}
                                                                </Typography>
                                                            </Col>
                                                            <Col md="6">
                                                                <Typography variant="h6" style={{ textAlign: 'center' }} gutterBottom>
                                                                    Version: {modelDetails.versions[selectedForCompare[1]].version_number}
                                                                </Typography>
                                                            </Col>
                                                        </Row>
                                                        <Row
                                                        >
                                                            <Col md="6">
                                                                <ConfusionMatrix cm={modelDetails.versions[selectedForCompare[0]].graph_data.confusion_matrix} output_mapping={modelDetails.versions[selectedForCompare[0]].output_mapping} />
                                                            </Col>
                                                            <Col md="6">
                                                                <ConfusionMatrix cm={modelDetails.versions[selectedForCompare[1]].graph_data.confusion_matrix} output_mapping={modelDetails.versions[selectedForCompare[1]].output_mapping} />
                                                            </Col>
                                                        </Row>
                                                        <Row>
                                                            <Col md="6">
                                                                <FeatureImportance fi={modelDetails.versions[selectedForCompare[0]].graph_data.feature_importance} />
                                                            </Col>
                                                            <Col md="6">
                                                                <FeatureImportance fi={modelDetails.versions[selectedForCompare[1]].graph_data.feature_importance} />
                                                            </Col>
                                                        </Row>
                                                        <Row>
                                                            <Col md="6">
                                                                <PrecisionRecall pr_data={modelDetails.versions[selectedForCompare[0]].graph_data.precision_recall_data} />
                                                            </Col>
                                                            <Col md="6">
                                                                <PrecisionRecall pr_data={modelDetails.versions[selectedForCompare[1]].graph_data.precision_recall_data} />
                                                            </Col>

                                                        </Row>
                                                        <Row>
                                                            <Col md="6">
                                                                <RocCurve auc_data={modelDetails.versions[selectedForCompare[0]].graph_data.auc_data} />
                                                            </Col>
                                                            <Col md="6">
                                                                <RocCurve auc_data={modelDetails.versions[selectedForCompare[1]].graph_data.auc_data} />
                                                            </Col>
                                                        </Row>
                                                    </> : null
                                            }
                                        </CustomTabPanel>
                                    </Col>
                                </Row>
                            </>
                        }
                    </CustomTabPanel>
                </Col>
            </Row>
        </div>
    )
}

export default ModelInfoComponent;