import React from "react";
import axios from "axios";
import {CircularProgress, Typography, Button} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {Row, Col} from "reactstrap";

function InferenceZoo() {
    const [loading, setLoading] = React.useState(true);
    const [inferencePipelines, setInferencePipelines] = React.useState([{
        "time": "2021-10-10T12:00:00.000Z",
        "pipeline_id": "S9NVQZ",
        "nodes": [{
            'id': '1',
            'type': 'input',
            'data': {'label': 'Start'},
            'position': {'x': 250, 'y': 5},
            'width': 150,
            'height': 40
        }],
        'edges': []
    }]);
    const [pipelineChunks, setPipelineChunks] = React.useState([]);
    const [pageNum, setPageNum] = React.useState(1);
    const [totalNumPages, setTotalNumPages] = React.useState(1);
    const pageLimit = 10
    const CHUNK_SIZE = 3 // number of items in one row to be displayed on the page

    React.useEffect(() => {
        const getPipelinesUrl = process.env.REACT_APP_INFERENCE_PIPELINE_ZOO_GET_PIPELINES || "http://localhost:5005/getPipelinesList";
        axios.get(getPipelinesUrl + `/?page=${pageNum}&limit=${pageLimit}`)
            .then(async (response) => {
                console.log(response.data);
                const temp = [];
                if (response.data && Array.isArray(response.data.inference_pipelines)) {
                    for (let i = 0; i < response.data.inference_pipelines.length; i++) {
                        try {
                            let pipeline = response.data.inference_pipelines[i];
                            if (typeof pipeline === "string") pipeline = JSON.parse(pipeline);
                            temp.push(pipeline);
                        } catch (error) {
                            console.log(error);
                            console.error(`Invalid JSON in response.data.inference_pipelines[${i}]:`, response.data.inference_pipelines[i]);
                        }
                    }
                }
                setInferencePipelines(temp);
                const chunks = chunkArray(temp, CHUNK_SIZE);
                setPipelineChunks(chunks);
                setTotalNumPages(response.data.total_pages || 1);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Failed to fetch saved pipelines:", error);
                setLoading(false);
            })
    }, [pageNum]);

    function chunkArray(myArray, chunk_size) {
        let index;
        const arrayLength = myArray.length;
        const tempArray = [];

        for (index = 0; index < arrayLength; index += chunk_size) {
            const myChunk = myArray.slice(index, index + chunk_size);
            tempArray.push(myChunk);
        }

        console.log(tempArray)

        return tempArray;
    }

    const handleNext = () => {
        if (pageNum < totalNumPages) {
            setPageNum(pageNum + 1);
        }
    };

    const handlePrev = () => {
        if (pageNum > 1) {
            setPageNum(pageNum - 1);
        }
    };

    const handleCopyLink = (pipelineId) => {
        const link = `${window.location.origin}/pipeline/${pipelineId}`;
        navigator.clipboard.writeText(link).then(() => {
            alert('Pipeline link copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert(`Copy this pipeline ID: ${pipelineId}`);
        });
    };


    return (<div className="content">
        {loading ? <div style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '70vh'
        }}>
            <CircularProgress/> <br/>
            <Typography variant="h6" style={{marginLeft: '10px'}}>
                Fetching Saved Inference Pipelines <br/>
            </Typography>
            <Typography variant="subtitle1" style={{marginLeft: '10px'}}>
                Please wait...
            </Typography>
        </div> : <>

            {pipelineChunks.map((pipelineChunk,) => {

                return (<Row style={{marginBottom: "1.5rem"}}>
                    {pipelineChunk.map((pipeline, index) => {
                        return (<Col md="4">
                             <ul>
                                 <li key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                     <a href={`/pipeline/${pipeline.pipeline_id}`} style={{ marginRight: '10px', color: '#3345dd', fontWeight: '600', textDecoration: 'none' }}>
                                         {pipeline.pipeline_name} ({pipeline.pipeline_id})
                                     </a>
                                     <Button 
                                         size="small" 
                                         variant="outlined" 
                                         startIcon={<ContentCopyIcon style={{ fontSize: '12px' }} />}
                                         style={{ borderRadius: '15px', textTransform: 'none', padding: '2px 8px', fontSize: '11px', color: '#333333', borderColor: '#cccccc' }}
                                         onClick={() => handleCopyLink(pipeline.pipeline_id)}
                                     >
                                         Copy Link
                                     </Button>
                                 </li>
                             </ul>
                        </Col>)
                    })}
                </Row>);
            })}

            <div>
                <button onClick={handlePrev} disabled={pageNum === 1}>Previous Page</button>
                <span>Page {pageNum} of {totalNumPages}</span>
                <button onClick={handleNext} disabled={pageNum === totalNumPages}>Next Page</button>
            </div>
        </>}
    </div>);
}

export default InferenceZoo;