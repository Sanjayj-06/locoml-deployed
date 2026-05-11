import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@mui/material";
import { ResponsiveLine } from "nivo/lib/components/charts/line";
import Plot from "react-plotly.js";

const FeatureImportance = (props) => {

    const fi = props.fi;

    const sortedFi = fi.feature_importance.map((value, index) => ({
        value,
        name: fi.feature_names[index]
    })).sort((a, b) => b.value - a.value);

    const topFeatures = sortedFi.slice(0, 10).map(item => item.name);
    const topImportance = sortedFi.slice(0, 10).map(item => item.value);
    console.log(topFeatures, topImportance)
    const data = [{
        x: topFeatures,
        y: topImportance,
        type: 'bar',
    }];

    const layout = {
        title: 'Top 10 Features by Importance',
        xaxis: {
            title: 'Feature Name'
        },
        yaxis: {
            title: 'Importance'
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

export default FeatureImportance;