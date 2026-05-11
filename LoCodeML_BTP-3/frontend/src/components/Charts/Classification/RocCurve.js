import { useEffect, useState } from "react";
import axios from "axios";
import Plot from "react-plotly.js";

const RocCurve = (props) => {

    const auc_data = props.auc_data;

    const fprData = auc_data['fpr'][0];
    const tprData = auc_data['tpr'][0];
    const thresholdsData = auc_data['thresholds'][0];
    const rocAuc = auc_data['auc'][0];

    const getXY = () => {
        let x = []
        let y = []
        for (let i = 0; i < fprData.length; i++) {
            x.push(fprData[i])
            y.push(tprData[i])
        }
        return [x, y]
    }

    const data = [
        {
            x: getXY()[0],
            y: getXY()[1],
            mode: 'lines',
            type: 'scatter',
            line: {
                color: 'orange',
            },
            name: 'ROC curve',
        },
        {
            x: [0, 1],
            y: [0, 1],
            mode: 'lines',
            type: 'scatter',
            name: 'baseline',
            line: {
                dash: 'dashdot',
                color: 'blue',
            },
        },
    ]

    var layout = {
        title: 'Receiver Operating Characteristic Curve',
        xaxis: {
            title: 'False Positive Rate',
        },
        yaxis: {
            title: 'True Positive Rate',
        },
        legend : {
            x : 1,
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
                config={{ responsive: true }}
            />
        </div>
    )

}

export default RocCurve;