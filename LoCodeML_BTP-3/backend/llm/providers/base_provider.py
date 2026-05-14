from abc import ABC, abstractmethod

class BaseProvider(ABC):
    """
    Abstract base provider for LLMs.
    """
    @abstractmethod
    def generate_response(self, prompt: str) -> str:
        """Generate response from the LLM given a prompt."""
        pass
        
    @abstractmethod
    def health_check(self) -> bool:
        """Check the health of the provider."""
        pass
        
    @abstractmethod
    def get_metrics(self) -> dict:
        """Get performance and routing metrics."""
        pass
