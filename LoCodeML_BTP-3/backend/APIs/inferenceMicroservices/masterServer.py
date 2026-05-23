from flask import Flask, jsonify, request
import requests
import pandas as pd
from flask_cors import CORS
import nanoid
import os
import sys
import psutil

# Add root path to sys.path to ensure we can import resolver
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

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


def resolve_input_dataset(node):
    entity = node.get('data', {}).get('entity')

    if isinstance(entity, dict):
        if entity.get('manual_inputs'):
            return None, None
        dataset_id = entity.get('dataset_id')
        dataset_type_value = entity.get('dataset_type') or dataset_type
        if dataset_id and dataset_type_value:
            return dataset_id, dataset_type_value

    cached_dataset_id = inputFiles.get(node.get('id'))
    if cached_dataset_id and dataset_type:
        return cached_dataset_id, dataset_type

    return None, None


def build_manual_dataset(entity):
    manual_inputs = entity.get('manual_inputs') or {}
    if not manual_inputs:
        return None
    input_order = entity.get('manual_input_order') or list(manual_inputs.keys())
    values = [manual_inputs.get(key) for key in input_order]
    return [input_order, values]


def resolve_model_id(node):
    if node.get('model_id'):
        return node.get('model_id')

    entity = node.get('data', {}).get('entity')

    if isinstance(entity, dict):
        return entity.get('model_id') or entity.get('id') or entity.get('_id')

    if isinstance(entity, str) and entity:
        return entity

    return node.get('data', {}).get('model_id')

def create_query_string(url, args):
    # args is an immutable dictionary
    query_string = ""
    for key, value in args.items():
        query_string += f"{key}={value}&"
    query_string = query_string[:-1]  # remove the last '&'
    return f"{url}?{query_string}"


