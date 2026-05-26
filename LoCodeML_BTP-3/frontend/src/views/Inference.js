import React, { useCallback, useState } from "react";
import axios from "axios";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Button, CircularProgress, Modal, Typography } from "@mui/material";
import { CsvToHtmlTable } from 'react-csv-to-table';
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
import PasteInferencePipelineDialog from "./PasteInferencePipelineDialog";
import adapterSelectorNode from "./customSelectorNodes/adapterSelectorNode";
import imageClassificationSelectorNode from "./customSelectorNodes/imageClassificationSelectorNode";
import MetricsOverlay from "../components/pipeline/MetricsOverlay";
import PreRunEvaluationDashboard, { buildEvaluationSignature } from "../components/pipeline/PreRunEvaluationDashboard";
import ResolverAssistantButton from "../components/resolver_assistant/ResolverAssistantButton";
import ResolverAssistantPanel from "../components/resolver_assistant/ResolverAssistantPanel";
import PipelineLegendDashboard from "../components/pipeline/PipelineLegendDashboard";

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
    input: { "nodeType": 'inputData', 'type': 'Inputs' },
    preprocessing: { "nodeType": 'preprocessing', 'type': 'Preprocessing' },
    adapter: { "nodeType": 'adapter', 'type': 'Adapter' },
    classification: { "nodeType": 'classification', 'type': 'Classification' },
    regression: { "nodeType": 'regression', 'type': 'Regression' },
    sentiment: { "nodeType": 'sentiment', 'type': 'Sentiment' },
    huggingface: { "nodeType": 'huggingface', 'type': 'Huggingface' },
    imageclassification: { "nodeType": 'imageclassification', 'type': 'Image Classification' },
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

const modelParameters = {
    "Pass or Fail": [
        "student_id",
        "attendance_pct",
        "homework_pct",
        "midterm_score",
        "study_hours_per_week"
    ],
    "ShelvaHP": [
        "Square_Footage",
        "Num_Bedrooms",
        "Num_Bathrooms",
        "Year_Built",
        "Lot_Size",
        "Garage_Size",
        "Neighborhood_Quality"
    ],
    // Add other models and their parameters here
};

