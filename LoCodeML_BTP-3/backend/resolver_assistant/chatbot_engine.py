import os
import logging
import google.generativeai as genai # type: ignore
from google.api_core.exceptions import GoogleAPIError

logger = logging.getLogger(__name__)

class ChatbotEngine:
    def __init__(self):
        self.api_key = os.getenv("RESOLVER_ASSISTANT_API_KEY")
        if not self.api_key:
            logger.warning("RESOLVER_ASSISTANT_API_KEY is not set. Falling back to PIPELINE_LLM_API_KEY for fallback.")
            self.api_key = os.getenv("PIPELINE_LLM_API_KEY")

        if not self.api_key:
            raise ValueError("No Gemini API Key found in .env. Please set RESOLVER_ASSISTANT_API_KEY.")

    def get_response(self, system_instruction, user_prompt):
        """
        Sends system instruction and prompt to Gemini using the RESOLVER_ASSISTANT_API_KEY.
        """
        try:
            # Reconfigure genai for this client/session to ensure strict key usage
            genai.configure(api_key=self.api_key)
            
            model = genai.GenerativeModel(
                model_name="gemini-flash-latest",
                system_instruction=system_instruction
            )
            
            logger.info("Sending request to Resolver Assistant Gemini model...")
            response = model.generate_content(user_prompt)
            
            if not response or not response.text:
                raise ValueError("Empty response received from Gemini.")
                
            return response.text
            
        except GoogleAPIError as e:
            logger.error(f"Google API Error in Resolver Assistant: {e}")
            raise RuntimeError(f"Resolver Assistant Google API Error: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in Resolver Assistant Chatbot: {e}")
            raise RuntimeError(f"Resolver Assistant error: {e}")
