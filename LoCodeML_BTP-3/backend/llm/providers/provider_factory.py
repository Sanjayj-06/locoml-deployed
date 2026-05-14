from .gemini_provider import GeminiProvider

class ProviderFactory:
    """
    Factory to instantiate LLM providers.
    Future providers (OpenAI, Claude, Ollama, DeepSeek, local models) 
    can be added here dynamically.
    """
    
    @staticmethod
    def get_provider(provider_name: str = "gemini"):
        if provider_name.lower() == "gemini":
            return GeminiProvider()
        # Add future providers here:
        # elif provider_name.lower() == "openai":
        #     return OpenAIProvider()
        # elif provider_name.lower() == "claude":
        #     return ClaudeProvider()
        # elif provider_name.lower() == "ollama":
        #     return OllamaProvider()
        else:
            raise ValueError(f"Unknown provider: {provider_name}")
