import pandas as pd
from flask import Flask, Blueprint, jsonify, request
from pandas.api.types import is_numeric_dtype
import sys
import os
from flask_jsonpify import jsonpify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv(dotenv_path="../../.env")
env_path = os.getenv("PROJECT_PATH")

sys.path.append(env_path)

preprocess = Blueprint('preprocess', __name__)

app = Flask(__name__)
CORS(app)


@app.route('/health', methods=["GET"])
def health():
    return "OK"


@app.route('/preprocess', methods=['POST'])
def preprocessDataset():
    # dataset_id = request.json['dataset_id']

    # dataset_path = os.getenv('PROJECT_PATH') + 'Datasets/' + dataset_id + '.csv'


    # Access finalTasks from request data
    finalTask = request.json['task']
    dataset = request.json['dataset']
    if finalTask not in ["Drop Duplicate Rows", "Interpolate Missing Values", "Normalise Features"]:
        return dataset

    df = pd.DataFrame(dataset)
    df.columns = df.iloc[0]
    df = df.drop(df.index[0])

    # Read the csv file
    # df = pd.read_csv(dataset_path)

    # Count number of duplicate rows
    duplicate_rows = df[df.duplicated()]
    num_duplicate_rows = len(duplicate_rows)
    print(f"BEFORE: Num duplicate rows: {num_duplicate_rows}")

    # Perform preprocessing tasks based on finalTasks
    if finalTask == "Drop Duplicate Rows":
        df = df.drop_duplicates()
        duplicate_rows = df[df.duplicated()]
        num_duplicate_rows = len(duplicate_rows)
        print(f"AFTER drop duplicate rows: Num duplicate rows: {num_duplicate_rows}")

    # Count number of interpolated rows
    interpolated_rows = df.isnull().sum()
    print(interpolated_rows)
    num_interpolated_rows = len(interpolated_rows)
    print(f"BEFORE: Num interpolated rows: {num_interpolated_rows}")

    if finalTask == "Interpolate Missing Values":
        for column in df.columns:
            print(column)
            if not is_numeric_dtype(df[column]) and df[column].dtype != 'bool':
                df[column] = df[column].fillna(df[column].mode()[0])
            else:
                df[column] = df[column].fillna(df[column].mean())
        interpolated_rows = df.isnull().sum()
        num_interpolated_rows = len(interpolated_rows)
        print(f"AFTER interpolate missing values: Num interpolated rows: {num_interpolated_rows}")

    # Find list of columns normalized
    normalized_columns = []

    if finalTask == "Normalise Features":
        for column in df.columns:
            if is_numeric_dtype(df[column]) and df[column].dtype != 'bool':
                df[column] = (df[column] - df[column].mean()) / df[column].std()
                normalized_columns.append(column)

    df_list = [df.columns.tolist()]
    df_list.extend(df.values.tolist())
    JSONP_data = jsonify(df_list)
    return JSONP_data


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5003, debug=True)
