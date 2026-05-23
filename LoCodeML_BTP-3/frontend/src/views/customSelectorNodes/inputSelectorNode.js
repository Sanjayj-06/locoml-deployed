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
import { Handle, Position } from 'reactflow';
import { Modal, Button, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import DatasetLinkedOutlinedIcon from '@mui/icons-material/DatasetLinkedOutlined';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import './NodeStyles.css';
import axios from "axios";


export default memo(({ id, data, isConnectable }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFileUploaded, setIsFileUploaded] = useState("");
    const [manualInputsReady, setManualInputsReady] = useState(false);

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
            if (Array.isArray(inputSchema.columns)) {
                return inputSchema.columns;
            }
            if (Array.isArray(inputSchema.features)) {
                return inputSchema.features;
            }
        }
        return null;
    };

    const handleInstantResult = async () => {
        if (!data.selectedModel) {
            alert("Select the Pretrained model to use this feature");
            return;
        }
        const selectedModel = data.selectedModel;
        const modelName = typeof selectedModel === "string" ? selectedModel : selectedModel?.model_name;
        const questions = extractModelColumns(selectedModel)
            || await fetchModelColumns(modelName)
            || (data.modelParameters && data.modelParameters[modelName]);
        if (!questions || questions.length === 0) {
            alert("No parameters found for the selected model.");
            return;
        }

        const userInputs = {};
        for (const question of questions) {
            const answer = prompt(`Enter value for ${question}:`);
            if (answer === null) {
                alert("Operation cancelled.");
                return;
            }
            const trimmedAnswer = String(answer).trim();
            const numericValue = Number(trimmedAnswer);
            userInputs[question] = Number.isFinite(numericValue) && trimmedAnswer !== "" ? numericValue : trimmedAnswer;
        }
        const entityData = {
            manual_inputs: userInputs,
            manual_input_order: questions,
            dataset_type: "manual",
            nodeid: id,
        };
        data.entity = entityData;
        setIsFileUploaded("");
        setManualInputsReady(true);
        alert("Inputs saved. Click Run to execute the pipeline.");

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
                {/* <div className="switchIcon" /> */}
                {isFileUploaded ? <CheckBoxIcon style={{fontSize: "14px", marginLeft: "8px"}} /> : <DatasetLinkedOutlinedIcon style={{fontSize: "14px", marginLeft: "8px"}} />}
                {/* <DatasetLinkedOutlinedIcon style={{fontSize: "14px", marginLeft: "8px"}} /> */}
                <div className="switchLabel" >Input</div>
                <Button
                    style={{height: "15px", width: "15px", borderRadius: "0px", marginLeft: "16px", marginBottom: "2px"}}
                    type="text"
                    icon={<DeleteSweepIcon style={{fontSize: '11px'}}/>}
                    onClick={handleDelete}
                    className="deleteButton"
                />
            </div>

            <Modal
                title="Input Selection"
                visible={isModalOpen}
                onCancel={handleCloseModal}
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' }}>
                    <Upload
                        name="file"
                        beforeUpload={() => false} // Prevent automatic upload
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

            <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
            />
        </>
    );
});