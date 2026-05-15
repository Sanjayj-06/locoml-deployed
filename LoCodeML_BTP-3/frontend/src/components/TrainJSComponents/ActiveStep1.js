import React, { useEffect } from "react";
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';

import { Col, Row, Button as ReactStrapButton } from "reactstrap";

function ActiveStep1(props) {

    const objective = props.objective;
    console.log(objective)

    const [trainingMode, setTrainingMode] = React.useState('AutoML');
    const [modelType, setModelType] = React.useState('');
    const [metricMode, setMetricMode] = React.useState('AutoSelect');
    const [metricType, setMetricType] = React.useState('');

    const classifiers = ['Logistic Regression', 'Decision Tree', 'Random Forest', 'Ada Boost', 'Naive Bayes', 'K Nearest Neighbours', 'SVM']
    const regressors = ['Random Forest Regressor', 'AdaBoost Regressor', 'Ridge Regression', 'Bayesian Ridge Regression']
    const sentimentClassifier = ['DistilBERT']
    const imageClassifiers = ['CNN','ResNet']
    const translationModels = ['Helsinki-NLP/Opus-MT-en-de', 'Helsinki-NLP/Opus-MT-en-fr', 'Helsinki-NLP/Opus-MT-en-es', 'Helsinki-NLP/Opus-MT-en-ro']
    const classificationMetrics = ['Accuracy', 'Precision', 'Recall', 'F1 Score', 'AUC']
    const regressionMetrics = ['R2 Score', 'Mean Absolute Error', 'Mean Squared Error', 'Root Mean Squared Error']
    const sentimentMetrics = ['Accuracy', 'Precision', 'Recall', 'F1 Score']
    const imageClassificationMetrics = ['Accuracy', 'Precision', 'Recall', 'F1 Score', 'AUC']
    const translationMetrics = ['BLEU', 'Rouge', 'Accuracy']

    const sendDataToMainPage = () => {
        props.parentCallback({
            trainingMode: trainingMode,
            modelType: modelType,
            metricMode: metricMode,
            metricType: metricType
        });
    }

    useEffect(() => {
        sendDataToMainPage();
    }, [trainingMode, modelType, metricMode, metricType])

    return (
        <>
            <div style={{ marginTop: "1.5rem" }}>
                <Box>
                    <Row className="mb-3">
                        <Col md="2" style={{ marginTop: "1rem" }}>
                            Optimization Objective:
                        </Col>
                        <Col md="6">
                            <FormControl>
                                <RadioGroup
                                    aria-labelledby="demo-controlled-radio-buttons-group"
                                    // name="controlled-radio-buttons-group"
                                    value={metricMode}
                                    onChange={(event) => { console.log(event.target.value); setMetricMode(event.target.value); setMetricType('') }}
                                >
                                    <FormControlLabel
                                        value="AutoSelect"
                                        control={<Radio />}
                                        label={
                                            <div style={{ marginTop: '0.8rem' }}>
                                                Select Automatically based on dataset
                                                <div style={{ fontSize: '12px', color: 'gray' }}>
                                                    The metric to be optimized is selected automatically based on the dataset.
                                                </div>
                                            </div>
                                        }
                                    />
                                    <FormControlLabel
                                        value="CustomMetric"
                                        control={<Radio />}
                                        label={
                                            <div style={{ marginTop: '0.8rem' }}>
                                                Select a particular metric
                                                <div style={{ fontSize: '12px', color: 'gray' }}>
                                                    Select a particular metric to be optimized.
                                                </div>
                                            </div>
                                        }
                                    />
                                    {metricMode == "CustomMetric" && objective.toLowerCase() == 'classification' ? <div>
                                        <FormControl fullWidth>
                                            <InputLabel id="label">Select Metric</InputLabel>
                                            <Select
                                                labelId="label"
                                                label="Select Classifier"
                                                fullWidth
                                                onChange={(e) => setMetricType(e.target.value)}
                                            >
                                                {classificationMetrics.map((column) => (
                                                    <MenuItem value={column}>{column}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </div> : null}
                                    {metricMode == "CustomMetric" && objective.toLowerCase() == 'regression' ? <div>
                                        <FormControl fullWidth>
                                            <InputLabel id="label">Select Metric</InputLabel>
                                            <Select
                                                labelId="label"
                                                label="Select Regressor"
                                                fullWidth
                                                onChange={(e) => setMetricType(e.target.value)}
                                            >
                                                {regressionMetrics.map((column) => (
                                                    <MenuItem value={column}>{column}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </div> : null}
                                    {metricMode == "CustomMetric" && objective.toLowerCase() == 'sentiment' ? <div>
                                        <FormControl fullWidth>
                                            <InputLabel id="label">Select Metric</InputLabel>
                                            <Select
                                                labelId="label"
                                                label="Select Sentiment Analysis Model"
                                                fullWidth
                                                onChange={(e) => setMetricType(e.target.value)}
                                            >
                                                {sentimentMetrics.map((column) => (
                                                    <MenuItem value={column}>{column}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </div> : null}
                                    {metricMode == "CustomMetric" && objective.toLowerCase() == 'imageclassification' ? <div>
                                        <FormControl fullWidth>
                                            <InputLabel id="label">Select Metric</InputLabel>
                                            <Select
                                                labelId="label"
                                                label="Select Image Classification Model"
                                                fullWidth
                                                onChange={(e) => setMetricType(e.target.value)}
                                            >
                                                {imageClassificationMetrics.map((column) => (
                                                    <MenuItem value={column}>{column}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </div> : null}
                                    {metricMode == "CustomMetric" && objective.toLowerCase() == 'machinetranslation' ? <div>
                                        <FormControl fullWidth>
                                            <InputLabel id="label">Select Metric</InputLabel>
                                            <Select
                                                labelId="label"
                                                label="Select Metric"
                                                fullWidth
                                                onChange={(e) => setMetricType(e.target.value)}
                                            >
                                                {translationMetrics.map((column) => (
                                                    <MenuItem value={column}>{column}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </div> : null}
                                </RadioGroup>
                            </FormControl>
                        </Col>
                    </Row>
                    <Row className=" mb-3">
                        <Col md="2" style={{ marginTop: "1rem" }}>
                            Select Model Type:
                        </Col>
                        <Col md="6">
                            <FormControl>
                                <RadioGroup
                                    aria-labelledby="demo-controlled-radio-buttons-group"
                                    // name="controlled-radio-buttons-group"
                                    // row
                                    value={trainingMode}
                                    onChange={(e) => setTrainingMode(e.target.value)}
                                >
                                    <FormControlLabel
                                        value="AutoML"
                                        control={<Radio />}
                                        label={
                                            <div style={{ marginTop: '0.8rem' }}>
                                                AutoML
                                                <div style={{ fontSize: '12px', color: 'gray' }}>
                                                    Train a classifier automatically which maximizes the selected metric. The model is trained using various algorithms and the best one is selected.
                                                </div>
                                            </div>
                                        }
                                    />
                                    <FormControlLabel
                                        value="CustomModel"
                                        control={<Radio />}
                                        label={
                                            <div style={{ marginTop: '0.8rem' }}>
                                                Select a model type
                                                <div style={{ fontSize: '12px', color: 'gray' }}>
                                                    Select a particular model type and train the model.
                                                </div>
                                            </div>
                                        }
                                    />
                                    {trainingMode == "CustomModel" && objective.toLowerCase() == 'classification' ? <div>
                                        <FormControl fullWidth>
                                            <InputLabel id="label">Select Classifier</InputLabel>
                                            <Select
                                                labelId="label"
                                                label="Select Classifier"
                                                fullWidth
                                                onChange={(e) => setModelType(e.target.value)}
                                            >
                                                {classifiers.map((column) => (
                                                    <MenuItem value={column}>{column}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </div> : null}
                                    {trainingMode == "CustomModel" && objective.toLowerCase() == 'regression' ? <div>
                                        <FormControl fullWidth>
                                            <InputLabel id="label">Select Regressor</InputLabel>
                                            <Select
                                                labelId="label"
                                                label="Select Regressor"
                                                fullWidth
                                                onChange={(e) => setModelType(e.target.value)}
                                            >
                                                {regressors.map((column) => (
                                                    <MenuItem value={column}>{column}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </div> : null}
                                    {trainingMode == "CustomModel" && objective.toLowerCase() == 'sentiment' ? <div>
                                        <FormControl fullWidth>
                                            <InputLabel id="label">Select Sentiment Analysis Model</InputLabel>
                                            <Select
                                                labelId="label"
                                                label="Select Sentiment Analysis Model"
                                                fullWidth
                                                onChange={(e) => setModelType(e.target.value)}
                                            >
                                                {sentimentClassifier.map((column) => (
                                                    <MenuItem value={column}>{column}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </div> : null}
                                    {metricMode == "CustomMetric" && objective.toLowerCase() == 'machinetranslation' ? <div>
                                        <FormControl fullWidth>
                                            <InputLabel id="label">Select Metric</InputLabel>
                                            <Select
                                                labelId="label"
                                                label="Select Metric"
                                                fullWidth
                                                onChange={(e) => setMetricType(e.target.value)}
                                            >
                                                {translationMetrics.map((column) => (
                                                    <MenuItem value={column}>{column}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </div> : null}
                                    {trainingMode == "CustomModel" && objective.toLowerCase() == 'machinetranslation' ? <div>
                                        <FormControl fullWidth>
                                            <InputLabel id="label">Select Translation Model</InputLabel>
                                            <Select
                                                labelId="label"
                                                label="Select Translation Model"
                                                fullWidth
                                                onChange={(e) => setModelType(e.target.value)}
                                            >
                                                {translationModels.map((column) => (
                                                    <MenuItem value={column}>{column}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </div> : null}
                                </RadioGroup>
                            </FormControl>
                        </Col>
                    </Row>
                </Box>
            </div>
        </>
    )
}

export default ActiveStep1