from flask import Blueprint, jsonify, request
import os
import json
import numpy as np
from collections import Counter
from PIL import Image
import io
import zipfile
from datasets import load_from_disk
from mongoDB import db

img_preprocess = Blueprint('img_preprocess', __name__)

class RunningStats:
    """Class to compute running mean and variance"""
    def __init__(self):
        self.n = 0
        self.old_m = 0
        self.new_m = 0
        self.old_s = 0
        self.new_s = 0
        self.min_val = float('inf')
        self.max_val = float('-inf')

    def update(self, x):
        self.n += 1
        if self.n == 1:
            self.old_m = self.new_m = x
            self.old_s = 0
        else:
            self.new_m = self.old_m + (x - self.old_m) / self.n
            self.new_s = self.old_s + (x - self.old_m) * (x - self.new_m)
            self.old_m = self.new_m
            self.old_s = self.new_s
        self.min_val = min(self.min_val, x)
        self.max_val = max(self.max_val, x)

    def mean(self):
        return self.new_m if self.n else 0.0

    def variance(self):
        return self.new_s / (self.n - 1) if self.n > 1 else 0.0

    def std(self):
        return np.sqrt(self.variance())

def unzip_dataset(zip_path, extract_to):
    """Unzip dataset if not already extracted"""
    if not os.path.exists(extract_to):
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
    return extract_to

def get_dataset_splits(dataset_dict_path):
    """Get dataset splits from dataset_dict.json"""
    with open(dataset_dict_path, 'r') as f:
        dataset_dict = json.load(f)
    return dataset_dict.get('splits', [])

@img_preprocess.route('/img_preprocess/<dataset_id>', methods=['GET'])
def preprocessDataset(dataset_id):
    dataset_path = None
    dataset_info = db['Datasets'].find_one({'dataset_id': dataset_id})
    if dataset_info:
        dataset_path = dataset_info.get('dataset_path')

    if not dataset_path or not os.path.exists(dataset_path):
        project_path = os.getenv('PROJECT_PATH', '')
        dataset_path = os.path.join(project_path, 'Datasets', f'{dataset_id}.zip')

    extract_to = os.path.join(os.getenv('PROJECT_PATH', ''), 'ExtractedDatasets', dataset_id)

    try:
        # Extract dataset
        extract_to = unzip_dataset(dataset_path, extract_to)
        dataset_dict_path = os.path.join(extract_to, 'dataset_dict.json')
        splits = get_dataset_splits(dataset_dict_path)

        if 'train' not in splits:
            return jsonify({'message': 'Train split not found in dataset_dict.json'})

        # Load dataset
        dataset = load_from_disk(extract_to)
        train_split = dataset['train']
        
        # Analyze and return preprocessing suggestions
        return analyze_preprocessing_needs(train_split)
    
    except Exception as e:
        return jsonify({
            'message': f'Error processing dataset: {str(e)}'
        }), 500

def analyze_preprocessing_needs(dataset):
    """Analyze dataset and generate preprocessing suggestions"""
    suggestions = {
        "normalize": False,
        "color_mode_info": {
            "dominant_mode": None,
            "is_mixed": False,
            "conversion_target": None
        },
        "standardize_aspect_ratio": False,
        "handle_alpha_channel": False,
        "resize": False,
        "suggested_resolution": None
    }
    
    # Initialize statistics trackers
    global_pixel_stats = RunningStats()
    global_aspect_stats = RunningStats()
    global_color_modes = Counter()
    global_sizes = Counter()
    total_alpha_channel_count = 0
    processed_images = 0
    
    # Single pass through the dataset
    for img in dataset['image']:
        try:
            # Handle different image formats
            if isinstance(img, Image.Image):
                pil_img = img
            elif isinstance(img, bytes):
                pil_img = Image.open(io.BytesIO(img))
            elif isinstance(img, np.ndarray):
                pil_img = Image.fromarray(img)
            else:
                continue
            
            # Process pixel values
            img_array = np.array(pil_img)
            global_pixel_stats.max_val = max(global_pixel_stats.max_val, np.max(img_array))
            global_pixel_stats.min_val = min(global_pixel_stats.min_val, np.min(img_array))
            
            # Process image dimensions and aspect ratio
            w, h = pil_img.size
            aspect = w / h
            global_aspect_stats.update(aspect)
            global_sizes[(w, h)] += 1
            
            # Process color mode and alpha channel
            global_color_modes[pil_img.mode] += 1
            if pil_img.mode in ['RGBA', 'LA']:
                total_alpha_channel_count += 1
            
            processed_images += 1

        except Exception as e:
            continue
    
    # Skip analysis if no images were processed successfully
    if processed_images == 0:
        return jsonify({
            'message': 'No images could be processed successfully'
        }), 400
    
    # Generate preprocessing suggestions based on collected statistics
    
    # Normalization check
    if global_pixel_stats.max_val > 1.0 and global_pixel_stats.max_val <= 255.0 and global_pixel_stats.min_val >= 0.0:
        suggestions["normalize"] = True
    
    # Color mode analysis
    if global_color_modes:
        dominant_mode, dominant_count = global_color_modes.most_common(1)[0]
        suggestions["color_mode_info"]["dominant_mode"] = dominant_mode
        
        if len(global_color_modes) > 1:
            # Mixed color modes detected
            suggestions["color_mode_info"]["is_mixed"] = True
            suggestions["color_mode_info"]["conversion_target"] = dominant_mode
        else:
            # Single color mode - suggest conversion if appropriate
            if dominant_mode == 'L':
                suggestions["color_mode_info"]["conversion_target"] = 'RGB'
            elif dominant_mode == 'RGB':
                suggestions["color_mode_info"]["conversion_target"] = 'L'
    
    # Aspect ratio standardization check
    if global_aspect_stats.std() > 0.1:
        suggestions["standardize_aspect_ratio"] = True
    
    # Alpha channel handling check
    if total_alpha_channel_count > 0:
        suggestions["handle_alpha_channel"] = True
    
    # Image size standardization check
    if len(global_sizes) > 1:
        most_common_size, _ = global_sizes.most_common(1)[0]
        suggestions["resize"] = True
        suggestions["suggested_resolution"] = most_common_size
    
    return jsonify({
        "preprocessing_suggestions": suggestions,
        "stats": {
            "processed_images": processed_images,
            "unique_sizes": len(global_sizes),
            "color_modes_found": dict(global_color_modes),
            "aspect_ratio_std": round(global_aspect_stats.std(), 3)
        }
    })