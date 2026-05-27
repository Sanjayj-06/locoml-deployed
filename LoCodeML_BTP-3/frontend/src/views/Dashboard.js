
import React, { useEffect } from "react";
// react plugin used to create charts
import { Line, Pie } from "react-chartjs-2";
// reactstrap components
import {
    Card,
    CardHeader,
    CardBody,
    CardFooter,
    CardTitle,
    Row,
    Col,
} from "reactstrap";
// core components
import {
    dashboard24HoursPerformanceChart,
    dashboardEmailStatisticsChart,
    dashboardNASDAQChart,
} from "variables/charts.js";
import axios from "axios";

import DatasetIcon from '@mui/icons-material/Dataset';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import BarChartIcon from '@mui/icons-material/BarChart';
import Plot from "react-plotly.js";

function Dashboard() {

    const [allModelDetails, setAllModelDetails] = React.useState([])
    const [datasetDetails, setDatasetDetails] = React.useState([])
    const [systemStats, setSystemStats] = React.useState({
        "total_models": 0,
        "total_datasets": 0,
        "total_size_of_datasets": 0,
        "most_popular_model": "",
    })
    const [barPlotData, setBarPlotData] = React.useState({})
    const [areaPlotData, setAreaPlotData] = React.useState({})
    const [piePlotData, setPiePlotData] = React.useState({})

    useEffect(() => {

        const getModelDetails = async () => {
            try {
                const response = await axios.get('/getTrainedModels');
                if (!response?.data?.trained_models) {
                    throw new Error("Invalid trained models response format");
                }
                var temp = [];
                for (var i = 0; i < response.data.trained_models.length; i++) {
                    try {
                        var parsed_model = JSON.parse(response.data.trained_models[i].replace(/Infinity/g, "1e1000"));
                        temp.push(parsed_model);
                    } catch (error) {
                        console.error(`Invalid JSON in response.data.trained_models[${i}]:`, response.data.trained_models[i]);
                    }
                }
                setAllModelDetails(temp);
                console.log(response.data.trained_models.length);

                setSystemStats(prev => ({
                    ...prev,
                    total_models: temp.length,
                    most_popular_model: getMostPopularModel(temp)
                }));
                
                var plotdata1 = BarPlotData(temp);
                var plotdata2 = AreaPlotData(temp);
                var plotdata3 = PiePlotData(temp);
                setBarPlotData(plotdata1);
                setAreaPlotData(plotdata2);
                setPiePlotData(plotdata3);
            } catch (error) {
                console.error("Failed to load trained models details:", error);
            }
        }

        const getDatasetDetails = async () => {
            try {
                const response = await axios.get('/getDatasets');
                if (!response?.data?.dataset_list) {
                    throw new Error("Invalid dataset list response format");
                }
                const datasets = response.data.dataset_list;
                setDatasetDetails(datasets);
                console.log(datasets.length);
                setSystemStats(prev => ({
                    ...prev,
                    total_datasets: datasets.length,
                    total_size_of_datasets: getTotalSizeOfDatasets(datasets)
                }));
            } catch (error) {
                console.error("Failed to load dataset details:", error);
            }
        }

        getModelDetails();
        getDatasetDetails();
    }, [])

    const getNumberOfModels = (modelDetails) => {
        return modelDetails.length;
    }

    const getNumberOfDatasets = (datasetDetails) => {
        return datasetDetails.length;
    }

    const getTotalSizeOfDatasets = (datasetDetails) => {
        var totalSize = 0;
        for (var i = 0; i < datasetDetails.length; i++) {
            totalSize += parseInt(datasetDetails[i].dataset_size);
        }
        return (totalSize / 1000000).toFixed(2);
    }

    const getMostPopularModel = (modelDetails) => {
        var modelCount = {};
        console.log(typeof (modelDetails[0]))
        // console.log(JSON.parse(modelDetails[0]))
        for (var i = 0; i < modelDetails.length; i++) {
            console.log(modelDetails[i].estimator_type)
            if (modelDetails[i].estimator_type in modelCount) {
                modelCount[modelDetails[i].estimator_type] += 1;
            }
            else {
                modelCount[modelDetails[i].estimator_type] = 1;
            }
        }
        var max = 0;
        var maxModel = "";
        for (var model in modelCount) {
            if (modelCount[model] > max) {
                max = modelCount[model];
                maxModel = model;
            }
        }
        return maxModel;
    }

    const BarPlotData = (modelDetails) => {

        var modelCount = {
            'classification': 0,
            'regression': 0,
            'sentiment': 0,
        }

        for (var i = 0; i < modelDetails.length; i++) {
            if (modelDetails[i].objective.toLowerCase() == 'classification') {
                console.log("hit")
                modelCount['classification'] += 1;
            }
            else if (modelDetails[i].objective.toLowerCase() == 'sentiment') {
                modelCount['sentiment'] += 1;
            } 
            else {
                modelCount['regression'] += 1;
            }
        }

        const data = [{
            x: Object.keys(modelCount),
            y: Object.values(modelCount),
            type: 'bar',
            marker: {
                color: ['green', 'blue', 'pink']
            }
        }];

        const layout = {
            title: 'Model Objectives',
            xaxis: {
                title: 'Model Objective',
            },
            yaxis: {
                title: 'Number of Models',
            },
            autosize: true,
        };

        return {
            data: data,
            layout: layout,
        }
        // return modelCount;
    }

    const AreaPlotData = (modelDetails) => {
        // show number of models trained per day for the last 7 days

        // find number of models trained per day

        var modelsTrainedPerDay = {};
        var today = new Date();
        var last7Days = [];
        for (var i = 0; i < 30; i++) {
            var date = new Date(today);
            date.setDate(date.getDate() - i);
            last7Days.push(date.toLocaleDateString());
        }

        for (var i = 0; i < modelDetails.length; i++) {
            var timestamp = modelDetails[i].time.$date;
            var date = new Date(timestamp).toLocaleDateString();
            console.log(date)
            // check if date is within last 7 days
            if (last7Days.includes(date)) {
                if (date in modelsTrainedPerDay) {
                    modelsTrainedPerDay[date] += 1;
                }
                else {
                    modelsTrainedPerDay[date] = 1;
                }
            }
        }

        const xData = Object.keys(modelsTrainedPerDay);
        const yData = Object.values(modelsTrainedPerDay);

        const data = [{
            x: xData,
            y: yData,
            type: 'scatter',
            mode: 'lines+markers',
            fill: 'tozeroy',
            line: {
                shape: 'spline',
            },
        }];

        const layout = {
            title: 'Models Trained per Day',
            xaxis: {
                title: 'Date',
            },
            yaxis: {
                title: 'Number of Models',
            },
            autosize: true,
        };

        return {
            data: data,
            layout: layout,
        }
    }

    const PiePlotData = (modelDetails) => {

        var estimatorTypeCount = {}

        for (var i = 0; i < modelDetails.length; i++) {
            if (modelDetails[i].estimator_type in estimatorTypeCount) {
                estimatorTypeCount[modelDetails[i].estimator_type] += 1;
            }
            else {
                estimatorTypeCount[modelDetails[i].estimator_type] = 1;
            }
        }

        const data = [{
            values: Object.values(estimatorTypeCount),
            labels: Object.keys(estimatorTypeCount),
            type: 'pie',
        }];

        const layout = {
            title: 'Model Types',
            autosize: true,
        };

        return {
            data: data,
            layout: layout,
        }
    }

    return (
        <>
            <div className="content">
                <Row>
                    <Col lg="3" md="6" sm="6">
                        <Card className="card-stats" style={{ minHeight: '235px' }}>
                            <CardBody>
                                <Row>
                                    <Col md="4" xs="5">
                                        <div className="icon-big text-center icon-warning">
                                            <ModelTrainingIcon fontSize="large" style={{ color: 'brown' }} />
                                        </div>
                                    </Col>
                                    <Col md="8" xs="7">
                                        <div className="numbers">
                                            <p className="card-category">Total Number of Models Trained</p>
                                            <CardTitle tag="p">{systemStats["total_models"]}</CardTitle>
                                            <p />
                                        </div>
                                    </Col>
                                </Row>
                            </CardBody>
                            <CardFooter>
                                <hr />
                                <div className="stats">
                                    <i className="fas fa-sync-alt" /> Total number of models trained till date.
                                </div>
                            </CardFooter>
                        </Card>
                    </Col>
                    <Col lg="3" md="6" sm="6">
                        <Card className="card-stats">
                            <CardBody>
                                <Row>
                                    <Col md="4" xs="5">
                                        <div className="icon-big text-center icon-warning">
                                            <DatasetIcon fontSize="large" style={{ color: 'green' }} />
                                        </div>
                                    </Col>
                                    <Col md="8" xs="7">
                                        <div className="numbers">
                                            <p className="card-category">Total Number of Datasets Uploaded</p>
                                            <CardTitle tag="p">{systemStats["total_datasets"]}</CardTitle>
                                            <p />
                                        </div>
                                    </Col>
                                </Row>
                            </CardBody>
                            <CardFooter>
                                <hr />
                                <div className="stats">
                                    <i className="far fa-calendar" /> Total number of datasets uploaded on the system.
                                </div>
                            </CardFooter>
                        </Card>
                    </Col>
                    <Col lg="3" md="6" sm="6">
                        <Card className="card-stats">
                            <CardBody>
                                <Row>
                                    <Col md="4" xs="5">
                                        <div className="icon-big text-center icon-warning">
                                            <BarChartIcon fontSize="large" style={{ color: 'violet' }} />
                                        </div>
                                    </Col>
                                    <Col md="8" xs="7">
                                        <div className="numbers">
                                            <p className="card-category">Combined Size of Datasets</p>
                                            <CardTitle tag="p">{systemStats["total_size_of_datasets"]} MB</CardTitle>
                                            <p />
                                        </div>
                                    </Col>
                                </Row>
                            </CardBody>
                            <CardFooter>
                                <hr />
                                <div className="stats">
                                    <i className="far fa-clock" /> Total size of all datasets in Megabytes (MB)
                                </div>
                            </CardFooter>
                        </Card>
                    </Col>
                    <Col lg="3" md="6" sm="6">
                        <Card className="card-stats">
                            <CardBody>
                                <Row>
                                    <Col md="4" xs="5">
                                        <div className="icon-big text-center icon-warning">
                                            <StarBorderIcon fontSize="large" style={{ color: 'blue' }} />
                                        </div>
                                    </Col>
                                    <Col md="8" xs="7">
                                        <div className="numbers">
                                            <p className="card-category">Most Popular Model</p>
                                            <CardTitle
                                                tag="p"
                                                title={systemStats["most_popular_model"]}
                                                style={{
                                                    fontSize: '0.9rem',
                                                    lineHeight: 1.2,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    marginBottom: 0,
                                                    maxWidth: '100%'
                                                }}
                                            >
                                                {systemStats["most_popular_model"]}
                                            </CardTitle>
                                            <p />
                                        </div>
                                    </Col>
                                </Row>
                            </CardBody>
                            <CardFooter>
                                <hr />
                                <div className="stats">
                                    <i className="fas fa-sync-alt" /> This is the most popular model.
                                </div>
                            </CardFooter>
                        </Card>
                    </Col>
                </Row>
                <Row>
                    <Col md="12">
                        <Card>
                            <CardHeader>
                                <CardTitle tag="h5">Number of Models Trained Per day</CardTitle>
                                <p className="card-category">Last 30 days report</p>
                            </CardHeader>
                            <CardBody>
                                {/* <Line
                                    data={dashboard24HoursPerformanceChart.data}
                                    options={dashboard24HoursPerformanceChart.options}
                                    width={400}
                                    height={100}
                                /> */}
                                <Plot
                                    data={areaPlotData.data}
                                    layout={areaPlotData.layout}
                                    style={{
                                        'width': '100%'
                                    }}
                                />
                            </CardBody>
                            {/* <CardFooter>
                                <hr />
                                <div className="stats">
                                    <i className="fa fa-history" /> Updated 3 minutes ago
                                </div>
                            </CardFooter> */}
                        </Card>
                    </Col>
                </Row>
                <Row>
                    <Col md="5">
                        <Card>
                            <CardHeader>
                                <CardTitle tag="h5">Number of Models</CardTitle>
                                <p className="card-category">Number of Models according to objective</p>
                            </CardHeader>
                            <CardBody>
                                {/* <Pie
                                    data={dashboardEmailStatisticsChart.data}
                                    options={dashboardEmailStatisticsChart.options}
                                /> */}
                                <Plot
                                    data={barPlotData.data}
                                    layout={barPlotData.layout}
                                    style={{
                                        'width': '100%'
                                    }}
                                />
                            </CardBody>
                            <CardFooter>
                                {/* <div className="legend">
                                    <i className="fa fa-circle text-primary" /> Opened{" "}
                                    <i className="fa fa-circle text-warning" /> Read{" "}
                                    <i className="fa fa-circle text-danger" /> Deleted{" "}
                                    <i className="fa fa-circle text-gray" /> Unopened
                                </div>
                                <hr />
                                <div className="stats">
                                    <i className="fa fa-calendar" /> Number of emails sent
                                </div> */}
                            </CardFooter>
                        </Card>
                    </Col>
                    <Col md="7">
                        <Card className="card-chart">
                            <CardHeader>
                                <CardTitle tag="h5">Distribution of Models</CardTitle>
                                <p className="card-category">Share of each type of model</p>
                            </CardHeader>
                            <CardBody>
                                {/* <Line
                                    data={dashboardNASDAQChart.data}
                                    options={dashboardNASDAQChart.options}
                                    width={400}
                                    height={100}
                                /> */}
                                <Plot 
                                    data={piePlotData.data}
                                    layout={piePlotData.layout}
                                    style={{
                                        'width': '100%'
                                    }}
                                />
                            </CardBody>
                            {/* <CardFooter>
                                <div className="chart-legend">
                                    <i className="fa fa-circle text-info" /> Tesla Model S{" "}
                                    <i className="fa fa-circle text-warning" /> BMW 5 Series
                                </div>
                                <hr />
                                <div className="card-stats">
                                    <i className="fa fa-check" /> Data information certified
                                </div>
                            </CardFooter> */}
                        </Card>
                    </Col>
                </Row>
            </div>
        </>
    );
}

export default Dashboard;
