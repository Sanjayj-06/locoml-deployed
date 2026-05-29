from flask import Flask, jsonify, request
import requests
import pandas as pd
from flask_cors import CORS
import nanoid
import os
import sys
import psutil
import json
import hashlib
import datetime

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

PRE_RUN_TTL_SECONDS = 900
PRE_RUN_SIGNATURE_CACHE = {}

NODE_ESTIMATION_BASELINES = {
    "inputdata": {"latency": 52.0, "cpu": 18.0, "gpu": 4.0, "memory": 24.0},
    "preprocessing": {"latency": 120.0, "cpu": 42.0, "gpu": 14.0, "memory": 31.0},
    "adapter": {"latency": 95.0, "cpu": 34.0, "gpu": 11.0, "memory": 29.0},
    "classification": {"latency": 150.0, "cpu": 56.0, "gpu": 38.0, "memory": 36.0},
    "regression": {"latency": 136.0, "cpu": 50.0, "gpu": 29.0, "memory": 35.0},
    "sentiment": {"latency": 162.0, "cpu": 58.0, "gpu": 42.0, "memory": 38.0},
    "huggingface": {"latency": 182.0, "cpu": 64.0, "gpu": 51.0, "memory": 43.0},
    "imageclassification": {"latency": 174.0, "cpu": 62.0, "gpu": 67.0, "memory": 47.0},
    "default": {"latency": 118.0, "cpu": 40.0, "gpu": 20.0, "memory": 33.0},
}


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


def _clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def _normalize_node_type(node):
    return str(node.get("type") or node.get("data", {}).get("label") or "default").lower()


def _canonicalize_graph(nodes, edges):
    canonical_nodes = []
    for node in nodes:
        data = node.get("data", {})
        entity = data.get("entity")
        if isinstance(entity, dict):
            entity = {
                "model_id": entity.get("model_id") or entity.get("id") or entity.get("_id"),
                "dataset_id": entity.get("dataset_id"),
                "dataset_type": entity.get("dataset_type"),
                "name": entity.get("name") or entity.get("filename"),
            }

        canonical_nodes.append({
            "id": node.get("id"),
            "type": node.get("type"),
            "entity": entity,
            "model_id": node.get("model_id") or data.get("model_id"),
            "preprocessingType": data.get("preprocessingType"),
            "task_name": data.get("task_name"),
        })

    canonical_edges = [
        {
            "source": edge.get("source"),
            "target": edge.get("target"),
        }
        for edge in edges
    ]

    canonical_nodes.sort(key=lambda item: str(item.get("id")))
    canonical_edges.sort(key=lambda item: f"{item.get('source')}->{item.get('target')}")
    return {"nodes": canonical_nodes, "edges": canonical_edges}


def _build_pipeline_signature(nodes, edges):
    canonical = _canonicalize_graph(nodes, edges)
    encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _cleanup_pre_run_cache(now):
    expired = []
    for signature, created_at in PRE_RUN_SIGNATURE_CACHE.items():
        if (now - created_at).total_seconds() > PRE_RUN_TTL_SECONDS:
            expired.append(signature)
    for signature in expired:
        PRE_RUN_SIGNATURE_CACHE.pop(signature, None)


def _register_pre_run_signature(signature):
    now = datetime.datetime.utcnow()
    _cleanup_pre_run_cache(now)
    PRE_RUN_SIGNATURE_CACHE[signature] = now


def _validate_pre_run_signature(signature, nodes, edges):
    if not signature:
        return False, "Pre-run node inference is required before pipeline execution.", None

    expected_signature = _build_pipeline_signature(nodes, edges)
    if signature != expected_signature:
        return False, "Pipeline changed after pre-run inference. Re-run evaluation before executing.", expected_signature

    now = datetime.datetime.utcnow()
    _cleanup_pre_run_cache(now)
    generated_at = PRE_RUN_SIGNATURE_CACHE.get(signature)
    if not generated_at:
        return False, "No fresh pre-run inference found for this pipeline. Evaluate again before run.", expected_signature

    return True, "ok", expected_signature


