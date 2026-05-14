from flask import Flask, jsonify, request
import requests
import pandas as pd
from flask_cors import CORS
import nanoid
import os
import sys
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

nodeDetails = []
nodes_dict = dict()
edgeDetails = []
inputFiles = dict()
datasetDetails = dict()
adapterCode = ""
adapterNodeId = None
dataset_type = None
preprocessing_tasks = {}
IMAGE_PREPROCESSING_TASKS = [
    "Resize Image",
    "Color Space Conversion",
    "Image Normalization",
    "Data Augmentation",
    "None"
]

intermediate_output = None
hasSentIntermediate = True

hasDatasetDetails = False


def _error_response(message, status_code=422):
    return jsonify({"status": "error", "message": message}), status_code

def reset_globals():
    global edgeDetails, datasetDetails, adapterNodeId, intermediate_output, hasSentIntermediate, hasDatasetDetails, preprocessing_tasks
    edgeDetails = []
    datasetDetails = dict()
    adapterNodeId = None
    intermediate_output = None
    hasSentIntermediate = True
    hasDatasetDetails = False
    preprocessing_tasks = {}  # Clear the preprocessing tasks

def create_query_string(url, args):
    # args is an immutable dictionary
    query_string = ""
    for key, value in args.items():
        query_string += f"{key}={value}&"
    query_string = query_string[:-1]  # remove the last '&'
    return f"{url}?{query_string}"


@app.route("/nodeInfo", methods=["POST"])
def node_info():
    global hasSentIntermediate, datasetDetails
    global nodeDetails
    nodeDetails = request.json['nodes']
    global edgeDetails
    edgeDetails = request.json['edges']
    if not nodeDetails:
        return jsonify({"status": "error", "message": "No nodes found"}), 400
    if not edgeDetails:
        return jsonify({"status": "error", "message": "No edges found"}), 400
    print(f"[DEBUG] Recieved nodes and edges", file=sys.stdout)
    # print(f"[DEBUG] Node details: {nodeDetails}", file=sys.stdout)
    # print(f"[DEBUG] Edge details: {edgeDetails}", file=sys.stdout)
    global nodes_dict
    for n in nodeDetails:
        nodes_dict[n['id']] = n
        if n['data']['label'] == 'Adapter':
            global adapterNodeId
            adapterNodeId = n['id']
            hasSentIntermediate = False
            
    for n in nodeDetails:
        for id in inputFiles:
            if n['id'] == id:
                n['data']['entity'] = inputFiles[id]
                print(f"[DEBUG] Updated node: {n['id']} with entity: {n['data']['entity']}", file=sys.stdout)

    predictions = delegate_work()

    if predictions is None:
        return _error_response(
            "Pipeline execution failed before producing any output. Check the selected model chain and preprocessing steps."
        )

    if isinstance(predictions, dict) and 'objective' in predictions:
        if predictions['objective'].lower() == 'imageclassification':
            # Return image classification results directly
            return predictions, 200

    if isinstance(predictions, list) and len(predictions) == 0:
        return _error_response(
            "Pipeline execution returned no rows. This usually means one of the selected models produced an empty output."
        )


    if isinstance(predictions, dict) and 'message' in predictions:
        return _error_response(predictions['message'])

    if isinstance(predictions, dict) and 'error' in predictions:
        return _error_response(predictions['error'])

    predictions_df = pd.DataFrame(predictions)
    if predictions_df.empty:
        return _error_response(
            "Pipeline execution returned an empty result. Please verify that the output of one model matches the input of the next model."
        )

    if len(predictions_df.columns) == 0:
        return _error_response(
            "Pipeline execution produced data without columns. The model output format is not compatible with the pipeline runner."
        )

    if len(predictions_df.index) == 0:
        return _error_response(
            "Pipeline execution produced no records. Please check the input dataset and the model chain."
        )

    predictions_df.columns = predictions_df.iloc[0]
    predictions_df = predictions_df.drop(predictions_df.index[0])

    if predictions_df.empty:
        return _error_response(
            "Pipeline execution completed but no prediction rows were produced after formatting the output."
        )

    if not hasSentIntermediate:
        hasSentIntermediate = True
        return predictions_df.to_csv(index=False), 201
    # os.remove(os.getenv('PROJECT_PATH') + 'Datasets/' + inputFile + '.csv')

    reset_globals()

    return predictions_df.to_csv(index=False), 200

