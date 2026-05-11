import { Typography, Button, CircularProgress, LinearProgress, Table, TableHead, TableRow, TableCell, TableBody, Box, Chip, MenuItem, TextField, Checkbox } from "@mui/material";
import axios from "axios";
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import React, { useEffect } from "react";
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Paper from '@mui/material/Paper';
import { Col, Row, Button as ReactStrapButton } from "reactstrap";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Table as ReactStrapTable } from "reactstrap";

const ChangeEstimatorType = (props) => {
    const modelDetails = props.modelDetails;

    const [allClassifiers, setAllClassifiers] = React.useState([]);
    const [classifierMap, setClassifierMap] = React.useState({})
    const [allRegressors, setAllRegressors] = React.useState([]);
    const [selectedClassifier, setSelectedClassifier] = React.useState('')
    const [hyperparameters, setHyperparameters] = React.useState({});
    const [checkBoxStates, setCheckBoxStates] = React.useState([])
    const [textBoxStates, setTextBoxStates] = React.useState([])
    const [textBoxValues, setTextBoxValues] = React.useState([])

    useEffect(() => {
        const getClassifiersAndHyperparameters = async () => {
            // console.log(process.env.REACT_APP_GET_ALL_CLASSIFIERS_URL)
            const response = await axios.get('http://127.0.0.1:5000/getAllClassifiers');
            setAllClassifiers(response.data);
            const response2 = await axios.get('http://127.0.0.1:5000/getClassifierMap');
            console.log(response2)
            setClassifierMap(response2.data);
            // console.log()
            if (modelDetails.objective.toLowerCase() == 'classification') {
                setSelectedClassifier(response2.data.reverse_map[modelDetails.estimator_type])
            }
            const response3 = await axios.post('http://127.0.0.1:5000/getHyperparameters', {
                'estimator_name': modelDetails.estimator_type,
            })
            // console.log(response3.data)
            var checkboxes = []
            var textboxes = []
            var texts = []
            console.log(checkboxes)
            var hyperparameter_keys = Object.keys(response3.data)
            for (var i = 0; i < hyperparameter_keys.length; i++) {
                checkboxes.push(false)
                textboxes.push(true)
                texts.push(response3.data[hyperparameter_keys[i]])
            }
            setHyperparameters(response3.data)
            // console.log(checkboxes)
            setCheckBoxStates(checkboxes)
            setTextBoxStates(textboxes)
            setTextBoxValues(texts)
      }
        
      getClassifiersAndHyperparameters();
    }, [])  

    const handleClassifierChange = (e) => {
        setSelectedClassifier(e.target.value)
        const sklearn_estimator_name = classifierMap.forward_map[e.target.value]
        console.log(classifierMap)
        console.log(sklearn_estimator_name)
        axios.post('http://127.0.0.1:5000/getHyperparameters', {
            'estimator_name': sklearn_estimator_name,
        }).then(response3 => {
            console.log(response3.data)
            var checkboxes = []
            var textboxes = []
            var texts = []
            console.log(checkboxes)
            var hyperparameter_keys = Object.keys(response3.data)
            for (var i = 0; i < hyperparameter_keys.length; i++) {
                checkboxes.push(false)
                textboxes.push(true)
                texts.push(response3.data[hyperparameter_keys[i]])
            }
            setHyperparameters(response3.data)
            console.log(checkboxes)
            setCheckBoxStates(checkboxes)
            setTextBoxStates(textboxes)
            setTextBoxValues(texts)
        }
        ).catch(err => {
            console.log(err)
        })
    }

    const handleCheckBoxChange = (index) => {
        var temp = [...checkBoxStates]
        temp[index] = !temp[index]
        setCheckBoxStates(temp)
        var temp2 = [...textBoxStates]
        temp2[index] = !temp2[index]
        setTextBoxStates(temp2)
    }

    const handleTextFieldChange = (index, e) => {
        var temp = [...textBoxValues]
        temp[index] = e.target.value
        setTextBoxValues(temp)
    }

    const sendDataToMainPage = () => {
        console.log(classifierMap)
        props.parentCallback({
            selectedClassifier: classifierMap.forward_map[selectedClassifier],
            hyperparameters: hyperparameters,
            textBoxValues: textBoxValues
        })
    }

    useEffect(() => {
        if(Object.keys(classifierMap).length > 0) 
        {
            sendDataToMainPage();
        }
    }
    , [selectedClassifier, hyperparameters, textBoxValues])

    return (
        <>
            <Row className="align-items-center mb-3">
                <Col md="4">
                    Select {modelDetails.objective.toLowerCase() == 'classification' ? 'Classifier' : 'Regressor'} type:
                    <Typography variant='body1'
                        style={{
                            fontSize: '14px'
                        }}
                    >
                        (The original classifier has been selected by default).
                    </Typography>
                </Col>
                <Col md="6">
                    <FormControl fullWidth>
                        <InputLabel id="objectivelabel">Classifier</InputLabel>
                        <Select
                            // labelId="objectivelabel"
                            // label="Column"
                            label="Classifier"
                            fullWidth
                            value={selectedClassifier}
                            onChange={(e) => handleClassifierChange(e)}>
                            {allClassifiers.map((clf) => {
                                return (
                                    <MenuItem value={clf}>{clf}</MenuItem>
                                )
                            })}
                        </Select>
                    </FormControl>
                </Col>
            </Row>
            <Row style={{
                marginBottom: '2rem'
            }}>
                <Col md="12">
                    <Typography>
                        Select the hyperparameters you want to change and enter the new value:
                    </Typography>
                </Col>
            </Row>
            {
                Object.entries(hyperparameters).map(([key, value], i) => {
                    return (
                        <Row className="align-items-center mb-3">
                            <Col md="1">
                                <Checkbox checked={checkBoxStates[i]} onChange={() => { handleCheckBoxChange(i) }} inputProps={{ 'aria-label': 'controlled' }} />
                            </Col>
                            <Col md="4">
                                <Typography>{key}</Typography>
                            </Col>
                            <Col md="6">
                                <TextField disabled={textBoxStates[i]} value={textBoxValues[i]} variant="standard" defaultValue={value} onChange={(event) => { handleTextFieldChange(i, event) }}></TextField>
                            </Col>
                        </Row>
                    )
                })
            }
        </>
    )
}

export default ChangeEstimatorType;