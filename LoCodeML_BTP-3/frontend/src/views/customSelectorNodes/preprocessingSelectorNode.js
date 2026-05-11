import React, { memo, useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Select, Space, Button, Modal } from "antd";
import { DeleteOutlined } from '@ant-design/icons';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

export default memo(({ id, data, isConnectable, nodeType }) => {
  const [isPreprocessorSelected, setIsPreprocessorSelected] = React.useState(false);
  const [dataType, setDataType] = React.useState(null);
  const [isDataTypeModalOpen, setIsDataTypeModalOpen] = React.useState(false);
  const [isPreprocessModalOpen, setIsPreprocessModalOpen] = React.useState(false);
  const [selectedPreprocess, setSelectedPreprocess] = React.useState(null);
  const [showParameterModal, setShowParameterModal] = React.useState(false);
  const [parameters, setParameters] = React.useState({});

  const csvPreprocessing = [
    'Drop Duplicate Rows', 
    'Interpolate Missing Values', 
    'Normalize Features', 
    'None'
  ];

  useEffect(() => {
    if(data){
      if(data.entity && data.entity){
        if(data.preprocessingType === "csv"){
          setDataType('csv');
        }
        else{
          if(data.params){
            // console.log("Parameters: ", data.params); 
            setParameters(data.entity.parameters);
            // handleParameterChange(data.params);
          }
          setDataType('image');
        }
        setIsPreprocessorSelected(true);
        setSelectedPreprocess(data.entity?.type || data.entity);
      }else{
        setIsPreprocessorSelected(false);
      }
    }
  },[data]);

  const imagePreprocessing = [
    {
      value: 'Resize Image',
      params: {
        width: null,
        height: null
      }
    },
    {
      value: 'Color Space Conversion',
      params: {
        colorSpace: null
      }
    },
    {
      value: 'Image Normalization',
      params: {}
    },
    {
      value: 'Data Augmentation',
      params: {}
    },
    {
      value: 'None',
      params: {}
    }
  ];

  const handleDataTypeChange = (value) => {
    setDataType(value);
    setIsDataTypeModalOpen(false);
    setIsPreprocessModalOpen(true);
  };

  const handlePreprocessChange = (value) => {
    if(dataType === 'csv') {
      data.entity = value;
      setIsPreprocessorSelected(true);
      setIsPreprocessModalOpen(false);
      return;
    }
    const selectedProcess = imagePreprocessing.find(p => p.value === value);
    setSelectedPreprocess(selectedProcess);
    
    if (Object.keys(selectedProcess.params).length > 0) {
      setShowParameterModal(true);
    } else {
      data.entity = { type: value, parameters: {} };
      console.log(data.entity);
      setIsPreprocessorSelected(true);
      setIsPreprocessModalOpen(false);
    }
  };

  const handleParameterChange = (paramValues) => {
    console.log("Hello broo",paramValues);
    setParameters({});
    data.entity = {
      type: selectedPreprocess.value,
      parameters: paramValues
    };
    console.log(data.entity);
    setParameters(paramValues);
    setShowParameterModal(false);
    setIsPreprocessModalOpen(false);
    setIsPreprocessorSelected(true);
  };

  const handleDelete = () => {
    data.onDelete(id);
  };

  const handleOpenModal = () => {
    if (!dataType) {
      setIsDataTypeModalOpen(true);
    } else {
      setIsPreprocessModalOpen(true);
    }
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

      <div className="switchNode" onClick={handleOpenModal} style={{ width: "146px" }}>
        {/* <div className="switchIcon" /> */}
        {isPreprocessorSelected ? <CheckBoxIcon style={{ fontSize: "14px", marginLeft: "8px" }} /> : <AssessmentIcon style={{ fontSize: "14px", marginLeft: "8px" }} />}
        {/* <AssessmentIcon style={{ fontSize: "14px", marginLeft: "8px" }} /> */}
        <div className="switchLabel" >Preprocessing</div>
        <Button
          style={{ height: "15px", width: "15px", borderRadius: "0px", marginLeft: "16px", marginBottom: "2px" }}
          type="text"
          icon={<DeleteSweepIcon style={{ fontSize: '11px' }} />}
          onClick={handleDelete}
          className="deleteButton"
        />
      </div>

      {/* Data Type Selection Modal */}
      <Modal
        title="Select Data Type"
        visible={isDataTypeModalOpen}
        onCancel={() => setIsDataTypeModalOpen(false)}
        footer={null}
      >
        <div>
          <Select
            className="selectStyle nodrag nopan"
            defaultValuevalue={data.preprocessingType}
            style={{ width: '100%' }}
            options={[
              { value: 'csv', label: 'CSV Data' },
              { value: 'image', label: 'Image Data' }
            ]}
            onChange={handleDataTypeChange}
          />
        </div>
      </Modal>

      {/* Preprocessing Selection Modal */}
      <Modal
        title="Select Preprocessing Step"
        visible={isPreprocessModalOpen}
        onCancel={() => setIsPreprocessModalOpen(false)}
        footer={null}
      >
        <div>
          <Select
            className="selectStyle nodrag nopan"
            style={{ width: '100%' }}
            defaultValue={data.entity || "None"}
            options={(dataType === 'csv' ? csvPreprocessing : imagePreprocessing.map(p => p.value)).map((preprocess) => ({
              value: preprocess,
              label: preprocess
            }))}
            onChange={handlePreprocessChange}
          />
        </div>
      </Modal>

      {/* Parameter Modal */}
      <Modal
        title={`Configure ${selectedPreprocess?.value}`}
        visible={showParameterModal}
        onCancel={() => setShowParameterModal(false)}
        footer={null}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {selectedPreprocess?.value === 'Resize Image' && (
            <>
              <div>
                <label>Width:</label>
                <Select
                  style={{ width: '100%' }}
                  options={[
                    { value: 32, label: '32px' },
                    { value: 256, label: '256px' },
                    { value: 299, label: '299px' },
                    { value: 320, label: '320px' }
                  ]}
                  onChange={(value) => setParameters({ width: value })}
                />
              </div>
              <div>
                <label>Height:</label>
                <Select
                  style={{ width: '100%' }}
                  options={[
                    { value: 32, label: '32px' },
                    { value: 256, label: '256px' },
                    { value: 299, label: '299px' },
                    { value: 320, label: '320px' }
                  ]}
                  onChange={(value) => setParameters({ width: parameters.width, height: value })}
                />
              </div>
            </>
          )}
          {selectedPreprocess?.value === 'Color Space Conversion' && (
            <div>
              <label>Color Space:</label>
              <Select
                style={{ width: '100%' }}
                options={[
                  { value: 'RGB', label: 'RGB' },
                  { value: 'GRAY', label: 'Grayscale' },
                ]}
                onChange={(value) => setParameters({ colorSpace: value })}
              />
            </div>
          )}
          <Button
            type="primary"
            onClick={() => handleParameterChange(parameters)}
            style={{ marginTop: '10px' }}
          >
            Apply
          </Button>
        </div>
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