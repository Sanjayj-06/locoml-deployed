from flask import Flask, Blueprint, request, send_file, jsonify
import nanoid
import os
import sys
import datetime
from flask_jsonpify import jsonpify
import pandas as pd
from dotenv import load_dotenv
from flask_cors import CORS
from pandas.api.types import is_numeric_dtype
import re
from pprint import pprint
import zipfile
from datasets import load_from_disk
import base64
from io import BytesIO
from PIL import Image

load_dotenv(dotenv_path="../../.env")
env_path = os.getenv("PROJECT_PATH")

sys.path.append(env_path)

storeDataset = Blueprint('storeDataset', __name__)

app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health():
    return "OK"


@app.route('/input/getInferenceDataset', methods=['GET', 'POST'])
def getInferenceFile():
    print("Currently in getInferenceFile")

    data = request.get_json()
    dataset_id = data['dataset_id']
    dataset_type = data['dataset_type']
    
    if dataset_type == 'zip':
        dataset_path = os.getenv('PROJECT_PATH') + 'Datasets/' + dataset_id + '.zip'
        with zipfile.ZipFile(dataset_path, 'r') as zip_ref:
            zip_ref.extractall(os.getenv('PROJECT_PATH') + 'ExtractedDatasets/'+ dataset_id)
        dataset_path = os.getenv('PROJECT_PATH') + 'ExtractedDatasets/'+ dataset_id
        
        # Load the dataset and get the test split
        dataset = load_from_disk(dataset_path)
        test_dataset = dataset['test'] if 'test' in dataset else dataset
        
        # Convert dataset to list format with base64 encoded images
        df_list = [['image', 'label']]  # Header
        for item in test_dataset:
            # Convert PIL Image to base64
            img = item['image']
            if isinstance(img, Image.Image):
                buffered = BytesIO()
                img.save(buffered, format="PNG")
                img_str = base64.b64encode(buffered.getvalue()).decode()
                df_list.append([img_str, item.get('label', '')])
            else:
                print(f"[WARNING] Skipping non-image item: {type(img)}", file=sys.stdout)
                continue
            
    else:
        # Handle CSV case as before
        dataset_path = os.getenv('PROJECT_PATH') + 'Datasets/' + dataset_id + '.csv'
        if not os.path.exists(dataset_path):
            print(f"[ERROR] Dataset not found: {dataset_path}",file=sys.stdout)
            return jsonify({"error": "Dataset not found"}), 404
        else:
            print(f"[DEBUG] Dataset found: {dataset_path}",file=sys.stdout)
        df = pd.read_csv(dataset_path)

        for column in df.columns:
            if not is_numeric_dtype(df[column]) and df[column].dtype != 'bool':
                df[column] = df[column].fillna(df[column].mode()[0])
            else:
                df[column] = df[column].fillna(df[column].mean())

        df_list = [df.columns.tolist()]
        df_list.extend(df.values.tolist())

    JSONP_data = jsonify(df_list)
    print(f"[DEBUG] Dataset Stored Successfully in {dataset_path}",file=sys.stdout)
    return JSONP_data

@app.route('/input/adaptInferenceDataset', methods=['POST'])
def adaptInferenceDataset():
    data = request.get_json()
    dataset = data['dataset']
    adapterCode = data['adapterCode']
    pattern = r'#\s*={9}\s*Add your custom code\s*={9}\s*\n(.*?)\n\s*#\s*={9}'
    custom_code = re.search(pattern, adapterCode, re.DOTALL).group(1).strip()
    custom_code = custom_code.split('\n')
    final_code = ""
    for i in range(len(custom_code)):
        if custom_code[i].startswith('    '):
            custom_code[i] = custom_code[i][4:]
        final_code += custom_code[i] + '\n'

    df = pd.DataFrame(dataset[1:], columns=dataset[0])
    
    output_df = df.copy()

    # execute the custom code
    exec_globals = {'output_df': output_df, 'df': df}
    exec_locals = {}
    exec(final_code, exec_globals, exec_locals)
    # drop the text column from output_df
    # output_df['initial_text'] = df['text']
    # output_df['text'] = df['translation_text']
    # output_df = output_df.drop(columns=['translation_text'])

    output_df = exec_locals['output_df']
    final_df = [output_df.columns.tolist()]
    final_df.extend(output_df.values.tolist())

    return jsonify(final_df)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)
