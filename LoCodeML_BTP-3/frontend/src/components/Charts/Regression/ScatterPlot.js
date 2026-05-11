import Plot from "react-plotly.js";

const ScatterPlot = (props) => {

    const scatter_plot_data = props.scatter_plot_data;
    const y_true = scatter_plot_data.y_true;

    const y_pred = scatter_plot_data.y_pred;

    const data = [
        {
            x: y_true,
            y: y_pred,
            mode: 'markers',
            type: 'scatter',
            marker: {
                color: 'orange',
            },
            name: 'Scatter Plot',
        },
    ]

    var layout = {

        title: 'Scatter Plot',

        xaxis: {
            title: 'True Values'
        },
        yaxis: {
            title: 'Predicted Values',
        },
        legend: {
            x: 1,
            y: 1,
        },
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

export default ScatterPlot;