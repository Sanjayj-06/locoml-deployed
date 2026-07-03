from flask import Blueprint, request, jsonify
import sys
import os
import json

from dotenv import load_dotenv
load_dotenv()

HYPERBOLIC_API_KEY = os.getenv("HYPERBOLIC_API_KEY")

sys.path.append(os.getenv('PROJECT_PATH', ''))
from auth_helper import get_user_from_request

from APIs.generatePipeline.llm import LLMService
from APIs.generatePipeline.promptLLM import PipelinePromptService

sys.path.append("../")
from mongoDB import db

text_preprocessors = [
    "Drop Duplicate Rows", 
    "Normalize Features", 
    "Interpolate Missing Values"
]

image_preprocessors = [
    "Resize Image", 
    "Color Space Conversion", 
    "Image Normalization"
]

availableTypes = [
    "inputData", 
    "preprocessing", 
    "classification", 
    "regression", 
    "sentiment", 
    "imageclassification"
]

pipelineGenerator = Blueprint("pipelineGenerator", __name__)

class PipelineParamsLoader:
    def __init__(self):
        self.params_file = os.path.join(
            os.path.dirname(__file__), 
            "generatePipeline", 
            "pipeline_params.json"
        )

    def load_params(self):
        """Load the most recent pipeline parameters from MongoDB, then fall back to file."""
        try:
            collection = db["Pipeline_Requests"]
            username = get_user_from_request()
            query = {'username': username} if username else {'username': {'$exists': False}}
            params = collection.find_one(query, sort=[("updated_at", -1)])

            if not params:
                if not os.path.exists(self.params_file):
                    raise FileNotFoundError("Pipeline params not found in database or file")

                with open(self.params_file, 'r') as f:
                    params = json.load(f)

            required_fields = ['dataset_name', 'dataset_type', 'dataset_ids']
            if not all(field in params for field in required_fields):
                raise ValueError("Missing required fields in params file")

            if not params.get('dataset_ids'):
                raise ValueError("No dataset IDs available for the selected dataset. Train the model first or refresh the pipeline request.")

            return params
        except Exception as e:
            raise Exception(f"Error loading pipeline parameters: {str(e)}")


def _pipeline_validation_error(message, details=None, status_code=422):
    payload = {
        "success": False,
        "error": message,
    }
    if details:
        payload["details"] = details
    return jsonify(payload), status_code


def _validate_pipeline_graph(pipeline_data, trained_models, model_id_map):
    errors = []

    if not isinstance(pipeline_data, dict):
        return ["Pipeline response is not a JSON object."]

    nodes = pipeline_data.get("Nodes")
    edges = pipeline_data.get("Edges")

    if not isinstance(nodes, list) or not isinstance(edges, list):
        return ["Pipeline response must contain 'Nodes' and 'Edges' arrays."]

    if not nodes:
        return ["Pipeline contains no nodes."]

    node_ids = [node.get("id") for node in nodes]
    if len(node_ids) != len(set(node_ids)):
        errors.append("Each pipeline node must have a unique id.")

    node_lookup = {node.get("id"): node for node in nodes if node.get("id")}
    incoming = {node_id: 0 for node_id in node_lookup}
    outgoing = {node_id: 0 for node_id in node_lookup}

    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if source not in node_lookup:
            errors.append(f"Edge {edge.get('id', '<unknown>')} points from missing source node '{source}'.")
            continue
        if target not in node_lookup:
            errors.append(f"Edge {edge.get('id', '<unknown>')} points to missing target node '{target}'.")
            continue
        outgoing[source] += 1
        incoming[target] += 1

    input_nodes = [node_id for node_id, count in incoming.items() if count == 0]
    output_nodes = [node_id for node_id, count in outgoing.items() if count == 0]

    if len(input_nodes) != 1:
        errors.append("Pipeline must have exactly one input node with no incoming edges.")
    if len(output_nodes) != 1:
        errors.append("Pipeline must have exactly one final model node with no outgoing edges.")

    for node_id, node in node_lookup.items():
        node_type = node.get("type")
        if node_type != "inputData" and incoming.get(node_id, 0) == 0:
            errors.append(f"Node '{node_id}' ({node_type}) is disconnected from the pipeline input.")
        if node_type != "inputData" and node_type not in {"preprocessing", "classification", "regression", "sentiment", "imageclassification"}:
            errors.append(f"Node '{node_id}' has unsupported type '{node_type}'.")

    model_nodes = [node for node in nodes if node.get("type") in {"classification", "regression", "sentiment", "imageclassification"}]
    if len(model_nodes) != 1:
        errors.append("Pipeline must contain exactly one model node.")
    else:
        model_entity = model_nodes[0].get("data", {}).get("entity")
        if model_entity not in model_id_map:
            errors.append(f"Selected model '{model_entity}' was not found in the database.")

    # Ensure the graph is a single linear chain.
    if nodes and edges and not errors:
        visited = set()
        current = input_nodes[0]
        while True:
            visited.add(current)
            next_edges = [edge for edge in edges if edge.get("source") == current]
            if not next_edges:
                break
            if len(next_edges) > 1:
                errors.append(f"Node '{current}' branches into multiple downstream nodes; a linear pipeline is required.")
                break
            current = next_edges[0].get("target")
            if current in visited:
                errors.append("Pipeline contains a cycle.")
                break
        if not errors and len(visited) != len(nodes):
            missing = [node_id for node_id in node_lookup if node_id not in visited]
            errors.append(f"Pipeline has disconnected nodes: {', '.join(missing)}.")

    return errors

