import React from 'react';
import { Line } from 'react-chartjs-2';
import { Paper, Typography } from '@mui/material';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

function TrainingHistory({ history_data }) {
    if (!history_data || !history_data.accuracy) return null;

    console.log(history_data);

    const data = {
        labels: Array.from({ length: history_data.accuracy.length }, (_, i) => i + 1),
        datasets: [
            {
                label: 'Training Accuracy',
                data: history_data.accuracy,
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                fill: false,
                tension: 0.1
            },
            {
                label: 'Validation Accuracy',
                data: history_data.val_accuracy,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                fill: false,
                tension: 0.1
            },
            {
                label: 'Training Loss',
                data: history_data.loss,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: false,
                tension: 0.1,
                yAxisID: 'y1'
            },
            {
                label: 'Validation Loss',
                data: history_data.val_loss,
                borderColor: 'rgba(255, 159, 64, 1)',
                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                fill: false,
                tension: 0.1,
                yAxisID: 'y1'
            }
        ]
    };

    const options = {
        responsive: true,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Training History'
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Accuracy'
                },
                min: 0,
                max: 1
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                    display: true,
                    text: 'Loss'
                },
                grid: {
                    drawOnChartArea: false,
                },
            },
            x: {
                title: {
                    display: true,
                    text: 'Epoch'
                }
            }
        }
    };

    return (
        <Paper elevation={3} style={{ padding: '1rem', marginBottom: '1rem' }}>
            <Typography variant="h6" gutterBottom>Training History</Typography>
            <Line data={data} options={options} />
        </Paper>
    );
}

export default TrainingHistory;