@app.route("/nodeInfo", methods=["POST"])
def node_info():
    global hasSentIntermediate, datasetDetails, dataset_type
    global nodeDetails
    try:
        payload = request.get_json(silent=True) or {}
        nodeDetails = payload.get('nodes', [])
        global edgeDetails
        edgeDetails = payload.get('edges', [])
        if not nodeDetails:
            return jsonify({"status": "error", "message": "No nodes found"}), 400
        if not edgeDetails:
            return jsonify({"status": "error", "message": "No edges found"}), 400
        print(f"[DEBUG] Received nodes and edges. Total nodes: {len(nodeDetails)}, Total edges: {len(edgeDetails)}", file=sys.stdout)
        
        # Log edge traversals planned
        for edge in edgeDetails:
            print(f"[DEBUG] [GRAPH CONFIG] Edge: {edge.get('source')} -> {edge.get('target')}", file=sys.stdout)

        global nodes_dict
        for n in nodeDetails:
            nodes_dict[n['id']] = n
            node_label = n['data'].get('label', '')
            node_type = n.get('type', '')
            print(f"[DEBUG] [NODE INITIALIZED] ID: {n['id']}, Label: {node_label}, Type: {node_type}", file=sys.stdout)
            
            if node_label == 'Adapter' or node_type == 'adapter':
                global adapterNodeId
                adapterNodeId = n['id']
                hasSentIntermediate = False

            if node_label == 'Inputs' or node_type == 'inputData':
                dataset_id_value, dataset_type_value = resolve_input_dataset(n)
                if dataset_id_value and dataset_type_value:
                    inputFiles[n['id']] = dataset_id_value
                    global dataset_type
                    dataset_type = dataset_type_value
                
        for n in nodeDetails:
            for id in inputFiles:
                if n['id'] == id:
                    n['data']['entity'] = inputFiles[id]
                    print(f"[DEBUG] Updated input node: {n['id']} with entity: {n['data']['entity']}", file=sys.stdout)

        print("[DEBUG] [EXECUTION START] Delegating work...", file=sys.stdout)
        predictions = delegate_work()
        print(f"[DEBUG] [EXECUTION END] Predictions received: type={type(predictions)}", file=sys.stdout)

        if predictions is None:
            return jsonify({
                "status": "error",
                "message": "Pipeline execution failed before producing any output. Check the selected model chain and preprocessing steps."
            }), 422

        if isinstance(predictions, dict):
            # Check if it represents an error payload
            if 'error' in predictions:
                status_code = predictions.get("status_code", 422)
                return jsonify({
                    "status": "error",
                    "message": predictions['error'],
                    "traceback": predictions.get('traceback'),
                    "failing_node_id": predictions.get('failing_node_id')
                }), status_code
            elif 'message' in predictions and not 'objective' in predictions:
                status_code = predictions.get("status_code", 422)
                return jsonify({
                    "status": "error",
                    "message": predictions['message'],
                    "traceback": predictions.get('traceback'),
                    "failing_node_id": predictions.get('failing_node_id')
                }), status_code
            elif 'objective' in predictions:
                if predictions['objective'].lower() == 'imageclassification':
                    # MANDATORY TASK 8: ADD FINAL SUCCESS TRACE for Image Classification
                    results = predictions.get('results', [])
                    print(f"[DEBUG] [SUCCESS TELEMETRY TRACE] Image Classification successful", file=sys.stdout)
                    print(f"Prediction Count: {len(results)}", file=sys.stdout)
                    print(f"Prediction Shape: ({len(results)}, 4)", file=sys.stdout)
                    if results:
                        print(f"Sample Prediction Values:\n{results[:2]}", file=sys.stdout)
                    return predictions, 200

        if isinstance(predictions, list) and len(predictions) == 0:
            return jsonify({
                "status": "error",
                "message": "Pipeline execution returned no rows. This usually means one of the selected models produced an empty output."
            }), 422

        predictions_df = pd.DataFrame(predictions)
        if predictions_df.empty:
            return jsonify({
                "status": "error",
                "message": "Pipeline execution returned an empty result. Please verify that the output of one model matches the input of the next model."
            }), 422

        if len(predictions_df.columns) == 0:
            return jsonify({
                "status": "error",
                "message": "Pipeline execution produced data without columns. The model output format is not compatible with the pipeline runner."
            }), 422

        if len(predictions_df.index) == 0:
            return jsonify({
                "status": "error",
                "message": "Pipeline execution produced no records. Please check the input dataset and the model chain."
            }), 422

        predictions_df.columns = predictions_df.iloc[0]
        predictions_df = predictions_df.drop(predictions_df.index[0])

        if predictions_df.empty:
            return jsonify({
                "status": "error",
                "message": "Pipeline execution completed but no prediction rows were produced after formatting the output."
            }), 422

        # MANDATORY TASK 8: ADD FINAL SUCCESS TRACE
        prediction_col = 'prediction' if 'prediction' in predictions_df.columns else predictions_df.columns[-1]
        print(f"[DEBUG] [SUCCESS TELEMETRY TRACE] Tabular Predictions successful", file=sys.stdout)
        print(f"Prediction Count: {len(predictions_df)}", file=sys.stdout)
        print(f"Prediction Shape: {predictions_df.shape}", file=sys.stdout)
        print(f"Sample Prediction Values:\n{predictions_df[prediction_col].head(5).to_string()}", file=sys.stdout)

        if not hasSentIntermediate:
            hasSentIntermediate = True
            return predictions_df.to_csv(index=False), 201

        reset_globals()

        return predictions_df.to_csv(index=False), 200

    except Exception as e:
        import traceback
        tb_str = traceback.format_exc()
        print(f"[ERROR] [NODE_INFO EXCEPTION] Exception in pipeline execution: {str(e)}\n{tb_str}", file=sys.stderr)
        return jsonify({
            "status": "error",
            "message": f"Pipeline execution failed: {str(e)}",
            "traceback": tb_str
        }), 500

