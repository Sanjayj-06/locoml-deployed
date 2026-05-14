import React, {useCallback, useState} from "react";
import axios from "axios";
import {DeleteOutline} from "@mui/icons-material";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {Button, CircularProgress, Modal, Typography, Box} from "@mui/material";
import {CsvToHtmlTable} from 'react-csv-to-table';
import './inference.css'
import 'reactflow/dist/style.css';
import InferenceNavbar from './InferenceNavbar';
import ChatbotModal from '../components/Chatbot/ChatbotModal'
import ReactFlow, {
    addEdge,
    applyEdgeChanges,
    Background,
    Controls,
    Panel,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
} from "reactflow";
import inputSelectorNode from "./customSelectorNodes/inputSelectorNode";
import preprocessingSelectorNode from "./customSelectorNodes/preprocessingSelectorNode";
import classificationSelectorNode from "./customSelectorNodes/classificationSelectorNode";
import regressionSelectorNode from "./customSelectorNodes/regressionSelectorNode";
import sentimentSelectorNode from "./customSelectorNodes/sentimentSelectorNode";
import huggingFaceSelectorNode from "./customSelectorNodes/huggingFaceSelectorNode";
import SaveInferencePipelineDialog from "./SaveInferencePipelineDialog";
import adapterSelectorNode from "./customSelectorNodes/adapterSelectorNode";
import imageClassificationSelectorNode from "./customSelectorNodes/imageClassificationSelectorNode";

const nodeTypes = {
    inputData: inputSelectorNode,
    preprocessing: preprocessingSelectorNode,
    adapter: adapterSelectorNode,
    classification: classificationSelectorNode,
    regression: regressionSelectorNode,
    sentiment: sentimentSelectorNode,
    huggingface: huggingFaceSelectorNode,
    imageclassification: imageClassificationSelectorNode,
};

const nodeDetails = {
    input: {"nodeType": 'inputData', 'type': 'Inputs'},
    preprocessing: {"nodeType": 'preprocessing', 'type': 'Preprocessing'},
    adapter: {"nodeType": 'adapter', 'type': 'Adapter'},
    classification: {"nodeType": 'classification', 'type': 'Classification'},
    regression: {"nodeType": 'regression', 'type': 'Regression'},
    sentiment: {"nodeType": 'sentiment', 'type': 'Sentiment'},
    huggingface: {"nodeType": 'huggingface', 'type': 'Huggingface'},
    imageclassification: {"nodeType": 'imageclassification', 'type': 'Image Classification'},
}

const presetDetails = {
    classification: [nodeDetails['input'], nodeDetails['preprocessing'], nodeDetails['classification']],
    regression: [nodeDetails['input'], nodeDetails['preprocessing'], nodeDetails['regression']],
    sentiment: [nodeDetails['input'], nodeDetails['preprocessing'], nodeDetails['sentiment']],
    imageclassification: [nodeDetails['input'], nodeDetails['preprocessing'], nodeDetails['imageclassification']],
}


const initialNodes = [
    // {
    //     id: '1',
    //     type: 'input',
    //     data: {label: 'Start'},
    //     position: {x: 250, y: 5},
    // }
];

let id = 0;
const getID = () => `dndnode_${id++}`;

const nodeTypeColorMap = {
    "inputData": "#d7e3fc",
    "preprocessing": "#efc7e5",
    "adapter": "#f5d4ba",
    "classification": "#b0f2b4",
    "regression": "lightgrey",
    "sentiment": "#ffef9f",
    "huggingface": "#cbf2f2",
    "imageclassification": "#f2b0b0",
};

const nodeSizes = {
    "inputData": "small",
    "preprocessing": "large",
    "adapter": "small",
    "classification": "large",
    "regression": "large",
    "sentiment": "large",
    "huggingface": "large",
    "imageclassification": "large",
}

const nodeDimensions = {
    "large": { width: 200 },
    "medium": { width: 144 },
    "small": { width: 96 }
};

