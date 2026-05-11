import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@mui/material";
import Plot from "react-plotly.js";

const PrecisionRecall = (props) => {

    const pr_data = props.pr_data;
    const precision_values = pr_data['precision'][0];
    const recall_values = pr_data['recall'][0];

    const data = [
        {
            x: recall_values,
            y: precision_values,
            mode: 'lines',
            type: 'scatter',
            line: {
                color: 'orange',
            },
            name: 'Precision Recall Curve',
        },
    ]

    var layout = {

        title: 'Precision Recall Curve',

        xaxis: {
            title: 'Recall',
        },
        yaxis: {
            title: 'Precision',
        },
        legend: {
            x: 1,
            y: 1,
        },
        autosize: true,
        width: 500
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

export default PrecisionRecall;