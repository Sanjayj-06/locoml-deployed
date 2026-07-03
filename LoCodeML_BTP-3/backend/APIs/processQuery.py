from flask import Blueprint, request, jsonify
import sys
import json
import os
sys.path.append(os.getenv('PROJECT_PATH', ''))
from APIs.generatePipeline.processQueryResource import ProcessQuery

processQuery = Blueprint('processQuery', __name__)
@processQuery.route('/processQuery', methods=['POST'])
def process_query_helper():
    try:
        print("[DEBUG] Starting query processing...", file=sys.stderr)

        # Validate request
        request_data = request.json
        print(f"[DEBUG] Received request data: {request_data}", file=sys.stderr)

        if not request_data or 'prompt' not in request_data:
            print("[DEBUG] Missing required fields in request", file=sys.stderr)
            return jsonify({
                "success": False,
                "error": "Missing required fields: 'prompt'"
            }), 400

        user_prompt = request_data.get('prompt')
        previous_messges = request_data.get('previous_messages', [])
        
        print(f"[DEBUG] User prompt: {user_prompt}", file=sys.stderr)
        print(f"[DEBUG] Previous messages: {previous_messges}", file=sys.stderr)

        process_query_instance = ProcessQuery(user_prompt, previous_messges)
        result = process_query_instance.process_query()

        if not result:
            print("[DEBUG] Query processing returned no result", file=sys.stderr)
            return jsonify({
                "success": False,
                "error": "Pipeline assistant returned no response. Please verify HYPERBOLIC_API_KEY and try again."
            }), 503

        got_required_params, response = result
        # Prepare response
        if response:
            print("[DEBUG] Query processed successfully", file=sys.stderr)
            return jsonify({
                "success": True,
                "got_required_params": got_required_params,
                "data": response
            }), 200
        else:
            print("[DEBUG] Query processing failed", file=sys.stderr)
            return jsonify({
                "success": False,
                "error": "Failed to process the query"
            }), 500
    except Exception as e:
        print(f"[DEBUG] Unexpected error: {e}", file=sys.stderr)
        return jsonify({
            "success": False,
            "error": f"Pipeline assistant error: {str(e)}"
        }), 500