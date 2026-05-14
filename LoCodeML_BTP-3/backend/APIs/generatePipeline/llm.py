import json
import sys
import re
import os
from datetime import datetime

# Using the unified LLM service for ECOS adaptive routing
from llm.llm_service import UnifiedLLMService

class LLMService:
    def __init__(self, api_key=None, model=None):
        # We now use the unified ECOS service which manages API keys and providers
        self.unified_service = UnifiedLLMService()

    def call_llm(self, system_prompt=None):
        """Make API call to LLM service"""
        print("[DEBUG] Preparing LLM API request via UnifiedService...", file=sys.stderr)
        
        try:
            return self.unified_service.generate_response(system_prompt=system_prompt)
        except Exception as e:
            print(f"[ERROR] LLM API request failed: {str(e)}", file=sys.stderr)
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