@app.route("/resumePipeline", methods=["POST"])
def resume_pipeline():
    global intermediate_output
    if intermediate_output is None:
        return _error_response("No intermediate output to resume from. Please run the pipeline again.", 400)

    # Optionally, you can get any parameters needed from the request
    # For example, if you need the adapter node ID or any user modifications
    # adapter_node_id = 
    # adapter_node_id = request.json.get('node_id')
    # if adapter_node_id is None:
    #     return jsonify({"status": "error", "message": "No node ID provided"}), 400

    # Continue pipeline processing from the Adapter node
    print("Intermediate output: ", intermediate_output)
    predictions = run(adapterNodeId, intermediate_output)

    if predictions is None:
        return _error_response(
            "Pipeline could not resume from the adapter node. Check the adapter output and downstream model compatibility."
        )

    # print("PREDICTIONS: ", predictions)

    # Clear the intermediate output after resuming
    intermediate_output = None

    # Process predictions as before
    predictions_df = pd.DataFrame(predictions)
    if predictions_df.empty:
        return _error_response(
            "Pipeline resume returned no rows. Downstream model may have produced an empty output."
        )

    predictions_df.columns = predictions_df.iloc[0]
    predictions_df = predictions_df.drop(predictions_df.index[0])

    if predictions_df.empty:
        return _error_response(
            "Pipeline resume completed but no prediction rows were produced after formatting the output."
        )

    reset_globals()

    # Return the predictions or any relevant data
    return predictions_df.to_csv(index=False), 200

@app.route("/fetchDatasetDetails", methods=["GET"])
def fetch_dataset_details():
    global datasetDetails
    print("datasetDetails: ", datasetDetails)
    if not datasetDetails:
        return jsonify({"status": "error", "message": "No input file found!"})
    if hasDatasetDetails:
        return jsonify({"status":  "success", "message": datasetDetails})
    if datasetDetails and not hasDatasetDetails:
        return jsonify({"status": "error", "message": "Please run the previous model to fetch output details"})             # TODO: Send the correct error code instead of this all the time


@app.route("/getFile", methods=["POST"])
# @cross_origin()
def get_file():
    global datasetDetails
    global dataset_type
    dataset_file = request.files['file']
    dataset_name = request.form['filename']
    print(f"[DEBUG] dataset_name: {dataset_name}", file=sys.stdout)
    dataset_size = request.form['filesize']
    nodeid = request.form['nodeid']
    dataset_type = request.form['dataset_type']
    dataset_id = nanoid.generate(alphabet='0123456789', size=5)
    if dataset_type == 'zip':
        dataset_path = os.getenv('PROJECT_PATH') + 'Datasets/' + dataset_id + '.zip'
    else:
        dataset_path = os.getenv('PROJECT_PATH') + 'Datasets/' + dataset_id + '.csv'
    dataset_file.save(dataset_path)

    # Store the dataset columns and their types for the adapter
    ipDataset = callInputRouter(dataset_id, dataset_type)
    for i in range(len(ipDataset[0])):
        datasetDetails[ipDataset[0][i]] = str(type(ipDataset[1][i]))

    inputFiles[nodeid] = dataset_id

    return jsonify({"status": "success"}), 200

@app.route('/getAdapterCode', methods=['POST'])
def get_adapter_code():
    global adapterCode
    adapter_code = request.json['adapter_code']
    print(adapter_code)
    adapterCode = adapter_code
    return jsonify({"status": "success"}), 200


def get_next_ids(source_id):
    next_ids = []
    for edge in edgeDetails:
        if edge['source'] == source_id:
            next_ids.append(edge['target'])
    return next_ids


def execute(node, ip):
    global intermediate_output
    global dataset_type
    print("Executing ...", end='')
    # print(node['id'])
    op = None
    if node['data']['label'] == 'Inputs':
        op = callInputRouter(node['data']['entity'], dataset_type)
    elif node['data']['label'] == 'Preprocessing':
        print("Helllo Nijesh this is preprocessing speaking",node['data'], flush=True)
        op = callPreprocessRouter(node['data'], ip)
    elif node['data']['label'] == 'Adapter':
        op = callAdapter(ip)
    elif node['data']['label'] == 'Classification' or node['data']['label'] == 'Regression' or node['data'][
        'label'] == 'Sentiment' or node['data']['label'] == 'Image Classification':
        op = callModelRouter(node['data']['entity']['model_id'], ip)
    elif node['data']['label'] == 'Huggingface':
        op = callModelRouterForHuggingFace(node['data']['model_name'], node['data']['task_name'],
                                           node['data']['candidate_labels'], ip)
        
    intermediate_output = op
    print(f"[DEBUG] Executed node: {node['data']['label']}", file=sys.stdout)
    return op


# def run(id, ip):
#     op = execute(nodes_dict[id], ip)
#     next_ids = get_next_ids(id)
#     predictions = None
#     for nxt_id in next_ids:
#         predictions = run(nxt_id, op)
#     if predictions:
#         op = predictions
#     return op

def run(node_id, input_data):
    global intermediate_output, hasDatasetDetails, datasetDetails
    node = nodes_dict[node_id]
    # Check if the current node is the Adapter node
    if node['data']['label'] == 'Adapter' and not hasSentIntermediate:
        # intermediate_output = output  # Store output to be used later
        datasetDetails = dict()
        for i in range(len(intermediate_output[0])):
            datasetDetails[intermediate_output[0][i]] = str(type(intermediate_output[1][i]))
        hasDatasetDetails = True
        return intermediate_output  # Pause execution
    print(f"[DEBUG] Executing node: {node['data']['label']}", file=sys.stdout)
    output = execute(node, input_data)

    # Continue with the next nodes
    next_ids = get_next_ids(node_id)
    predictions = None
    for nxt_id in next_ids:
        predictions = run(nxt_id, output)
        if predictions is None:
            # Pipeline has paused at the Adapter node
            return None
    if predictions:
        output = predictions
    return output


