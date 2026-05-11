import requests
import json
import sys
import os
sys.path.append(os.getenv('PROJECT_PATH'))
HYPERBOLIC_API_KEY = os.getenv('HYPERBOLIC_API_KEY')

def LLM(model="deepseek-ai/DeepSeek-V3-0324", system_prompt=None, user_prompt=None):
    print("[DEBUG] Preparing LLM API request...", file=sys.stderr)
    API_KEY = HYPERBOLIC_API_KEY
    if not API_KEY:
        print("[ERROR] API Key is not set. Please set the HYPERRBOLIC_API_KEY environment variable.", file=sys.stderr)
        raise ValueError("API Key is not set.")
    if not system_prompt or not user_prompt:    
        print("[ERROR] System prompt or user prompt is missing.", file=sys.stderr)
        raise ValueError("System prompt or user prompt is missing.")
    url = "https://api.hyperbolic.xyz/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + API_KEY
    }
    data = {
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": user_prompt
                }
            ],
        "model": model,
        "temperature": 0.1,
        "top_p": 0.9
        }
    
    try:
        print("[DEBUG] Sending request to LLM API...", file=sys.stderr)
        response = requests.post(url, headers=headers, json=data)
        print(f"[DEBUG] LLM Response Status: {response.status_code}", file=sys.stderr)
        
        response_json = response.json()
        # print(f"[DEBUG] LLM Raw Response: {json.dumps(response_json, indent=2)}", file=sys.stderr)
        
        llm_response = response_json['choices'][0]['message']['content']
        return llm_response
        
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] LLM API request failed: {str(e)}", file=sys.stderr)
        raise
    except KeyError as e:
        print(f"[ERROR] Unexpected LLM response format: {str(e)}", file=sys.stderr)
        raise
    except Exception as e:
        print(f"[ERROR] Unexpected error in LLM call: {str(e)}", file=sys.stderr)
        raise