import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import { 
    CircularProgress, Typography, Paper, Select, MenuItem, OutlinedInput, FormControl, Checkbox, ListItemText, Chip
} from '@mui/material';
import { Col, Row, Button as ReactStrapButton, Table as ReactStrapTable } from "reactstrap";
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import HistoryIcon from '@mui/icons-material/History';
import Plot from 'react-plotly.js';
import './stressTestUI.css';

const StressTestModal = ({ open, onClose, modelDetails, dataset_map }) => {
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';
    
    // Controls
    const [selectedFailures, setSelectedFailures] = useState(['noise', 'missing']);
    const [severity, setSeverity] = useState('medium');
    const [selectedCompareModels, setSelectedCompareModels] = useState([]);
    
    // Loaded data
    const [allModels, setAllModels] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    
    // Results
    const [report, setReport] = useState(null);
    const [compareResults, setCompareResults] = useState([]);

    // Fetch all models for comparative selection
    useEffect(() => {
        if (open) {
            fetchCompareModels();
            fetchHistory();
        }
    }, [open, modelDetails]);

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

        setLoading(true);
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
            setLoading(false);
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
                    color: ['#475569', '#dc2626']
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
                fillcolor: 'rgba(59, 130, 246, 0.08)',
                line: {
                    color: '#2563eb',
                    width: 1.5
                },
                marker: {
                    color: '#2563eb',
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
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="xl" 
            fullWidth 
            scroll="paper" 
            className="stress-dashboard-dialog"
            PaperProps={{
                style: {
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                    backgroundColor: '#f4f5f7',
                    padding: '24px',
                    fontFamily: 'Arial, sans-serif'
                }
            }}
        >
            <DialogContent style={{ padding: '0', backgroundColor: '#f4f5f7' }}>
                <div className="content">
                    
                    {/* BACK NAVIGATION */}
                    <Row style={{ marginBottom: "1rem" }}>
                        <Col>
                            <ReactStrapButton
                                onClick={onClose}
                                style={{
                                    marginTop: "0",
                                    marginBottom: "1rem",
                                    color: "black",
                                    backgroundColor: "#e4e6eb",
                                    border: "1px solid #cbd5e1"
                                }}
                            >
                                Go Back
                            </ReactStrapButton>
                        </Col>
                    </Row>

                    {/* PAGE TITLE */}
                    <Row style={{ marginBottom: "1rem" }}>
                        <Col>
                            <Typography variant="h5" component="h5" gutterBottom style={{ fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>
                                Model Stress Testing
                            </Typography>
                        </Col>
                    </Row>

                    {/* TOP INFORMATION CARD (Matching Details page ShortModelInfoComponent style exactly) */}
                    <Paper elevation={3}
                        style={{
                            padding: "1.5rem",
                            marginBottom: "2rem",
                            backgroundColor: "#ffffff",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1"
                        }}
                    >
                        <Typography style={{ fontFamily: 'Arial, sans-serif' }}>
                            <Row style={{ marginBottom: "0.5rem" }}>
                                <Col md="6">
                                    <strong>Dataset:</strong> {modelDetails.dataset_id}
                                </Col>
                                <Col md="6">
                                    <strong>Model ID:</strong> {modelDetails.model_id}
                                </Col>
                            </Row>
                            <Row style={{ marginBottom: "0.5rem" }}>
                                <Col md="6">
                                    <strong>Model Name:</strong> {modelDetails.model_name}
                                </Col>
                                <Col md="6">
                                    <strong>Model Type:</strong> {modelDetails.estimator_type}
                                </Col>
                            </Row>
                            <Row style={{ marginBottom: "0.5rem" }}>
                                <Col md="6">
                                    <strong>Training Mode:</strong> <Chip size="small" variant='outlined' label={modelDetails.training_mode} style={{ fontFamily: 'Arial, sans-serif' }} />
                                </Col>
                                <Col md="6">
                                    <strong>Objective:</strong> {modelDetails.objective}
                                </Col>
                            </Row>
                            <Row style={{ marginBottom: "0.5rem" }}>
                                <Col md="6">
                                    <strong>Target Column:</strong> {modelDetails.target_column}
                                </Col>
                                <Col md="6">
                                    <strong>Metric:</strong> {modelDetails.metric_type}
                                </Col>
                            </Row>
                        </Typography>
                    </Paper>

                    {/* TWO COLUMN CONTENT LAYOUT (Matching Update Model layout style exactly) */}
                    <Row>
                        
                        {/* LEFT COLUMN: CONFIGURATION */}
                        <Col md="6">
                            <Typography variant="h6" component="h6" gutterBottom style={{ fontWeight: '600', marginBottom: '1rem', fontFamily: 'Arial, sans-serif' }}>
                                Failure Settings
                            </Typography>
                            <Paper elevation={3} style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '2rem' }}>
                                
                                <Typography style={{ marginBottom: '1.5rem', fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#475569' }}>
                                    Select the failure types to inject and configure severity:
                                </Typography>

                                {/* Checkbox Rows resembling ChangeHyperparameters manual selection style */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <Row className="align-items-center mb-2">
                                        <Col md="1">
                                            <Checkbox 
                                                checked={selectedFailures.includes('noise')} 
                                                onChange={() => handleFailureChange('noise')} 
                                                size="medium"
                                            />
                                        </Col>
                                        <Col md="11">
                                            <Typography style={{ fontWeight: '600', fontSize: '14px', fontFamily: 'Arial, sans-serif' }}>Noise Injection</Typography>
                                            <Typography style={{ fontSize: '12px', color: '#64748b', fontFamily: 'Arial, sans-serif' }}>Gaussian perturbation emulation</Typography>
                                        </Col>
                                    </Row>

                                    <Row className="align-items-center mb-2">
                                        <Col md="1">
                                            <Checkbox 
                                                checked={selectedFailures.includes('missing')} 
                                                onChange={() => handleFailureChange('missing')} 
                                                size="medium"
                                            />
                                        </Col>
                                        <Col md="11">
                                            <Typography style={{ fontWeight: '600', fontSize: '14px', fontFamily: 'Arial, sans-serif' }}>Missing Values</Typography>
                                            <Typography style={{ fontSize: '12px', color: '#64748b', fontFamily: 'Arial, sans-serif' }}>Random cell removal</Typography>
                                        </Col>
                                    </Row>

                                    <Row className="align-items-center mb-2">
                                        <Col md="1">
                                            <Checkbox 
                                                checked={selectedFailures.includes('drift')} 
                                                onChange={() => handleFailureChange('drift')} 
                                                size="medium"
                                            />
                                        </Col>
                                        <Col md="11">
                                            <Typography style={{ fontWeight: '600', fontSize: '14px', fontFamily: 'Arial, sans-serif' }}>Feature Drift</Typography>
                                            <Typography style={{ fontSize: '12px', color: '#64748b', fontFamily: 'Arial, sans-serif' }}>Covariate distribution shift</Typography>
                                        </Col>
                                    </Row>

                                    <Row className="align-items-center mb-2">
                                        <Col md="1">
                                            <Checkbox 
                                                checked={selectedFailures.includes('outliers')} 
                                                onChange={() => handleFailureChange('outliers')} 
                                                size="medium"
                                            />
                                        </Col>
                                        <Col md="11">
                                            <Typography style={{ fontWeight: '600', fontSize: '14px', fontFamily: 'Arial, sans-serif' }}>Outlier Injection</Typography>
                                            <Typography style={{ fontSize: '12px', color: '#64748b', fontFamily: 'Arial, sans-serif' }}>Extreme spike perturbation</Typography>
                                        </Col>
                                    </Row>
                                </div>

                                {/* Severity Group (Using native Reactstrap button types) */}
                                <div style={{ marginTop: '20px' }}>
                                    <Typography style={{ fontWeight: '600', color: '#475569', fontSize: '13px', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'Arial, sans-serif' }}>
                                        Severity level
                                    </Typography>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <ReactStrapButton 
                                            color={severity === 'low' ? 'info' : 'secondary'} 
                                            style={{ color: severity === 'low' ? 'black' : 'white', fontSize: '13px', padding: '6px 18px', textTransform: 'none', fontWeight: '600' }}
                                            onClick={() => setSeverity('low')}
                                        >
                                            Low
                                        </ReactStrapButton>
                                        <ReactStrapButton 
                                            color={severity === 'medium' ? 'info' : 'secondary'} 
                                            style={{ color: severity === 'medium' ? 'black' : 'white', fontSize: '13px', padding: '6px 18px', textTransform: 'none', fontWeight: '600' }}
                                            onClick={() => setSeverity('medium')}
                                        >
                                            Medium
                                        </ReactStrapButton>
                                        <ReactStrapButton 
                                            color={severity === 'high' ? 'info' : 'secondary'} 
                                            style={{ color: severity === 'high' ? 'black' : 'white', fontSize: '13px', padding: '6px 18px', textTransform: 'none', fontWeight: '600' }}
                                            onClick={() => setSeverity('high')}
                                        >
                                            High
                                        </ReactStrapButton>
                                    </div>
                                </div>

                                {/* Model Comparison Selection */}
                                <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                                    <Typography style={{ fontWeight: '600', color: '#475569', fontSize: '13px', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'Arial, sans-serif' }}>
                                        Compare With Model
                                    </Typography>
                                    <FormControl fullWidth size="small">
                                        <Select
                                            multiple
                                            displayEmpty
                                            value={selectedCompareModels}
                                            onChange={handleCompareModelSelect}
                                            input={<OutlinedInput style={{ borderRadius: '6px', fontSize: '14px', fontFamily: 'Arial, sans-serif' }} />}
                                            renderValue={(selected) => {
                                                if (selected.length === 0) {
                                                    return <span style={{ color: '#94a3b8' }}>Select compatible models...</span>;
                                                }
                                                return selected.map(id => {
                                                    const model = allModels.find(m => m.model_id === id);
                                                    return model ? model.model_name : id;
                                                }).join(', ');
                                            }}
                                            MenuProps={{
                                                PaperProps: {
                                                    style: {
                                                        fontFamily: 'Arial, sans-serif'
                                                    }
                                                }
                                            }}
                                        >
                                            {allModels.map((m) => (
                                                <MenuItem key={m.model_id} value={m.model_id} style={{ fontSize: '13px', fontFamily: 'Arial, sans-serif' }}>
                                                    <Checkbox checked={selectedCompareModels.indexOf(m.model_id) > -1} size="small" />
                                                    <ListItemText 
                                                        primary={`${m.model_name} (${m.estimator_type})`} 
                                                        secondary={`Match: ${m.compatibility_score}% | Target: ${m.target_column}`}
                                                        primaryTypographyProps={{ fontSize: '13px', fontWeight: '500', fontFamily: 'Arial, sans-serif' }}
                                                        secondaryTypographyProps={{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }}
                                                    />
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </div>

                                <ReactStrapButton 
                                    color="info" 
                                    style={{ color: 'black', fontWeight: '600', fontSize: '14px', width: '100%', marginTop: '1.5rem', padding: '10px 0' }}
                                    onClick={runStressTest}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <CircularProgress size={18} style={{ color: 'black' }} />
                                    ) : (
                                        "Run Stress Test"
                                    )}
                                </ReactStrapButton>

                                {loading && (
                                    <Typography variant="body2" style={{ marginTop: '10px', textAlign: 'center', fontSize: '13px', color: '#64748b', fontStyle: 'italic', fontFamily: 'Arial, sans-serif' }}>
                                        {loadingStep}
                                    </Typography>
                                )}
                            </Paper>
                        </Col>
 
                        {/* RIGHT COLUMN: RESULTS */}
                        <Col md="6">
                            <Typography variant="h6" component="h6" gutterBottom style={{ fontWeight: '600', marginBottom: '1rem', fontFamily: 'Arial, sans-serif' }}>
                                Evaluation Report
                            </Typography>
                            
                            {/* RUNNING STATUS */}
                            {loading && (
                                <Paper elevation={3} style={{ minHeight: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '32px' }}>
                                    <CircularProgress size={36} thickness={4} style={{ color: '#1e293b' }} />
                                    <Typography style={{ marginTop: '14px', fontWeight: '600', color: '#1e293b', fontSize: '15px', fontFamily: 'Arial, sans-serif' }}>
                                        Evaluating Model Robustness...
                                    </Typography>
                                    <Typography style={{ maxWidth: '340px', margin: '6px auto 0', fontSize: '13px', color: '#64748b', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
                                        Running synthetic stress injections against dataset splits.
                                    </Typography>
                                </Paper>
                            )}

                            {/* EMPTY STATE DEFAULT */}
                            {!loading && !report && (
                                <Paper elevation={3} style={{ minHeight: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '32px' }}>
                                    <Typography style={{ fontWeight: '600', color: '#1e293b', marginBottom: '6px', fontSize: '15px', fontFamily: 'Arial, sans-serif' }}>
                                        No stress evaluation run yet
                                    </Typography>
                                    <Typography style={{ maxWidth: '380px', margin: '0 auto', fontSize: '13px', color: '#64748b', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
                                        Choose failure parameters and click "Run Stress Test" to view performance metrics.
                                    </Typography>
                                </Paper>
                            )}

                            {/* STRESS TEST REPORT VIEW */}
                            {!loading && report && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    
                                    {/* METRICS SUMMARY TABLE (Matching ShortModelInfoComponent metrics view exactly) */}
                                    <Paper elevation={3} style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                        <Typography style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '10px', fontFamily: 'Arial, sans-serif' }}>
                                            Robustness Summary Metrics
                                        </Typography>
                                        <ReactStrapTable striped style={{ margin: 0 }}>
                                            <tbody>
                                                <tr>
                                                    <td><strong>Baseline ({report.metric_type})</strong></td>
                                                    <td style={{ textAlign: 'right', fontWeight: '500' }}>{report.original_score.toFixed(4)}</td>
                                                </tr>
                                                <tr>
                                                    <td><strong>Degraded Score</strong></td>
                                                    <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 'bold' }}>{report.degraded_score.toFixed(4)}</td>
                                                </tr>
                                                <tr>
                                                    <td><strong>Robustness Index</strong></td>
                                                    <td style={{ textAlign: 'right', color: '#059669', fontWeight: 'bold' }}>{report.robustness_score.toFixed(1)}%</td>
                                                </tr>
                                                <tr>
                                                    <td><strong>Stability Rating</strong></td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {renderHistoryBadge(report.badge, report.badge_color)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </ReactStrapTable>
                                    </Paper>

                                    {/* Visual Chart Plots inside neat Papers */}
                                    <Row>
                                        <Col md="6">
                                            <Paper elevation={3} style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                                                <Typography style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Arial, sans-serif' }}>
                                                    Shift Comparison
                                                </Typography>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <Plot
                                                        data={getBarChartData()}
                                                        layout={{
                                                            width: 210,
                                                            height: 170,
                                                            margin: { t: 5, b: 20, l: 30, r: 5 },
                                                            showlegend: false,
                                                            font: { family: 'Arial, sans-serif', size: 10 },
                                                            yaxis: { gridcolor: '#f1f5f9' },
                                                            xaxis: { gridcolor: 'transparent' }
                                                        }}
                                                        config={{ displayModeBar: false }}
                                                    />
                                                </div>
                                            </Paper>
                                        </Col>
                                        <Col md="6">
                                            <Paper elevation={3} style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                                                <Typography style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Arial, sans-serif' }}>
                                                    Resilience Profile
                                                </Typography>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <Plot
                                                        data={getRadarChartData()}
                                                        layout={{
                                                            width: 210,
                                                            height: 170,
                                                            margin: { t: 20, b: 20, l: 20, r: 20 },
                                                            font: { family: 'Arial, sans-serif', size: 10 },
                                                            polar: {
                                                                radialaxis: { visible: true, range: [0, 100], gridcolor: '#e2e8f0' },
                                                                angularaxis: { gridcolor: '#e2e8f0' }
                                                            },
                                                            showlegend: false
                                                        }}
                                                        config={{ displayModeBar: false }}
                                                    />
                                                </div>
                                            </Paper>
                                        </Col>
                                    </Row>

                                    {/* COMPARISON SYSTEM */}
                                    {compareResults.length > 0 && (
                                        <Paper elevation={3} style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                            <Typography variant="subtitle2" style={{ fontWeight: '600', color: '#1e293b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontFamily: 'Arial, sans-serif' }}>
                                                <CompareArrowsIcon style={{ color: '#2563eb', fontSize: '18px' }} />
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
                                                        <tr key={idx} style={{ backgroundColor: r.model_id === modelDetails.model_id ? '#f8fafc' : 'transparent' }}>
                                                            <td style={{ fontSize: '13px', fontWeight: r.model_id === modelDetails.model_id ? '600' : '500' }}>
                                                                {r.model_name} {r.model_id === modelDetails.model_id ? '(Current)' : ''}
                                                            </td>
                                                            <td style={{ fontSize: '13px' }}>{r.estimator_type}</td>
                                                            <td style={{ fontSize: '13px' }}>{r.original_score.toFixed(4)}</td>
                                                            <td style={{ fontSize: '13px' }}>{r.degraded_score.toFixed(4)}</td>
                                                            <td style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>{r.robustness_score.toFixed(1)}%</td>
                                                            <td>
                                                                {renderHistoryBadge(r.badge, r.badge_color)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </ReactStrapTable>
                                        </Paper>
                                    )}

                                </div>
                            )}
                        </Col>

                    </Row>

                    {/* RECENT RUNS SECTION (Visual match with Model details versions table) */}
                    <Row style={{ marginTop: '2rem' }}>
                        <Col md="12">
                            <Typography variant="h6" component="h6" gutterBottom style={{ fontWeight: '600', marginBottom: '1rem', fontFamily: 'Arial, sans-serif' }}>
                                Recent Runs
                            </Typography>
                            <Paper elevation={3} style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                {loadingHistory ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
                                        <CircularProgress size={18} />
                                    </div>
                                ) : history.length === 0 ? (
                                    <Typography style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: '#64748b', fontStyle: 'italic', fontFamily: 'Arial, sans-serif' }}>
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
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ fontWeight: '500', color: '#1e293b' }}>
                                                                    {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                <span style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                                                                    Run ID: #{runId}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td style={{ color: '#475569', fontSize: '13px' }}>
                                                            {h.failure_types.join(', ')}
                                                        </td>
                                                        <td style={{ textTransform: 'capitalize', fontWeight: '500', color: '#475569' }}>{h.severity}</td>
                                                        <td style={{ textAlign: 'right', color: '#475569' }}>{h.original_score.toFixed(4)}</td>
                                                        <td style={{ textAlign: 'right', color: h.badge_color === 'red' ? '#991b1b' : h.badge_color === 'yellow' ? '#854d0e' : '#475569' }}>{h.degraded_score.toFixed(4)}</td>
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
                            </Paper>
                        </Col>
                    </Row>

                </div>
            </DialogContent>
        </Dialog>
    );
};

export default StressTestModal;
