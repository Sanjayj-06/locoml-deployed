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
  const isModelSelected = !!(data?.model_id || data?.entity);

  const [recommendation, setRecommendation] = React.useState(null);
  const [isFetchingRec, setIsFetchingRec] = React.useState(false);

  const fetchRecommendation = async (modelId) => {
    if (!modelId) {
      setRecommendation(null);
      return;
    }
    setIsFetchingRec(true);
    try {
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const response = await axios.get(`${apiBase}/getRecommendation?model_id=${modelId}`);
      if (response.data && response.data.success && response.data.has_recommendation) {
        setRecommendation(response.data.recommendation);
      } else {
        setRecommendation(null);
      }
    } catch (error) {
      console.error("Error fetching recommendation:", error);
      setRecommendation(null);
    } finally {
      setIsFetchingRec(false);
    }
  };

  React.useEffect(() => {
    if (data?.model_id) {
      fetchRecommendation(data.model_id);
    } else {
      setRecommendation(null);
    }
  }, [data?.model_id]);

  const handleUseRecommendation = () => {
    if (!recommendation) return;
    const recModelObj = {
      model_id: recommendation.model_id,
      model_name: recommendation.model_name,
      estimator_type: recommendation.estimator_type,
      objective: recommendation.objective,
      target_column: recommendation.target_column,
      evaluation_metrics: [
        { metric_name: recommendation.metric_name, metric_value: recommendation.metric_value }
      ]
    };
    setSentimentModels(prev => ({
      ...prev,
      [recommendation.model_id]: recModelObj
    }));
    data.entity = recModelObj;
    data.model_id = recommendation.model_id;
    if (data.onModelBind) {
      data.onModelBind(id, recModelObj);
    }
    handleCloseModal();
  };

  const parseTrainedModels = (responseData) => {
    const normalizedResponse = typeof responseData === "string"
      ? (() => {
          try {
            return JSON.parse(responseData);
          } catch (error) {
            return {};
          }
        })()
      : responseData;

    const trainedModels = Array.isArray(normalizedResponse?.trained_models) ? normalizedResponse.trained_models : [];

    return trainedModels
      .map((model) => {
        if (typeof model === "string") {
          try {
            return JSON.parse(model.replace(/Infinity/g, "1e1000"));
          } catch (error) {
            return null;
          }
        }

        return model;
      })
      .filter(Boolean);
  };

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
          const parsedModels = parseTrainedModels(response.data);
          parsedModels.forEach((model) => {
            sentimentModelMap[model.model_id] = model;
          });
          if (data && data.model_id) {
            if (sentimentModelMap[data.model_id]) {
              const selectedModel = sentimentModelMap[data.model_id];
              data.entity = selectedModel;
              if (data.onModelBind) {
                data.onModelBind(id, selectedModel);
              }
            } else {
              data.entity = null;
              console.warn("No model found for the given model_id: ", data.model_id);
            }
          } else {
            data.entity = null;
          }
          setSentimentModels(sentimentModelMap);
          setIsLoading(false);
        })
        .catch((error) => {
          console.log(error);
          setSentimentModels({});
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
            className="nodrag nopan"
            style={{ width: '200px' }}
            value={data?.model_id || undefined}
            options={Object.keys(sentimentModels).map((model_id) => ({
              value: model_id,
              label: sentimentModels[model_id].model_name || sentimentModels[model_id].name || model_id
            }))}
            disabled={isLoading}
            onChange={handleChange}
            placeholder="Select a model"
          />
          {recommendation && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
              border: '1px solid #dcdcdc',
              boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
              transition: 'all 0.3s ease',
              fontFamily: '"Outfit", "Inter", sans-serif',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '20px', marginRight: '8px' }}>💡</span>
                <h5 style={{ margin: 0, fontWeight: 600, color: '#333', fontSize: '15px' }}>AI Model Recommendation</h5>
                <span style={{
                  marginLeft: 'auto',
                  background: '#4caf50',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  Better Performance
                </span>
              </div>
              
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#555', lineHeight: '1.5' }}>
                Another user, <strong>{recommendation.user.name}</strong> ({recommendation.user.company}), 
                used the model <strong>{recommendation.model_name}</strong> ({recommendation.estimator_type}) 
                for a similar use case (target: <code>{recommendation.target_column}</code>) and achieved 
                an outstanding <strong>{(recommendation.metric_value * 100).toFixed(2)}% {recommendation.metric_name}</strong>.
              </p>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.6)',
                padding: '8px 12px',
                borderRadius: '8px',
                marginBottom: '12px',
                fontSize: '12px'
              }}>
                <div>
                  <span>Your model: <strong>{(recommendation.chosen_metric_value * 100).toFixed(2)}%</strong></span>
                </div>
                <div>
                  <span>Recommended: <strong>{(recommendation.metric_value * 100).toFixed(2)}%</strong></span>
                </div>
                <div style={{ color: recommendation.difference >= 0 ? '#2e7d32' : '#c62828', fontWeight: 'bold' }}>
                  {recommendation.difference >= 0 ? '+' : ''}{(recommendation.difference * 100).toFixed(2)}% Improvement
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button 
                  type="primary" 
                  onClick={handleUseRecommendation}
                  style={{
                    background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                    border: 0,
                    color: 'white',
                    boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    height: '32px'
                  }}
                >
                  Use Recommended Model
                </Button>
              </div>
            </div>
          )}
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