function Inference() {

    const reactFlowWrapper = React.useRef(null);

    const [loading] = React.useState(false);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
    const [edges, setEdges] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = React.useState(null);

    const [csvData, setCsvData] = useState("");
    const [open, setOpen] = useState(false);

    const [chatbotState, setChatbotState] = useState(false);

    const [buttonLoading, setButtonLoading] = useState(false);

    const [selectedEdge, setSelectedEdge] = useState(null);

    const defaultSaveText = "Save Pipeline";
    const [saveButtonText, setSaveButtonText] = useState(defaultSaveText);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);

    const [isPipelinePaused, setIsPipelinePaused] = useState(false);
    const [hoveredNodeInfo, setHoveredNodeInfo] = useState(null);
    const [isEvaluationDialogOpen, setIsEvaluationDialogOpen] = useState(false);
    const [isPreRunEvaluationComplete, setIsPreRunEvaluationComplete] = useState(false);
    const [evaluatedPipelineSignature, setEvaluatedPipelineSignature] = useState("");
    const [preRunServerSignature, setPreRunServerSignature] = useState("");
    const [isResolverOpen, setIsResolverOpen] = useState(false);
    const [selectedModel, setSelectedModel] = useState(null);
    const [validationResult, setValidationResult] = useState({ valid: true, issues: [] });
    const [resolverStatus, setResolverStatus] = useState("IDLE");

    function handleModelSelection(model) {
        setSelectedModel(model);
        setNodes((oldNodes) => oldNodes.map(node => {
            if (node.type === "inputData") {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        selectedModel: model,
                        modelParameters: modelParameters,
                    }
                };
            }
            return node;
        }));
    }

    function handleModelBind(nodeId, model) {
        if (!model) return;
        const currentNodes = reactFlowInstance ? reactFlowInstance.getNodes() : nodes;
        const currentEdges = reactFlowInstance ? reactFlowInstance.getEdges() : edges;

        const updatedNodes = currentNodes.map(node => {
            if (node.id === nodeId) {
                return {
                    ...node,
                    model_id: model.model_id,
                    estimator: model.estimator_type || model.estimator,
                    model_name: model.model_name,
                    artifact_path: model.saved_model_path,
                    task_type: model.objective || model.task_type,
                    training_columns: model.training_columns || model.input_schema,
                    target_column: model.target_column,
                    bound_model: true,
                    data: {
                        ...node.data,
                        entity: model,
                        model_id: model.model_id,
                        task_type: model.objective || model.task_type,
                        training_columns: model.training_columns || model.input_schema,
                        target_column: model.target_column,
                        bound_model: true,
                    }
                };
            }
            return node;
        });

        setNodes(updatedNodes);

        // Run validation synchronously with the newly updated nodes/edges snapshot
        runLocalValidation(updatedNodes, currentEdges);
    }

    function handleDatasetBind(nodeId, datasetInfo) {
        if (!datasetInfo) return;
        const currentNodes = reactFlowInstance ? reactFlowInstance.getNodes() : nodes;
        const currentEdges = reactFlowInstance ? reactFlowInstance.getEdges() : edges;

        // Clear task, validation, and resolver states upon dataset change
        setValidationResult({ valid: true, issues: [] });
        setResolverStatus("IDLE");

        const updatedNodes = currentNodes.map(node => {
            if (node.id === nodeId) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        entity: datasetInfo,
                        dataset_id: datasetInfo.dataset_id || datasetInfo.id || datasetInfo,
                        dataset_type: datasetInfo.dataset_type || 'tabular'
                    }
                };
            }
            // Clear out bound model metadata from any model nodes to prevent stale compatibility validations
            // Note: Disabled model resetting on dataset change to prevent annoying model deselection bug
            /*
            if (datasetInfo.dataset_type !== 'manual' && ['classification', 'regression', 'sentiment', 'imageclassification', 'huggingface'].includes(node.type)) {
                return {
                    ...node,
                    model_id: null,
                    estimator: null,
                    model_name: null,
                    artifact_path: null,
                    task_type: null,
                    training_columns: null,
                    target_column: null,
                    bound_model: false,
                    data: {
                        ...node.data,
                        entity: null,
                        model_id: null,
                        task_type: null,
                        training_columns: null,
                        target_column: null,
                        bound_model: false,
                    }
                };
            }
            */
            return node;
        });

        setNodes(updatedNodes);

        // Run validation synchronously with the updated dataset nodes/edges snapshot
        runLocalValidation(updatedNodes, currentEdges);
    }

    function handlePreprocessBind(nodeId, preprocessInfo) {
        if (!preprocessInfo) return;
        const currentNodes = reactFlowInstance ? reactFlowInstance.getNodes() : nodes;
        const currentEdges = reactFlowInstance ? reactFlowInstance.getEdges() : edges;

        const updatedNodes = currentNodes.map(node => {
            if (node.id === nodeId) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        preprocessingType: preprocessInfo.preprocessingType,
                        scalerType: preprocessInfo.scalerType,
                        ...preprocessInfo
                    }
                };
            }
            return node;
        });

        setNodes(updatedNodes);

        // Run validation synchronously with the updated preprocessing nodes/edges snapshot
        runLocalValidation(updatedNodes, currentEdges);
    }

    const runLocalValidation = async (currentNodes, currentEdges) => {
        // Clear cached validation issues before revalidation to prevent stale rendering
        setValidationResult({ valid: true, issues: [] });

        const activeNodes = currentNodes || (reactFlowInstance ? reactFlowInstance.getNodes() : nodes);
        const activeEdges = currentEdges || (reactFlowInstance ? reactFlowInstance.getEdges() : edges);

        const inpNode = activeNodes.find(node => node.type === 'inputData' || node.data?.label === 'Inputs');
        const dsInfo = inpNode?.data?.entity;
        try {
            const response = await axios.post("http://localhost:5001/resolver-assistant/validate", {
                nodes: activeNodes,
                edges: activeEdges,
                dataset_id: dsInfo,
                original_filename: dsInfo?.filename || dsInfo?.name,
                pipeline_mode: "INFERENCE"
            });
            const data = response.data;
            setValidationResult(data);

            // Compute/Extract inferred tasks with fallbacks
            let datasetTask = data.dataset_task;
            if (!datasetTask) {
                const dsName = (typeof dsInfo === 'string' ? dsInfo : dsInfo?.filename || dsInfo?.name || "").toLowerCase();
                const dsType = inpNode?.data?.dataset_type || dsInfo?.dataset_type;
                if (dsType === 'image' || dsName.includes('image') || dsName.includes('zip')) {
                    datasetTask = 'IMAGE_CLASSIFICATION';
                } else if (dsType === 'text' || dsName.includes('sentiment') || dsName.includes('text')) {
                    datasetTask = 'SENTIMENT_ANALYSIS';
                } else if (dsName.includes('price') || dsName.includes('sales') || dsName.includes('hp.csv')) {
                    datasetTask = 'REGRESSION';
                } else {
                    datasetTask = 'CLASSIFICATION';
                }
            }

            let modelTask = data.model_task;
            if (!modelTask) {
                const modelNode = activeNodes.find(n => ['classification', 'regression', 'sentiment', 'imageclassification', 'huggingface'].includes(n.type));
                if (modelNode) {
                    if (modelNode.type === 'classification') modelTask = 'CLASSIFICATION';
                    else if (modelNode.type === 'regression') modelTask = 'REGRESSION';
                    else if (modelNode.type === 'sentiment') modelTask = 'SENTIMENT_ANALYSIS';
                    else if (modelNode.type === 'imageclassification') modelTask = 'IMAGE_CLASSIFICATION';
                    else if (modelNode.type === 'huggingface') modelTask = 'SENTIMENT_ANALYSIS';
                }
            }

            console.log("Dataset task:", datasetTask);
            console.log("Model task:", modelTask);
            console.log("Validation result:", data);

            // Apply resolver button state machine transitions
            if (!data.valid) {
                setResolverStatus("INVALID");
            } else {
                setResolverStatus((prev) => {
                    if (prev === "INVALID" || prev === "FIXING") {
                        setTimeout(() => {
                            setResolverStatus("IDLE");
                        }, 3000);
                        return "VALID";
                    }
                    return "IDLE";
                });
            }

            return data.valid;
        } catch (error) {
            console.error("Local validation failed:", error);
            setResolverStatus("IDLE");
            return true;
        }
    };

    const handleOpenResolverAssistant = async () => {
        await runLocalValidation();
        setIsResolverOpen(true);
    };

    async function applyGraphAction(action) {
        setResolverStatus("FIXING");
        switch (action.type) {
            case "replace_node": {
                const currentNodes = reactFlowInstance ? reactFlowInstance.getNodes() : nodes;
                const targetNode = currentNodes.find(n => n.id === action.node_id);
                if (targetNode) {
                    console.log("[Resolver Debug] Old Node Payload State:", targetNode);
                }

                const replacementLower = String(action.replacement || "").toLowerCase();
                let updatedType = targetNode ? targetNode.type : "regression";
                let updatedStyle = targetNode ? { ...targetNode.style } : {};
                let objective = "regression";

                if (replacementLower.includes("regression")) {
                    updatedType = "regression";
                    updatedStyle.backgroundColor = "lightgrey";
                    objective = "regression";
                } else if (replacementLower.includes("classification")) {
                    updatedType = "classification";
                    updatedStyle.backgroundColor = "#b0f2b4";
                    objective = "classification";
                } else if (replacementLower.includes("sentiment")) {
                    updatedType = "sentiment";
                    updatedStyle.backgroundColor = "#ffef9f";
                    objective = "sentiment";
                } else if (replacementLower.includes("huggingface")) {
                    updatedType = "huggingface";
                    updatedStyle.backgroundColor = "#cbf2f2";
                    objective = "sentiment";
                } else if (replacementLower.includes("image")) {
                    updatedType = "imageclassification";
                    updatedStyle.backgroundColor = "#f2b0b0";
                    objective = "imageclassification";
                }

                let boundModelData = null;
                try {
                    const res = await axios.get(`http://localhost:5001/getTrainedModels/${objective}`);
                    const responseData = res.data?.trained_models || [];
                    const trainedModels = responseData.map(modelStr => {
                        try {
                            return typeof modelStr === 'string' ? JSON.parse(modelStr.replace(/Infinity/g, "1e1000")) : modelStr;
                        } catch (e) {
                            return null;
                        }
                    }).filter(Boolean);

                    const inpNode = currentNodes.find(n => n.type === 'inputData' || n.data?.label === 'Inputs');
                    const dsInfo = inpNode?.data?.entity;

                    let datasetColumns = [];
                    if (dsInfo) {
                        if (Array.isArray(dsInfo.columns)) {
                            datasetColumns = dsInfo.columns;
                        } else if (dsInfo.manual_input_order) {
                            datasetColumns = dsInfo.manual_input_order;
                        } else if (dsInfo.manual_inputs) {
                            datasetColumns = Object.keys(dsInfo.manual_inputs);
                        } else if (dsInfo.features) {
                            datasetColumns = dsInfo.features;
                        }
                    }

                    const normDatasetCols = new Set(datasetColumns.map(c => String(c).toLowerCase().replace(/[^a-z0-9]/g, '')));

                    let compatibleModel = null;
                    for (const model of trainedModels) {
                        const modelFeatures = model.training_columns || model.input_schema || [];
                        const normModelFeatures = modelFeatures.map(f => {
                            const colName = typeof f === 'object' ? (f.column_name || f.name || "") : String(f);
                            return colName.toLowerCase().replace(/[^a-z0-9]/g, '');
                        });

                        const allFeaturesExist = normModelFeatures.every(f => normDatasetCols.has(f));
                        if (allFeaturesExist) {
                            compatibleModel = model;
                            break;
                        }
                    }

                    if (!compatibleModel && trainedModels.length > 0) {
                        compatibleModel = trainedModels[0];
                    }

                    if (compatibleModel) {
                        boundModelData = {
                            model_id: compatibleModel.model_id,
                            estimator: compatibleModel.estimator,
                            model_name: compatibleModel.model_name || compatibleModel.model_id,
                            artifact_path: compatibleModel.saved_model_path || compatibleModel.artifact_path,
                            task_type: compatibleModel.task_type || compatibleModel.objective?.toUpperCase(),
                            training_columns: compatibleModel.training_columns,
                            target_column: compatibleModel.target_column,
                            bound_model: true,
                            entity: compatibleModel
                        };
                    }
                } catch (err) {
                    console.error("Failed to fetch trained models during auto-repair:", err);
                }

                if (!boundModelData) {
                    const inferredTarget = "House_Price";
                    boundModelData = {
                        model_id: "default_" + objective + "_model",
                        estimator: objective === "regression" ? "LinearRegression" : "LogisticRegression",
                        model_name: "Default " + objective.charAt(0).toUpperCase() + objective.slice(1) + " Model",
                        artifact_path: null,
                        task_type: objective.toUpperCase(),
                        training_columns: [],
                        target_column: inferredTarget,
                        bound_model: false,
                        entity: {
                            model_id: "default_" + objective + "_model",
                            task_type: objective.toUpperCase(),
                            target_column: inferredTarget
                        }
                    };
                }

                const updatedNodes = currentNodes.map((node) => {
                    if (node.id === action.node_id) {
                        const newPayload = {
                            ...node,
                            type: updatedType,
                            style: updatedStyle,
                            model_id: boundModelData.model_id,
                            estimator: boundModelData.estimator,
                            model_name: boundModelData.model_name,
                            artifact_path: boundModelData.artifact_path,
                            task_type: boundModelData.task_type,
                            training_columns: boundModelData.training_columns,
                            target_column: boundModelData.target_column,
                            bound_model: boundModelData.bound_model,
                            data: {
                                ...node.data,
                                label: action.replacement,
                                model_id: boundModelData.model_id,
                                estimator: boundModelData.estimator,
                                model_name: boundModelData.model_name,
                                artifact_path: boundModelData.artifact_path,
                                task_type: boundModelData.task_type,
                                training_columns: boundModelData.training_columns,
                                target_column: boundModelData.target_column,
                                bound_model: boundModelData.bound_model,
                                entity: boundModelData.entity
                            }
                        };
                        console.log("[Resolver Debug] New Node Payload State:", newPayload);
                        return newPayload;
                    }
                    return node;
                });

                setNodes(updatedNodes);
                setValidationResult({ valid: true, issues: [] });
                await runLocalValidation(updatedNodes, reactFlowInstance ? reactFlowInstance.getEdges() : edges);
                break;
            }
            case "delete_node":
                deleteNode(action.node_id);
                break;
            case "add_node": {
                const color = nodeTypeColorMap[action.node_type] || "lightgrey";
                const newNode = {
                    id: action.node_id || getID(),
                    position: { x: 300, y: 300 },
                    data: {
                        label: action.label,
                        entity: action.label,
                        selectedModel: selectedModel,
                        modelParameters: modelParameters,
                        onDelete: deleteNode,
                        onNameChange: handleNameChange,
                        onModelSelect: handleModelSelection,
                        onModelBind: handleModelBind,
                        onDatasetBind: handleDatasetBind,
                        onPreprocessBind: handlePreprocessBind
                    },
                    style: { backgroundColor: color },
                    type: action.node_type
                };
                setNodes((nds) => nds.concat(newNode));
                break;
            }
            case "add_edge": {
                const newEdge = {
                    id: `dndedge_${action.source}_${action.target}`,
                    source: action.source,
                    target: action.target,
                    type: "smoothstep"
                };
                setEdges((eds) => addEdge(newEdge, eds));
                break;
            }
            case "delete_edge":
                setEdges((eds) => eds.filter(
                    (e) => !(e.source === action.source && e.target === action.target)
                ));
                break;
            default:
                console.warn("Unknown graph mutation type:", action.type);
                break;
        }
    }

    // Auto-revalidation loop: runs revalidation in real-time upon any graph structure changes
    React.useEffect(() => {
        if (nodes.length > 0) {
            runLocalValidation();
        }
    }, [nodes, edges]);

    React.useEffect(() => {
        if (!isPreRunEvaluationComplete || !evaluatedPipelineSignature) {
            return;
        }

        const currentSignature = buildEvaluationSignature(nodes, edges);
        if (currentSignature !== evaluatedPipelineSignature) {
            setIsPreRunEvaluationComplete(false);
            setPreRunServerSignature("");
        }
    }, [nodes, edges, evaluatedPipelineSignature, isPreRunEvaluationComplete]);

    const handleOpenChatbot = () => {
        setChatbotState(true);
    }
    const handleCloseChatbot = () => {
        setChatbotState(false);
    }

    const handleOpenEvaluation = () => {
        setIsEvaluationDialogOpen(true);
    }

    const handleCloseEvaluation = () => {
        setIsEvaluationDialogOpen(false);
    }

    const handleEvaluationComplete = (evaluationResult) => {
        const localSignature = evaluationResult?.localSignature || "";
        const serverSignature = evaluationResult?.serverSignature || "";

        setEvaluatedPipelineSignature(localSignature);
        setPreRunServerSignature(serverSignature);
        setIsPreRunEvaluationComplete(Boolean(localSignature && serverSignature));
    }

    const handleRoutingUpdate = (updatedNodes) => {
        setNodes(updatedNodes);
    }

    const executePipelineRun = async () => {
        const isValid = await runLocalValidation();
        if (!isValid) {
            setIsResolverOpen(true);
            return;
        }

        console.log("Nodes", nodes)
        console.log("Edges", edges)

        const inpNode = nodes.find(node => node.type === 'inputData' || node.data?.label === 'Inputs');
        const dsInfo = inpNode?.data?.entity;

        // Find bound model node to get current task and model metadata
        const modelNode = nodes.find(n => ['classification', 'regression', 'sentiment', 'imageclassification', 'huggingface'].includes(n.type));
        let activeTask = null;
        let modelMetadata = null;
        if (modelNode) {
            activeTask = modelNode.task_type || modelNode.data?.entity?.task_type || modelNode.data?.entity?.objective;
            if (!activeTask) {
                if (modelNode.type === 'sentiment' || modelNode.type === 'huggingface') {
                    activeTask = 'SENTIMENT_ANALYSIS';
                } else if (modelNode.type === 'imageclassification') {
                    activeTask = 'IMAGE_CLASSIFICATION';
                } else if (modelNode.type === 'classification') {
                    activeTask = 'CLASSIFICATION';
                } else if (modelNode.type === 'regression') {
                    activeTask = 'REGRESSION';
                } else {
                    activeTask = modelNode.type?.toUpperCase();
                }
            }
            modelMetadata = {
                model_id: modelNode.model_id || modelNode.data?.model_id || (typeof modelNode.data?.entity === 'object' ? modelNode.data?.entity?.model_id : null),
                estimator: modelNode.estimator || modelNode.data?.entity?.estimator || modelNode.data?.entity?.estimator_type,
                artifact_path: modelNode.artifact_path || modelNode.data?.entity?.saved_model_path,
                task_type: modelNode.task_type || modelNode.data?.entity?.task_type || modelNode.data?.entity?.objective || activeTask
            };
        }

        const payload = {
            dataset_id: typeof dsInfo === 'string' ? dsInfo : dsInfo?.name || dsInfo?.dataset_id || dsInfo?.id || dsInfo?.filename || "",
            nodes: nodes,
            edges: edges,
            task: activeTask,
            model_metadata: modelMetadata,
            pre_run_signature: preRunServerSignature,
        };
        console.log("Execution payload:", payload);

        setButtonLoading(true);

        const callMaster = async () => {
            try {
                const response = await axios.post("http://localhost:5001/nodeInfo", payload);

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
                }
            } catch (error) {
                const backendMessage = error?.response?.data?.error || error?.response?.data?.message || error.message;
                console.error("Pipeline run failed:", backendMessage, error);
                setCsvData("");
                setOpen(false);
                window.alert(`Pipeline run failed: ${backendMessage}`);
            } finally {
                setButtonLoading(false);
            }
        };

        callMaster();
    };

    const handleRun = async () => {
        const isValid = await runLocalValidation();
        if (!isValid) {
            setIsResolverOpen(true);
            return;
        }

        if (!isPreRunEvaluationComplete) {
            setIsEvaluationDialogOpen(true);
            return;
        }

        executePipelineRun();
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


    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    )

    const onDragOver = useCallback((event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }, []);

    const handleNodeMouseEnter = useCallback((event, node) => {
        const wrapperRect = reactFlowWrapper.current?.getBoundingClientRect();
        const nodeElement = event?.currentTarget || event?.target?.closest?.('.react-flow__node');
        const nodeRect = nodeElement?.getBoundingClientRect?.();

        if (!wrapperRect || !nodeRect) {
            setHoveredNodeInfo({
                node,
                position: { x: 0, y: 0 },
                nodeHeight: 0,
                placement: 'above',
            });
            return;
        }

        const anchorPoint = {
            x: nodeRect.left - wrapperRect.left + (nodeRect.width / 2),
            y: nodeRect.top - wrapperRect.top,
        };

        setHoveredNodeInfo({
            node,
            position: anchorPoint,
            nodeHeight: nodeRect.height,
            placement: anchorPoint.y < 220 ? 'below' : 'above',
        });
    }, []);

    const handleNodeMouseLeave = useCallback(() => {
        setHoveredNodeInfo(null);
    }, []);

    const clearHoveredNode = useCallback(() => {
        setHoveredNodeInfo(null);
    }, []);

    const onDrop = (event) => {
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
            position,
            data: {
                label: `${type}`, entity: null,
                model_name: null, task_name: null, candidate_labels: null, // needed for huggingFaceSelectorNode only
                selectedModel: selectedModel, modelParameters: modelParameters,
                onDelete: deleteNode, onNameChange: handleNameChange, onModelSelect: handleModelSelection, onModelBind: handleModelBind, onDatasetBind: handleDatasetBind, onPreprocessBind: handlePreprocessBind
            },

            style: { backgroundColor: color },
            type: nodeType
        };

        setNodes((nds) => nds.concat(newNode));
    };

    function deleteNode(id) {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    }

    function handleNameChange(id, newName) {
        setNodes((oldNodes) => {
            return oldNodes.map(node => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, name: newName } };
                }
                return node;
            });
        });
    }

    const handleEdgesChange = useCallback((changes) => {
        changes.forEach(change => {
            if (change.type === 'select' && change.selected) {
                setSelectedEdge(change.id);
            } else if (change.type === 'select' && !change.selected) {
                setSelectedEdge(null);
            }
        });
        setEdges((eds) => applyEdgeChanges(changes, eds));
    }, [setEdges, setSelectedEdge]);

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

    const handlePasteDialogOpen = () => {
        setIsPasteDialogOpen(true);
    };

    const handlePasteDialogClose = () => {
        setIsPasteDialogOpen(false);
    };

    const handlePastePipeline = async (pipelineId) => {
        setIsPasteDialogOpen(false);
        try {
            const retrieveUrl = process.env.REACT_APP_INFERENCE_PIPELINE_RETRIEVE_PIPELINE_DETAILS || "http://localhost:5005/retrievePipelineDetails";
            const response = await axios.get(retrieveUrl + `/?pipeline_id=${pipelineId}`);

            let data = response.data;
            if (typeof data === "string") data = JSON.parse(data);

            if (!data || !data.nodes || data.message) {
                alert(data.message || "Pipeline ID not found in database.");
                return;
            }

            // Re-bind node event handlers and metadata so they are fully functional
            const loadedNodes = data.nodes.map(node => ({
                ...node,
                data: {
                    ...node.data,
                    selectedModel: selectedModel,
                    modelParameters: modelParameters,
                    onDelete: deleteNode,
                    onNameChange: handleNameChange,
                    onModelSelect: handleModelSelection,
                    onModelBind: handleModelBind,
                    onDatasetBind: handleDatasetBind,
                    onPreprocessBind: handlePreprocessBind
                }
            }));

            setNodes(loadedNodes);
            setEdges(data.edges || []);
            alert("Pipeline loaded and pasted successfully!");
        } catch (error) {
            console.error("Failed to paste pipeline:", error);
            alert("Failed to retrieve pipeline. Make sure the backend microservices are running.");
        }
    };

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
                type: nodeType,
                position: { x: newPosX, y: newPosY },
                data: {
                    label: `${type}`, entity: null,
                    model_name: null, task_name: null, candidate_labels: null,
                    selectedModel: selectedModel, modelParameters: modelParameters,
                    onDelete: deleteNode, onNameChange: handleNameChange, onModelSelect: handleModelSelection, onModelBind: handleModelBind, onDatasetBind: handleDatasetBind, onPreprocessBind: handlePreprocessBind
                },

                style: { backgroundColor: nodeTypeColorMap[nodeType] }
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
                    y: 100 + (index * 50)
                },
                data: {
                    label: node.data.label,
                    entity: node.data.entity,
                    model_name: null,
                    task_name: null,
                    candidate_labels: null,
                    selectedModel: selectedModel,
                    modelParameters: modelParameters,
                    onDelete: deleteNode,
                    onNameChange: handleNameChange,
                    onModelSelect: handleModelSelection,
                    onModelBind: handleModelBind,
                    onDatasetBind: handleDatasetBind,
                    onPreprocessBind: handlePreprocessBind
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
                    if (node.data.parameters) {
                        baseNode.data.parameters = node.data.parameters;
                        console.log("Preprocessing node parameters:", node.data.parameters);
                    }
                    else {
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




    const inputNode = nodes.find(node => node.type === 'inputData' || node.data?.label === 'Inputs');
    const datasetInfo = inputNode?.data?.entity;

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
                    <CircularProgress /> <br />
                    <Typography variant="h6" style={{ marginLeft: '10px' }}>
                        Fetching Trained Models <br />
                    </Typography>
                    <Typography variant="subtitle1" style={{ marginLeft: '10px' }}>
                        Please wait...
                    </Typography>
                </div>
            ) : (
                <div sx={{ flex: 1, flexDirection: "column" }}>
                    <div style={{ display: 'flex' }}>
                        <InferenceNavbar handleOpen={handleOpenChatbot} style={{ flex: 1 }} />
                        <ChatbotModal
                            open={chatbotState}
                            handleClose={handleCloseChatbot}
                            onSendMessage={handleChatbotMessage}
                        />
                        <PreRunEvaluationDashboard
                            open={isEvaluationDialogOpen}
                            nodes={nodes}
                            edges={edges}
                            onClose={handleCloseEvaluation}
                            onApplyRouting={handleRoutingUpdate}
                            onEvaluationComplete={handleEvaluationComplete}
                        />
                        <ResolverAssistantPanel
                            open={isResolverOpen}
                            onClose={() => setIsResolverOpen(false)}
                            nodes={nodes}
                            edges={edges}
                            datasetInfo={datasetInfo}
                            onApplyFix={applyGraphAction}
                            validationResult={validationResult}
                            triggerValidation={runLocalValidation}
                        />
                        <Modal
                            open={open}
                            onClose={() => setOpen(false)}
                            hideBackdrop
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
                                        startIcon={<FileDownloadIcon />}
                                        onClick={handleDownloadBatch}
                                    >
                                        Download Results
                                    </Button>
                                </div>
                            </div>
                        </Modal>
                        <div className="dndflow"
                            style={{ flex: 1, marginTop: '63px', padding: '5px', border: 'solid', height: '100vh' }}>
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
                                        onNodeMouseEnter={handleNodeMouseEnter}
                                        onNodeMouseLeave={handleNodeMouseLeave}
                                        onNodeDragStart={clearHoveredNode}
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
                                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                                <ResolverAssistantButton onClick={handleOpenResolverAssistant} status={resolverStatus} />
                                                <Button onClick={handleOpenEvaluation} variant="outlined" style={{
                                                    borderRadius: 20,
                                                    borderColor: "#3345dd",
                                                    color: "#3345dd",
                                                    padding: "5px 10px",
                                                    fontSize: "12px"
                                                }}>Evaluate Model</Button>
                                                <Button onClick={handleOpenChatbot} variant="contained" style={{
                                                    borderRadius: 20,
                                                    backgroundColor: "#3345dd",
                                                    padding: "5px 10px",
                                                    fontSize: "12px"
                                                }}>Pipeline LLM</Button>
                                                <Button onClick={handlePasteDialogOpen} variant="contained" style={{
                                                    borderRadius: 20,
                                                    backgroundColor: "#333333",
                                                    padding: "5px 12px",
                                                    fontSize: "12px"
                                                }}>Paste Pipeline</Button>
                                                <Button onClick={handleSaveDialogOpen} variant="contained"
                                                    disabled={saveButtonText !== defaultSaveText} style={{
                                                        borderRadius: 20,
                                                        backgroundColor: "#333333",
                                                        padding: "5px 12px",
                                                        fontSize: "12px"
                                                    }}>{saveButtonText}</Button>
                                                <Button onClick={isPipelinePaused ? handleResume : handleRun} variant="contained" disabled={buttonLoading}
                                                    style={{
                                                        borderRadius: 20,
                                                        backgroundColor: "#333333",
                                                        padding: "5px 12px",
                                                        fontSize: "12px"
                                                    }}>
                                                    {buttonLoading ? "Running..." : isPipelinePaused ? "Resume" : isPreRunEvaluationComplete ? "Run" : "Run after Evaluate"}
                                                    <PlayArrowIcon />
                                                </Button>
                                                {selectedEdge && (
                                                    <Button onClick={handleDeleteEdge} variant="outlined" style={{
                                                        borderRadius: 20,
                                                        padding: "5px 12px",
                                                        fontSize: "12px",
                                                        color: "red",
                                                        borderColor: "red"
                                                    }}>
                                                        Delete Edge
                                                        <DeleteOutline />
                                                    </Button>
                                                )}
                                            </div>
                                        </Panel>
                                        <SaveInferencePipelineDialog
                                            open={isSaveDialogOpen}
                                            handleClose={handleSaveDialogClose}
                                            handleSave={handleSavePipeline}
                                        />
                                        <PasteInferencePipelineDialog
                                            open={isPasteDialogOpen}
                                            handleClose={handlePasteDialogClose}
                                            handlePaste={handlePastePipeline}
                                        />
                                        <Background />
                                        <Controls />
                                        <MetricsOverlay
                                            hoveredNodeInfo={hoveredNodeInfo}
                                            pipelineRunning={buttonLoading}
                                            pipelinePaused={isPipelinePaused}
                                        />
                                    </ReactFlow>
                                    <PipelineLegendDashboard
                                        nodes={nodes}
                                        edges={edges}
                                        pipelineRunning={buttonLoading}
                                        pipelinePaused={isPipelinePaused}
                                    />
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