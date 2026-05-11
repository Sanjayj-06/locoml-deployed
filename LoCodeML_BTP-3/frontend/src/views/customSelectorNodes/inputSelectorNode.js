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

import React, { memo, useRef, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Modal, Button, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import DatasetLinkedOutlinedIcon from '@mui/icons-material/DatasetLinkedOutlined';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import {DeleteOutlined} from '@ant-design/icons';
import './NodeStyles.css';
import axios from "axios";


export default memo(({ id, data, isConnectable }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFileUploaded, setIsFileUploaded] = useState("");

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

        const formData = new FormData();
        formData.append('file', file);
        formData.append('filesize', file.size);
        formData.append('filename', file.name);
        formData.append('nodeid', id);
        if (file.type === 'application/zip') {
            formData.append('dataset_type', 'zip');
        } else {
            formData.append('dataset_type', 'csv');
        }

        data.entity = formData;
        const formDataObject = Object.fromEntries(formData.entries());
        console.log(formDataObject);

        // Upload to the server
        axios.post(process.env.REACT_APP_MASTER_SERVER_GET_INPUT_FILE, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        }).then(res => {
            console.log(res);
        }).catch(err => {
            console.log(err);
        });

        // setIsModalOpen(false); // Close the modal after upload
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
                title="Upload Dataset"
                visible={isModalOpen}
                onCancel={handleCloseModal}
                footer={null}
            >
                <Upload
                    name="file"
                    beforeUpload={() => false} // Prevent automatic upload
                    onChange={handleUpload}
                    accept=".csv,.zip"
                >
                    <Button icon={<UploadOutlined />}>Click to Upload</Button>
                </Upload>
                {isFileUploaded && <p>Uploaded: {isFileUploaded}</p>}
            </Modal>

            <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
            />
        </>
    );
});