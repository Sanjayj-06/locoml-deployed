import pandas as pd
from flask import Blueprint, jsonify, request
from pandas.api.types import is_numeric_dtype
import os
from mongoDB import db

preprocess = Blueprint('preprocess', __name__)


@preprocess.route('/preprocess', methods=['POST'])
def preprocessDataset():
    dataset_id = request.json['dataset_id']
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

    # Access finalTasks from request data
    finalTasks = request.json['tasks']

    # Read the csv file
    df = pd.read_csv(dataset_path)

    # Count number of duplicate rows
    duplicate_rows = df[df.duplicated()]
    num_duplicate_rows = len(duplicate_rows)

    # Perform preprocessing tasks based on finalTasks
    if "Drop Duplicate Rows" in finalTasks:
        df = df.drop_duplicates()

    # Count number of interpolated rows
    interpolated_rows = df.isnull().sum()
    num_interpolated_rows = len(interpolated_rows)
    print(f"BEFORE: Num interpolated rows: {num_interpolated_rows}")

    if "Interpolate Missing Values" in finalTasks:
        for column in df.columns:
            if not is_numeric_dtype(df[column]) and df[column].dtype != 'bool':
                df[column] = df[column].fillna(df[column].mode()[0])
            else:
                df[column] = df[column].fillna(df[column].mean())
        interpolated_rows = df.isnull().sum()
        num_interpolated_rows = len(interpolated_rows)
        print(f"AFTER interpolate missing values: Num interpolated rows: {num_interpolated_rows}")

    # Find list of columns normalized
    normalized_columns = []

    if "Normalise Features" in finalTasks:
        for column in df.columns:
            if is_numeric_dtype(df[column]) and df[column].dtype != 'bool':
                df[column] = (df[column] - df[column].mean()) / df[column].std()
                normalized_columns.append(column)

    processed_dataset_path = os.path.join(
        os.getenv('PROJECT_PATH', ''),
        'processedDatasets',
        f'{dataset_id}.csv'
    )
    df.to_csv(processed_dataset_path, index=False)

    return jsonify({'message': 'Preprocessing completed successfully',
                    'num_duplicate': num_duplicate_rows,
                    'num_interpolate': num_interpolated_rows,
                    'normalized_columns': normalized_columns}), 200
