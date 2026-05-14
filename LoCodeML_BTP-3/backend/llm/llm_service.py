import logging
from typing import Optional
from .providers.provider_factory import ProviderFactory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class UnifiedLLMService:
    """
    Orchestration service for LLM providers.
    Prepares the architecture for future ECOS adaptive routing 
    by abstracting provider details away from the application logic.
    """
    def __init__(self, default_provider: str = "gemini"):
        # Provider abstraction logic
        self.provider = ProviderFactory.get_provider(default_provider)
        
    def generate_response(self, system_prompt: Optional[str] = None, user_prompt: Optional[str] = None) -> str:
        """
        Generates response using the active provider.
        Maintains frontend-compatible response format.
        """
        prompt = ""
        if system_prompt:
            prompt += f"System: {system_prompt}\n\n"
        if user_prompt:
            prompt += f"User: {user_prompt}\n\n"
            
        if not prompt:
            prompt = "Hello" # Fallback
            
        try:
            return self.provider.generate_response(prompt.strip())
        except Exception as e:
            logger.error(f"UnifiedLLMService Error: {e}")
            raise

    def get_provider_health(self) -> bool:
        """Health monitoring endpoint support."""
        return self.provider.health_check()

    def get_routing_metrics(self) -> dict:
        """
        Metrics for future adaptive routing (latency, health score, failure count).
        """
        return self.provider.get_metrics()

    def switch_provider(self, provider_name: str):
        """
        Switch to a different provider dynamically.
        """
        self.provider = ProviderFactory.get_provider(provider_name)
