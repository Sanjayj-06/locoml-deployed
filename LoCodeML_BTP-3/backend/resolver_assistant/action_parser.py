import re
import json
import logging

logger = logging.getLogger(__name__)

class ActionParser:
    @staticmethod
    def parse_actions(text):
        """
        Parses structured repair actions out of the assistant's response.
        Looks for markdown JSON blocks, and falls back to searching for JSON patterns.
        """
        if not text:
            return []

        # 1. Look for ```json ... ``` fenced code block
        json_block_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
        if json_block_match:
            try:
                parsed = json.loads(json_block_match.group(1).strip())
                if isinstance(parsed, dict) and "actions" in parsed:
                    return parsed["actions"]
            except Exception as e:
                logger.error(f"Failed to parse JSON inside ```json block: {e}")

        # 2. Look for general ``` ... ``` fenced code block if it contains "actions"
        general_block_match = re.finditer(r'```\s*(.*?)\s*```', text, re.DOTALL)
        for match in general_block_match:
            content = match.group(1).strip()
            if "actions" in content:
                try:
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and "actions" in parsed:
                        return parsed["actions"]
                except Exception:
                    pass

        # 3. Fallback: search for first occurrence of { ... "actions" ... } in raw text
        raw_json_match = re.search(r'\{\s*"actions"\s*:\s*\[.*\]\s*\}', text, re.DOTALL | re.IGNORECASE)
        if raw_json_match:
            try:
                parsed = json.loads(raw_json_match.group(0).strip())
                if isinstance(parsed, dict) and "actions" in parsed:
                    return parsed["actions"]
            except Exception:
                pass

        return []