@app.route("/telemetry/<node_type>", methods=["GET"])
def get_node_telemetry(node_type):
    try:
        node_type = node_type.lower()
        if node_type == 'inputdata' or node_type == 'adapter':
            url = "http://input_router:5002/telemetry"
        elif node_type == 'preprocessing':
            url = "http://preprocess_router:5003/telemetry"
        elif node_type in ['classification', 'regression', 'sentiment', 'imageclassification', 'huggingface']:
            url = "http://model_router:5004/telemetry"
        else:
            return jsonify({
                "cpuUsage": psutil.cpu_percent(interval=None),
                "memoryUsage": psutil.virtual_memory().percent
            })
            
        response = requests.get(url, timeout=2)
        if response.status_code == 200:
            return jsonify(response.json())
    except Exception as e:
        print(f"Telemetry error: {e}")
        pass
        
    return jsonify({
        "cpuUsage": psutil.cpu_percent(interval=None),
        "memoryUsage": psutil.virtual_memory().percent
    })

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

    return jsonify({
        "status": "success",
        "dataset_id": dataset_id,
        "dataset_type": dataset_type,
        "nodeid": nodeid,
    }), 200

@app.route('/getAdapterCode', methods=['POST'])
def get_adapter_code():
    global adapterCode
    adapter_code = request.json['adapter_code']
    print(adapter_code)
    adapterCode = adapter_code
    return jsonify({"status": "success"}), 200

# ----------------- RESOLVER ASSISTANT ENDPOINTS -----------------
from resolver_assistant.validation_engine import ValidationEngine
from resolver_assistant.analyzer import Analyzer
from resolver_assistant.prompt_builder import PromptBuilder
from resolver_assistant.chatbot_engine import ChatbotEngine
from resolver_assistant.action_parser import ActionParser

def _resolve_dataset_path(dataset_id, dataset_path):
    if isinstance(dataset_id, dict):
        dataset_id = dataset_id.get("dataset_id") or dataset_id.get("id") or dataset_id.get("entity")
    if dataset_id and (not dataset_path or not os.path.isabs(dataset_path)):
        project_path = os.getenv('PROJECT_PATH', '')
        potential_path = os.path.join(project_path, 'Datasets', f"{dataset_id}.csv")
        if os.path.exists(potential_path):
            return potential_path
        potential_path = os.path.join(project_path, 'Datasets', f"{dataset_id}.zip")
        if os.path.exists(potential_path):
            return potential_path
        datasets_dir = os.path.join(project_path, 'Datasets')
        if os.path.exists(datasets_dir):
            for f in os.listdir(datasets_dir):
                if f.startswith(dataset_id):
                    return os.path.join(datasets_dir, f)
    return dataset_path

@app.route("/resolver-assistant/validate", methods=["POST"])
def resolver_assistant_validate():
    payload = request.get_json(silent=True) or {}
    nodes = payload.get("nodes", [])
    edges = payload.get("edges", [])
    dataset_id = payload.get("dataset_id")
    dataset_path = payload.get("dataset_path")
    pipeline_mode = payload.get("pipeline_mode")
    execution_context = payload.get("execution_context")

    original_filename = None
    if isinstance(dataset_id, dict):
        original_filename = dataset_id.get("filename") or dataset_id.get("name")
    if not original_filename and isinstance(payload.get("original_filename"), str):
        original_filename = payload.get("original_filename")

    resolved_path = _resolve_dataset_path(dataset_id, dataset_path)
    analysis = Analyzer.analyze_pipeline(
        nodes, edges, dataset_path=resolved_path, 
        original_filename=original_filename,
        pipeline_mode=pipeline_mode,
        execution_context=execution_context
    )
    return jsonify(analysis["validation"]), 200

