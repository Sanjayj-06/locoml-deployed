const express = require('express');
const path = require('path');
const app = express();
const port = 3001;
cors = require('cors');

app.use(cors());

// API endpoint to fetch the CSV dataset
app.get('/api/model', (req, res) => {
  const filePath = path.join(__dirname, 'model_details.json');
  res.setHeader('Content-Type', 'text/json');
  res.sendFile(filePath);
});

// Start the server
app.listen(port, () => {
  console.log(`Dummy API is running at http://localhost:${port}`);
});