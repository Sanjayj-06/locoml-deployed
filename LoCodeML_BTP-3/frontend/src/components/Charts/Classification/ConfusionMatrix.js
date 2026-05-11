import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@mui/material";
import { ResponsiveLine } from "nivo/lib/components/charts/line";
import Plot from "react-plotly.js";

const ConfusionMatrix = (props) => {
    console.log(props)
    const cm = props.cm;
    const output_mapping = props.output_mapping;

    const text = cm.map(row => row.map(value => String(value)))
    const numClasses = cm.length
    const rowSums = cm.map(row => row.reduce((sum, value) => sum + value, 0));
    const colSums = cm.reduce((sums, row) => row.map((value, i) => sums[i] + value), new Array(numClasses).fill(0));

    const data = [{
        z: cm,
        x: Object.values(output_mapping),
        y: Object.values(output_mapping),
        type: 'heatmap',
        colorscale: 'YlGnBu',
        reversescale: true,
        text: text,
        hoverTemplate: '%{y} | %{x}: %{z}<extra></extra>',
    }];

    const layout = {
        title: 'Confusion Matrix',
        xaxis: {
            title: `Predicted Class (Class Counts = ${colSums.join(', ')})`,
        },
        yaxis: {
            title: `True Class (Class Counts = ${rowSums.join(', ')})`,
        },
        autosize: true,
        width: '500'
    };

    return (
        <div>
            <Plot
                data={data}
                layout={layout}
            />
        </div>
    )

}

export default ConfusionMatrix;