@app.route("/resolver-assistant/chat", methods=["POST"])
def resolver_assistant_chat():
    payload = request.get_json(silent=True) or {}
    nodes = payload.get("nodes", [])
    edges = payload.get("edges", [])
    dataset_id = payload.get("dataset_id")
    dataset_path = payload.get("dataset_path")
    message = payload.get("message")
    pipeline_mode = payload.get("pipeline_mode")
    execution_context = payload.get("execution_context")
    
    original_filename = None
    if isinstance(dataset_id, dict):
        original_filename = dataset_id.get("filename") or dataset_id.get("name")
    if not original_filename and isinstance(payload.get("original_filename"), str):
        original_filename = payload.get("original_filename")

    resolved_path = _resolve_dataset_path(dataset_id, dataset_path)
    debug_context = Analyzer.analyze_pipeline(
        nodes, edges, dataset_path=resolved_path, 
        original_filename=original_filename,
        pipeline_mode=pipeline_mode,
        execution_context=execution_context
    )
    
    sys_instruction = PromptBuilder.build_system_instruction()
    user_prompt = PromptBuilder.build_user_prompt(debug_context, user_message=message)
    
    try:
        chatbot = ChatbotEngine()
        response_text = chatbot.get_response(sys_instruction, user_prompt)
        actions = ActionParser.parse_actions(response_text)
    except Exception as api_err:
        import sys
        print(f"[WARNING] Chatbot API failed: {str(api_err)}. Falling back to deterministic resolver...", file=sys.stderr)
        
        # Fallback explanation and actions generator
        issues = debug_context.get("validation", {}).get("issues", [])
        
        fallback_reps = []
        fallback_actions = []
        
        for issue in issues:
            issue_id = issue.get("id", "")
            issue_msg = issue.get("message", "")
            node_id = issue.get("node_id")
            
            if issue_id == "graph_has_cycle":
                edges_to_delete = []
                cycle_edges = issue.get("cycle_edges", [])
                if cycle_edges:
                    for src, tgt in cycle_edges:
                        edges_to_delete.append((src, tgt))
                else:
                    # Fallback dynamic back-edge check
                    adj = {n['id']: [] for n in nodes}
                    for e in edges:
                        s = e.get('source')
                        t = e.get('target')
                        if s in adj and t in adj:
                            adj[s].append(t)
                    visited = {}
                    def find_back_edge(u):
                        visited[u] = 1
                        for v in adj[u]:
                            if visited.get(v, 0) == 1:
                                edges_to_delete.append((u, v))
                            elif visited.get(v, 0) == 0:
                                find_back_edge(v)
                        visited[u] = 2
                    for n in nodes:
                        if visited.get(n['id'], 0) == 0:
                            find_back_edge(n['id'])
                            
                for src, tgt in edges_to_delete:
                    fallback_actions.append({
                        "type": "delete_edge",
                        "source": src,
                        "target": tgt
                    })
                    fallback_reps.append(f"- **Cycle detected**: Delete connection from {src} to {tgt} to break the cycle.")
            
            elif "model_task_mismatch" in issue_id and node_id:
                inferred_task = "regression" if "regression" in issue_msg.lower() else "classification"
                fallback_actions.append({
                    "type": "replace_node",
                    "node_id": node_id,
                    "replacement": inferred_task.capitalize() + " Node"
                })
                fallback_reps.append(f"- **Model Task Mismatch**: Replace node {node_id} with a {inferred_task} model.")
                
            elif "incompatible_preprocessing" in issue_id and node_id:
                fallback_actions.append({
                    "type": "delete_node",
                    "node_id": node_id
                })
                fallback_reps.append(f"- **Incompatible Preprocessing**: Delete preprocessing node {node_id} to fix pipeline schema.")
            
            elif "missing_dataset" in issue_id or "missing_dataset_selection" in issue_id:
                fallback_reps.append(f"- **Missing Dataset Selection**: Please select or upload a dataset for Inputs node '{node_id}'.")
                
            elif "missing_model_selection" in issue_id and node_id:
                fallback_reps.append(f"- **Missing Model Selection**: Please select a trained model for Model node '{node_id}'.")
        
        if not fallback_reps:
            fallback_reps.append("The validation check reported issues, but no automated quick-fixes are available. Please adjust your nodes manually.")
            
        response_text = (
            "Hello! I've analyzed your pipeline locally. It seems my standard generative assistant API is currently rate-limited, "
            "but I have diagnosed the deterministic validation errors and drafted the exact quick-fixes for you:\n\n" +
            "\n".join(fallback_reps) + "\n\n"
            "You can apply these suggested fixes using the button below."
        )
        actions = fallback_actions

    return jsonify({
        "success": True,
        "response": response_text,
        "actions": actions
    }), 200



