import Plot from "react-plotly.js";

const ResidualPlot = (props) => {

    const residual_plot_data = props.residual_plot_data;
    const y_pred = residual_plot_data.y_pred;

    const y_residuals = residual_plot_data.residuals;

    // console.log(y_residuals)

    const scatterPlotData = {
        x: y_pred,
        y: y_residuals,
        type: 'scatter',
        mode: 'markers',
        name: 'Residuals',
    };

    const histogramData = {
        y: y_residuals,
        type: 'histogram',
        name: 'Residual Distribution',
        nbinsx: 50,
        xaxis: 'x2',
        yaxis: 'y'
    };

    const layout = {
        title: 'Residual Analysis',
        grid: {
            rows: 1, columns: 2,
            subplots: [['xy', 'x2y']],
        },
        xaxis: { title: 'Predicted Values', domain: [0, 0.7] },
        yaxis: { title: 'Residuals' },
        xaxis2: { title: 'Distribution', domain: [0.8, 1]},
        legend : {
            x : 1,
            y: 1,

        }
    };

    const figure = {
        data: [histogramData, scatterPlotData],
        layout: layout,
    };

    return (
        <div>
            <Plot
                data={figure.data}
                layout={figure.layout}
            />
        </div>
    )
}

export default ResidualPlot;