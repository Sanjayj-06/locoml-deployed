from flask import Blueprint, jsonify, request
import numpy as np
import os
import json

apply_preprocess = Blueprint('apply_preprocess', __name__)
@apply_preprocess.route('/apply_preprocess/<dataset_id>', methods=['POST'])
def apply_preprocessing(dataset_id):
    try:
        params = request.get_json()
        
        # Create PreprocessingTasks directory if it doesn't exist
        preprocessing_dir = './PreprocessingTasks'
        os.makedirs(preprocessing_dir, exist_ok=True)
        
        # Create the preprocessing configuration file path
        preprocessing_config_path = os.path.join(preprocessing_dir, f'{dataset_id}.json')
        
        # Read existing preprocessing suggestions
        with open(preprocessing_config_path, 'r') as f:
            existing_config = json.load(f)
        
        # Update the preprocessing suggestions with user selections
        existing_config['preprocessing_suggestions'].update({
            'normalize': params.get('normalize', False),
            'standardize_aspect_ratio': params.get('standardize_aspect_ratio', False),
            'handle_alpha_channel': params.get('handle_alpha_channel', False),
            'resize': params.get('resize', False),
            'suggested_resolution': params.get('suggested_resolution', None),
        })
        
        # Only update color_mode_info if it exists in params
        if params.get('color_mode_info'):
            existing_config['preprocessing_suggestions']['color_mode_info'] = params['color_mode_info']
        
        # Save updated configuration
        with open(preprocessing_config_path, 'w') as f:
            json.dump(existing_config, f, indent=4)
        
        return jsonify({
            'message': 'Preprocessing configuration updated successfully',
            'preprocessing_suggestions': existing_config['preprocessing_suggestions']
        })
        
    except Exception as e:
        return jsonify({
            'message': f'Error updating preprocessing configuration: {str(e)}'
        }), 500
