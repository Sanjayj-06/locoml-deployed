import requests
import json
import sys
import re
import os
from datetime import datetime

class LLMService:
    def __init__(self, api_key,
                  model="deepseek-ai/DeepSeek-V3-0324"):
        self.api_key = api_key
        self.model = model
        self.url = "https://api.hyperbolic.xyz/v1/chat/completions"
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

    def call_llm(self, system_prompt=None):
        """Make API call to LLM service"""
        print("[DEBUG] Preparing LLM API request...", file=sys.stderr)
        
        data = {
            "messages": [
                {
                    "role": "user",
                    "content": system_prompt
                }
            ],
            "model": self.model,
            "temperature": 0.1,
            "top_p": 0.9
        }
        
        print(f"[DEBUG] LLM Request - URL: {self.url}", file=sys.stderr)
        print(f"[DEBUG] LLM Request - Data: {json.dumps(data, indent=2)}", file=sys.stderr)
        
        try:
            print("[DEBUG] Sending request to LLM API...", file=sys.stderr)
            response = requests.post(self.url, headers=self.headers, json=data)
            print(f"[DEBUG] LLM Response Status: {response.status_code}", file=sys.stderr)
            
            response_json = response.json()
            print(f"[DEBUG] LLM Raw Response: {json.dumps(response_json, indent=2)}", file=sys.stderr)
            
            return response_json['choices'][0]['message']['content']
            
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] LLM API request failed: {str(e)}", file=sys.stderr)
            raise
        except KeyError as e:
            print(f"[ERROR] Unexpected LLM response format: {str(e)}", file=sys.stderr)
            raise
        except Exception as e:
            print(f"[ERROR] Unexpected error in LLM call: {str(e)}", file=sys.stderr)
            raise

    def clean_response(self, response):
        """Clean and extract JSON from LLM response"""
        match = re.search(r'```json\s*(\{.*\})\s*```', response, re.DOTALL)
        if match:
            response = match.group(1)
        return response.strip()

    def call_and_validate(self, final_prompt):
        """Call LLM, validate and log response"""
        try:
            print("[DEBUG] Calling LLM API...", file=sys.stderr)
            llm_response = self.call_llm(system_prompt=final_prompt)
            print(f"[DEBUG] Raw LLM response: {llm_response}", file=sys.stderr)
            
            pipeline_json = self.clean_response(llm_response.strip())
            print(f"[DEBUG] Cleaned response: {pipeline_json}", file=sys.stderr)
            
            pipeline = json.loads(pipeline_json)
            
            # Setup logging
            current_dir = os.path.dirname(os.path.abspath(__file__))
            log_dir = os.path.join(current_dir, 'responses')
            
            if not os.path.exists(log_dir):
                os.makedirs(log_dir)
                
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            log_file = os.path.join(log_dir, f'llm_response_{timestamp}.json')
            
            try:
                with open(log_file, 'w') as f:
                    json.dump({
                        'timestamp': timestamp,
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