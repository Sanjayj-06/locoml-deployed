import sys
import json
import os
sys.path.append(os.getenv('PROJECT_PATH', ''))
from functions.LLM_API import LLM
from mongoDB import db
from auth_helper import get_user_from_request
import re
import datetime
from APIs.generatePipeline.pipelineParameters import PipelineParameters

prompt_file_path = os.path.join(os.path.dirname(__file__), "process_query_SP.txt")
# previous_responses_file_path = os.path.join(os.path.dirname(__file__), "pipeline_params.json")

class ProcessQuery:
    def __init__(self, user_prompt, previous_messages):
        self.user_prompt = user_prompt
        self.previous_messages = previous_messages

    def process_query(self):
        try:
            print("[DEBUG] Entering process_query", file=sys.stderr)
            available_datasets = self.get_trained_datasets()
            print(f"[DEBUG] Available datasets: {available_datasets}", file=sys.stderr)            
            system_prompt = self.prepare_prompt(available_datasets)
            print(f"[DEBUG] System prompt prepared.", file=sys.stderr)
            previous_messeges_str = ""
            for i, message in enumerate(self.previous_messages):
                if isinstance(message, str):
                    self.previous_messages[i] = message.replace("\n", " ")
                    previous_messeges_str += message + "\n"
            final_prompt = previous_messeges_str + self.user_prompt
            print(f"[DEBUG] Final prompt:\n{final_prompt}", file=sys.stderr)
            llm_response = LLM(system_prompt=system_prompt, user_prompt=final_prompt)
            # print(f"[DEBUG] LLM response: {llm_response}", file=sys.stderr)
            
            result = self.parse_response(llm_response)
            if result is None:
                return False, "The pipeline assistant could not parse the model response. Please try again."
            return result
        except Exception as e:
            print(f"[DEBUG] Error in process_query: {e}", file=sys.stderr)
            return False, f"Pipeline assistant unavailable: {str(e)}"
    
    def get_trained_datasets(self):
        try:
            print("[DEBUG] Fetching datasets from DB", file=sys.stderr)
            collection = db["Datasets"]
            username = get_user_from_request()
            query = {'username': username} if username else {'username': {'$exists': False}}
            datasets = collection.find(query)
            available_datasets = [dataset for dataset in datasets]
            self.dataset_name_to_id = {}
            for dataset in available_datasets:
                if 'dataset_name' in dataset and 'dataset_id' in dataset:
                    name = dataset['dataset_name']
                    did = dataset['dataset_id']
                    if name not in self.dataset_name_to_id:
                        self.dataset_name_to_id[name] = []
                    self.dataset_name_to_id[name].append(did)
            return self.dataset_name_to_id.keys()
        except Exception as e:
            print(f"[DEBUG] Error in get_trained_datasets: {e}", file=sys.stderr)
            self.dataset_name_to_id = {}
            return []

    def _save_pipeline_context(self, save_data):
        try:
            collection = db["Pipeline_Requests"]
            document = dict(save_data)
            document["updated_at"] = datetime.datetime.utcnow()
            username = get_user_from_request()
            if username:
                document["username"] = username
            collection.insert_one(document)
            return True
        except Exception as e:
            print(f"[DEBUG] Error saving pipeline context to DB: {e}", file=sys.stderr)
            return False
    
    def prepare_prompt(self, available_datasets):
        try:
            print("[DEBUG] Preparing system prompt", file=sys.stderr)
            with open(prompt_file_path, "r") as f:
                template = f.read()
            dataset_names = ", ".join(available_datasets)
            dataset_types_str = ", ".join(["text", "image"])
            available_tasks_str = ", ".join(["classification", "regression", "sentimentanalysis", "imageclassification"])
            params_instance = PipelineParameters()
            all_params_str = ", ".join(params_instance.get_all_params())
            must_required_params_str = ", ".join(params_instance.get_must_required_params())
            prompt = (
                template.replace("{available_datasets}", dataset_names)
                .replace("{dataset_types}", dataset_types_str)
                .replace("{all_params}", all_params_str)
                .replace("{must_required_params}", must_required_params_str)
                .replace("{available_tasks}", available_tasks_str)
            )
            return prompt
        except Exception as e:
            print(f"[DEBUG] Error in prepare_prompt: {e}", file=sys.stderr)
            return ""
    
    def cleanResponse(self, response):
        match = re.search(r'```json\s*(\{.*\})\s*```', response, re.DOTALL)
        if match:
            response = match.group(1)
        else:
            match = re.search(r'```(.*?)```', response, re.DOTALL)
            if match:
                response = match.group(1)
        response = response.strip()
        return response
    
    
    def parse_response(self, llm_response):
        required_params = PipelineParameters()
        try:
            cleaned_response = self.cleanResponse(llm_response.strip())
            # Fix booleans and None to be JSON valid
            cleaned_response = (
                cleaned_response
                .replace("False", "false")
                .replace("True", "true")
                .replace("None", "null")
            )
            response_data = json.loads(cleaned_response)
            print(f"[DEBUG] Parsed LLM response: {response_data}", file=sys.stderr)
            got_required_params = response_data.get('got_all_required_params', False)
            if got_required_params:
                required_params.dataset_name = response_data.get('dataset_name')
                required_params.dataset_type = response_data.get('dataset_type')
                required_params.preprocessing_steps = response_data.get('preprocessing_steps')
                required_params.task = response_data.get('task')
                required_params.model_type = response_data.get('model_type')
                required_params.additional_info = response_data.get('additional_info')
                print(f"[DEBUG] All required params filled: {required_params.__dict__}", file=sys.stderr)
                
                # --- Save parameters to file ---
                save_data = required_params.__dict__.copy()
                # Add dataset ids if available
                dataset_name = save_data.get('dataset_name')
                dataset_ids = []
                if hasattr(self, 'dataset_name_to_id') and dataset_name:
                    # If dataset_name is a list, get ids for all; else, just one
                    if isinstance(dataset_name, list):
                        dataset_ids = [self.dataset_name_to_id.get(name) for name in dataset_name if name in self.dataset_name_to_id]
                    else:
                        if dataset_name in self.dataset_name_to_id:
                            dataset_ids = self.dataset_name_to_id[dataset_name]
                save_data['dataset_ids'] = dataset_ids
                save_data['got_required_params'] = True
                save_data['user_prompt'] = self.user_prompt
                save_data['previous_messages'] = self.previous_messages
                self._save_pipeline_context(save_data)
                return True, required_params.__dict__
            else:
                clarification = response_data.get('clarifying_question')
                print(f"[DEBUG] Clarification needed: {clarification}", file=sys.stderr)
                save_data = {
                    "user_prompt": self.user_prompt,
                    "clarifying_question": clarification,
                    "got_required_params": False,
                    "dataset_ids": [],
                    "updated_at": datetime.datetime.utcnow(),
                }
                self._save_pipeline_context(save_data)
                return False, clarification
        except json.JSONDecodeError as e:
            print(f"[DEBUG] Error parsing JSON: {e}", file=sys.stderr)
            print(f"[DEBUG] LLM response was: {llm_response}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"[DEBUG] Unexpected error in parse_response: {e}", file=sys.stderr)
            return None