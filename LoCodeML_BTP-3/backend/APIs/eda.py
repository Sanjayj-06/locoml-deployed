from flask import Blueprint, jsonify, request
import pandas as pd
import numpy as np
import json
import os
from mongoDB import db

eda = Blueprint('eda', __name__)

class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.int64):
            return int(obj)
        return json.JSONEncoder.default(self, obj)

@eda.route('/eda/<dataset_id>', methods=['GET'])
def edaDataset(dataset_id):
    dataset_path = None
    dataset_type = 'text'
    dataset_info = db['Datasets'].find_one({'dataset_id': dataset_id})
    if dataset_info:
        dataset_path = dataset_info.get('dataset_path')
        dataset_type = dataset_info.get('dataset_type', 'text')

    if not dataset_path or not os.path.exists(dataset_path):
        project_path = os.getenv('PROJECT_PATH', '')
        extension = 'zip' if dataset_type == 'image' else 'csv'
        dataset_path = os.path.join(project_path, 'Datasets', f'{dataset_id}.{extension}')
    
    try:
        df = pd.read_csv(dataset_path)
    except Exception as e:
        return jsonify({'message': 'Error reading the dataset', 'error': str(e)}), 400
    
    if df.empty:
        return jsonify({'message': 'Dataset is empty'}), 400
    
    data_dict = df.to_dict(orient='records')
    column_names = df.columns.tolist()

    column_details = {}

    for column in df.columns:
        index = int(df.columns.get_loc(column))
        num_missing_values = int(df[column].isnull().sum())
        
        if np.issubdtype(df[column].dtype, np.number):
            mean = round(df[column].mean(skipna=True), 2)
            std_dev = round(df[column].std(skipna=True), 2)
            median = round(df[column].median(skipna=True), 2)
            min_value = round(df[column].min(skipna=True), 2)
            max_value = round(df[column].max(skipna=True), 2)
            range_value = round(max_value - min_value, 2) if num_missing_values < len(df) else None

            column_details[column] = {
                'index': index,
                'column_type': 'numerical',
                'mean': mean,
                'std_dev': std_dev,
                'median': median,
                'min': min_value,
                'max': max_value,
                'num_unique_values': df[column].nunique(dropna=True),
                'num_missing_values': num_missing_values,
                'range': range_value
            }
        else:
            column_details[column] = {
                'index': index,
                'column_type': 'categorical',
                'mean': '',
                'std_dev': '',
                'median': '',
                'min': '',
                'max': '',
                'num_unique_values': df[column].nunique(dropna=True),
                'num_missing_values': num_missing_values,
                'range': ''
            }

    # Log column details before returning the response
    print(f"Column Details: {column_details}")

    # Use jsonify instead of json.dumps
    return jsonify({
        'message': 'EDA completed successfully',
        'data': data_dict,
        'columns': column_names,
        'column_details': column_details
    })
