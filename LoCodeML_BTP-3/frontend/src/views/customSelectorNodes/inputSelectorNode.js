// import React, {memo, useRef} from "react";
// import {Handle, Position} from "reactflow";
// import {Button, Input} from "antd";
// import {DeleteOutlined} from '@ant-design/icons';
// import axios from "axios";

// export default memo(({id, data, isConnectable}) => {
//     const fileInput = useRef(null);
//     const [isFileUploaded, setIsFileUploaded] = React.useState("");
//     const [nodeName, setNodeName] = React.useState( "");

//     const handleChange = async (event) => {
//         // Pass selected value to parent component
//         const file = event.target.files[0];

//         const formData = new FormData();
//         formData.append('file', file);
//         formData.append('filesize', file.size);
//         formData.append('filename', file.name);
//         formData.append('nodeid', id);

//         data.entity = formData;
//         console.log(data.entity);

//         await axios.post(process.env.REACT_APP_MASTER_SERVER_GET_INPUT_FILE, formData, {
//             headers: {
//                 'Content-Type': 'multipart/form-data',
//             }
//         }).then(res => {
//             console.log(res);
//             setIsFileUploaded(file.name);
//         }).catch(err => {
//             console.log(err);
//         });
//     };

    // const handleDelete = () => {
    //     data.onDelete(id);
    // };

//     const handleNameChange = (event) => {
//         const newName = event.target.value;
//         setNodeName(newName);
//         data.onNameChange(id, newName);
//     };

//     return (
//         <>
//             <Handle
//                 type="target"
//                 position={Position.Top}
//                 onConnect={(params) => console.log("handle onConnect", params)}
//                 isConnectable={isConnectable}
//             />
//             <div className="nodeContainer">
//                 <div className="nodeHeader">
//                     <div className="nodeTitle">Inputs</div>
//                     <Button
//                         type="text"
//                         icon={<DeleteOutlined style={{fontSize: '12px'}}/>}
//                         onClick={handleDelete}
//                         className="deleteButton"
//                     />
//                 </div>
//                 <Input
//                     placeholder="Name this node"
//                     value={nodeName}
//                     onChange={handleNameChange}
//                     style={{marginBottom: '10px', width: '100px', height: '25px', fontSize: '10px'}}
//                 />
//                 <input
//                     type="file"
//                     accept=".csv"
//                     style={{display: 'none'}}
//                     onChange={handleChange}
//                     ref={fileInput}
//                 />
//                 <Button style={{
//                     height: "20px", fontSize: "10px", marginTop: "2px", marginBottom: "2px",
//                     display: "flex", justifyContent: "center", alignItems: "center",
//                     backgroundColor: "#f5f5f5", color: "#222222",
//                 }}
//                         onClick={() => {
//                             fileInput.current.click();
//                         }}>
//                     {isFileUploaded !== "" ? `Uploaded: ${isFileUploaded}` : 'Upload Dataset'}
//                 </Button>
//                 <Button style={{
//                     height: "20px", fontSize: "10px", marginTop: "2px", marginBottom: "2px",
//                     display: "flex", justifyContent: "center", alignItems: "center",
//                     backgroundColor: "#e0f7fa", color: "#00796b",
//                 }}
//                         onClick={handleInstantResult}>
//                     Instant Result
//                 </Button>
//             </div>
//             <Handle
//                 type="source"
//                 position={Position.Bottom}
//                 id="b"
//                 isConnectable={isConnectable}
//             />
//         </>
//     );
// });

