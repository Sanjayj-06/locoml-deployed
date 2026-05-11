import { Typography, Button, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody, Box, Chip, MenuItem, TextField, Checkbox } from "@mui/material";
import axios from "axios";
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import React, { useEffect } from "react";
import { Col, Row, Button as ReactStrapButton } from "reactstrap";

const ChangeHyperparameters = (props) => {

    const modelDetails = props.modelDetails;
    const [classifierMap, setClassifierMap] = React.useState({})
    const [hyperparameters, setHyperparameters] = React.useState({});
    const [checkBoxStates, setCheckBoxStates] = React.useState([])
    const [textBoxStates, setTextBoxStates] = React.useState([])
    const [textBoxValues, setTextBoxValues] = React.useState([])

    useEffect(() => {

        const getHyperparameters = async () => {
            const response = await axios.get('http://127.0.0.1:5000/getClassifierMap');
            setClassifierMap(response.data);

            const sklearn_estimator_name = modelDetails.estimator_type
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

        getHyperparameters()
    }, [])

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
        props.parentCallback({
            hyperparameters: hyperparameters,
            textBoxValues: textBoxValues
        })
    }

    useEffect(() => {
        sendDataToMainPage();
    }, [hyperparameters, textBoxValues])

    return (
        <>
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

export default ChangeHyperparameters;