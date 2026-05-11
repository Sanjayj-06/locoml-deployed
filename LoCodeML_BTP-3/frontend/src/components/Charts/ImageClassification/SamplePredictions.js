import React, { useEffect, useRef } from 'react';
import { Paper, Typography, Grid, Card, CardContent } from '@mui/material';

function SamplePredictionCard({ prediction, index }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const renderImage = (imageArray) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            const size = imageArray.length; // Get the size of one dimension (assuming square image)
            
            // Set canvas size to match image dimensions
            canvas.width = size;
            canvas.height = size;
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Create ImageData
            const imageData = ctx.createImageData(size, size);
            
            // Fill pixel data
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const pixelIndex = (y * size + x) * 4;
                    // Get pixel value and invert it since MNIST uses white on black
                    const value = 255 - (imageArray[y][x] * 255);
                    imageData.data[pixelIndex] = value;     // R
                    imageData.data[pixelIndex + 1] = value; // G
                    imageData.data[pixelIndex + 2] = value; // B
                    imageData.data[pixelIndex + 3] = 255;   // A
                }
            }

            // Put the image data on the canvas
            ctx.putImageData(imageData, 0, 0);
        };

        renderImage(prediction.image);
    }, [prediction.image]);

    const isCorrect = prediction.true_label === prediction.predicted_label;

    return (
        <Grid item xs={12} sm={6} md={4} key={index}>
            <Card>
                <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', backgroundColor: '#fff' }}>
                    <canvas
                        ref={canvasRef}
                        style={{
                            width: '150px',
                            height: '150px',
                            imageRendering: 'pixelated'
                        }}
                    />
                </div>
                <CardContent>
                    <Typography variant="body2" color={isCorrect ? "success.main" : "error.main"}>
                        Predicted: {prediction.predicted_label}
                    </Typography>
                    <Typography variant="body2">
                        Actual: {prediction.true_label}
                    </Typography>
                    {!isCorrect && (
                        <Typography variant="body2" color="error">
                            Incorrect Prediction
                        </Typography>
                    )}
                </CardContent>
            </Card>
        </Grid>
    );
}

function SamplePredictions({ predictions_data }) {
    if (!predictions_data) return null;

    return (
        <Paper elevation={3} style={{ padding: '1rem', marginBottom: '1rem' }}>
            <Typography variant="h6" gutterBottom>Sample Predictions</Typography>
            <Grid container spacing={2}>
                {predictions_data.map((prediction, index) => (
                    <SamplePredictionCard 
                        key={index}
                        prediction={prediction} 
                        index={index}
                    />
                ))}
            </Grid>
        </Paper>
    );
}

export default SamplePredictions;