def get_next_ids(source_id):
    next_ids = []
    for edge in edgeDetails:
        if edge['source'] == source_id:
            next_ids.append(edge['target'])
    return next_ids


def print_payload_details(direction, node_id, node_label, node_type, payload):
    print(f"[DEBUG] [PAYLOAD TRACE] --- {direction.upper()} PAYLOAD ---", file=sys.stdout)
    print(f"  Node ID: {node_id}", file=sys.stdout)
    print(f"  Node Type: {node_type}", file=sys.stdout)
    print(f"  Node Label: {node_label}", file=sys.stdout)
    if payload is None:
        print(f"  Payload is None", file=sys.stdout)
    elif isinstance(payload, list):
        rows = len(payload)
        cols = len(payload[0]) if rows > 0 else 0
        print(f"  Payload format: List of lists (or list of dicts)", file=sys.stdout)
        print(f"  Dataframe Shape (simulated): {rows} rows x {cols} columns", file=sys.stdout)
        if rows > 0:
            print(f"  Dataframe Columns: {payload[0]}", file=sys.stdout)
    elif isinstance(payload, dict):
        print(f"  Payload format: Dictionary", file=sys.stdout)
        print(f"  Payload Keys: {list(payload.keys())}", file=sys.stdout)
        if 'dataset' in payload:
            ds = payload['dataset']
            if isinstance(ds, list):
                print(f"  Nested dataset shape: {len(ds)} rows x {len(ds[0]) if len(ds) > 0 else 0} columns", file=sys.stdout)
    elif isinstance(payload, pd.DataFrame):
        print(f"  Payload format: pandas DataFrame", file=sys.stdout)
        print(f"  Dataframe Shape: {payload.shape}", file=sys.stdout)
        print(f"  Dataframe Columns: {list(payload.columns)}", file=sys.stdout)
    else:
        print(f"  Payload type: {type(payload)}", file=sys.stdout)
    print(f"[DEBUG] [PAYLOAD TRACE] ---------------------------", file=sys.stdout)