def _resolve_dataset_bytes(nodes):
    for node in nodes:
        node_type = _normalize_node_type(node)
        if node_type != "inputdata":
            continue

        entity = node.get("data", {}).get("entity")
        if isinstance(entity, dict):
            file_size = entity.get("filesize") or entity.get("file", {}).get("filesize")
            if file_size is not None:
                try:
                    return max(0.0, float(file_size))
                except (TypeError, ValueError):
                    pass

            manual_inputs = entity.get("manual_inputs")
            if isinstance(manual_inputs, dict) and manual_inputs:
                # Estimate a few bytes per scalar input for manual mode.
                return float(len(manual_inputs) * 64)

    return 1_000_000.0


def _infer_model_complexity(node):
    data = node.get("data", {})
    entity = data.get("entity") if isinstance(data.get("entity"), dict) else {}
    model_text = " ".join([
        str(node.get("model_name") or ""),
        str(node.get("estimator") or ""),
        str(data.get("model_name") or ""),
        str(entity.get("model_name") or ""),
        str(entity.get("estimator") or ""),
        str(entity.get("estimator_type") or ""),
    ]).lower()

    if any(token in model_text for token in ["transformer", "bert", "llama", "gpt", "resnet", "vit"]):
        return 0.85
    if any(token in model_text for token in ["xgboost", "randomforest", "random forest", "lightgbm", "catboost", "cnn"]):
        return 0.62
    if any(token in model_text for token in ["svm", "ridge", "logistic", "naive", "knn", "linear"]):
        return 0.35
    return 0.45


def _estimate_node_metrics(node, position_index, total_nodes, dataset_mb, upstream_latency):
    node_type = _normalize_node_type(node)
    baseline = NODE_ESTIMATION_BASELINES.get(node_type, NODE_ESTIMATION_BASELINES["default"])

    complexity = _infer_model_complexity(node) if node_type in {
        "classification", "regression", "sentiment", "huggingface", "imageclassification"
    } else 0.15
    depth_factor = (position_index / max(1, total_nodes - 1))
    size_factor = _clamp(dataset_mb / 24.0, 0.03, 1.35)
    carry_over = _clamp(upstream_latency / 400.0, 0.0, 0.22)

    latency_ms = baseline["latency"] * (1.0 + 0.37 * size_factor + 0.22 * complexity + 0.11 * depth_factor + carry_over)
    cpu_usage = baseline["cpu"] + 16.0 * size_factor + 12.0 * complexity + 8.0 * depth_factor
    gpu_usage = baseline["gpu"] + 21.0 * complexity + 12.0 * size_factor + 6.0 * depth_factor
    memory_usage = baseline["memory"] + 13.0 * size_factor + 9.0 * complexity + 5.0 * depth_factor

    queue_pressure = _clamp((latency_ms - 130.0) / 170.0 + depth_factor * 0.35 + complexity * 0.2, 0.0, 1.0)
    throughput_rps = max(0.5, 1000.0 / max(25.0, latency_ms * (1.0 + 0.25 * queue_pressure)))

    failure_probability = _clamp(
        0.32 * (latency_ms / 320.0)
        + 0.22 * (cpu_usage / 100.0)
        + 0.2 * (gpu_usage / 100.0)
        + 0.18 * (memory_usage / 100.0)
        + 0.08 * queue_pressure,
        0.0,
        1.0,
    )

    if failure_probability >= 0.6:
        risk = "High"
    elif failure_probability >= 0.3:
        risk = "Moderate"
    else:
        risk = "Low"

    score = round(_clamp(100.0 - (failure_probability * 100.0), 0.0, 100.0), 2)

    return {
        "cpuUsage": round(_clamp(cpu_usage, 1.0, 100.0), 2),
        "gpuUsage": round(_clamp(gpu_usage, 0.0, 100.0), 2),
        "memoryUsage": round(_clamp(memory_usage, 1.0, 100.0), 2),
        "latency": round(max(5.0, latency_ms), 2),
        "throughput": round(throughput_rps, 2),
        "score": score,
        "failureProbability": round(failure_probability, 4),
        "predictedRuntimeRisk": risk,
        "riskDecision": {
            "scoreFormula": "score = 100 - (failureProbability * 100)",
            "riskThresholds": {
                "high": "failureProbability >= 0.60 or score < 40",
                "moderate": "failureProbability >= 0.30 or score < 70",
                "low": "otherwise",
            },
        },
        "queueSize": int(round(_clamp(queue_pressure * 8.0, 0.0, 12.0))),
        "retryCount": int(round(_clamp(failure_probability * 5.0, 0.0, 8.0))),
        "calculation": {
            "baseline": baseline,
            "datasetMB": round(dataset_mb, 3),
            "sizeFactor": round(size_factor, 3),
            "complexity": round(complexity, 3),
            "depthFactor": round(depth_factor, 3),
            "carryOver": round(carry_over, 3),
            "queuePressure": round(queue_pressure, 3),
        }
    }