@pipelineGenerator.route("/generatePipeline", methods=["POST"])
def generate_pipeline():
    try:
        print("[DEBUG] Starting pipeline generation...", file=sys.stderr)
        
        # Load parameters from file
        params_loader = PipelineParamsLoader()
        try:
            params = params_loader.load_params()
            print(f"[DEBUG] Loaded pipeline params: {params}", file=sys.stderr)
        except Exception as e:
            return jsonify({
                "success": False,
                "error": str(e)
            }), 400
            
        # Extract parameters
        dataset_name = params['dataset_name']
        dataset_type = params['dataset_type']
        dataset_ids = params['dataset_ids']
        
        # Build user preferences
        user_preferences = {}
        for pref in ['preprocessing_steps', 'task', 'model_type', 'additional_info']:
            if params.get(pref):
                user_preferences[pref] = params[pref]

        print(f"[DEBUG] Processing pipeline request, Dataset: {dataset_name}", file=sys.stderr)
        
        prompt_service = PipelinePromptService(db)
        llm_service = LLMService(api_key=HYPERBOLIC_API_KEY)

        # Skip dataset_ids lookup since we have them in params
        print(f"[DEBUG] Using dataset IDs from params: {dataset_ids}", file=sys.stderr)
        
        print("[DEBUG] Fetching trained models...", file=sys.stderr)
        trained_models = prompt_service.get_models_by_dataset_ids(dataset_ids)
        print(f"[DEBUG] Found {len(trained_models)} trained models", file=sys.stderr)
        
        if not trained_models:
            return jsonify({
                "success": False,
                "error": f"No trained models found for dataset: {dataset_name}"
            }), 404
        
        try:
            print("[DEBUG] Formatting models for prompt...", file=sys.stderr)
            formatted_models, model_id_map = prompt_service.format_models_for_prompt(trained_models)
            
            preprocessors = {
                "text": text_preprocessors,
                "image": image_preprocessors
            }
            types = availableTypes

            print("[DEBUG] Preparing final prompt...", file=sys.stderr)
            final_prompt = prompt_service.prepare_prompt(
                models=formatted_models,
                preprocessors=preprocessors,
                types=types,
                dataset_name=dataset_name,
                dataset_type=dataset_type,
                user_preferences=user_preferences
            )
            
            print("[DEBUG] Calling LLM and validating response...", file=sys.stderr)
            response_data = llm_service.call_and_validate(final_prompt)
            if not response_data.get("success"):
                print(f"[DEBUG] LLM validation failed: {response_data.get('error')}", file=sys.stderr)
                return jsonify({
                    "success": False,
                    "error": response_data.get("error", "Pipeline generation failed"),
                    "details": response_data.get("details", [])
                }), 500

            pipeline_errors = _validate_pipeline_graph(response_data.get("pipeline"), trained_models, model_id_map)
            if pipeline_errors:
                print(f"[DEBUG] Pipeline validation errors: {pipeline_errors}", file=sys.stderr)
                return _pipeline_validation_error(
                    "Pipeline could not be connected into a valid linear flow.",
                    pipeline_errors,
                    422,
                )
            
            print("[DEBUG] Pipeline generation successful", file=sys.stderr)
            return jsonify({
                "success": True,
                "data": {
                    "pipeline": response_data["pipeline"],
                    "logFile": response_data["log_file"],
                    "modelMap": model_id_map
                }
            })
            
        except Exception as e:
            print(f"[ERROR] Pipeline generation failed: {str(e)}", file=sys.stderr)
            return jsonify({
                "success": False,
                "error": f"Pipeline generation failed: {str(e)}"
            }), 500
            
    except Exception as e:
        print(f"[ERROR] Unexpected error: {str(e)}", file=sys.stderr)
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }), 500