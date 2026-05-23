from flask import Blueprint, send_file, jsonify
from mongoDB import db

import os
import sys 
sys.path.append(os.getenv('PROJECT_PATH'))
import bson.json_util as json_util

from mongoDB import db

getDatasets = Blueprint('getDatasets', __name__)

def resolve_dataset_path(dataset_id, dataset_type, dataset_info=None):
    dataset_path = None
    dataset_type = dataset_type or 'text'

    if dataset_info:
        dataset_path = dataset_info.get('dataset_path')
        dataset_type = dataset_info.get('dataset_type', dataset_type)

    if not dataset_path or not os.path.exists(dataset_path):
        project_path = os.getenv('PROJECT_PATH', '')
        extension = 'zip' if dataset_type == 'image' else 'csv'
        dataset_path = os.path.join(project_path, 'Datasets', f'{dataset_id}.{extension}')

    return dataset_path, dataset_type

@getDatasets.route('/getDatasets')
def getDatasetList():
    # read all files from Datasets folder
    # return list of files
    import datetime
    collection = db['Datasets']

    # Self-healing: sync files on disk in the Datasets directory with MongoDB
    project_path = os.getenv('PROJECT_PATH', '')
    datasets_dir = os.path.join(project_path, 'Datasets')
    if os.path.exists(datasets_dir):
        for f in os.listdir(datasets_dir):
            if f.startswith('.'):
                continue
            name, ext = os.path.splitext(f)
            if ext.lower() in ['.csv', '.zip']:
                dataset_id = name
                # Check if it exists in DB
                existing = collection.find_one({'dataset_id': dataset_id})
                if not existing:
                    filepath = os.path.join(datasets_dir, f)
                    try:
                        size = str(os.path.getsize(filepath))
                    except Exception:
                        size = "0"
                    
                    collection.insert_one({
                        'time': datetime.datetime.now(),
                        'dataset_id': dataset_id,
                        'dataset_size': size,
                        'dataset_name': f"Dataset_{dataset_id}{ext}",
                        'dataset_path': filepath,
                        'dataset_type': 'image' if ext.lower() == '.zip' else 'text'
                    })

    dataset_list = list(collection.find({}))
    filtered_list = []

    for dataset in dataset_list:
        dataset_id = dataset.get('dataset_id')
        dataset_type = dataset.get('dataset_type', 'text')
        dataset_path, resolved_type = resolve_dataset_path(
            dataset_id,
            dataset_type,
            dataset_info=dataset
        )

        if dataset_path and os.path.exists(dataset_path):
            dataset['_id'] = str(dataset['_id'])
            dataset['dataset_path'] = dataset_path
            dataset['dataset_type'] = resolved_type
            filtered_list.append(dataset)

    return {'dataset_list': filtered_list}

@getDatasets.route('/getDatasetInfo/<dataset_id>')
def getDatasetInfo(dataset_id):
    collection = db['Datasets']
    dataset_info = collection.find_one({'dataset_id': dataset_id})
    return json_util.dumps(dataset_info)

@getDatasets.route('/getDatasets/<dataset_id>/<dataset_type>')
def getDataset(dataset_id, dataset_type):
    # read file from Datasets folder
    # return file
    dataset_info = db['Datasets'].find_one({'dataset_id': dataset_id})
    dataset_path, _ = resolve_dataset_path(
        dataset_id,
        dataset_type,
        dataset_info=dataset_info
    )

    if not dataset_path or not os.path.exists(dataset_path):
        return jsonify({'message': 'Dataset file not found'}), 404

    return send_file(dataset_path)

# @getDatasets.route('/getDatasets/<dataset_id>/file')
# def getDatasetFile(dataset_id):
#     # read file from Datasets folder
#     # return file
#     dataset_path = './Datasets/'+dataset_id+'.csv'
#     # dataset_file = open(dataset_path + '/' + dataset_name)
#     # print(dataset_path)
#     return send_file(dataset_path, as_attachment=True)

@getDatasets.route('/getDatasets/columns/<model_name>')
def getDatasetColumns(model_name):
    collection = db['Models_Trained']
    data = collection.find_one({'model_name': model_name})
    if data:
        return {'target_column': data.get('target_column'), 'non_target_columns': data.get('non_target_columns')}

    # Fallback to Model_zoo
    zoo_collection = db['Model_zoo']
    data = zoo_collection.find_one({'model_name': model_name})
    if data:
        input_schema = data.get('input_schema', [])
        non_target_columns = []
        if isinstance(input_schema, list):
            for col in input_schema:
                if isinstance(col, dict):
                    non_target_columns.append(col.get('column_name'))
                else:
                    non_target_columns.append(col)
        elif isinstance(input_schema, dict):
            non_target_columns = input_schema.get('columns') or input_schema.get('features') or []

        return {
            'target_column': data.get('target_column'),
            'non_target_columns': [c for c in non_target_columns if c]
        }

    return jsonify({'message': 'Model columns not found'}), 404