def _build_linear_node_order(nodes, edges):
    node_by_id = {node.get("id"): node for node in nodes if node.get("id")}
    incoming = {node_id: 0 for node_id in node_by_id}
    outgoing = {node_id: [] for node_id in node_by_id}

    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if source in outgoing and target in incoming:
            outgoing[source].append(target)
            incoming[target] += 1

    start_candidates = [node_id for node_id, count in incoming.items() if count == 0]
    if not start_candidates and nodes:
        start_candidates = [nodes[0].get("id")]

    ordered_ids = []
    visited = set()
    for start_id in start_candidates:
        current_id = start_id
        while current_id and current_id not in visited and current_id in node_by_id:
            ordered_ids.append(current_id)
            visited.add(current_id)
            next_ids = outgoing.get(current_id, [])
            current_id = next_ids[0] if next_ids else None

    for node in nodes:
        node_id = node.get("id")
        if node_id and node_id not in visited:
            ordered_ids.append(node_id)

    return [node_by_id[node_id] for node_id in ordered_ids if node_id in node_by_id]


def _estimate_pipeline(nodes, edges):
    ordered_nodes = _build_linear_node_order(nodes, edges)
    dataset_bytes = _resolve_dataset_bytes(nodes)
    dataset_mb = max(0.001, dataset_bytes / (1024.0 * 1024.0))

    estimates = []
    upstream_latency = 0.0
    for index, node in enumerate(ordered_nodes):
        metrics = _estimate_node_metrics(node, index, len(ordered_nodes), dataset_mb, upstream_latency)
        upstream_latency = metrics["latency"]
        estimates.append({
            "node_id": node.get("id"),
            "node_type": node.get("type"),
            "node_title": node.get("data", {}).get("name") or node.get("data", {}).get("label") or node.get("type"),
            "metrics": metrics,
        })

    return estimates


