import { Typography, Button, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody, Box, Chip } from "@mui/material";
import axios from "axios";
import React, { useEffect } from "react";
import { Col, Row, Button as ReactStrapButton } from "reactstrap";
import { Table as ReactStrapTable } from "reactstrap";
import ModelInfoComponent from "components/ModelInfo/ModelInfoComponent";
import ModelCard from "components/ModelInfo/ModelInfoCard";

function ModelDetails() {
    // console.log("ModelDetails");
    const model_id = window.location.pathname.split("/")[2];
    const [loading, setLoading] = React.useState(true);
    const [modelDetails, setModelDetails] = React.useState({});
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
                // if(response.data) {
                //     localStorage.setItem("modelDetails", JSON.stringify(response.data))
                // }
                console.log("This is the modeldetails", response.data)
                setModelDetails(response.data);
                setLoading(false)
                console.log(response.data);
            })
            .catch((error) => {
                console.log(error);
            })

        // return () => clearTimeout(timer);
    }, []);

    return (
        <div className="content">
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
                    {
                        Object.keys(modelDetails).length > 0 && <ModelInfoComponent modelDetails={modelDetails} />
                    }
                </div>

            }
        </div>
    )
}

export default ModelDetails;