// Add new component for image results display
const ImageResultsDisplay = ({ results }) => {
  return (
    <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '20px' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
        gap: '20px' 
      }}>
        {results.map((result, index) => (
          <div key={index} style={{ 
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '10px',
            textAlign: 'center'
          }}>
            <img
              src={`data:image/png;base64,${result.image}`}
              alt={`Prediction ${index}`}
              style={{ 
                width: '100%',
                height: '150px',
                objectFit: 'contain',
                marginBottom: '10px'
              }}
            />
            <div style={{ 
              backgroundColor: '#f5f5f5',
              padding: '8px',
              borderRadius: '4px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                Prediction: {result.predicted_label}
              </div>
              {result.confidence && (
                <div style={{ 
                  color: '#666',
                  fontSize: '0.9em'
                }}>
                  Confidence: {(result.confidence * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function Inference() {

    const reactFlowWrapper = React.useRef(null);

    const [loading, setLoading] = React.useState(false);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = React.useState(null);

    const [popupOpen, setPopupOpen] = useState(false);
    const [csvData, setCsvData] = useState("");
    const [open, setOpen] = useState(false);

    const [chatbotState, setChatbotState] = useState(false);

    const [buttonLoading, setButtonLoading] = useState(false);

    const [selectedEdge, setSelectedEdge] = useState(null);

    const defaultSaveText = "Save Pipeline";
    const [saveButtonText, setSaveButtonText] = useState(defaultSaveText);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

    const [isPipelinePaused, setIsPipelinePaused] = useState(false);
    const [adapterNodeId, setAdapterNodeId] = useState(null);

    const handleOpenChatbot = () =>{
        setChatbotState(true);
    }
    const handleCloseChatbot = () =>{
        setChatbotState(false);
    }

    const handleRun = () => {
        console.log("Nodes", nodes)
        console.log("Edges", edges)
        setButtonLoading(true);

        const callMaster = async () => {
            try {
                const response = await axios.post("http://localhost:5001/nodeInfo", {
                    nodes: nodes,
                    edges: edges
                });

                console.log("Received response: ", typeof (response.data));
                console.log("Response: ", response.data);

                if (response.status === 201) {
                    setIsPipelinePaused(true);
                    return;
                }

                if (response.status === 200) {
                    const data = response.data;
                    console.log("Response data:", data);

                    if (typeof data === 'string') {
                        setCsvData(data);
                    } else if ('objective' in data && data.results) {
                        console.log("Objective:", data.objective);
                        if (data.objective.toLowerCase() === 'imageclassification') {
                            setCsvData(data.results);
                        } else if (typeof data.results === 'string') {
                            setCsvData(data.results);
                        } else {
                            const csvString = convertResultsToCSV(data.results);
                            setCsvData(csvString);
                        }
                    }

                    setOpen(true);
                    setPopupOpen(true);
                }
            } catch (error) {
                const backendMessage = error?.response?.data?.error || error?.response?.data?.message || error.message;
                console.error("Pipeline run failed:", backendMessage, error);
                setPopupOpen(true);
                setCsvData("");
                setOpen(false);
                window.alert(`Pipeline run failed: ${backendMessage}`);
            } finally {
                setButtonLoading(false);
            }
        };

        callMaster();
    };

    const handleClosePopup = () => {
        setPopupOpen(false);
    };

    function handleDownloadBatch() {
        if (Array.isArray(csvData)) {
            // Download JSON for image classification results
            const resultsJson = JSON.stringify(csvData, null, 2);
            const blob = new Blob([resultsJson], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'image_classification_results.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else {
            // Handle regular CSV data as before
            const blob = new Blob([csvData], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'predictions.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
    }

    const style = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
        bgcolor: 'white',
        border: '2px solid #333333',
        boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
        borderRadius: '10px',
        p: 4,
    };

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [],
    )

    const onDragOver = useCallback((event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            console.log("Type: ", type)

            // check if the dropped element is valid
            if (typeof type === 'undefined' || !type) {
                return;
            }

            const nodeType = event.dataTransfer.getData('nodeType');
            let color;

            color = nodeTypeColorMap[nodeType];

            if (nodeType === "classificationPreset") {
                createPresetPipeline("classification", event);
                return;
            }
            else if (nodeType === "regressionPreset") {
                createPresetPipeline("regression", event);
                return;
            }
            else if (nodeType === "sentimentPreset") {
                createPresetPipeline("sentiment", event);
                return;
            }
            else if (nodeType === "imageclassificationPreset") {
                createPresetPipeline("imageclassification", event);
                return;
            }
            // reactFlowInstance.project was renamed to reactFlowInstance.screenToFlowPosition
            // and you don't need to subtract the reactFlowBounds.left/top anymore
            // details: https://reactflow.dev/whats-new/2023-11-10
            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });


            console.log("NodeType: ", nodeType)
            const newNode = {
                id: getID(),
                type,
                position,
                data: {label: `${type}`, entity: null,
                model_name: null, task_name: null, candidate_labels: null, // needed for huggingFaceSelectorNode only
                onDelete: deleteNode, onNameChange: handleNameChange},
                style: {backgroundColor: color},
                type: nodeType
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance],
    );

    const deleteNode = (id) => {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    };

    const handleNameChange = (id, newName) => {
        setNodes((oldNodes) => {
            return oldNodes.map(node => {
                if (node.id === id) {
                    return {...node, data: {...node.data, name: newName}};
                }
                return node;
            });
        });
    };

    const [selectedClassification, setSelectedClassification] = useState(null);

    const handleClassificationChange = (value) => {
        setSelectedClassification(value);
        console.log("Selected classification model: ", value);
    };

    const handleEdgesChange = useCallback((changes) => {
        changes.forEach(change => {
            if (change.type === 'select' && change.selected) {
                setSelectedEdge(change.id);
            } else if (change.type === 'select' && !change.selected) {
                setSelectedEdge(null);
            }
        });
        setEdges((eds) => applyEdgeChanges(changes, eds));
    }, []);

    const handleDeleteEdge = () => {
        setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdge));
        setSelectedEdge(null);
    };

    const handleSaveDialogOpen = () => {
        setIsSaveDialogOpen(true);
    }

    const handleSaveDialogClose = () => {
        setIsSaveDialogOpen(false);
    }

    const handleSavePipeline = async (savedPipelineName) => {
        setSaveButtonText("Saving pipeline...");
        setIsSaveDialogOpen(false);
        await axios.post("http://localhost:5005/savePipeline", {
            nodes: nodes,
            edges: edges,
            pipeline_name: savedPipelineName,
        })
            .then((response) => {
                console.log("Received response: ", response.data);
                setSaveButtonText("Saved the pipeline!");
            })
            .catch((error) => {
                console.log(error);
                setSaveButtonText("Failed, please try again.");
                setTimeout(() => setSaveButtonText(defaultSaveText), 3000);
            });
    }

    const createPresetPipeline = (presetType, event) => {
        const position = reactFlowInstance.project({
            x: event.clientX,
            y: event.clientY,
        });

        let presetNodes = presetDetails[presetType];
        console.log(presetNodes)

        const baseSpacingX = 50;
        const yIncrement = 10;
        
        for (let i = 0; i < presetNodes.length; i++) {
            const nodeType = presetNodes[i].nodeType;
            const type = presetNodes[i].type;

            const nodeWidth = nodeDimensions[nodeSizes[nodeType]].width;
            const newPosX = position.x + (nodeWidth + baseSpacingX) * i;
            const newPosY = position.y + yIncrement * i;
            // handle for image classification task
            const newNode = {
                id: getID(),
                type: nodeType,  // Remove duplicate 'type' property
                position: {x: newPosX, y: newPosY},
                data: {label: `${type}`, entity: null,
                    model_name: null, task_name: null, candidate_labels: null,
                    onDelete: deleteNode, onNameChange: handleNameChange},
                style: {backgroundColor: nodeTypeColorMap[nodeType]}
            };
            setNodes((nds) => nds.concat(newNode));
        }
    }


    const handleResume = () => {
        setButtonLoading(true);
    
        const resumePipeline = async () => {
            try {
                await axios.post("http://localhost:5001/resumePipeline", {}).then((response) => {
                    if (response.status === 200) {
                        const result = response.data;
                        setCsvData(result);
                        setOpen(true);
                        setPopupOpen(true);
                        setIsPipelinePaused(false);
                    } else {
                        const errorData = response.data;
                        console.error("Error resuming pipeline:", errorData.message);
                    }
                })
    
            } catch (error) {
                console.error("Error resuming pipeline:", error);
            } finally {
                setButtonLoading(false);
            }
        };
    
        resumePipeline();
    };

    const handleChatbotMessage = (pipe) => {
        console.log("Received pipeline from chatbot: ", pipe);
        const testPipeline = {
            "pipeline": {
                "Nodes": [
                    {
                        "id": "dndnode_1",
                        "data": {
                            "entity": "wineQualityTest.csv",
                        },
                        "type": "inputData"
                    },
                    {
                        "id": "dndnode_2",
                        "data": {
                            "entity": "Drop Duplicate Rows",
                            "params": null,
                            "preprocessingType": "csv",
                        },
                        "type": "preprocessing"
                    },
                    {
                        "id": "dndnode_3",
                        "data": {
                            "entity": "Normalize Features",
                            "params": null,
                            "preprocessingType": "csv",
                        },
                        "type": "preprocessing"
                    },
                    {
                        "id": "dndnode_4",
                        "data": {
                            "entity": "WFVEJG",
                        },
                        "type": "classification"
                    }
                ],
                "Edges": [
                    {
                        "id": "dndedge_1",
                        "source": "dndnode_1",
                        "target": "dndnode_2"
                    },
                    {
                        "id": "dndedge_2",
                        "source": "dndnode_2",
                        "target": "dndnode_3"
                    },
                    {
                        "id": "dndedge_3",
                        "source": "dndnode_3",
                        "target": "dndnode_4"
                    }
                ]
            }
        };
        const model_map = pipe.modelMap;
        const pipeline = pipe.pipeline || testPipeline.pipeline;

        const newNodes = pipeline.Nodes.map((node, index) => {
            const baseNode = {
                id: node.id,
                type: node.type,
                position: {
                    x: 100 + (index * 250),
                    y: 100 + (index*50)
                },
                data: {
                    label: node.data.label,
                    entity: node.data.entity,
                    model_name: null,
                    task_name: null,
                    candidate_labels: null,
                    onDelete: deleteNode,
                    onNameChange: handleNameChange
                },
                style: { 
                    backgroundColor: nodeTypeColorMap[node.type],
                }
            };

            // Replace the switch statement with:
            switch (node.type) {
                case 'preprocessing':
                    console.log("Processing preprocessing node:", node.data.entity);
                    baseNode.data.preprocessingType = node.data.preprocessingType;
                    if(node.data.parameters) {
                        baseNode.data.parameters = node.data.parameters;
                        console.log("Preprocessing node parameters:", node.data.parameters);
                    }
                    else{
                        console.log("No parameters found for preprocessing node");
                    }
                    break;
                case 'classification':
                case 'regression': 
                case 'sentiment':
                case 'imageclassification':
                    console.log("Processing model node:", model_map[node.data.entity]);
                    baseNode.data.model_id = model_map[node.data.entity];
                    baseNode.data.entity = model_map[node.data.entity];
                    break;
                default:
                    console.log("Unhandled node type:", node.type);
                    break;
            }
            return baseNode;
        });

        // Create edges with proper formatting
        const newEdges = pipeline.Edges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: 'smoothstep',
        }));

        // Update nodes and edges
        setNodes(newNodes);
        setEdges(newEdges);
    };

    return (

        <div>
            {loading ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '70vh'
                }}>
                    <CircularProgress/> <br/>
                    <Typography variant="h6" style={{marginLeft: '10px'}}>
                        Fetching Trained Models <br/>
                    </Typography>
                    <Typography variant="subtitle1" style={{marginLeft: '10px'}}>
                        Please wait...
                    </Typography>
                </div>
            ) : (
                <div sx={{flex: 1, flexDirection: "column"}}>
                    <div style={{display: 'flex'}}>
                        <InferenceNavbar handleOpen={handleOpenChatbot} style={{flex: 1}}/>
                        <ChatbotModal 
                            open={chatbotState} 
                            handleClose={handleCloseChatbot} 
                            onSendMessage={handleChatbotMessage}
                        />
                        <Modal 
                            open={open} 
                            onClose={() => setOpen(false)} 
                            style={{
                                width: "90%",
                                position: "absolute",
                                top: "40%",
                                left: "50%",
                                transform: "translate(-50%, -50%)"
                            }}
                        >
                            <div style={{
                                backgroundColor: "#fff",
                                padding: "20px",
                                borderRadius: "8px",
                                maxHeight: "90vh",
                                overflow: "hidden"
                            }}>
                                {Array.isArray(csvData) ? (
                                    // Render image classification results
                                    <ImageResultsDisplay results={csvData} />
                                ) : (
                                    // Render regular CSV data
                                    <CsvToHtmlTable
                                        data={csvData.split('\n').slice(0, 10).join('\n')}
                                        csvDelimiter=","
                                        tableClassName="table table-striped table-hover"
                                    />
                                )}
                                <div style={{ 
                                    marginTop: '20px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '0 20px'
                                }}>
                                    <Button 
                                        onClick={() => setOpen(false)}
                                        variant="outlined"
                                    >
                                        Close
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<FileDownloadIcon/>}
                                        onClick={handleDownloadBatch}
                                    >
                                        Download Results
                                    </Button>
                                </div>
                            </div>
                        </Modal>
                        <div className="dndflow"
                             style={{flex: 1, marginTop: '63px', padding: '5px', border: 'solid', height: '100vh'}}>
                            <ReactFlowProvider>
                                <div className="reactflow-wrapper" ref={reactFlowWrapper}>
                                    <ReactFlow
                                        nodes={nodes}
                                        edges={edges}
                                        onNodesChange={onNodesChange}
                                        onEdgesChange={handleEdgesChange}
                                        onConnect={onConnect}
                                        onInit={setReactFlowInstance}
                                        onDrop={onDrop}
                                        onDragOver={onDragOver}
                                        nodeTypes={nodeTypes}
                                        fitView
                                        edgesUpdatable={!buttonLoading}
                                        edgesFocusable={!buttonLoading}
                                        nodesDraggable={!buttonLoading}
                                        nodesConnectable={!buttonLoading}
                                        nodesFocusable={!buttonLoading}
                                        elementsSelectable={!buttonLoading}
                                    >
                                        <Panel position="top-right">
                                            <Button onClick={handleSaveDialogOpen} variant="contained"
                                                    disabled={saveButtonText !== defaultSaveText} style={{
                                                borderRadius: 36,
                                                backgroundColor: "#333333",
                                                padding: "18px 36px",
                                                fontSize: "18px"
                                            }}>{saveButtonText}</Button>
                                            <Button onClick={isPipelinePaused ? handleResume : handleRun} variant="contained" disabled={buttonLoading}
                                                    style={{
                                                        borderRadius: 35,
                                                        backgroundColor: "#333333",
                                                        padding: "18px 36px",
                                                        fontSize: "18px"
                                                    }}>
                                                {buttonLoading ? "Running..." : isPipelinePaused ? "Resume" : "Run"}
                                                <PlayArrowIcon/>
                                            </Button>
                                            {selectedEdge && (
                                                <Button onClick={handleDeleteEdge} variant="outlined" style={{
                                                    borderRadius: 35,
                                                    padding: "10px 20px",
                                                    marginLeft: "10px",
                                                    fontSize: "18px",
                                                    color: "red",
                                                    borderColor: "red"
                                                }}>
                                                    Delete Edge
                                                    <DeleteOutline/>
                                                </Button>
                                            )}

                                        </Panel>
                                        <SaveInferencePipelineDialog
                                            open={isSaveDialogOpen}
                                            handleClose={handleSaveDialogClose}
                                            handleSave={handleSavePipeline}
                                        />
                                        <Background/>
                                        <Controls/>
                                    </ReactFlow>
                                </div>
                            </ReactFlowProvider>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

// Add this helper function if not already present
const convertResultsToCSV = (results) => {
    if (!Array.isArray(results)) return '';
    
    // Get headers from first result object
    const headers = Object.keys(results[0]);
    
    // Create CSV string with headers
    let csvString = headers.join(',') + '\n';
    
    // Add each row of data
    results.forEach(row => {
        const values = headers.map(header => row[header]);
        csvString += values.join(',') + '\n';
    });
    
    return csvString;
};

export default Inference;