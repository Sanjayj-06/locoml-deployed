import React, { memo } from "react";
import { Handle, Position } from "reactflow";
import { Select, Space, Button, Modal } from "antd";
import { DeleteOutlined } from '@ant-design/icons';
import axios from "axios";
import './nodes.css';
import Description from '@mui/icons-material/Description';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

export default memo(({ id, data, isConnectable, nodeType }) => {

  const [sentimentModels, setSentimentModels] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isModelSelected, setIsModelSelected] = React.useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  React.useEffect(() => {
    const fetchData = async () => {
      axios.get("/getTrainedModels/sentiment")
        .then((response) => {
          console.log("Received sentiment models: ", response.data);
          var sentimentModelMap = {};
          const parsedModels = response.data.trained_models.map(model => JSON.parse(model.replace(/Infinity/g, "1e1000")));
          parsedModels.forEach((model) => {
            sentimentModelMap[model.model_id] = model;
          });
          if (data && data.model_id) {
            if (sentimentModelMap[data.model_id]) {
              const selectedModel = sentimentModelMap[data.model_id];
              data.entity = selectedModel;
              setIsModelSelected(true);
              if (data.onModelBind) {
                data.onModelBind(id, selectedModel);
              }
            } else {
              data.entity = null;
              setIsModelSelected(false);
              console.warn("No model found for the given model_id: ", data.model_id);
            }
          } else {
            data.entity = null;
            setIsModelSelected(false);
          }
          setSentimentModels(sentimentModelMap);
          setIsLoading(false);
        })
        .catch((error) => {
          console.log(error);
          setSentimentModels({});
          setIsModelSelected(false);
          setIsLoading(false);
        });
    }
    fetchData();
  }
    , []);

  const handleChange = (value) => {
    const selectedModel = sentimentModels[value];
    data.entity = selectedModel;
    data.model_id = value;
    setIsModelSelected(true);
    if (data.onModelBind) {
      data.onModelBind(id, selectedModel);
    }
  };

  const handleDelete = () => {
    data.onDelete(id);
  }

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        // style={{ background: "#555" }}
        onConnect={(params) => console.log("handle onConnect", params)}
        isConnectable={isConnectable}
      />

      <div className="switchNode" onClick={handleOpenModal} style={{ width: "124px" }}>
        {/* <div className="switchIcon" /> */}
        {isModelSelected ? <CheckBoxIcon style={{ fontSize: "14px", marginLeft: "8px" }} /> : <Description style={{ fontSize: "14px", marginLeft: "8px" }} />}
        {/* <Description style={{ fontSize: "14px", marginLeft: "8px" }} /> */}
        <div className="switchLabel" >Sentiment</div>
        <Button
          style={{ height: "15px", width: "15px", borderRadius: "0px", marginLeft: "16px", marginBottom: "2px" }}
          type="text"
          icon={<DeleteSweepIcon style={{ fontSize: '11px' }} />}
          onClick={handleDelete}
          className="deleteButton"
        />
      </div>

      <Modal
        title="Select Sentiment Model"
        visible={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
      >
        {/* Model selection part inside the modal */}
        <div >
          {/* Dropdown for selecting classification models */}
          <Select
            className="selectStyle nodrag nopan"
            defaultValue={data?.model_id || ""}
            options={Object.keys(sentimentModels).map((model_id) => ({
              value: model_id,
              label: sentimentModels[model_id].model_name
            }))}
            disabled={isLoading}
            onChange={handleChange}
          // className="nodrag nopan"
          />
        </div>
      </Modal>

      {/* <div className="nodeContainer">
        <div className="nodeHeader">
          <div className="nodeTitle">Sentiment Analysis</div>
          <Button
            type="text"
            icon={<DeleteOutlined style={{ fontSize: '12px' }} />}
            onClick={handleDelete}
            className="deleteButton"
          />
        </div>
        <Select
          className="selectStyle nodrag nopan"
          options={Object.keys(sentimentModels).map((model_id) => ({
            value: model_id,
            label: sentimentModels[model_id].model_name
          }))}
          disabled={isLoading}
          onChange={handleChange}
        // className="nodrag nopan"
        />
      </div> */}

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
