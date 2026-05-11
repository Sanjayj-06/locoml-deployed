from flask import Blueprint, request, jsonify
import sys
import os
import json

from dotenv import load_dotenv
load_dotenv()

HYPERBOLIC_API_KEY = os.getenv("HYPERBOLIC_API_KEY")

sys.path.append(os.getenv('PROJECT_PATH'))

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
        """Load pipeline parameters from JSON file"""
        try:
            if not os.path.exists(self.params_file):
                raise FileNotFoundError("Pipeline params file not found")

            with open(self.params_file, 'r') as f:
                params = json.load(f)

            required_fields = ['dataset_name', 'dataset_type', 'dataset_ids']
            if not all(field in params for field in required_fields):
                raise ValueError("Missing required fields in params file")

            return params
        except Exception as e:
            raise Exception(f"Error loading pipeline parameters: {str(e)}")

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
                return jsonify(response_data), 500
            
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