import os
import time
import logging
import google.generativeai as genai  # type: ignore
from google.generativeai.types import generation_types  # type: ignore
from google.api_core.exceptions import GoogleAPIError
from .base_provider import BaseProvider

logger = logging.getLogger(__name__)

class GeminiProvider(BaseProvider):
    """
    Google Gemini API provider implementation.
    """
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            logger.error("GEMINI_API_KEY is not set.")
            raise ValueError("GEMINI_API_KEY is required for GeminiProvider.")
            
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel("gemini-flash-latest")
        
        self.metrics = {
            "latency_ms": 0,
            "failure_count": 0,
            "success_count": 0,
            "health_score": 100, # 0-100 scale for future adaptive routing
            "provider_name": "gemini"
        }

    def generate_response(self, prompt: str) -> str:
        start_time = time.time()
        logger.info(f"Incoming prompt to Gemini: {prompt[:100]}...")
        
        try:
            response = self.model.generate_content(prompt)
            
            if not response or not response.text:
                raise ValueError("Empty response received from Gemini.")
                
            latency = (time.time() - start_time) * 1000
            self.metrics["latency_ms"] = latency
            self.metrics["success_count"] += 1
            
            # Token usage logging if available in usage_metadata
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                logger.info(f"Token usage - Prompt: {response.usage_metadata.prompt_token_count}, "
                            f"Candidates: {response.usage_metadata.candidates_token_count}, "
                            f"Total: {response.usage_metadata.total_token_count}")
            
            logger.info(f"Provider: Gemini, Latency: {latency:.2f}ms")
            
            return response.text
            
        except generation_types.StopCandidateException as e:
            logger.error(f"Malformed response or generation stopped: {e}")
            self._handle_failure()
            raise RuntimeError(f"Gemini generation stopped unexpectedly: {e}")
        except GoogleAPIError as e:
            # Handle rate limits, quota exceeded, invalid API key, etc.
            logger.error(f"Google API Error (e.g., Quota exceeded, Invalid Key, Timeout): {e}")
            self._handle_failure()
            raise RuntimeError(f"Google API Error: {e}")
        except Exception as e:
            logger.error(f"Unexpected error calling Gemini: {e}")
            self._handle_failure()
            raise RuntimeError(f"Gemini API Error: {e}")

    def _handle_failure(self):
        self.metrics["failure_count"] += 1
        self.metrics["health_score"] = max(0, self.metrics["health_score"] - 10)

    def health_check(self) -> bool:
        try:
            self.model.generate_content("hello")
            self.metrics["health_score"] = min(100, self.metrics["health_score"] + 5)
            return True
        except Exception as e:
            logger.warning(f"Health check failed for Gemini: {e}")
            self._handle_failure()
            return False

    def get_metrics(self) -> dict:
        return self.metrics
