import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    CircularProgress, Typography, Paper, Select, MenuItem, OutlinedInput, FormControl, Checkbox, ListItemText, Chip, Button
} from '@mui/material';
import { Col, Row, Button as ReactStrapButton, Table as ReactStrapTable } from "reactstrap";
import Plot from 'react-plotly.js';
import 'components/ModelInfo/stressTestUI.css';

const StressTest = () => {
    const model_id = window.location.pathname.split("/")[2];
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';
    
    // Loaded Model State
    const [modelDetails, setModelDetails] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Controls
    const [selectedFailures, setSelectedFailures] = useState(['noise', 'missing']);
    const [severity, setSeverity] = useState('medium');
    const [selectedCompareModels, setSelectedCompareModels] = useState([]);
    
    // Loaded Data
    const [allModels, setAllModels] = useState([]);
    const [history, setHistory] = useState([]);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    
    // Results
    const [report, setReport] = useState(null);
    const [compareResults, setCompareResults] = useState([]);

    // Fetch primary model details
    useEffect(() => {
        setLoading(true);
        setError(null);
        axios.get("/getTrainedModels/" + model_id)
            .then((response) => {
                if (response.data) {
                    setModelDetails(response.data);
                    setLoading(false);
                } else {
                    setError(`Model '${model_id}' was not found.`);
                    setLoading(false);
                }
            })
            .catch((err) => {
                console.error("Failed to fetch model details:", err);
                setError("Failed to retrieve model details from the backend server.");
                setLoading(false);
            });
    }, [model_id]);

    // Fetch companion models & history once primary model is loaded
    useEffect(() => {
        if (modelDetails && modelDetails.model_id) {
            fetchCompareModels();
            fetchHistory();
        }
    }, [modelDetails]);

    const fetchCompareModels = async () => {
        try {
            const res = await axios.get(`${apiBaseUrl}/stress-test/compatible-models/${modelDetails.model_id}`);
            const matchingModels = res.data.compatible_models || [];
            setAllModels(matchingModels);
        } catch (err) {
            console.error("Failed fetching compatible comparison models", err);
        }
    };

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await axios.get(`${apiBaseUrl}/stress-test/history/${modelDetails.model_id}`);
            if (res.data && res.data.history) {
                setHistory(res.data.history);
            }
        } catch (err) {
            console.error("Failed loading history", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleFailureChange = (type) => {
        if (selectedFailures.includes(type)) {
            setSelectedFailures(selectedFailures.filter(f => f !== type));
        } else {
            setSelectedFailures([...selectedFailures, type]);
        }
    };

    const handleCompareModelSelect = (event) => {
        const { value } = event.target;
        setSelectedCompareModels(typeof value === 'string' ? value.split(',') : value);
    };

    const runStressTest = async () => {
        if (selectedFailures.length === 0) {
            alert("Please select at least one failure type to run the stress test.");
            return;
        }

        setLoadingAnalysis(true);
        setReport(null);
        setCompareResults([]);
        
        try {
            setLoadingStep("Emulating synthetic failure injection...");
            const mainRes = await axios.post(`${apiBaseUrl}/stress-test`, {
                model_id: modelDetails.model_id,
                failure_types: selectedFailures,
                severity: severity
            });
            setReport(mainRes.data);

            const tempCompareResults = [mainRes.data];
            
            if (selectedCompareModels.length > 0) {
                for (let i = 0; i < selectedCompareModels.length; i++) {
                    const cModelId = selectedCompareModels[i];
                    const compModelName = allModels.find(m => m.model_id === cModelId)?.model_name || cModelId;
                    setLoadingStep(`Running test for ${compModelName}...`);
                    
                    try {
                        const compRes = await axios.post(`${apiBaseUrl}/stress-test`, {
                            model_id: cModelId,
                            primary_model_id: modelDetails.model_id,
                            failure_types: selectedFailures,
                            severity: severity
                        });
                        tempCompareResults.push(compRes.data);
                    } catch (e) {
                        console.error(`Comparison stress test failed for ${cModelId}`, e);
                    }
                }
            }
            setCompareResults(tempCompareResults);
            fetchHistory();
        } catch (err) {
            console.error("Stress test execution failed", err);
            const errMsg = err.response?.data?.error || err.message || "Stress test failed.";
            alert(`Stress test failed: ${errMsg}\n\nPlease verify that the pipeline and datasets are correctly configured.`);
        } finally {
            setLoadingAnalysis(false);
            setLoadingStep('');
        }
    };

    const getBarChartData = () => {
        if (!report) return [];
        return [
            {
                x: ['Baseline', 'Tested'],
                y: [report.original_score, report.degraded_score],
                type: 'bar',
                marker: {
                    color: ['#66615b', '#ef8157']
                },
                width: 0.35
            }
        ];
    };

    const getRadarChartData = () => {
        if (!report || !report.individual_results) return [];
        
        const labels = ['Noise', 'Missing', 'Drift', 'Outliers'];
        const values = [
            report.individual_results.noise?.robustness || 0,
            report.individual_results.missing?.robustness || 0,
            report.individual_results.drift?.robustness || 0,
            report.individual_results.outliers?.robustness || 0
        ];

        return [
            {
                type: 'scatterpolar',
                r: [...values, values[0]],
                theta: [...labels, labels[0]],
                fill: 'toself',
                fillcolor: 'rgba(81, 203, 206, 0.08)',
                line: {
                    color: '#51cbce',
                    width: 1.5
                },
                marker: {
                    color: '#51cbce',
                    size: 5
                }
            }
        ];
    };

    const renderHistoryBadge = (badge, badge_color) => {
        let colorClass = 'green';
        if (badge_color === 'yellow') colorClass = 'yellow';
        if (badge_color === 'red') colorClass = 'red';
        
        return (
            <div className={`history-badge ${colorClass}`}>
                <div className="history-badge-dot" />
                <span>{badge}</span>
            </div>
        );
    };

    return (
        <div className="content stress-test-page">
            
            {/* BACK NAVIGATION (Exact style match with UpdateModel and details back button) */}
            <Row>
                <Col>
                    <Button
                        onClick={() => { window.history.back() }}
                        style={{
                            marginTop: "0",
                            marginBottom: "1rem"
                        }}
                    >
                        Go Back
                    </Button>
                </Col>
            </Row>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
                    <CircularProgress /> <br />
                    <Typography variant="body1" style={{ marginLeft: '10px' }}>
                        Fetching Model details for {model_id} <br />
                    </Typography>
                    <Typography variant="subtitle1" style={{ marginLeft: '10px' }}>
                        Please wait...
                    </Typography>
                </div>
            ) : error ? (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '70vh', textAlign: 'center' }}>
                    <Paper elevation={3} style={{ padding: '2.5rem', maxWidth: '500px', borderRadius: '16px', border: '1px solid rgba(220, 53, 69, 0.2)', backgroundColor: '#fff' }}>
                        <Typography variant="h5" color="error" gutterBottom style={{ fontWeight: 'bold' }}>
                            Model Fetch Failed
                        </Typography>
                        <Typography variant="body1" style={{ margin: '1rem 0', color: '#555', lineHeight: '1.6' }}>
                            {error}
                        </Typography>
                        <Button 
                            variant="contained" 
                            color="error" 
                            onClick={() => { window.history.back() }}
                            style={{ marginTop: '1.5rem', borderRadius: '8px', color: '#fff', textTransform: 'none', fontSize: '16px', padding: '8px 24px' }}
                        >
                            Return to Previous Page
                        </Button>
                    </Paper>
                </div>
            ) : (
                <div>
                    
                    {/* PAGE TITLE */}
                    <Row style={{ marginBottom: "1rem" }}>
                        <Col>
                            <Typography variant="h5" component="h5" gutterBottom>
                                Model Stress Testing
                            </Typography>
                        </Col>
                    </Row>

                    {/* TOP INFORMATION CARD (Exact style match with ShortModelInfoComponent) */}
                    <Paper elevation={3}
                        style={{
                            padding: "1rem",
                            marginBottom: "1rem",
                            backgroundColor: "transparent",
                        }}
                    >
                        <Typography>
                            <Row style={{ marginBottom: "0.5rem" }}>
                                <Col>
                                    Dataset: {modelDetails.dataset_id}
                                </Col>
                            </Row>
                            <Row style={{ marginBottom: "0.5rem" }}>
                                <Col>
                                    Model ID: {modelDetails.model_id}
                                </Col>
                            </Row>
                            <Row style={{ marginBottom: "0.5rem" }}>
                                <Col md="6">
                                    Model Name: {modelDetails.model_name}
                                </Col>
                                <Col md="6">
                                    Model Type: {modelDetails.estimator_type}
                                </Col>
                            </Row>
                            <Row style={{ marginBottom: "0.5rem" }}>
                                <Col md="6">
                                    Training Mode: <Chip variant='outlined' label={modelDetails.training_mode} />
                                </Col>
                                <Col md="6">
                                    Objective: {modelDetails.objective}
                                </Col>
                            </Row>
                            <Row style={{ marginBottom: "0.5rem" }}>
                                <Col md="6">
                                    Target Column: {modelDetails.target_column}
                                </Col>
                                <Col md="6">
                                    Metric: {modelDetails.metric_type}
                                </Col>
                            </Row>
                        </Typography>
                    </Paper>

                    {/* TWO COLUMN CONTENT LAYOUT (Exact style match with UpdateModel view columns) */}
                    <Row>
                        
                        {/* LEFT COLUMN: CONFIGURATION */}
                        <Col md="6">
                            <Typography variant="h5" component="h5" gutterBottom>
                                Failure Settings
                            </Typography>
                            
                            <Typography style={{ marginBottom: '1.5rem', fontSize: '14px', color: '#475569' }}>
                                Select the failure types you want to change and configure parameters:
                            </Typography>

                            {/* Checkbox selector rows matching ChangeHyperparameters.js perfectly */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <Row className="align-items-center mb-3">
                                    <Col md="1">
                                        <Checkbox 
                                            checked={selectedFailures.includes('noise')} 
                                            onChange={() => handleFailureChange('noise')} 
                                        />
                                    </Col>
                                    <Col md="4">
                                        <Typography>Noise Injection</Typography>
                                    </Col>
                                    <Col md="7">
                                        <Typography style={{ fontSize: '13px', color: '#64748b' }}>Gaussian perturbation emulation</Typography>
                                    </Col>
                                </Row>

                                <Row className="align-items-center mb-3">
                                    <Col md="1">
                                        <Checkbox 
                                            checked={selectedFailures.includes('missing')} 
                                            onChange={() => handleFailureChange('missing')} 
                                        />
                                    </Col>
                                    <Col md="4">
                                        <Typography>Missing Values</Typography>
                                    </Col>
                                    <Col md="7">
                                        <Typography style={{ fontSize: '13px', color: '#64748b' }}>Random missing cell insertion</Typography>
                                    </Col>
                                </Row>

                                <Row className="align-items-center mb-3">
                                    <Col md="1">
                                        <Checkbox 
                                            checked={selectedFailures.includes('drift')} 
                                            onChange={() => handleFailureChange('drift')} 
                                        />
                                    </Col>
                                    <Col md="4">
                                        <Typography>Feature Drift</Typography>
                                    </Col>
                                    <Col md="7">
                                        <Typography style={{ fontSize: '13px', color: '#64748b' }}>Covariate distribution shift</Typography>
                                    </Col>
                                </Row>

                                <Row className="align-items-center mb-3">
                                    <Col md="1">
                                        <Checkbox 
                                            checked={selectedFailures.includes('outliers')} 
                                            onChange={() => handleFailureChange('outliers')} 
                                        />
                                    </Col>
                                    <Col md="4">
                                        <Typography>Outlier Injection</Typography>
                                    </Col>
                                    <Col md="7">
                                        <Typography style={{ fontSize: '13px', color: '#64748b' }}>Extreme std-dev spike perturbation</Typography>
                                    </Col>
                                </Row>
                            </div>

                            {/* Severity Button Group (Exact match with standard Reactstrap button designs) */}
                            <div style={{ marginTop: '2rem' }}>
                                <Typography style={{ fontWeight: '500', marginBottom: '10px' }}>
                                    Severity level
                                </Typography>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <ReactStrapButton 
                                        color={severity === 'low' ? 'info' : 'secondary'} 
                                        style={{ color: severity === 'low' ? 'black' : 'white' }}
                                        onClick={() => setSeverity('low')}
                                    >
                                        Low
                                    </ReactStrapButton>
                                    <ReactStrapButton 
                                        color={severity === 'medium' ? 'info' : 'secondary'} 
                                        style={{ color: severity === 'medium' ? 'black' : 'white' }}
                                        onClick={() => setSeverity('medium')}
                                    >
                                        Medium
                                    </ReactStrapButton>
                                    <ReactStrapButton 
                                        color={severity === 'high' ? 'info' : 'secondary'} 
                                        style={{ color: severity === 'high' ? 'black' : 'white' }}
                                        onClick={() => setSeverity('high')}
                                    >
                                        High
                                    </ReactStrapButton>
                                </div>
                            </div>

                            {/* Model Comparison Selection */}
                            <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                                <Typography style={{ fontWeight: '500', marginBottom: '10px' }}>
                                    Compare With Model
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <Select
                                        multiple
                                        displayEmpty
                                        value={selectedCompareModels}
                                        onChange={handleCompareModelSelect}
                                        input={<OutlinedInput style={{ borderRadius: '6px' }} />}
                                        renderValue={(selected) => {
                                            if (selected.length === 0) {
                                                return <span style={{ color: '#94a3b8' }}>Select compatible models...</span>;
                                            }
                                            return selected.map(id => {
                                                const model = allModels.find(m => m.model_id === id);
                                                return model ? model.model_name : id;
                                            }).join(', ');
                                        }}
                                    >
                                        {allModels.map((m) => (
                                            <MenuItem key={m.model_id} value={m.model_id} style={{ fontSize: '13px' }}>
                                                <Checkbox checked={selectedCompareModels.indexOf(m.model_id) > -1} size="small" />
                                                <ListItemText 
                                                    primary={`${m.model_name} (${m.estimator_type})`} 
                                                    secondary={`Match: ${m.compatibility_score}% | Target: ${m.target_column}`}
                                                    primaryTypographyProps={{ fontSize: '13px', fontWeight: '500' }}
                                                    secondaryTypographyProps={{ fontSize: '11px' }}
                                                />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </div>

                            <ReactStrapButton 
                                color="info" 
                                style={{ color: 'black', marginTop: '1rem' }}
                                onClick={runStressTest}
                                disabled={loadingAnalysis}
                            >
                                {loadingAnalysis ? (
                                    <CircularProgress size={18} style={{ color: 'black' }} />
                                ) : (
                                    "Run Stress Test"
                                )}
                            </ReactStrapButton>

                            {loadingAnalysis && (
                                <Typography variant="body2" style={{ marginTop: '10px', fontStyle: 'italic' }}>
                                    {loadingStep}
                                </Typography>
                            )}
                        </Col>
 
                        {/* RIGHT COLUMN: RESULTS */}
                        <Col md="6">
                            <Typography variant="h5" component="h5" gutterBottom>
                                Evaluation Report
                            </Typography>
                            
                            {/* RUNNING STATUS */}
                            {loadingAnalysis && (
                                <Paper elevation={3} style={{ minHeight: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', padding: '24px' }}>
                                    <CircularProgress size={36} thickness={4} />
                                    <Typography style={{ marginTop: '14px', fontWeight: '600', fontSize: '15px' }}>
                                        Evaluating Model Robustness...
                                    </Typography>
                                    <Typography style={{ maxWidth: '340px', margin: '6px auto 0', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                                        Running synthetic stress injections against dataset splits.
                                    </Typography>
                                </Paper>
                            )}

                            {/* EMPTY STATE DEFAULT */}
                            {!loadingAnalysis && !report && (
                                <Paper elevation={3} style={{ minHeight: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', padding: '24px' }}>
                                    <Typography style={{ fontWeight: '600', fontSize: '15px' }}>
                                        No stress evaluation run yet
                                    </Typography>
                                    <Typography style={{ maxWidth: '380px', margin: '0 auto', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                                        Choose failure parameters and click "Run Stress Test" to view performance metrics.
                                    </Typography>
                                </Paper>
                            )}

                            {/* STRESS TEST REPORT VIEW */}
                            {!loadingAnalysis && report && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    
                                    {/* METRICS SUMMARY TABLE (Exact layout/style match with ShortModelInfoComponent striped table) */}
                                    <ReactStrapTable striped style={{ margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>Metric</th>
                                                <th>Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>Baseline ({report.metric_type})</td>
                                                <td>{report.original_score.toFixed(4)}</td>
                                            </tr>
                                            <tr>
                                                <td>Degraded Score</td>
                                                <td className="text-danger" style={{ fontWeight: 'bold' }}>{report.degraded_score.toFixed(4)}</td>
                                            </tr>
                                            <tr>
                                                <td>Robustness Index</td>
                                                <td className="text-success" style={{ fontWeight: 'bold' }}>{report.robustness_score.toFixed(1)}%</td>
                                            </tr>
                                            <tr>
                                                <td>Stability Rating</td>
                                                <td>
                                                    {renderHistoryBadge(report.badge, report.badge_color)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </ReactStrapTable>

                                    {/* Visual Chart Plots (No border or shadow wrapper, matching standard detail charts) */}
                                    <Row style={{ marginTop: '1.5rem' }}>
                                        <Col md="6">
                                            <Typography style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                                                Shift Comparison
                                            </Typography>
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                <Plot
                                                    data={getBarChartData()}
                                                    layout={{
                                                        width: 230,
                                                        height: 180,
                                                        margin: { t: 5, b: 20, l: 30, r: 5 },
                                                        showlegend: false,
                                                        font: { family: 'Arial, sans-serif', size: 10 },
                                                        yaxis: { gridcolor: '#f1f5f9' },
                                                        xaxis: { gridcolor: 'transparent' },
                                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                                        plot_bgcolor: 'rgba(0,0,0,0)'
                                                    }}
                                                    config={{ displayModeBar: false }}
                                                />
                                            </div>
                                        </Col>
                                        <Col md="6">
                                            <Typography style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                                                Resilience Profile
                                            </Typography>
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                <Plot
                                                    data={getRadarChartData()}
                                                    layout={{
                                                        width: 230,
                                                        height: 180,
                                                        margin: { t: 20, b: 20, l: 20, r: 20 },
                                                        font: { family: 'Arial, sans-serif', size: 10 },
                                                        polar: {
                                                            radialaxis: { visible: true, range: [0, 100], gridcolor: '#e2e8f0' },
                                                            angularaxis: { gridcolor: '#e2e8f0' }
                                                        },
                                                        showlegend: false,
                                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                                        plot_bgcolor: 'rgba(0,0,0,0)'
                                                    }}
                                                    config={{ displayModeBar: false }}
                                                />
                                            </div>
                                        </Col>
                                    </Row>

                                    {/* COMPARISON SYSTEM */}
                                    {compareResults.length > 0 && (
                                        <div style={{ marginTop: '1rem' }}>
                                            <Typography variant="h5" component="h5" gutterBottom>
                                                Side-by-Side Model Comparison
                                            </Typography>
                                            <ReactStrapTable striped responsive>
                                                <thead>
                                                    <tr>
                                                        <th>Model</th>
                                                        <th>Estimator</th>
                                                        <th>Baseline</th>
                                                        <th>Degraded</th>
                                                        <th>Robustness</th>
                                                        <th>Rating</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {compareResults.map((r, idx) => (
                                                        <tr key={idx} className={r.model_id === modelDetails.model_id ? 'table-info' : ''}>
                                                            <td style={{ fontWeight: r.model_id === modelDetails.model_id ? 'bold' : 'normal' }}>
                                                                {r.model_name} {r.model_id === modelDetails.model_id ? '(Current)' : ''}
                                                            </td>
                                                            <td>{r.estimator_type}</td>
                                                            <td>{r.original_score.toFixed(4)}</td>
                                                            <td>{r.degraded_score.toFixed(4)}</td>
                                                            <td className="text-success" style={{ fontWeight: 'bold' }}>{r.robustness_score.toFixed(1)}%</td>
                                                            <td>
                                                                {renderHistoryBadge(r.badge, r.badge_color)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </ReactStrapTable>
                                        </div>
                                    )}

                                </div>
                             )}
                        </Col>

                    </Row>

                    {/* RECENT RUNS SECTION (Visual match with Model details versions table) */}
                    <Row style={{ marginTop: '2rem' }}>
                        <Col md="12">
                            <Typography variant="h5" component="h5" gutterBottom>
                                Recent Runs
                            </Typography>
                            {loadingHistory ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
                                    <CircularProgress size={18} />
                                </div>
                            ) : history.length === 0 ? (
                                <Typography style={{ textAlign: 'center', padding: '12px', fontStyle: 'italic' }}>
                                    No historical logs found for this model.
                                </Typography>
                            ) : (
                                <ReactStrapTable striped responsive style={{ margin: 0 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>Timestamp</th>
                                            <th style={{ textAlign: 'left' }}>Emulations</th>
                                            <th style={{ textAlign: 'left' }}>Severity</th>
                                            <th style={{ textAlign: 'right' }}>Baseline</th>
                                            <th style={{ textAlign: 'right' }}>Degraded</th>
                                            <th style={{ textAlign: 'right' }}>Robustness</th>
                                            <th style={{ textAlign: 'center' }}>Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((h, idx) => {
                                            const date = h.time && h.time.$date ? new Date(h.time.$date) : new Date();
                                            const runId = h._id?.$oid ? h._id.$oid.substring(18).toUpperCase() : `RST-${history.length - idx}`;
                                            
                                            let robustnessClass = 'value-muted-green';
                                            if (h.badge_color === 'yellow') robustnessClass = 'value-muted-amber';
                                            if (h.badge_color === 'red') robustnessClass = 'value-muted-red';
                                            
                                            return (
                                                <tr key={idx}>
                                                    <td>
                                                        <div>
                                                            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        <small className="text-muted">
                                                            Run ID: #{runId}
                                                        </small>
                                                    </td>
                                                    <td>
                                                        {h.failure_types.join(', ')}
                                                    </td>
                                                    <td style={{ textTransform: 'capitalize' }}>{h.severity}</td>
                                                    <td style={{ textAlign: 'right' }}>{h.original_score.toFixed(4)}</td>
                                                    <td style={{ textAlign: 'right' }} className={h.badge_color === 'red' ? 'text-danger' : h.badge_color === 'yellow' ? 'text-warning' : ''}>
                                                        {h.degraded_score.toFixed(4)}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }} className={robustnessClass}>{h.robustness_score.toFixed(1)}%</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {renderHistoryBadge(h.badge, h.badge_color)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </ReactStrapTable>
                            )}
                        </Col>
                    </Row>

                </div>
            )}

        </div>
    );
};

export default StressTest;
