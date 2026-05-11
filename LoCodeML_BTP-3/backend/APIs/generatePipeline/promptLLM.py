import uuid
import json
import os
import sys

sys.path.append("../../")
from mongoDB import db

class PipelinePromptService:
    def __init__(self, db_connection):
        self.db = db_connection
        self.prompt_file_path = os.path.join(os.path.dirname(__file__), "pipeline_system_prompt.txt")

    def format_models_for_prompt(self, models):
        """Format models for the LLM prompt and create ID mapping"""
        model_id_map = {}
        formatted_models = []
        
        for model in models:
            dup_id = self._generate_duplicate_id()
            
            model_id_map[dup_id] = model["model_id"]
            model_id_map[model["model_id"]] = dup_id
            
            formatted_model = self._format_single_model(model, dup_id)
            formatted_models.append(formatted_model)
        
        return formatted_models, model_id_map

    def _format_single_model(self, model, dup_id):
        """Helper method to format a single model"""
        parameters = model.get("parameters", {})
        parameter_dict = {p["parameter_name"]: p["parameter_value"] for p in parameters}

        evaluation_metrics = model.get("evaluation_metrics", {})
        evaluation_metrics_dict = {m["metric_name"]: m["metric_value"] for m in evaluation_metrics}
        
        formatted_model = {
            "id": dup_id,
            "objective": model.get("objective", "unknown"),
            "model": model.get("estimator_type", ""),
            "parameters": parameter_dict,
            "metrics": evaluation_metrics_dict
        }

        if "target_column" in model:
            formatted_model["target_column"] = model["target_column"]
            
        if model.get("objective") == "imageClassification":
            self._add_image_preprocessing_info(formatted_model, model)

        return formatted_model

    def _add_image_preprocessing_info(self, formatted_model, model):
        """Add image-specific preprocessing information"""
        preprocessing = model.get("input_schema", {}).get("preprocessing", {})
        
        resize = preprocessing.get("resize", None)
        if resize and len(resize) == 2:
            formatted_model["resize_preprocessing_width"] = resize[0]
            formatted_model["resize_preprocessing_height"] = resize[1]

        color_space = model.get("input_schema", {}).get("format", None)
        if color_space:
            formatted_model["color_space"] = color_space

        normalization = preprocessing.get("normalization", None)
        if normalization:
            formatted_model["normalization_mean"] = normalization.get("mean", [])
            formatted_model["normalization_std"] = normalization.get("std", [])

    def get_dataset_ids_by_name(self, dataset_name):
        """Retrieve dataset IDs from database by name"""
        try:
            collection = self.db['Datasets']
            datasets = list(collection.find({"dataset_name": dataset_name}))
            return [dataset.get("dataset_id") for dataset in datasets if "dataset_id" in dataset]
        except Exception as e:
            print(f"Error retrieving dataset IDs: {str(e)}")
            return []
    
    def get_models_by_dataset_ids(self, dataset_ids):
        """Retrieve models from database by dataset IDs"""
        try:
            collection = self.db["Model_zoo"]
            models = list(collection.find({"dataset_id": {"$in": dataset_ids}}))
            return [{k: v for k, v in model.items() if k != '_id'} for model in models]
        except Exception as e:
            print(f"Error retrieving trained models: {str(e)}")
            return []

    def _generate_duplicate_id(self) -> str:
        """Generate a unique duplicate ID"""
        return f"dup_{str(uuid.uuid4())[:8]}"

    def prepare_prompt(self, models: list, preprocessors: dict, types: list, 
                      dataset_name: str, dataset_type: str, user_preferences: dict) -> str:
        """Prepare the final prompt for LLM"""
        try:
            with open(self.prompt_file_path, "r") as f:
                template = f.read()
        except FileNotFoundError:
            raise FileNotFoundError("Pipeline system prompt template file not found")

        replacements = {
            "{dataset_name}": dataset_name,
            "{models}": json.dumps(models, indent=2),
            "{dataset_type}": dataset_type,
            "{user_preferences}": json.dumps(user_preferences, indent=2),
            "{text_preprocessors}": json.dumps(preprocessors["text"], indent=2),
            "{image_preprocessors}": json.dumps(preprocessors["image"], indent=2),
            "{types}": json.dumps(types, indent=2)
        }

        final_prompt = template
        for key, value in replacements.items():
            final_prompt = final_prompt.replace(key, value)

        return final_prompt
