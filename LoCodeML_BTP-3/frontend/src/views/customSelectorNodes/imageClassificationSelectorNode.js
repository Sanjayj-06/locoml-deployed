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

  const [imageClassificationModels, setImageClassificationModels] = React.useState([]);
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
      axios.get(process.env.REACT_APP_GET_TRAINED_MODELS_URL + "/imageclassification")
        .then((response) => {
          console.log("Received image classification models: ", response.data);
          var imageClassificationModelMap = {};
          const parsedModels = response.data.trained_models.map(model => JSON.parse(model.replace(/Infinity/g, "1e1000")));
          parsedModels.forEach((model) => {
            imageClassificationModelMap[model.model_id] = model;
          });
          if (data && data.model_id) {
            if(imageClassificationModelMap[data.model_id]){
              data.entity = imageClassificationModelMap[data.model_id];
              setIsModelSelected(true);
            } else {
              data.entity = null;
              setIsModelSelected(false);
              console.warn("No model found for the given model_id: ", data.model_id);
            }
          }
          else{
            data.entity = null;
            setIsModelSelected(false);
          }
          setImageClassificationModels(imageClassificationModelMap);
          setIsLoading(false);
        })
        .catch((error) => {
          console.log(error);
        });
    }
    fetchData();
  }
    , []);

  const handleChange = (value) => {
    // Pass selected value to parent component
    data.entity = imageClassificationModels[value];
    setIsModelSelected(true);
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
        <div className="switchLabel" >Image Classification</div>
        <Button
          style={{ height: "15px", width: "15px", borderRadius: "0px", marginLeft: "16px", marginBottom: "2px" }}
          type="text"
          icon={<DeleteSweepIcon style={{ fontSize: '11px' }} />}
          onClick={handleDelete}
          className="deleteButton"
        />
      </div>

      <Modal
        title="Select Image Classification Model"
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
            options={Object.keys(imageClassificationModels).map((model_id) => ({
              value: model_id,
              label: imageClassificationModels[model_id].model_name
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