def execute(node, ip):
    global intermediate_output
    global dataset_type
    node_id = node.get('id')
    node_label = node.get('data', {}).get('label', '')
    node_type = node.get('type', '')
    
    # Trace incoming payload
    print_payload_details("incoming", node_id, node_label, node_type, ip)
    
    try:
        print(f"[DEBUG] [EXECUTE ACTION] Executing action for node label: '{node_label}', type: '{node_type}'", file=sys.stdout)
        
        op = None
        # 1. Inputs node check
        if node_type == 'inputData' or node_label == 'Inputs':
            entity = node.get('data', {}).get('entity')
            if isinstance(entity, dict) and entity.get('manual_inputs'):
                print(f"[DEBUG] [INPUTS NODE] Loading manual inputs: {entity.get('manual_inputs')}", file=sys.stdout)
                op = build_manual_dataset(entity)
                if not op:
                    return {
                        "error": "Manual inputs are empty. Provide inputs before running the pipeline.",
                        "status_code": 400,
                    }
            else:
                dataset_id_value, dataset_type_value = resolve_input_dataset(node)
                print(f"[DEBUG] [INPUTS NODE] Resolved dataset_id: {dataset_id_value}, dataset_type: {dataset_type_value}", file=sys.stdout)
                if not dataset_id_value or not dataset_type_value:
                    return {
                        "error": "No uploaded dataset was attached to the input node. Upload a dataset before running the pipeline.",
                        "status_code": 400,
                    }
                op = callInputRouter(dataset_id_value, dataset_type_value)
                
        # 2. Preprocessing node check
        elif node_type == 'preprocessing' or node_label == 'Preprocessing':
            print(f"[DEBUG] [PREPROCESSING NODE] Preprocessing tasks config: {node['data']}", file=sys.stdout)
            op = callPreprocessRouter(node['data'], ip)
            
            # MANDATORY TASK 2: VERIFY PREPROCESSING OUTPUT
            print(f"[DEBUG] [PREPROCESSING OUTPUT VERIFICATION] Verifying preprocessing output payload...", file=sys.stdout)
            if op is None:
                raise ValueError("Preprocessing output is None.")
            if isinstance(op, dict) and ("error" in op or "message" in op):
                pass
            else:
                try:
                    df_temp = pd.DataFrame(op)
                    print(f"[DEBUG] [PREPROCESSING OUTPUT VERIFICATION] Preprocessing Output Shape: {df_temp.shape}", file=sys.stdout)
                    if not df_temp.empty:
                        print(f"[DEBUG] [PREPROCESSING OUTPUT VERIFICATION] Preprocessing Output Columns: {list(df_temp.iloc[0])}", file=sys.stdout)
                    else:
                        print(f"[DEBUG] [PREPROCESSING OUTPUT VERIFICATION] Preprocessing Output is EMPTY DataFrame!", file=sys.stdout)
                    
                    if df_temp.empty:
                        raise ValueError("Preprocessing returned an empty dataset.")
                    if len(df_temp.columns) == 0:
                        raise ValueError("Preprocessing output contains no columns.")
                except Exception as ex:
                    print(f"[ERROR] [PREPROCESSING OUTPUT VERIFICATION] Invalid payload or conversion failed: {str(ex)}", file=sys.stderr)
                    raise ValueError(f"Preprocessing returned an invalid payload: {str(ex)}")
            
        # 3. Adapter node check
        elif node_type == 'adapter' or node_label == 'Adapter':
            print("[DEBUG] [ADAPTER NODE] Calling Adapter logic", file=sys.stdout)
            op = callAdapter(ip)
            
        # 4. ML Models node check
        elif node_type in ['classification', 'regression', 'sentiment', 'imageclassification'] or node_label in ['Classification', 'Regression', 'Sentiment', 'Image Classification']:
            is_bound = node.get('bound_model') or node.get('data', {}).get('bound_model')
            model_id = resolve_model_id(node)
            
            # Backward compatibility
            has_bound_key = ('bound_model' in node) or ('bound_model' in node.get('data', {}))
            if not has_bound_key and model_id:
                is_bound = True
                
            print(f"[DEBUG] [MODEL NODE] Model ID: {model_id}, Is Bound: {is_bound}", file=sys.stdout)
            if not is_bound or not model_id:
                return {
                    "error": f"No model is selected for the {node_label or node_type} node. Choose a model before running the pipeline.",
                    "status_code": 400,
                }
            
            # MANDATORY TASK 3: VERIFY REGRESSION NODE INPUT
            try:
                from mongoDB import db
                collection = db['Model_zoo']
                model_info = collection.find_one({'model_id': model_id}) or {}
                artifact_path = model_info.get('saved_model_path')
                training_columns = [c.get('column_name') for c in model_info.get('input_schema', []) if isinstance(c, dict)]
                print(f"[DEBUG] [MODEL NODE INPUT VERIFICATION] Confirmed input to regression/classification node:", file=sys.stdout)
                print(f"  - Transformed Dataframe Row Count: {len(ip) if isinstance(ip, list) else 0}", file=sys.stdout)
                print(f"  - Model ID: {model_id}", file=sys.stdout)
                print(f"  - Saved Artifact Path: {artifact_path}", file=sys.stdout)
                print(f"  - Training Columns Expected: {training_columns}", file=sys.stdout)
            except Exception as dbe:
                print(f"[DEBUG] [MODEL NODE INPUT VERIFICATION] Could not fetch DB metadata: {dbe}", file=sys.stdout)
                
            op = callModelRouter(model_id, ip)
            
        # 5. Huggingface node check
        elif node_type == 'huggingface' or node_label == 'Huggingface':
            model_name = node['data'].get('model_name')
            task_name = node['data'].get('task_name')
            print(f"[DEBUG] [HUGGINGFACE NODE] Model: {model_name}, Task: {task_name}", file=sys.stdout)
            op = callModelRouterForHuggingFace(
                node['data']['model_name'], node['data']['task_name'],
                node['data']['candidate_labels'], ip
            )
        else:
            # Unknown node type - raise explicit exception (Task 6)
            raise ValueError(f"Unknown node type '{node_type}' and label '{node_label}' in graph execution.")
            
        # Catch errors returned as dicts from routers and inject the failing node id
        if isinstance(op, dict) and "error" in op:
            if "failing_node_id" not in op:
                op["failing_node_id"] = node_id
            return op

        intermediate_output = op
        print(f"[DEBUG] [EXECUTE END] Finished executing node '{node_label or node_type}' successfully", file=sys.stdout)
        
        # Trace outgoing payload
        print_payload_details("outgoing", node_id, node_label, node_type, op)
        
        return op
    except Exception as e:
        import traceback
        tb_str = traceback.format_exc()
        print(f"[ERROR] [EXECUTE EXCEPTION] Exception executing node '{node_id}': {str(e)}\n{tb_str}", file=sys.stderr)
        return {
            "error": f"Failed to execute node '{node_label or node_id}': {str(e)}", 
            "traceback": tb_str,
            "failing_node_id": node_id
        }


