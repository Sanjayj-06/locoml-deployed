import React, { useState, useEffect } from "react";
import { Table } from "reactstrap";
import Papa from "papaparse";

function CSVDisplay() {
  const [parsedCsvData, setParsedCsvData] = useState([]);

  useEffect(() => {
    fetch('./archive/adult.csv')
      .then(response => response.text())
      .then(text => {
        const parsedData = Papa.parse(text, { header: true });
        setParsedCsvData(parsedData.data.slice(0,5));
        console.log('text', parsedCsvData);
      });
  }, []);

  return (
    <div className="content">
      <div style={{ overflowX: 'auto' }}>
        <Table>
          <thead>
            {parsedCsvData.length > 0 && (
              <tr>
                {Object.keys(parsedCsvData[0]).map((header, index) => (
                  <th key={index}>{header}</th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {parsedCsvData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {Object.values(row).map((cellValue, cellIndex) => (
                  <td key={cellIndex}>{cellValue}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export default CSVDisplay;