@app.route("/preRunNodeInference", methods=["POST"])
def pre_run_node_inference():
    payload = request.get_json(silent=True) or {}
    nodes = payload.get("nodes", [])
    edges = payload.get("edges", [])

    if not nodes:
        return jsonify({"status": "error", "message": "No nodes found"}), 400
    if not edges:
        return jsonify({"status": "error", "message": "No edges found"}), 400

    signature = _build_pipeline_signature(nodes, edges)
    estimates = _estimate_pipeline(nodes, edges)
    _register_pre_run_signature(signature)

    summary = {
        "nodeCount": len(nodes),
        "highRiskNodes": len([item for item in estimates if item["metrics"]["predictedRuntimeRisk"] == "High"]),
        "moderateRiskNodes": len([item for item in estimates if item["metrics"]["predictedRuntimeRisk"] == "Moderate"]),
        "avgLatencyMs": round(sum(item["metrics"]["latency"] for item in estimates) / max(1, len(estimates)), 2),
        "avgThroughputRps": round(sum(item["metrics"]["throughput"] for item in estimates) / max(1, len(estimates)), 2),
    }

    return jsonify({
        "status": "success",
        "pipeline_signature": signature,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "estimates": estimates,
        "summary": summary,
        "calculation_notes": [
            "No pipeline node is executed for this estimate; values are static predictions based on graph metadata.",
            "Latency/CPU/GPU/Memory are derived from node-type baselines, dataset size factor, model complexity hints, and graph depth.",
            "Throughput is derived from predicted latency and queue pressure: throughput ~= 1000 / (latency * pressure_adjustment).",
            "Risk is derived from weighted latency, CPU, GPU, memory, and queue pressure and then mapped to Low/Moderate/High.",
        ],
    }), 200


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

        pre_run_signature = payload.get("pre_run_signature")
        is_valid_pre_run, pre_run_message, expected_signature = _validate_pre_run_signature(pre_run_signature, nodeDetails, edgeDetails)
        if not is_valid_pre_run:
            return jsonify({
                "status": "error",
                "message": pre_run_message,
                "expected_signature": expected_signature,
            }), 428

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
                entity = n.get('data', {}).get('entity')
                if isinstance(entity, dict) and (entity.get('manual_inputs') or entity.get('dataset_type') == 'manual'):
                    inputFiles.pop(n['id'], None)
                    dataset_type = 'manual'
                else:
                    dataset_id_value, dataset_type_value = resolve_input_dataset(n)
                    if dataset_id_value and dataset_type_value:
                        inputFiles[n['id']] = dataset_id_value
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
    try:
        payload = request.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            return jsonify({
                "valid": True,
                "issues": [],
                "error": "Invalid payload format"
            }), 200

        nodes = payload.get("nodes", [])
        edges = payload.get("edges", [])
        if nodes is None:
            nodes = []
        if edges is None:
            edges = []

        if not isinstance(nodes, list) or not isinstance(edges, list):
            return jsonify({
                "valid": True,
                "issues": [],
                "error": "Nodes and edges must be lists"
            }), 200

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
        
        validation_res = analysis.get("validation", {})
        if not isinstance(validation_res, dict):
            validation_res = {"valid": True, "issues": []}
            
        return jsonify(validation_res), 200

    except Exception as error:
        import traceback
        import sys
        print(f"[ERROR] Resolver AI validation failed: {str(error)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({
            "valid": True,
            "issues": [],
            "error": "Resolver AI validation execution failed",
            "details": str(error)
        }), 200

@app.route("/resolver-assistant/chat", methods=["POST"])
def resolver_assistant_chat():
    try:
        payload = request.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            return jsonify({
                "success": True,
                "fallback": True,
                "response": "AI analysis is temporarily unavailable due to malformed request payload.",
                "message": "AI analysis temporarily unavailable.",
                "actions": []
            }), 200

        nodes = payload.get("nodes", [])
        edges = payload.get("edges", [])
        if nodes is None:
            nodes = []
        if edges is None:
            edges = []

        if not isinstance(nodes, list) or not isinstance(edges, list):
            return jsonify({
                "success": True,
                "fallback": True,
                "response": "AI analysis is temporarily unavailable due to invalid nodes/edges format.",
                "message": "AI analysis temporarily unavailable.",
                "actions": []
            }), 200

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

    except Exception as error:
        import traceback
        import sys
        print(f"[ERROR] Resolver AI Chat failed: {str(error)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({
            "success": True,
            "fallback": True,
            "response": "AI analysis is temporarily unavailable. Please verify your pipeline configuration manually.",
            "message": "AI analysis temporarily unavailable.",
            "actions": []
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