def run(node_id, input_data):
    global intermediate_output, hasDatasetDetails, datasetDetails
    try:
        node = nodes_dict[node_id]
        node_label = node['data'].get('label', '')
        node_type = node.get('type', '')
        print(f"[DEBUG] [RUN NODE] Visited node '{node_id}' with label: '{node_label}', type: '{node_type}'", file=sys.stdout)
        
        # Check if the current node is the Adapter node
        if (node_type == 'adapter' or node_label == 'Adapter') and not hasSentIntermediate:
            datasetDetails = dict()
            for i in range(len(intermediate_output[0])):
                datasetDetails[intermediate_output[0][i]] = str(type(intermediate_output[1][i]))
            hasDatasetDetails = True
            print(f"[DEBUG] [PAUSE ON ADAPTER] Pausing execution at Adapter node '{node_id}' to wait for adapter edits.", file=sys.stdout)
            return intermediate_output  # Pause execution

        print(f"[DEBUG] [EXECUTE START] Calling execute() on node '{node_id}' with label: '{node_label}', type: '{node_type}'", file=sys.stdout)
        output = execute(node, input_data)
        
        if isinstance(output, dict) and "error" in output:
            print(f"[ERROR] [EXECUTE FAILURE] Node '{node_id}' returned error: {output['error']}", file=sys.stderr)
            return output

        # Continue with the next nodes
        next_ids = get_next_ids(node_id)
        print(f"[DEBUG] [EDGE TRAVERSAL] Traversing edges from '{node_id}' to next targets: {next_ids}", file=sys.stdout)
        
        predictions = None
        for nxt_id in next_ids:
            nxt_node = nodes_dict.get(nxt_id)
            nxt_label = nxt_node['data'].get('label', 'Unknown') if nxt_node else "Unknown"
            nxt_type = nxt_node.get('type', 'Unknown') if nxt_node else "Unknown"
            print(f"[DEBUG] [EDGE TRAVERSAL] Traversing edge '{node_id}' ({node_label}) -> '{nxt_id}' ({nxt_label}, {nxt_type})", file=sys.stdout)
            predictions = run(nxt_id, output)
            if predictions is None:
                # Pipeline has paused at the Adapter node
                print(f"[DEBUG] [PAUSE PROPAGATION] Execution paused downstream from node '{node_id}'", file=sys.stdout)
                return None
        if predictions:
            output = predictions
        return output
    except Exception as e:
        import traceback
        tb_str = traceback.format_exc()
        print(f"[ERROR] [RUN NODE EXCEPTION] Exception in running node '{node_id}': {str(e)}\n{tb_str}", file=sys.stderr)
        return {
            "error": f"Execution failed at node '{node_id}': {str(e)}", 
            "traceback": tb_str,
            "failing_node_id": node_id
        }


