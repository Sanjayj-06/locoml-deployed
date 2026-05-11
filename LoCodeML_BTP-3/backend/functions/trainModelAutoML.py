from ClassificationUtility import ClassificationUtility
from RegressionUtility import RegressionUtility
from ImageClassificationUtility import ImageClassificationUtility
from Sentiment_new import SentimentAnalysisUtility_1
import pandas as pd
import datetime
import pickle
import nanoid
import os
import sys
import json
import zipfile
from datasets import load_from_disk
from icecream import ic

project_path = os.getenv('PROJECT_PATH')
sys.path.append(project_path)
from mongoDB import db
sys.path.append('../Enums/')
from Enums.enums import ClassificationMetrics, RegressionMetrics, ImageClassificationMetrics, SentimentAnalysisMetrics


def trainModelAutoML(dataset_id, model_name, target_column, metric_mode, metric_type, objective):
    
    print("Entered AUTOML",flush=True)
    if metric_mode.lower() == 'autoselect':
        if objective.lower() == 'classification':
            dataset_path = os.getenv('PROJECT_PATH') + 'Datasets/'+dataset_id+'.csv'
            df = pd.read_csv(dataset_path)
            class_dist = df[target_column].value_counts()
            is_balanced = class_dist.min() / class_dist.max() > 0.5

            if is_balanced:
                metric_type = ClassificationMetrics.Accuracy.value
            else:
                metric_type = ClassificationMetrics.AUC.value

        elif objective.lower() == 'regression':
            dataset_path = os.getenv('PROJECT_PATH') + 'Datasets/'+dataset_id+'.csv'
            df = pd.read_csv(dataset_path)
            metric_type = RegressionMetrics.R2.value
        elif objective.lower() == 'imageclassification':
            dataset_path = os.getenv('PROJECT_PATH') + 'Datasets/'+dataset_id+'.zip'
            if not os.path.exists(os.getenv('PROJECT_PATH') + 'ExtractedDatasets/'+dataset_id):
                with zipfile.ZipFile(dataset_path, 'r') as zip_ref:
                    zip_ref.extractall(os.getenv('PROJECT_PATH') + 'ExtractedDatasets/'+ dataset_id)
            dataset_path = os.getenv('PROJECT_PATH') + 'ExtractedDatasets/'+ dataset_id
            dataset = load_from_disk(dataset_path)
            metric_type = ImageClassificationMetrics.Accuracy.value

    ic(objective.lower())
    if objective.lower() == 'classification':
        clf_util = ClassificationUtility(df, target_column, 'AutoML', None, metric_type)
    elif objective.lower() == 'regression':
        clf_util = RegressionUtility(df, target_column, 'AutoML', None, metric_type)
    elif objective.lower() == 'sentiment':
        clf_util = SentimentAnalysisUtility_1(df, target_column, 'AutoML', None, metric_type)
    elif objective.lower() == 'imageclassification':
        clf_util = ImageClassificationUtility(dataset, target_column, 'AutoML', None, metric_type, dataset_id=dataset_id)

    

    clf_util.trainAutoML()
    results = clf_util.results

    if objective.lower() == 'classification':
        best_model_name = clf_util.getBestModel(metric_type)['classifier']
        print("HELLLOOOO", type(best_model_name), clf_util.getBestModel(metric_type))
        model_parameters = clf_util.trained_models[best_model_name]['classifier'].get_params()
        print("MODEL PARAMS", model_parameters, type(model_parameters))
    elif objective.lower() == 'sentiment':
        best_model_name = clf_util.getBestModel(metric_type)['sentiment_model']
        print("DEBUG: Sentiment - Best Model Name:", best_model_name, file=sys.stderr)
        model_parameters = clf_util.get_params()
        print("DEBUG: Sentiment - Model Parameters:", model_parameters, file=sys.stderr)
    elif objective.lower() == 'imageclassification':
        print("DEBUG: Starting Image Classification model extraction", file=sys.stderr)
        best_model = clf_util.getBestModel(metric_type)
        print("DEBUG: Image Classification - Full Best Model Object:", best_model, file=sys.stderr)
        best_model_name = best_model['classifier']
        print("DEBUG: Image Classification - Best Model Name:", best_model_name, file=sys.stderr)
        model_parameters = clf_util.get_params()
        print("DEBUG: Image Classification - Model Parameters:", model_parameters, file=sys.stderr)
    else:
        best_model_name = clf_util.getBestModel(metric_type)['regressor']
        model_parameters = clf_util.trained_models[best_model_name]['regressor'].get_params()
    
    metrics = []
    for metric in results.columns:
        if metric == 'Classifier' or metric.lower() == 'regressor' or metric.lower() == 'sentiment_model' or metric.lower() == 'classifier':
            continue
        metrics.append({
            'metric_name' : metric,
            'metric_value' : results.iloc[0][metric],
        })

    # Convert results DataFrame to proper format for MongoDB
    results_list = []
    for idx, row in results.iterrows():
        row_dict = {}
        for col in results.columns:
            row_dict[col] = str(row[col])
        results_list.append(row_dict)

    parameters = []
    for key, value in model_parameters.items():
        if value == None:
            value = 'None'
        parameters.append({
            'parameter_name' : key,
            'parameter_value' : value
        })

    print("Status: Saving Model and Pipeline in file system", file=sys.stderr)
    model_id = nanoid.generate(alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', size=6)
    save_path = os.getenv('PROJECT_PATH') + 'Models/' + model_id + '.pkl'
    clf_util.saveModel(best_model_name, save_path)
    # print("Transformation Pipeline and Model Successfully Saved", file=sys.stderr)
    
    input_schema = clf_util.get_input_schema()
    output_schema = clf_util.get_output_schema()
    output_mapping = clf_util.get_output_mapping()

    print("Status: Generating Visualization data", file=sys.stderr)

    graph_data = {}
    if objective.lower() == 'classification':
        print("Status: Generating Confusion Matrix", file=sys.stderr)
        cm = clf_util.get_confusion_matrix()
        print("Status: Generating Feature Importance", file=sys.stderr)
        feature_importance = clf_util.get_feature_importance()
        print("Status: Generating Precision-Recall Curve", file=sys.stderr)
        pr_data = clf_util.get_precision_recall_data()
        print("Status: Generating ROC Curve", file=sys.stderr)
        auc_data = clf_util.get_auc_data()
        graph_data = {
            'confusion_matrix' : cm,
            'feature_importance' : feature_importance,
            'precision_recall_data' : pr_data,
            'auc_data' : auc_data
        }
    elif objective.lower() == 'sentiment':
        print("Status: Generating Confusion Matrix", file=sys.stderr)
        cm = clf_util.get_confusion_matrix()
        graph_data = {
            'confusion_matrix' : cm,
        }
    elif objective.lower() == 'imageclassification':
        print("DEBUG: Starting Image Classification visualization generation", file=sys.stderr)
        print("Status: Generating Confusion Matrix", file=sys.stderr)
        try:
            cm = clf_util.get_confusion_matrix()
            print("DEBUG: Confusion Matrix generated successfully:", cm, file=sys.stderr)
        except Exception as e:
            print("DEBUG: Error generating confusion matrix:", str(e), file=sys.stderr)
            cm = None

        print("Status: Generating Class Distribution", file=sys.stderr)
        try:
            class_dist = clf_util.get_class_distribution()
            print("DEBUG: Class Distribution generated successfully:", class_dist, file=sys.stderr)
        except Exception as e:
            print("DEBUG: Error generating class distribution:", str(e), file=sys.stderr)
            class_dist = None

        print("Status: Generating Sample Predictions", file=sys.stderr)
        try:
            sample_preds = clf_util.get_sample_predictions()
            print("DEBUG: Sample Predictions generated successfully:", sample_preds, file=sys.stderr)
        except Exception as e:
            print("DEBUG: Error generating sample predictions:", str(e), file=sys.stderr)
            sample_preds = None

        print("Status: Generating Training History", file=sys.stderr)
        try:
            training_history = clf_util.get_training_history()
            print("DEBUG: Training History generated successfully:", training_history, file=sys.stderr)
        except Exception as e:
            print("DEBUG: Error generating training history:", str(e), file=sys.stderr)
            training_history = None

        graph_data = {
            'confusion_matrix': cm,
            'class_distribution': class_dist,
            'sample_predictions': sample_preds,
            'training_history': training_history
        }
        print("DEBUG: Final graph_data for Image Classification:", graph_data, file=sys.stderr)
    else:
        print("Status: Generating Feature Importance", file=sys.stderr)
        feature_importance = clf_util.get_feature_importance()
        print("Status: Generating Scatter Plot", file=sys.stderr)
        scatter_plot_data = clf_util.get_scatter_plot_data()
        print("Status: Generating Residual Plot", file=sys.stderr)
        residual_plot_data = clf_util.get_residual_plot_data()
        graph_data = {
            'feature_importance' : feature_importance,
            'scatter_plot_data' : scatter_plot_data,
            'residual_plot_data' : residual_plot_data
        }


    print("Status: Saving Model Metadata in database", file=sys.stderr)
    
    collection = db['Model_zoo']

    details = {
        'time' : datetime.datetime.now(),
        'model_id' : model_id,
        'model_name' : model_name,
        'training_mode' : 'AutoML',
        'estimator_type' : best_model_name,
        'metric_mode' : metric_mode,
        'metric_type' : metric_type,
        'saved_model_path' : save_path,
        'dataset_id' : dataset_id,
        'objective' : objective,
        'target_column' : target_column,
        'parameters' : parameters,
        'evaluation_metrics' : metrics,
        'all_models_results' : results.to_dict('records'),
        'input_schema' : input_schema,
        'output_schema' : output_schema,
        'output_mapping' : output_mapping,
        'graph_data' : graph_data,
        'versions' : [{
            'time' : datetime.datetime.now(),
            'model_id' : model_id,
            'model_name' : model_name,
            'estimator_type' : best_model_name,
            'saved_model_path' : save_path,
            'parameters' : parameters,
            'evaluation_metrics' : metrics,
            'output_mapping' : output_mapping,
            'graph_data' : graph_data,
            'version_number' : 1
        }]
    }

    
    collection.insert_one(details)
    details.pop('_id')
    return details

dataset_id = sys.argv[1]
model_name = sys.argv[2]
model_type = sys.argv[3] # not needed in automl
hyperparameters = sys.argv[4] # not needed while training for first time
target_column = sys.argv[5]
metric_mode = sys.argv[6]
metric_type = sys.argv[7]
objective = sys.argv[8]
model_id = sys.argv[9] # not needed in automl
isUpdate = sys.argv[10] # not needed in automl

ic(dataset_id, model_name, model_type, hyperparameters, target_column, metric_mode, metric_type, objective, model_id)

details = trainModelAutoML(dataset_id, model_name, target_column, metric_mode, metric_type, objective)
details_path = os.getenv('PROJECT_PATH') + 'Usage/details.pkl'
with open(details_path, 'wb') as f:
    pickle.dump(details, f)