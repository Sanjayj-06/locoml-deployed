"""Responsible for all the inference pipeline saving, retrieval, traversal etc., API calls. Separate inference
microservice, running on port 5005.
NOTE: The modelRouter.py is responsible for everything else, like the actual
inference part of the inference pipeline."""
from aiohttp import FormData
from flask import request, Flask, jsonify, Response
import csv
from io import StringIO
import requests
import bson.json_util as json_util
import nanoid
import os
import sys
import datetime
from dotenv import load_dotenv, find_dotenv
from flask_cors import CORS

load_dotenv(find_dotenv())
sys.path.append(os.getenv('PROJECT_PATH', ''))
from mongoDB import db
from auth_helper import get_user_from_request

load_dotenv(dotenv_path="../../.env")
env_path = os.getenv("PROJECT_PATH")
MASTER_SERVER_GETFILE_URL = os.getenv("MASTER_SERVER_GETFILE_URL") or "http://master_server:5001/getFile"
INFERENCE_PIPELINE_RETRIEVE_PIPELINE_DETAILS_URL = os.getenv("INFERENCE_PIPELINE_RETRIEVE_PIPELINE_DETAILS_URL") or "http://pipeline_router:5005/retrievePipelineDetails"
RUN_INFERENCE_PIPELINE_URL = os.getenv("RUN_INFERENCE_PIPELINE_URL") or "http://master_server:5001/nodeInfo"
PRE_RUN_INFERENCE_URL = os.getenv("PRE_RUN_INFERENCE_URL") or "http://master_server:5001/preRunNodeInference"

sys.path.append(env_path)

app = Flask(__name__)
CORS(app)


@app.route('/health', methods=["GET"])
def health():
    return "OK"


@app.route('/savePipeline', methods=['POST'])
def save_pipeline():
    data = request.get_json()
    nodes = data['nodes']
    edges = data['edges']
    pipeline_name = data['pipeline_name']

    # remove the input data, if present. we don't want to save the dataset used in inference.
    for node in nodes:
        if node['type'] == 'inputData':
            node['data']['entity'] = None

    pipeline_id = nanoid.generate(alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', size=6)

    collection = db['Inference_Pipelines']
    username = get_user_from_request()

    collection.insert_one({
        'time': datetime.datetime.now(),
        'pipeline_id': pipeline_id,
        'pipeline_name': pipeline_name,
        'nodes': nodes,
        'edges': edges,
        'username': username,
    })

    return json_util.dumps({'status': 'success', 'dataset_id': pipeline_id})


@app.route('/getPipelinesList/', methods=['GET'])
def get_pipelines_list():
    # defaulting to page 1 and limit 10 unless specified otherwise in the request args.
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))

    offset = (page - 1) * limit

    collection = db['Inference_Pipelines']
    pipelines_list = []
    username = get_user_from_request()
    query = {'username': username} if username else {'username': {'$exists': False}}
    total_pipelines = collection.count_documents(query)
    for pipeline in collection.find(query).skip(offset).limit(limit):
        pipeline.pop('_id')
        pipelines_list.append(pipeline)

    return json_util.dumps({
        'page': page,
        'limit': limit,
        'total_items': total_pipelines,
        'total_pages': (total_pipelines + limit - 1) // limit,
        'inference_pipelines': pipelines_list
    })


@app.route('/retrievePipelineDetails/', methods=['GET'])
def retrieve_pipeline_details():
    pipeline_id = request.args.get('pipeline_id')
    if not pipeline_id:
        return json_util.dumps({"message": "Invalid request. Missing pipeline ID."})
    return get_pipeline_details_by_ID(pipeline_id)


def get_pipeline_details_by_ID(pipeline_id):
    collection = db['Inference_Pipelines']
    query = {"pipeline_id": pipeline_id}
    username = get_user_from_request()
    if username:
        query["username"] = username
    pipeline_info = list(collection.find(query))
    if not pipeline_info:
        return json_util.dumps({"message": "Invalid request. No pipeline is saved with this pipeline ID."})
    return json_util.dumps(pipeline_info[0])  # Ideally, there shouldn't be multiple pipelines with the same ID as
    # the ID must be randomly generated. So, return the first result.


@app.route('/getCSVInput/<pipeline_id>', methods=['POST'])
def csv_input(pipeline_id):
    file = request.files.get('file')
    if not file:
        return jsonify({"error": "No file part in the request"}), 400

    files = {'file': (file.filename, file.stream, file.content_type)}
    data = {'filename': file.filename, 'filesize': len(file.read()), 'nodeid': 'dndnode_0'}
    file.stream.seek(0)  # reset read ptr back to start after reading length (like I did in the dict above)

    response = requests.post(MASTER_SERVER_GETFILE_URL, files=files, data=data)
    if response.status_code != 200:
        return jsonify({"error": "Failed to upload file to the file server"}), response.status_code

    pipeline_details = requests.get(INFERENCE_PIPELINE_RETRIEVE_PIPELINE_DETAILS_URL + f'/?pipeline_id={pipeline_id}')
    if pipeline_details.status_code != 200:
        return jsonify({"error": "Failed to retrieve pipeline details"}), response.status_code
    pipeline_details.content.decode('utf8')

    # process this data for pipeline execution.
    processed_data = process_data_for_pipeline_execution(pipeline_details.json(), files, data)

    # Collect pre-run inference before execution; nodeInfo enforces this signature.
    pre_run_response = requests.post(PRE_RUN_INFERENCE_URL, json={
        'nodes': processed_data['nodes'],
        'edges': processed_data['edges'],
    })
    if pre_run_response.status_code != 200:
        try:
            payload = pre_run_response.json()
            message = payload.get("message") or payload.get("error") or "Failed to collect pre-run inference"
        except Exception:
            message = pre_run_response.text or "Failed to collect pre-run inference"
        return jsonify({"error": message}), pre_run_response.status_code

    pre_run_payload = pre_run_response.json() if pre_run_response.content else {}
    pre_run_signature = pre_run_payload.get("pipeline_signature")

    # tell the master server to run this pipeline.
    output_data = requests.post(RUN_INFERENCE_PIPELINE_URL, json={
        'nodes': processed_data['nodes'],
        'edges': processed_data['edges'],
        'pre_run_signature': pre_run_signature,
    })
    if output_data.status_code != 200:
        try:
            payload = output_data.json()
            message = payload.get("message") or payload.get("error") or "Failed to run this pipeline"
        except Exception:
            message = output_data.text or "Failed to run this pipeline"
        return jsonify({"error": message}), output_data.status_code
    output_data.content.decode('utf8')  # this is returned in text/csv format by the server.

    return Response(
        output_data,
        mimetype="text/csv",
    )


def process_data_for_pipeline_execution(pipeline_details, files, data):
    for node in pipeline_details['nodes']:
        if node['type'] == "inputData":
            node['data']['entity'] = {'file': {'filename': files['file'][0], 'filesize': data['filesize']}, 'filename': data['filename'], 'filesize': data['filesize'], 'nodeid': node['id']}

    return pipeline_details


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5005, debug=False)
