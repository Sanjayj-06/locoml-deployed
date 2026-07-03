from mongoDB import db
from flask import Blueprint, request, send_file
import os
import sys
import inspect
import sklearn
import requests
import bson.json_util as json_util
import pandas as pd
import nanoid
from datetime import datetime
sys.path.append(os.getenv('PROJECT_PATH', ''))
sys.path.append('../')

from Enums import enums
updateModelAPIs = Blueprint('updateModelAPIs', __name__)

@updateModelAPIs.route('/trainOnMoreData', methods=['GET', 'POST'])
def trainOnMoreData():
    print("hit")

    # original_dataset_id = request.json['original_dataset_id']
    # new_dataset_file = request.json['file']
    # modelDetails = request.json['model_details']

    original_dataset_id = request.form['original_dataset_id']
    new_dataset_file = request.files['file']
    # modelDetails = request.form['model_details']

    # modelDetails = json_util.loads(modelDetails)

    # load the json string into a dictionary
    # modelDetails = json_util.loads(modelDetails)
    
    new_dataset_id = nanoid.generate(alphabet='0123456789', size=5)
    response = requests.get('http://main:5000/getDatasets/'+original_dataset_id)
    # return {}
    response2 = requests.get('http://main:5000/getDatasetInfo/'+original_dataset_id)
    
    response2 = response2.json()
    csv_content = response.content.decode('utf-8')
    original_dataset_path = os.getenv('PROJECT_PATH') + 'Datasets/' + original_dataset_id + '.csv'
    df = pd.read_csv(original_dataset_path)
    # return {}
    print("This is the new dataset file", new_dataset_file)
    df2 = pd.read_csv(new_dataset_file)
    # concatenate the two dataframes
    df = pd.concat([df, df2])
    # return {}
    # # print(response2)
    dataset_path = os.getenv('PROJECT_PATH') + 'Datasets/' + new_dataset_id + '.csv'
    df.to_csv(dataset_path, index=False)
    dataset_size = os.path.getsize(os.getenv('PROJECT_PATH') + 'Datasets/' + new_dataset_id + '.csv')
    collection = db['Datasets']

    collection.insert_one({
        'time' : datetime.now(),
        'dataset_id': new_dataset_id,
        'dataset_size' : str(dataset_size),
        'dataset_name': response2['dataset_name'] + ' extended',
        'dataset_path': dataset_path,
    })

    print("hrrreeeee")

    # # request.form = json_util.loads(request.form)

    response = requests.post('http://main:5000/trainModel', json={
        'dataset_id': new_dataset_id,
        'model_name': request.form['model_name'],
        'target_column': request.form['target_column'],
        'objective': request.form['objective'],
        'metric_mode': request.form['metric_mode'],
        'metric_type': request.form['metric_type'],
        'training_mode': 'Custom',
        'model_type': request.form['model_type'],
        'model_id': request.form['model_id'],
        'isUpdate': 'True',
    })

    response_dict = response.json()
    return json_util.dumps(response_dict)


@updateModelAPIs.route('/changeHyperparameters', methods=['POST'])
def changeHyperparameters():
    model_details = request.json['model_details']
    new_hyperparameters = request.json['new_hyperparameters']

    dataset_id = model_details['dataset_id']
    model_id = model_details['model_id']
    model_name = model_details['model_name']
    target_column = model_details['target_column']
    objective = model_details['objective']
    metric_mode = model_details['metric_mode']
    metric_type = model_details['metric_type']
    training_mode = 'Custom'
    model_type = model_details['estimator_type']
    model_id = model_details['model_id']

    print("hrrreeeee")


    response = requests.post('http://main:5000/trainModel', json={
        'dataset_id': dataset_id,
        'model_name': model_name,
        'target_column': target_column,
        'objective': objective,
        'metric_mode': metric_mode,
        'metric_type': metric_type,
        'training_mode': training_mode,
        'model_type': model_type,
        'hyperparameters': new_hyperparameters,
        'model_id': model_id,
        'isUpdate': 'True',
    })

    response_dict = response.json()
    print("Response")
    # print type of response
    print("Type pf response:")
    print(type(response_dict))
    print("\n\n")
    # print(response_dict)
    return json_util.dumps(response_dict)

@updateModelAPIs.route('/changeEstimatorType', methods=['POST'])
def changeEstimatorType():
    model_details = request.json['model_details']
    new_hyperparameters = request.json['new_hyperparameters']
    model_type = request.json['estimator_type']

    dataset_id = model_details['dataset_id']
    model_id = model_details['model_id']
    model_name = model_details['model_name']
    target_column = model_details['target_column']
    objective = model_details['objective']
    metric_mode = model_details['metric_mode']
    metric_type = model_details['metric_type']
    training_mode = 'Custom'
    # model_type = model_details['estimator_type']
    model_id = model_details['model_id']


    response = requests.post('http://main:5000/trainModel', json={
        'dataset_id': dataset_id,
        'model_name': model_name,
        'target_column': target_column,
        'objective': objective,
        'metric_mode': metric_mode,
        'metric_type': metric_type,
        'training_mode': training_mode,
        'model_type': model_type,
        'hyperparameters': new_hyperparameters,
        'model_id': model_id,
        'isUpdate' : 'True',
    })

    return response.json()

# @updateModelAPIs.route('/hyperparameterGridSearch', methods=['POST'])
# def hyperparameterGridSearch():
#     model_details = request.json['model_details']
#     hyperparameter_grid = request.json['hyperparameter_grid']

#     dataset_id = model_details['dataset_id']
#     model_id = model_details['model_id']
#     model_name = model_details['model_name']
#     target_column = model_details['target_column']
#     objective = model_details['objective']
#     metric_mode = model_details['metric_mode']
#     metric_type = model_details['metric_type']
#     training_mode = 'Custom'
#     model_type = model_details['estimator_type']
#     model_id = model_details['model_id']


#     response = requests.post('http://main:5000/trainModel', json={
#         'dataset_id': dataset_id,
#         'model_name': model_name,
#         'target_column': target_column,
#         'objective': objective,
#         'metric_mode': metric_mode,
#         'metric_type': metric_type,
#         'training_mode': training_mode,
#         'model_type': model_type,
#         'hyperparameters': hyperparameter_grid,
#         'model_id': model_id
#     })

#     return response.json()