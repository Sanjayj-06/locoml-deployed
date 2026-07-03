from flask import Blueprint, send_file, jsonify
from mongoDB import db

import os
import sys 
sys.path.append(os.getenv('PROJECT_PATH', ''))
import bson.json_util as json_util
from auth_helper import get_user_from_request

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
    try:
        import datetime
        collection = db['Datasets']

        username = get_user_from_request()
        query = {'username': username} if username else {'username': {'$exists': False}}
        dataset_list = list(collection.find(query))
        filtered_list = []

        for dataset in dataset_list:
            try:
                dataset_id = dataset.get('dataset_id')
                dataset_type = dataset.get('dataset_type', 'text')
                dataset_path, resolved_type = resolve_dataset_path(
                    dataset_id,
                    dataset_type,
                    dataset_info=dataset
                )

                if dataset_path and os.path.exists(dataset_path):
                    if '_id' in dataset:
                        dataset['_id'] = str(dataset['_id'])
                    dataset['dataset_path'] = dataset_path
                    dataset['dataset_type'] = resolved_type
                    filtered_list.append(dataset)
            except Exception as item_err:
                print(f"[WARNING] Skipping malformed dataset entry: {item_err}")

        return {'dataset_list': filtered_list}
    except Exception as e:
        import traceback
        import sys
        print(f"[ERROR] Failed to retrieve dataset list: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({
            'success': False,
            'dataset_list': [],
            'error': 'Failed to retrieve datasets registry',
            'details': str(e)
        }), 500

@getDatasets.route('/getDatasetInfo/<dataset_id>')
def getDatasetInfo(dataset_id):
    try:
        collection = db['Datasets']
        username = get_user_from_request()
        query = {'dataset_id': dataset_id}
        if username:
            query['username'] = username
        dataset_info = collection.find_one(query)
        if not dataset_info:
            return jsonify({'error': f'Dataset {dataset_id} not found'}), 404
        return json_util.dumps(dataset_info)
    except Exception as e:
        import traceback
        import sys
        print(f"[ERROR] Failed to fetch dataset {dataset_id}: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({'error': str(e)}), 500

@getDatasets.route('/getDatasets/<dataset_id>/<dataset_type>')
def getDataset(dataset_id, dataset_type):
    # read file from Datasets folder
    # return file
    username = get_user_from_request()
    query = {'dataset_id': dataset_id}
    if username:
        query['username'] = username
    dataset_info = db['Datasets'].find_one(query)
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