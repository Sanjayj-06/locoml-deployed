import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from 'react-router-dom';
import { List, ListItem, ListItemIcon, ListItemText, Collapse } from "@mui/material";
import { ExpandLess, ExpandMore, Folder, InsertDriveFile } from "@mui/icons-material";
import Description from '@mui/icons-material/Description';
import DatasetLinkedOutlinedIcon from '@mui/icons-material/DatasetLinkedOutlined';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { Select, Space } from 'antd';

function InferenceNavbar(props) {
    const [modelsOpen, setModelsOpen] = React.useState(false);
    const [presetsOpen, setPresetsOpen] = React.useState(false);
    const [customPipelinesOpen, setCustomPipelinesOpen] = React.useState(false);

    const toggleModels = () => {
        setModelsOpen(!modelsOpen);
    };

    const togglePresets = () => {
        setPresetsOpen(!presetsOpen);
    };

    const toggleCustomPipelines = () => {
        setCustomPipelinesOpen(!customPipelinesOpen);
    };

    const onDragStart = (event, nodeName, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeName);
        event.dataTransfer.setData('nodeType', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    }

    return (
        <List component="nav" sx={{ marginTop: '63px', width: '29.6%', color: 'black', backgroundColor: 'white', height: '91vh', overflow: 'auto', pb: 2 }}>

            <ListItem button onClick={togglePresets} sx={{ mt: 1, mb: 1 }}>
                <ListItemIcon>
                    <Folder />
                </ListItemIcon>
                <ListItemText primary="Presets" />
                {presetsOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItem>

            <Collapse in={presetsOpen} timeout="auto" unmountOnExit>
                {/* todo: Classification Pipeline - change frontend */}
                <List component="div" sx={{ pl: 2, pr: 4 }}>
                    <ListItem onDragStart={(event) => onDragStart(event, "ClassificationPreset", "classificationPreset")} draggable sx={{
                        borderRadius: 35,
                        backgroundColor: "#b0f2b4",
                        // padding: "18px 36px",
                        // margin: "10px 0",
                        borderRadius: '10px',
                        margin: '2px 10px 0px 10px',
                        border: "solid 0.2px darkgrey"

                    }}>
                        <ListItemIcon>
                            <DatasetLinkedOutlinedIcon />
                        </ListItemIcon>

                        <ListItemText primary={"Classification Pipeline"} />
                    </ListItem>

                    <ListItem onDragStart={(event) => onDragStart(event, "RegressionPreset", "regressionPreset")} draggable sx={{
                        borderRadius: 35,
                        backgroundColor: "lightgrey",
                        // padding: "18px 36px",
                        // margin: "10px 0",
                        borderRadius: '10px',
                        margin: '10px 10px 0px 10px',
                        border: "solid 0.2px darkgrey"

                    }}>
                        <ListItemIcon>
                            <DatasetLinkedOutlinedIcon />
                        </ListItemIcon>

                        <ListItemText primary={"Regression Pipeline"} />
                    </ListItem>

                    <ListItem onDragStart={(event) => onDragStart(event, "SentimentPreset", "sentimentPreset")} draggable sx={{
                        borderRadius: 35,
                        backgroundColor: "#ffef9f",
                        // padding: "18px 36px",
                        // margin: "10px 0",
                        borderRadius: '10px',
                        margin: '10px 10px 0px 10px',
                        border: "solid 0.2px darkgrey"

                    }}>
                        <ListItemIcon>
                            <DatasetLinkedOutlinedIcon />
                        </ListItemIcon>

                        <ListItemText primary={"Sentiment Pipeline"} />
                    </ListItem>

                    <ListItem onDragStart={(event) => onDragStart(event, "ImageClassificationPreset", "imageclassificationPreset")} draggable sx={{
                        borderRadius: 35,
                        backgroundColor: "#f2b0b0",
                        borderRadius: '10px',
                        margin: '10px 10px 0px 10px',
                        border: "solid 0.2px darkgrey"

                    }}>
                        <ListItemIcon>
                            <DatasetLinkedOutlinedIcon />
                        </ListItemIcon>

                        <ListItemText primary={"Image Classification Pipeline"} />
                    </ListItem>         
                </List>
            </Collapse>

            <ListItem button onClick={toggleCustomPipelines} sx={{ mt: 1, mb: 1 }}>
                <ListItemIcon>
                    <Folder />
                </ListItemIcon>
                <ListItemText primary="Custom" />
                {customPipelinesOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItem>

            <Collapse in={customPipelinesOpen} timeout="auto" unmountOnExit sx={{ mb: 2 }}>

                <List component="div" sx={{ pl: 2, pr: 4, mb: 1 }}>
                    <ListItem onDragStart={(event) => onDragStart(event, "Inputs", "inputData")} draggable sx={{
                        borderRadius: 35,
                        backgroundColor: "#d7e3fc",
                        // padding: "18px 36px",
                        // margin: "10px 0",
                        borderRadius: '10px',
                        margin: '10px 10px 0px 10px',
                        border: "solid 0.2px darkgrey"

                    }}>
                        <ListItemIcon>
                            <DatasetLinkedOutlinedIcon />
                        </ListItemIcon>

                        <ListItemText primary={"Input"} />
                    </ListItem>

                </List>

                <List component="div" disablePadding sx={{ pl: 2, pr: 4, mb: 1 }}>
                    <ListItem onDragStart={(event) => onDragStart(event, "Preprocessing", "preprocessing")} draggable sx={{
                        borderRadius: 35,
                        backgroundColor: "#efc7e5",
                        // padding: "18px 36px",
                        // margin: "10px 0",
                        borderRadius: '10px',
                        margin: '2px 10px 10px 10px',
                        border: "solid 0.2px darkgrey"

                    }}>
                        <ListItemIcon>
                            <AssessmentIcon />
                        </ListItemIcon>

                        <ListItemText primary={"Preprocessing"} />
                    </ListItem>
                </List>

                <List component="div" disablePadding sx={{ pl: 2, pr: 4, mb: 1 }}>
                    <ListItem onDragStart={(event) => onDragStart(event, "Adapter", "adapter")} draggable sx={{
                        borderRadius: 35,
                        backgroundColor: "#f5d4ba",
                        // padding: "18px 36px",
                        // margin: "10px 0",
                        borderRadius: '10px',
                        margin: '2px 10px 10px 10px',
                        border: "solid 0.2px darkgrey"

                    }}>
                        <ListItemIcon>
                            <AccountTreeIcon />
                        </ListItemIcon>

                        <ListItemText primary={"Adapter"} />
                    </ListItem>
                </List>

                {/* Models */}
                <ListItem button onClick={toggleModels} sx={{ pl: 4, mt: 1, mb: 1 }}>
                    <ListItemIcon>
                        <Folder />
                    </ListItemIcon>
                    <ListItemText primary="Models" />
                    {modelsOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse in={modelsOpen} timeout="auto" unmountOnExit sx={{ mb: 2 }}>
                    <List component="div" disablePadding>
                        <List component="div" disablePadding sx={{ pl: 4, pr: 4, mb: 1 }}>
                            <ListItem onDragStart={(event) => onDragStart(event, "Classification", "classification")} draggable sx={{
                                borderRadius: 35,
                                pl: 2,
                                backgroundColor: "#b0f2b4",
                                // padding: "18px 36px",
                                // margin: "10px 0",
                                borderRadius: '10px',
                                margin: '10px',
                                border: "solid 0.2px darkgrey"

                            }}>
                                <ListItemIcon sx={{}}>
                                    <Description />
                                </ListItemIcon>
                                <ListItemText primary={"Classification"} />
                            </ListItem>
                        </List>

                        <List component="div" disablePadding sx={{ pl: 4, pr: 4, mb: 1 }}>
                            <ListItem onDragStart={(event) => onDragStart(event, "Regression", "regression")} draggable sx={{
                                borderRadius: 35,
                                pl: 2,
                                backgroundColor: "lightgrey",
                                // padding: "18px 36px",
                                // margin: "10px 0",
                                borderRadius: '10px',
                                margin: '10px',
                                border: "solid 0.2px darkgrey"

                            }}>
                                <ListItemIcon>
                                    <Description />
                                </ListItemIcon>
                                <ListItemText primary={"Regression"} />
                            </ListItem>
                        </List>

                        <List component="div" disablePadding sx={{ pl: 4, pr: 4, mb: 1 }}>
                            <ListItem onDragStart={(event) => onDragStart(event, "Sentiment", "sentiment")} draggable sx={{
                                borderRadius: 35,
                                pl: 2,
                                backgroundColor: "#ffef9f",
                                // padding: "18px 36px",
                                // margin: "10px 0",
                                borderRadius: '10px',
                                margin: '10px',
                                border: "solid 0.2px darkgrey"

                            }}>
                                <ListItemIcon>
                                    <Description />
                                </ListItemIcon>
                                <ListItemText primary={"Sentiment"} />
                            </ListItem>
                        </List>

                        <List component="div" disablePadding sx={{ pl: 4, pr: 4, mb: 1 }}>
                            <ListItem onDragStart={(event) => onDragStart(event, "ImageClassification", "imageclassification")} draggable sx={{
                                borderRadius: 35,
                                pl: 2,
                                backgroundColor: "#f2b0b0",
                                borderRadius: '10px',
                                margin: '10px',
                                border: "solid 0.2px darkgrey"

                            }}>
                                <ListItemIcon>
                                    <Description />
                                </ListItemIcon>
                                <ListItemText primary={"Image Classification"} />
                            </ListItem>
                        </List>

                        <List component="div" disablePadding sx={{ pl: 4, pr: 4 }}>
                            <ListItem onDragStart={(event) => onDragStart(event, "Huggingface", "huggingface")} draggable sx={{
                                borderRadius: 35,
                                pl: 2,
                                backgroundColor: "#cbf2f2",
                                // padding: "18px 36px",
                                // margin: "10px 0",
                                borderRadius: '10px',
                                margin: '10px',
                                border: "solid 0.2px darkgrey"

                            }}>
                                <ListItemIcon>
                                    <Description />
                                </ListItemIcon>
                                <ListItemText primary={"HuggingFace"} />
                            </ListItem>
                        </List>

                    </List>
                </Collapse >

            </Collapse>
        </List >
    )
}

export default InferenceNavbar;