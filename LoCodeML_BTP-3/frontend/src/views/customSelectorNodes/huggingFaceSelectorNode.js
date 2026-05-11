import React, { memo } from "react";
import { Handle, Position } from "reactflow";
import { Select, Space, Button, Modal, Input } from "antd";
import { DeleteOutlined } from '@ant-design/icons'; import axios from "axios";
import Description from '@mui/icons-material/Description';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
// import { IconButton } from "rsuite";
import { Accordion, AccordionDetails, AccordionSummary, Box, TextField, Typography, Link, Tooltip, IconButton } from "@mui/material";
import { FormControl } from "@mui/base";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export default memo(({ id, data, isConnectable, nodeType }) => {

    React.useEffect(() => {
        window.addEventListener('error', e => {
            if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
                const resizeObserverErrDiv = document.getElementById(
                    'webpack-dev-server-client-overlay-div'
                );
                const resizeObserverErr = document.getElementById(
                    'webpack-dev-server-client-overlay'
                );
                if (resizeObserverErr) {
                    resizeObserverErr.setAttribute('style', 'display: none');
                }
                if (resizeObserverErrDiv) {
                    resizeObserverErrDiv.setAttribute('style', 'display: none');
                }
            }
        });
    }, []);

    const [regressionModels, setRegressionModels] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [isModelSelected, setIsModelSelected] = React.useState(false);
    const [isCodeSaved, setIsCodeSaved] = React.useState(false);
    const [isCustomModelOpen, setIsCustomModelOpen] = React.useState(false);
    const [modelName, setModelName] = React.useState('');
    const [taskName, setTaskName] = React.useState('');
    const [candidateLabels, setCandidateLabels] = React.useState('');

    // const handleChange = (value) => {
    //     // Pass selected value to parent component
    //     data.entity = regressionModels[value];
    //     setIsModelSelected(true);
    // };

    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if ((modelName === 'None' || modelName !== '') && (taskName !== '') ) {
            setIsModelSelected(true);
        }
        setIsModalOpen(false);
    };

    const handleDelete = () => {
        data.onDelete(id);
    }

    const handleCodeSave = () => {
        setIsCodeSaved(true);
    };

    const handleOpenCustomModel = () => {
        setIsCustomModelOpen(!isCustomModelOpen);
    };

    const handleModelNameChange = (e) => {
        data.model_name = e.target.value;
        setModelName(e.target.value);
    };

    const handleTaskNameChange = (e) => {
        data.task_name = e.target.value;
        setTaskName(e.target.value);
    };

    const handleCandidateLabelsChange = (e) => {
        data.candidate_labels = e.target.value;
        setCandidateLabels(e.target.value);
    };

    return (
        <>
            <Handle
                type="target"
                position={Position.Left}
                // style={{ background: "#555" }}
                onConnect={(params) => console.log("handle onConnect", params)}
                isConnectable={isConnectable}
            />

            <div className="switchNode" onClick={handleOpenModal} style={{ width: "138px" }}>
                {/* <div className="switchIcon" /> */}
                {isModelSelected ? <CheckBoxIcon style={{ fontSize: "14px", marginLeft: "8px" }} /> : <Description style={{ fontSize: "14px", marginLeft: "8px" }} />}
                {/* <Description style={{ fontSize: "14px", marginLeft: "8px" }} /> */}
                <div className="switchLabel" >HuggingFace</div>
                <Button
                    style={{ height: "15px", width: "15px", borderRadius: "0px", marginLeft: "16px", marginBottom: "2px" }}
                    type="text"
                    icon={<DeleteSweepIcon style={{ fontSize: '11px' }} />}
                    onClick={handleDelete}
                    className="deleteButton"
                />
            </div>

            <Modal visible={isModalOpen} onCancel={handleCloseModal} onOk={handleCloseModal} width='600px'>
                <Typography variant="h6" component="h2" style={{ marginBottom: "27px" }}>
                    Configure Model (Hugging Face)
                </Typography>

                <Space direction="vertical" style={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                        <Typography variant="body1" style={{ marginRight: '49px' }}>Model</Typography>
                        <Input
                            placeholder="Specify model name, or type 'None' to auto-select"
                            value={modelName}
                            onChange={handleModelNameChange}
                            style={{ width: '100%' }}
                        />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                        <Typography variant="body1" style={{ marginRight: '8px' }}>
                            Task
                        </Typography>
                        <Tooltip title="Available tasks" arrow>
                            <IconButton
                                href="https://github.com/huggingface/transformers/blob/v4.46.0/src/transformers/pipelines/__init__.py#L593"
                                target="_blank"
                                rel="noopener noreferrer"
                                size="small"
                                sx={{ marginRight: '12px', paddingTop: '3px' }}
                            >
                                <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Input
                            placeholder="Examples: sentiment-analysis, summarization, translation_XX_to_YY, etc."
                            value={taskName}
                            onChange={handleTaskNameChange}
                            style={{ width: '100%' }}
                        />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                        <Typography variant="body1" style={{ marginRight: '-13px' }}>Candidate Labels</Typography>
                        <Input
                            placeholder="Specify if task if zero-shot-classification (comma-separated) '"
                            value={candidateLabels}
                            onChange={handleCandidateLabelsChange}
                            style={{ width: '100%' }}
                        />
                    </Box>
                </Space>
            </Modal>


            <Handle
                type="source"
                position={Position.Right}
                id="b"
                // style={{ bottom: 10, top: "auto", background: "#555" }}
                isConnectable={isConnectable}
            />
        </>
    );
});