import React, { memo, useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Modal, Button, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import DatasetLinkedOutlinedIcon from '@mui/icons-material/DatasetLinkedOutlined';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import './NodeStyles.css';
import axios from "axios";


export default memo(({ id, data, isConnectable }) => {
    const { getNodes } = useReactFlow();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFileUploaded, setIsFileUploaded] = useState("");
    const [manualInputsReady, setManualInputsReady] = useState(false);

    // Form Modal states for Premium Manual Parameter Input
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formFields, setFormFields] = useState([]);
    const [formValues, setFormValues] = useState({});
    const [activeModelName, setActiveModelName] = useState("");

    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleDelete = () => {
        data.onDelete(id);
    };

    const handleUpload = (info) => {
        const file = info.file;
        setIsFileUploaded(file.name);
        setManualInputsReady(false);
        const datasetType = file.type === 'application/zip' ? 'zip' : 'csv';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('filesize', file.size);
        formData.append('filename', file.name);
        formData.append('nodeid', id);
        formData.append('dataset_type', datasetType);

        const formDataObject = Object.fromEntries(formData.entries());
        console.log(formDataObject);

        axios.post("http://localhost:5001/getFile", formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        }).then(res => {
            const datasetId = res?.data?.dataset_id || res?.data?.datasetId;
            const entityData = {
                dataset_id: datasetId,
                dataset_type: datasetType,
                filename: file.name,
                filesize: file.size,
                nodeid: id,
            };
            data.entity = entityData;
            console.log(res);

            if (typeof data.onDatasetBind === 'function') {
                data.onDatasetBind(id, entityData);
            }
        }).catch(err => {
            console.log(err);
        });
    };



    const fetchModelColumns = async (modelName) => {
        if (!modelName) {
            return null;
        }
        try {
            const response = await axios.get(`/getDatasets/columns/${encodeURIComponent(modelName)}`);
            const columns = response?.data?.non_target_columns;
            if (Array.isArray(columns) && columns.length > 0) {
                return columns;
            }
        } catch (error) {
            console.error("Failed to fetch model columns:", error);
        }
        return null;
    };

    const extractModelColumns = (selectedModel) => {
        if (!selectedModel || typeof selectedModel !== "object") {
            return null;
        }
        if (Array.isArray(selectedModel.non_target_columns)) {
            return selectedModel.non_target_columns;
        }
        if (selectedModel.input_schema) {
            const inputSchema = selectedModel.input_schema;
            if (Array.isArray(inputSchema)) {
                return inputSchema.map(col => typeof col === "object" ? col.column_name : col).filter(Boolean);
            }
            if (Array.isArray(inputSchema.columns)) {
                return inputSchema.columns;
            }
            if (Array.isArray(inputSchema.features)) {
                return inputSchema.features;
            }
        }
        if (selectedModel.training_columns) {
            const trainCols = selectedModel.training_columns;
            if (Array.isArray(trainCols)) {
                return trainCols.map(col => typeof col === "object" ? col.column_name : col).filter(Boolean);
            }
        }
        return null;
    };

    const handleInstantResult = async () => {
        let selectedModel = data.selectedModel;

        // Fallback: check other nodes in reactflow graph to see if any node has a bound/selected model
        if (!selectedModel) {
            try {
                const allNodes = getNodes();
                const modelNode = allNodes.find(n => 
                    ['classification', 'regression', 'sentiment', 'imageclassification', 'huggingface'].includes(n.type) && n.data?.entity
                );
                if (modelNode) {
                    selectedModel = modelNode.data.entity;
                }
            } catch (e) {
                console.error("Failed to automatically detect model node:", e);
            }
        }

        if (!selectedModel) {
            alert("Please select a Pre-trained model in your classifier/regressor node first.");
            return;
        }

        const modelName = typeof selectedModel === "string" ? selectedModel : selectedModel?.model_name;
        setActiveModelName(modelName || "Selected Model");

        const questions = extractModelColumns(selectedModel)
            || await fetchModelColumns(modelName)
            || (data.modelParameters && data.modelParameters[modelName]);

        if (!questions || questions.length === 0) {
            alert("No parameters found for the selected model.");
            return;
        }

        setFormFields(questions);

        // Initialize form values
        const initialValues = {};
        questions.forEach(q => {
            initialValues[q] = "";
        });
        setFormValues(initialValues);
        setIsFormModalOpen(true);
    };

    const handleFormSubmit = () => {
        const userInputs = {};
        for (const field of formFields) {
            const val = String(formValues[field] || "").trim();
            if (val === "") {
                alert(`Please enter a value for parameter: ${field}`);
                return;
            }
            const numericValue = Number(val);
            userInputs[field] = Number.isFinite(numericValue) ? numericValue : val;
        }

        const entityData = {
            manual_inputs: userInputs,
            manual_input_order: formFields,
            dataset_type: "manual",
            nodeid: id,
        };
        data.entity = entityData;
        setIsFileUploaded("");
        setManualInputsReady(true);
        setIsFormModalOpen(false);
        alert("Parameters saved successfully. Click 'Run' to execute the pipeline.");

        if (typeof data.onDatasetBind === 'function') {
            data.onDatasetBind(id, entityData);
        }
    };

    return (
        <>
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
            />

            <div className="switchNode" onClick={handleOpenModal}>
                {isFileUploaded ? <CheckBoxIcon style={{fontSize: "14px", marginLeft: "8px"}} /> : <DatasetLinkedOutlinedIcon style={{fontSize: "14px", marginLeft: "8px"}} />}
                <div className="switchLabel" >Input</div>
                <Button
                    style={{height: "15px", width: "15px", borderRadius: "0px", marginLeft: "16px", marginBottom: "2px"}}
                    type="text"
                    icon={<DeleteSweepIcon style={{fontSize: '11px'}}/>}
                    onClick={handleDelete}
                    className="deleteButton"
                />
            </div>

            {/* Input Selection Modal */}
            <Modal
                title="Input Selection"
                visible={isModalOpen}
                onCancel={handleCloseModal}
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' }}>
                    <Upload
                        name="file"
                        beforeUpload={() => false}
                        onChange={handleUpload}
                        accept=".csv,.zip"
                    >
                        <Button icon={<UploadOutlined />}>Upload dataset</Button>
                    </Upload>
                    {isFileUploaded && <p style={{ marginTop: '10px', marginBottom: '0' }}>Uploaded: {isFileUploaded}</p>}

                    <div style={{ margin: '15px 0', color: '#888', fontWeight: 'bold' }}>(or)</div>

                    <Button
                        onClick={() => {
                            handleCloseModal();
                            handleInstantResult();
                        }}>
                        {manualInputsReady ? "Manual Inputs Ready" : "Manual Input (only for single input)"}
                    </Button>
                </div>
            </Modal>

            {/* Premium Custom Form Parameter Modal */}
            <Modal
                title={
                    <div style={{ paddingBottom: '10px', borderBottom: '1px solid #f0f0f0' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#111', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Manual Parameter Entry</span>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                            Pipeline Model: <strong style={{ color: '#00796b' }}>{activeModelName}</strong>
                        </div>
                    </div>
                }
                visible={isFormModalOpen}
                onCancel={() => setIsFormModalOpen(false)}
                footer={[
                    <Button key="cancel" onClick={() => setIsFormModalOpen(false)}>
                        Cancel
                    </Button>,
                    <Button key="submit" type="primary" onClick={handleFormSubmit} style={{ backgroundColor: '#00796b', borderColor: '#00796b' }}>
                        Save Inputs
                    </Button>
                ]}
                width="500px"
            >
                <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '15px 5px' }}>
                    {formFields.map((field) => (
                        <div key={field} style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#444', marginBottom: '6px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                                {field}
                            </label>
                            <input
                                type="text"
                                value={formValues[field] || ""}
                                onChange={(e) => {
                                    setFormValues({
                                        ...formValues,
                                        [field]: e.target.value
                                    });
                                }}
                                placeholder={`Enter value for ${field}...`}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '13px',
                                    borderRadius: '6px',
                                    border: '1px solid #ccc',
                                    backgroundColor: '#fafafa',
                                    color: '#222',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    fontFamily: 'system-ui, -apple-system, sans-serif'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#00796b';
                                    e.target.style.backgroundColor = '#ffffff';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#ccc';
                                    e.target.style.backgroundColor = '#fafafa';
                                }}
                            />
                        </div>
                    ))}
                </div>
            </Modal>

            <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
            />
        </>
    );
});