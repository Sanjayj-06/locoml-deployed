import sys
import os
sys.path.append(os.getenv('PROJECT_PATH'))

# Using the unified LLM service for ECOS adaptive routing
from llm.llm_service import UnifiedLLMService

def LLM(model=None, system_prompt=None, user_prompt=None):
    print("[DEBUG] Preparing LLM API request via UnifiedService...", file=sys.stderr)
    
    if not system_prompt or not user_prompt:    
        print("[ERROR] System prompt or user prompt is missing.", file=sys.stderr)
        raise ValueError("System prompt or user prompt is missing.")
        
    try:
        service = UnifiedLLMService()
        return service.generate_response(system_prompt=system_prompt, user_prompt=user_prompt)
    except Exception as e:
        print(f"[ERROR] LLM API request failed: {str(e)}", file=sys.stderr)
        raise