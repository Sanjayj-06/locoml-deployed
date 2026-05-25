import React, {useState, useRef, useEffect} from "react";
import {useMatch, useNavigate} from "react-router-dom";
import axios from "axios";
import {CircularProgress, Modal, Typography} from "@mui/material";
import {Button} from "antd";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import {CsvToHtmlTable} from "react-csv-to-table";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

function ProcessSavedPipeline() {
    const match = useMatch("/pipeline/:pipeline_id");
    const navigate = useNavigate();
    const pipeline_id = match?.params.pipeline_id.replaceAll("%20", " ");
    const [loading, setLoading] = useState(true);
    const [inferencePipeline, setInferencePipeline] = useState({
        "time": "2021-10-10T12:00:00.000Z",
        "pipeline_id": "S9NVQZ",
        "nodes": [{
            'id': '1',
            'type': 'input',
            'data': {'label': 'Start'},
            'position': {'x': 250, 'y': 5},
            'width': 150,
            'height': 40
        }],
        'edges': []
    });
    const [inputBlockList, setInputBlockList] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [csvData, setCsvData] = useState("");
    const [open, setOpen] = useState(false);
    const [showCURLCommand, setShowCURLCommand] = useState([]);

    useEffect(() => {
        const retrieveUrl = process.env.REACT_APP_INFERENCE_PIPELINE_RETRIEVE_PIPELINE_DETAILS || "http://localhost:5005/retrievePipelineDetails";
        axios.get(retrieveUrl + `/?pipeline_id=${pipeline_id}`)
            .then(async (response) => {
                let data = response.data;
                if (typeof response.data === "string") data = JSON.parse(data);
                console.log(data);
                setInferencePipeline(data);
                setLoading(false);

                const inputDataNodes = data.nodes
                    .map((node, index) => ({...node, index}))
                    .filter(node => node.type === 'inputData')
                    .map(node => ({
                        index: node.index,
                        id: node.id,
                        name: (node.data.hasOwnProperty('name') ? node.data.name : ""),
                        uploadedFileName: "",
                        fileInput: React.createRef()
                    }));
                setInputBlockList(inputDataNodes);
                setShowCURLCommand(new Array(inputDataNodes.length).fill(false));
                console.log(inputDataNodes);
            })
            .catch((error) => {
                console.error("Failed to fetch pipeline details:", error);
                setLoading(false);
            })
    }, [pipeline_id]);

    const processGivenInput = async (event, index) => {
        const file = event.target.files[0];

        const formData = new FormData();
        formData.append('file', file);
        formData.append('filesize', file.size);
        formData.append('filename', file.name);
        formData.append('nodeid', inputBlockList[index].id);

        const getFileInputUrl = process.env.REACT_APP_MASTER_SERVER_GET_INPUT_FILE || "http://localhost:5001/getFile";
        await axios.post(getFileInputUrl, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        }).then(res => {
            console.log(res);
            setInputBlockList((prevState) => {
                const newState = [...prevState];
                newState[index].uploadedFileName = file.name;
                return newState;
            });
            setInferencePipeline((prevState) => {
                const newState = {...prevState};
                newState.nodes[inputBlockList[index].index].data.entity = formData;
                return newState;
            });
        }).catch(err => {
            console.log(err);
        });
    };

    const handleRun = async () => {
        const nodes = inferencePipeline.nodes;
        const edges = inferencePipeline.edges;
        console.log("Nodes", nodes);
        console.log("Edges", edges);
        setIsRunning(true);

        const callMaster = async () => {
            try {
                const runPipelineUrl = process.env.REACT_APP_RUN_INFERENCE_PIPELINE || "http://localhost:5001/nodeInfo";
                const response = await axios.post(runPipelineUrl, {
                    nodes: nodes,
                    edges: edges
                });

                console.log("Received response: ", typeof (response.data));

                if (response.status === 200) {
                    setCsvData(response.data);
                    setOpen(true);
                }
            } catch (error) {
                const backendMessage = error?.response?.data?.message || error?.response?.data?.error || error.message;
                console.log(error);
                window.alert(`Pipeline run failed: ${backendMessage}`);
            } finally {
                setIsRunning(false);
            }
        };

        await callMaster();
    };

    const handleDownloadBatch = () => {
        const csvDownload = new Blob([csvData], {type: 'text/csv'});
        const url = window.URL.createObjectURL(csvDownload);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'predictions.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCopyCurlCommand = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('Command copied to clipboard!');
        }).catch(err => {
            console.log('Failed to copy: ', err);
        });
    };

    const toggleCurlCommandVisibility = (index) => {
        setShowCURLCommand((prev) => {
            const newState = [...prev];
            newState[index] = !newState[index];
            return newState;
        });
    };

    return (
        <div className="content">
            {loading ? (
                <div style={{
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '70vh'
                }}>
                    <CircularProgress /> <br />
                    <Typography variant="h6" style={{ marginLeft: '10px' }}>
                        Fetching Details of Pipeline with ID: {pipeline_id} <br />
                    </Typography>
                    <Typography variant="subtitle1" style={{ marginLeft: '10px' }}>
                        Please wait...
                    </Typography>
                </div>
            ) : (
                <>
                    <div style={{ marginBottom: "20px" }}>
                        <Button 
                            onClick={() => navigate("/pipelines")} 
                            style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: "6px", 
                                height: "35px", 
                                borderRadius: "18px", 
                                backgroundColor: "#ffffff", 
                                color: "#333333", 
                                border: "1px solid #cccccc", 
                                fontSize: "14px", 
                                padding: "0 15px",
                                cursor: "pointer",
                                boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                                textTransform: "none",
                                fontWeight: "500"
                            }}
                        >
                            ← Back to Inference Zoo
                        </Button>
                    </div>
                    {inputBlockList.map((inputBlock, index) => (
                        <div key={index}>
                            {inputBlock.name === "" ? `ID: ${inputBlock.id}` : `Name: ${inputBlock.name}`}
                            <input
                                type="file"
                                accept=".csv"
                                style={{ display: 'none' }}
                                onChange={(event) => processGivenInput(event, index)}
                                ref={inputBlock.fileInput}
                            />
                            <Button
                                style={{
                                    height: "40px", fontSize: "20px", marginTop: "2px", marginBottom: "2px",
                                    display: "flex", justifyContent: "center", alignItems: "center",
                                    backgroundColor: "#f5f5f5", color: "#222222",
                                }}
                                onClick={() => {
                                    inputBlock.fileInput.current.click();
                                }}
                            >
                                {inputBlock.uploadedFileName !== "" ? `Uploaded: ${inputBlock.uploadedFileName}` : 'Upload Dataset'}
                            </Button>
                            <Button
                                style={{
                                    height: "40px", fontSize: "20px", marginTop: "2px", marginBottom: "2px",
                                    display: "flex", justifyContent: "center", alignItems: "center",
                                    backgroundColor: "#f5f5f5", color: "#222222",
                                    marginLeft: '10px'
                                }}
                                onClick={() => toggleCurlCommandVisibility(index)}
                            >
                                {showCURLCommand[index] ? 'Hide cURL Command' : 'Show cURL Command'}
                            </Button>
                            {showCURLCommand[index] && (
                                <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
                                    <div style={{
                                        border: '1px solid #ccc',
                                        padding: '10px',
                                        overflowX: 'scroll',
                                        whiteSpace: 'nowrap',
                                        maxWidth: '600px',
                                        marginRight: '10px'
                                    }}>
                                        curl -X POST -F {"file=@Datasets/<input_dataset_name>.csv"} http://localhost:5005/getCSVInput/{pipeline_id} --output output.csv
                                    </div>
                                    <Button
                                        onClick={() => handleCopyCurlCommand(`curl -X POST -F "file=@Datasets/${inputBlock.uploadedFileName}.csv" http://localhost:5005/getCSVInput/${pipeline_id} --output output.csv`)}
                                    >
                                        <ContentCopyIcon />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                    <Modal open={open} onClose={() => setOpen(false)} style={{
                        width: "80%",
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)"
                    }}>
                        <div style={{ backgroundColor: "#fff", padding: "20px" }}>
                            <CsvToHtmlTable
                                data={csvData.split('\n').slice(0, 10).join('\n')}
                                csvDelimiter=","
                                tableClassName="table table-striped table-hover"
                            />
                            <Button onClick={() => setOpen(false)}>Close</Button>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<FileDownloadIcon />}
                                style={{ marginLeft: '72%' }}
                                onClick={handleDownloadBatch}
                            >
                                Download
                            </Button>
                        </div>
                    </Modal>
                    <Button
                        onClick={handleRun}
                        variant="contained"
                        disabled={isRunning}
                        style={{
                            borderRadius: 35,
                            backgroundColor: "#333333",
                            marginTop: '20px',
                            padding: "18px 36px",
                            fontSize: "18px",
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {isRunning ? "Running..." : "Run"}
                        <PlayArrowIcon style={{ marginLeft: '8px' }} />
                    </Button>
                </>
            )}
        </div>
    );
}

export default ProcessSavedPipeline;