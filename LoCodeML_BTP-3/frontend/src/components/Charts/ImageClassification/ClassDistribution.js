import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Paper, Typography } from '@mui/material';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

function ClassDistribution({ distribution_data }) {
    if (!distribution_data || !distribution_data.counts || !distribution_data.labels) return null;

    const data = {
        labels: distribution_data.labels,
        datasets: [{
            label: 'Number of Samples',
            data: distribution_data.counts,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }]
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Class Distribution'
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Number of Samples'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Class Label'
                }
            }
        }
    };

    return (
        <Paper elevation={3} style={{ padding: '1rem', marginBottom: '1rem' }}>
            <Typography variant="h6" gutterBottom>Class Distribution</Typography>
            <Bar data={data} options={options} />
        </Paper>
    );
}

export default ClassDistribution;