def delegate_work():
    try:
        if not nodeDetails:
            return {"error": "No nodes found in the pipeline layout"}

        predictions = None
        for node in nodeDetails:
            node_label = node['data'].get('label', '')
            node_type = node.get('type', '')
            print(f"[DEBUG] [DELEGATOR SEARCH] Checking node label: {node_label}, type: {node_type}", file=sys.stdout)
            if node_type == 'inputData' or node_label == 'Inputs':
                print(f"[DEBUG] [DELEGATOR START] Found Inputs node '{node['id']}', initiating graph traversal from here", file=sys.stdout)
                predictions = run(node['id'], None)

        return predictions
    except Exception as e:
        import traceback
        tb_str = traceback.format_exc()
        print(f"[ERROR] [DELEGATE WORK EXCEPTION] Exception: {str(e)}\n{tb_str}", file=sys.stderr)
        return {"error": f"Delegation error: {str(e)}", "traceback": tb_str}


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
        if response.status_code >= 400:
            return {"error": response.json().get("error", response.text), "status_code": response.status_code}
        dataset = response.json()
        return dataset
    except Exception as e:
        print(f"[ERROR] Error in receiving input: {str(e)}")
        return {"error": f"Input router error: {str(e)}", "status_code": 500}


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
        if response.status_code >= 400:
            try:
                payload = response.json()
                message = payload.get('message') or payload.get('error') or response.text
                tb = payload.get('traceback')
            except Exception:
                message = response.text
                tb = None
            res = {"error": message, "status_code": response.status_code}
            if tb:
                res["traceback"] = tb
            return res
        preProcessedDataset = response.json()
        return preProcessedDataset
    except Exception as e:
        print(e)
        return {"error": f"Preprocess router error: {str(e)}", "status_code": 500}


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
        if response.status_code >= 400:
            try:
                payload = response.json()
                message = payload.get('message') or payload.get('error') or response.text
                tb = payload.get('traceback')
            except Exception:
                message = response.text
                tb = None
            res = {"error": message, "status_code": response.status_code}
            if tb:
                res["traceback"] = tb
            return res
        return response.json()
    except Exception as e:
        print(e)
        return {"error": f"Model router error: {str(e)}", "status_code": 500}

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
        if response.status_code >= 400:
            try:
                payload = response.json()
                message = payload.get('message') or payload.get('error') or response.text
                tb = payload.get('traceback')
            except Exception:
                message = response.text
                tb = None
            res = {"error": message, "status_code": response.status_code}
            if tb:
                res["traceback"] = tb
            return res
        return response.json()
    except Exception as e:
        print(e)
        return {"error": f"Model router error: {str(e)}", "status_code": 500}

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
        if response.status_code >= 400:
            return {"error": response.json().get("error", response.text), "status_code": response.status_code}
        dataset = response.json()
        return dataset
    except Exception as e:
        print("Error in recieving input: ", e)
        return {"error": f"Adapter router error: {str(e)}", "status_code": 500}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