# @app.route("/delegate_work", methods=["GET"])
def delegate_work():
    if not nodeDetails:
        return jsonify({"status": "error", "message": "No nodes found"})

    # predictions = run('1',None)
    predictions = None
    for node in nodeDetails:
        print(f"[DEBUG] Label: {node['data']['label']}", file=sys.stdout)
        if node['data']['label'] == 'Inputs':
            predictions = run(node['id'], None)

    return predictions


def callInputRouter(dataset_id, dataset_type):
    input_port = 5002
    # Use the service name from docker-compose.yml
    base_url = f"http://input_router:{input_port}"  # Changed from localhost to service name
    try:
        input_health_url = f"http://input_router:{input_port}/health"
        input_health_url = f"{base_url}/health"
        response = requests.get(input_health_url)
        print(f"[DEBUG] Health check response: {response.text}")
        if response.text == "OK":
            pass
    except Exception as e:
        print(f"[ERROR] Input server not responding: {str(e)}")
        return None
  
    input_url = f"{base_url}/input/getInferenceDataset" 
    try:
        print(f"[DEBUG] Calling input router with payload: {{'dataset_id': {dataset_id}, 'dataset_type': {dataset_type}}}")
        response = requests.post(input_url, json={
            'dataset_id': dataset_id,
            'dataset_type': dataset_type
        })
        print(f"[DEBUG] Input router response status: {response.status_code}")
        dataset = response.json()
        # print(f"[DEBUG] Input router response data: {dataset}")
        return dataset
    except Exception as e:
        print(f"[ERROR] Error in receiving input: {str(e)}")
        return None


def callPreprocessRouter(task, dataset):
    preprocess_port = 5003
    entity = task['entity']
    if isinstance(entity, dict):
        print(f"[DEBUG] Task: {task}", flush=True)
        task_type = task.get('type')
        if task_type in IMAGE_PREPROCESSING_TASKS:
            preprocessing_tasks[task_type] = task.get('parameters')
        return dataset
    elif isinstance(entity, str) and entity in IMAGE_PREPROCESSING_TASKS:
        preprocessing_tasks[entity] = task.get('parameters')
        return dataset
    task=entity
    try:
        preprocess_health_url = f"http://preprocess_router:{preprocess_port}/health"
        response = requests.get(preprocess_health_url)
        if response.text == "OK":
            pass
    except Exception as e:
        print("Preprocess server not responding : ", e)

    preprocess_url = f"http://preprocess_router:{preprocess_port}/preprocess"
    try:
        response = requests.post(preprocess_url, json={
            'dataset': dataset,
            'task': task
        })
        preProcessedDataset = response.json()
        return preProcessedDataset
    except Exception as e:
        print(e)


def callModelRouter(model_id, dataset):
    model_port = 5004
    print(f"{preprocessing_tasks}", flush=True)
    try:
        model_health_url = f"http://model_router:{model_port}/health"
        response = requests.get(model_health_url)
        if response.text == "OK":
            pass
    except Exception as e:
        print("Model server not responding : ", e)

    model_url = f"http://model_router:{model_port}/inference/batch"
    try:
        response = requests.post(model_url, json={
            'dataset': dataset,
            'model_id': model_id,
            'preprocessing_tasks': preprocessing_tasks
        })
        return response.json()
    except Exception as e:
        print(e)

def callModelRouterForHuggingFace(model_name, task_name, candidate_labels, dataset):
    model_port = 5004
    try:
        model_health_url = f"http://model_router:{model_port}/health"
        response = requests.get(model_health_url)
        if response.text == "OK":
            pass
    except Exception as e:
        print("Model server not responding : ", e)
    
    model_url = f"http://model_router:{model_port}/inference/huggingface/batch"
    try:
        response = requests.post(model_url, json={
            'dataset': dataset,
            'model_name': model_name,
            'task_name': task_name,
            'candidate_labels': candidate_labels
        })
        return response.json()
    except Exception as e:
        print(e)

def callAdapter(dataset):
    input_port = 5002
    try:
        input_health_url = f"http://input_router:{input_port}/health"
        response = requests.get(input_health_url)
        if response.text == "OK":
            pass
    except Exception as e:
        print("Input server not responding : ", e)

    input_url = f"http://input_router:{input_port}/input/adaptInferenceDataset"
    try:
        response = requests.post(input_url, json={
            'dataset': dataset,
            'adapterCode': adapterCode,
        })
        dataset = response.json()
        return dataset
    except Exception as e:
        print("Error in recieving input: ", e)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
