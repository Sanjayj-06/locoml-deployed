import uuid
from typing import Dict, List
import json
import os
from datetime import datetime

def generate_duplicate_id() -> str:
    return f"dup_{str(uuid.uuid4())[:8]}"

def EnrichContext(UserPrompt: str):
    availableModels = [
        {
            "id": "model_001",  # Original ID
            "objective": "classification",
            "metadata": {
                "trainingdataset": "WineQuality.csv",
                "model": "RandomForestClassifier",
                "hyperparameters": {
                    "n_estimators": 100,
                    "max_depth": 10
                },
                "metrics": {
                    "accuracy": 0.85,
                    "precision": 0.9,
                    "recall": 0.8
                }
            }
        },
        {
            "id": "model_002",  # Original ID
            "objective": "regression",
            "metadata": {
                "trainingdataset": "WineQuality.csv",
                "model": "RandomForestRegressor",
                "hyperparameters": {
                    "n_estimators": 100,
                    "max_depth": 10
                },
                "metrics": {
                    "accuracy": 0.85,
                    "precision": 0.9,
                    "recall": 0.8
                }
            }
        }
    ]
    modelIDMap = {}
    sanitized_models = []
    for model in availableModels:
        dup_id = generate_duplicate_id()
        modelIDMap[dup_id] = model["id"]
        modelIDMap[model["id"]] = dup_id
        
        sanitized_model = {
            "id": dup_id,
            "objective": model["objective"],
            "metadata": model["metadata"]
        }
        sanitized_models.append(sanitized_model)
    availablePreprocessors = ["Drop Duplicate Rows", "Normalize Features", "Interpolate Missing Values"]
    availableTypes = ["inputData","preprocessing","classification", "regression", "sentiment", "imageclassification"]
    return sanitized_models, availablePreprocessors, availableTypes, modelIDMap
    
    

def preparePrompt(UserPrompt: str, models: List[Dict], preprocessors: List[str], types: List[str]) -> Dict:
    prompt = f"""
    Given the following context, create a machine learning pipeline in the specified JSON format.
    
    User Query: {UserPrompt}
    Context :
        Available Models: {models}
        Available Preprocessors: {preprocessors}
        Available type of nodes: {types}

    Return a JSON pipeline with the following requirements:
    1. Each node must have an 'id', 'data' with 'entity' field, and 'type'
    2. Connect nodes with edges using 'source' and 'target' fields
    3. Include input data, preprocessing steps, and model selection
    4. Use the exact format shown below, filling in appropriate values based on context
    5. Ensure all JSON fields are properly quoted and formatted
    
    Required JSON Format:
    {{
    "Nodes": [
        {{
            "id": "dndnode_<number>",
            "data": {{
                "entity": "<step_name>"
            }},
            "type": "<node_type>"
        }}
    ],
    "Edges": [
        {{
            "id": "dndedge_<number>",
            "source": "<source_node_id>",
            "target": "<target_node_id>"
        }}
    ]
    }}

    Only return the JSON structure, nothing else.
    """
    return prompt

def cleanResponse(response):
    if response.startswith('```json'):
        response = response[7:]  # Remove ```json
    if response.endswith('```'):
        response = response[:-3]  # Remove ```
    response = response.strip()
    return response


def callandValidate(prompt, user_prompt: str, modelIDmap: dict):    
    try:
        # Get LLM response and clean it
        llm_response = LLM(prompt=prompt)
        pipeline_json = cleanResponse(llm_response.strip())
        
        # Parse JSON to validate format
        pipeline = json.loads(pipeline_json)
        
        # Setup logging with absolute path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        log_dir = os.path.join(current_dir, 'responses')
        
        # Create directory if it doesn't exist
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
            
        # Create timestamp and filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = os.path.join(log_dir, f'llm_response_{timestamp}.json')
        
        # Log the response with error handling
        try:
            with open(log_file, 'w') as f:
                json.dump({
                    'timestamp': timestamp,
                    'user_prompt': user_prompt,
                    'response': pipeline
                }, f, indent=2)
                print(f"Response logged to: {log_file}")
        except IOError as e:
            print(f"Error writing to log file: {e}")
            
        return {
            "pipeline": pipeline,
            "success": True,
            "log_file": log_file
        }
            
    except json.JSONDecodeError as e:
        print(f"JSON Decode Error: {e}")
        return {
            "error": f"Invalid JSON format: {str(e)}",
            "success": False
        }
    except Exception as e:
        print(f"Unexpected error: {e}")
        return {
            "error": str(e),
            "success": False
        }
