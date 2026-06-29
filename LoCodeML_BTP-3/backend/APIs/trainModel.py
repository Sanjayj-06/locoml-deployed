from flask import Blueprint, current_app, request
from flask_sse import sse
import time
import subprocess
import sys
import pickle 
import os
import json
import itertools
from tqdm import tqdm
import requests
import bson.json_util as json_util
 
trainModelAPIs = Blueprint('trainModel', __name__)

@trainModelAPIs.route('/trainModel', methods=['GET', 'POST'])
def trainModel():
    print("hit")
    data = request.get_json()
    dataset_id = data['dataset_id']
    model_name = data['model_name']
    if 'target_column' in data:
        target_column = data['target_column']
    else:
        target_column = None
    if 'input_type' in data:
        input_type = data['input_type']
    else:
        input_type = None
    objective = data['objective']
    metric_mode = data['metric_mode']
    metric_type = data['metric_type']
    training_mode = data['training_mode']
    model_type = data['model_type']
    isUpdate = data['isUpdate']

    # check if hyperparameters are provided

    if isUpdate.lower() != 'true':
        hyperparameters = 'None'
        model_id = 'None'
    else:
        if 'hyperparameters' in data:
            hyperparameters = json.dumps(data['hyperparameters'])
        else:
            hyperparameters = 'None'
        model_id = data['model_id']

    usecase = data.get('usecase', '')
    visibility = data.get('visibility', 'Public')

    # if metric_type.lower() != 'autoselect':
    #     metric_type = data['custom_metric_type']

    if training_mode.lower() == 'automl':
        process_path = os.getenv('PROJECT_PATH') + 'functions/trainModelAutoML.py'
    else:
        process_path = os.getenv('PROJECT_PATH') + 'functions/trainModelCustom.py'
    
    process = subprocess.Popen(['python3.12', '-u', process_path, dataset_id, model_name, model_type, hyperparameters, target_column, metric_mode, metric_type, objective, model_id, isUpdate, usecase, visibility], stderr=subprocess.PIPE, bufsize=1, text=True)

    status = 'Loading'
    current_model = 'Initialising'
    progress_percent = 0
    estimated_time_left = 'Calculating'

    while True:
        output = process.stderr.readline()
        print(output)
        if process.poll() is not None:
            break

        if output:
            # print(output)
            if output.find('Status: ') != -1:
                status = output[output.find('Status: ')+8:output.find('Current Classifier: ')]
                status = status.strip()
                print(status)

            if output.find("Current Classifier: ") != -1:
                current_model = output[output.find("Current Classifier: ")+20:output.find("Processing: ")]
                current_model = current_model.strip()
                print(current_model)

            if output.find("Processing: ") != -1:
                progress_percent = output[output.find("Processing: ")+12:output.find("Processing: ")+15]
                progress_percent = int(progress_percent.strip())
                print(progress_percent)

            if output.find("<") != -1:
                idx = output.find("<")
                time_left = output[idx+1:idx+6]
                if time_left[0] == '?':
                    estimated_time_left = 'Calculating'
                else:
                    # convert it to mins and secs from MM:SS format
                    estimated_time_left = ''
                    # print("time_left", time_left)
                    # check if time_left[:2] can be converted to int
                    if time_left[:2].isdigit() == False:
                        estimated_time_left = 'Calculating'
                        continue
                    
                    if int(time_left[:2]) > 0:
                        estimated_time_left = str(int(time_left[:2])) + ' mins '
                    estimated_time_left += str(int(time_left[3:])) + ' secs'
                print(estimated_time_left)
            
            if training_mode.lower() != 'automl':
                current_model = model_type
                
            sse.publish({
                'progress': progress_percent,
                'model': current_model,
                'status': status,
                'estimated_time_left': estimated_time_left
            }, channel='mychannel')

    
    details_path = os.getenv('PROJECT_PATH') + 'Usage/details.pkl'
    with open(details_path, 'rb') as f:
        details = pickle.load(f)
    print(type(details))
    return json_util.dumps(details)

# @trainModelAPIs.route('/hyperparameterTuning', methods=['GET', 'POST'])
# def hyperparameterTuning():
#     data = request.get_json()
#     dataset_id = data['dataset_id']
#     model_name = data['model_name']
#     target_column = data['target_column']
#     objective = data['objective']
#     metric_mode = data['metric_mode']
#     metric_type = data['metric_type']
#     training_mode = data['training_mode']
#     model_type = data['model_type']
#     hyperparameter_grid = data['hyperparameter_grid']
#     model_id = data['model_id']

#     # make combinations of hyperparameters
#     hyperparameters = []
#     keys = []
#     for key in hyperparameter_grid:
#         keys.append(key)
#         hyperparameters.append(hyperparameter_grid[key])

#     hyperparameters = list(itertools.product(*hyperparameters))

#     hyperparameters_dict = []
#     for hyperparameter in hyperparameters:
#         hyperparameters_dict.append(dict(zip(keys, hyperparameter)))

#     pbar = tqdm(hyperparameters_dict)
    
#     best_hyperparameters = None
#     best_metric = None

#     for hyperparameter in pbar:
#         pbar.set_description("Processing %s" % hyperparameter)
        
#         response = requests.post('http://main:5000/trainModel', json={
#             'dataset_id': dataset_id,
#             'model_name': model_name,
#             'target_column': target_column,
#             'objective': objective,
#             'metric_mode': metric_mode,
#             'metric_type': metric_type,
#             'training_mode': training_mode,
#             'model_type': model_type,
#             'hyperparameters': hyperparameter,
#             'model_id': model_id
#         })

#         cur_metric = response.json()['evaluation_metrics'][metric_type.lower()]
#         cur_metric = float(cur_metric)
        
#         if best_metric == None or cur_metric > best_metric:
#             best_metric = cur_metric
#             best_hyperparameters = hyperparameter

    
    
    