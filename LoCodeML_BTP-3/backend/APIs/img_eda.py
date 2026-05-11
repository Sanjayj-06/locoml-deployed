from flask import Blueprint, jsonify, request
import pandas as pd
import numpy as np
import json
import os
import json
import numpy as np
from collections import Counter, defaultdict
import pyarrow as pa
import pyarrow.dataset as ds
from PIL import Image
import io
import glob
import zipfile
from datasets import load_from_disk
import shutil  # Add this import at the top

img_eda = Blueprint('img_eda', __name__)

@img_eda.route('/img_eda/<dataset_id>', methods=['GET'])
def edaDataset(dataset_id):
    dataset_path = './Datasets/' + dataset_id + '.zip'
    extract_to = './ExtractedDatasets/' + dataset_id

    try:
        print(extract_to, flush=True)
        extract_to = unzip_dataset(dataset_path, extract_to)
        print(extract_to, flush=True)
        
        dataset_dict_path = os.path.join(extract_to, 'dataset_dict.json')
        splits = get_dataset_splits(dataset_dict_path)
        print(splits, flush=True)

        if 'train' not in splits:
            print("Train split not found in dataset_dict.json")
            return jsonify({
                'message': 'Train split not found in dataset_dict.json'
            })
        
        dataset = load_from_disk(extract_to, keep_in_memory=True)
        train_split = dataset['train']
        dataset_info_path = os.path.join(extract_to, 'train', 'dataset_info.json')
        print(dataset_info_path, flush=True)
        
        preprocessing_dir = './PreprocessingTasks'
        os.makedirs(preprocessing_dir, exist_ok=True)
        preprocessing_file = os.path.join(preprocessing_dir, f'{dataset_id}.json')
        
        result = analyze_dataset_stats(train_split, dataset_info_path, preprocessing_file)
        
        # Delete the extracted folder after analysis is complete
        if os.path.exists(extract_to):
            shutil.rmtree(extract_to)
            print(f"Cleaned up extracted dataset at {extract_to}", flush=True)
        
        return result
        
    except Exception as e:
        # Ensure cleanup happens even if there's an error
        if os.path.exists(extract_to):
            shutil.rmtree(extract_to)
        print(f"Error during EDA: {e}")
        return jsonify({
            'message': f'Error during EDA: {str(e)}'
        }), 500

@img_eda.route('/preprocessing_tasks/<dataset_id>', methods=['GET'])
def get_preprocessing_tasks(dataset_id):
    preprocessing_file = os.path.join('./PreprocessingTasks', f'{dataset_id}.json')
    try:
        with open(preprocessing_file, 'r') as f:
            preprocessing_data = json.load(f)
        return jsonify(preprocessing_data['preprocessing_suggestions'])
    except FileNotFoundError:
        return jsonify({'error': 'Preprocessing suggestions not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def unzip_dataset(zip_path, extract_to):
    if not os.path.exists(extract_to):
        print(f"Extracting dataset to {extract_to}...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
        print("Extraction complete!")
    else:
        print(f"Using existing extracted dataset at {extract_to}")
    return extract_to

def get_dataset_splits(dataset_dict_path):
    with open(dataset_dict_path, 'r') as f:
        dataset_dict = json.load(f)
    return dataset_dict.get('splits', [])

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

def analyze_dataset_stats(dataset, dataset_info_path, preprocessing_file):
    print("Analyzing dataset...", flush=True)
    
    with open(dataset_info_path, 'r') as f:
        dataset_info = json.load(f)

    split_stats = {
        "classes": [],
        "metadata": {
            "total_images": 0,
            "corrupt_images": 0,
            "total_classes": 0,
            "class_balance": "unknown"
        },
        "preprocessing_suggestions": {
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
    }
    
    if 'label' not in dataset.features:
        print("No 'label' column found in the dataset")
        return jsonify({
            'message': 'No "label" column found in the dataset'
        })
    
    labels = dataset['label']
    unique_labels = np.unique(labels)
    label_counts = Counter(labels)
    
    # Dataset-wide analysis containers
    global_pixel_stats = RunningStats()
    global_aspect_stats = RunningStats()
    global_color_modes = Counter()
    global_sizes = Counter()
    total_alpha_channel_count = 0
    
    for class_index in unique_labels:
        class_name = str(class_index)
        if 'features' in dataset_info and 'label' in dataset_info['features']:
            if 'names' in dataset_info['features']['label']:
                class_name = dataset_info['features']['label']['names'][class_index]
        
        class_stats = {
            "class_name": class_name,
            "index": int(class_index),
            "type": "image",
            "number_of_images": label_counts[class_index],
            "dominant_aspect_ratio": "unknown",
            "aspect_ratio_variation": 0,
            "color_mode": "unknown",
            "has_alpha_channel": False,
            "average_file_size_kb": 0,
            "number_of_missing_values": 0,
            "preprocessing_suggestions": []
        }
        
        class_images = dataset.filter(lambda example: example['label'] == class_index)
        
        # Class-specific running stats
        class_aspect_stats = RunningStats()
        class_filesize_stats = RunningStats()
        class_color_modes = Counter()
        alpha_channel_count = 0
        corrupt_count = 0
        
        for img in class_images['image']:
            try:
                if isinstance(img, Image.Image):
                    pil_img = img
                elif isinstance(img, bytes):
                    pil_img = Image.open(io.BytesIO(img))
                elif isinstance(img, np.ndarray):
                    pil_img = Image.fromarray(img)
                else:
                    raise ValueError(f"Unsupported image type: {type(img)}")
                
                # Check pixel values min/max
                img_array = np.array(pil_img)
                global_pixel_stats.max_val = max(global_pixel_stats.max_val, np.max(img_array))
                global_pixel_stats.min_val = min(global_pixel_stats.min_val, np.min(img_array))
                
                # File size
                if isinstance(img, bytes):
                    file_size_kb = len(img) / 1024
                else:
                    file_size_kb = len(pil_img.tobytes()) / 1024
                class_filesize_stats.update(file_size_kb)
                
                # Aspect ratio
                w, h = pil_img.size
                aspect = w / h
                class_aspect_stats.update(aspect)
                global_aspect_stats.update(aspect)
                global_sizes[(w, h)] += 1

                # Color mode
                class_color_modes[pil_img.mode] += 1
                global_color_modes[pil_img.mode] += 1
                
                if pil_img.mode in ['RGBA', 'LA']:
                    alpha_channel_count += 1
                    total_alpha_channel_count += 1
                    
            except Exception as e:
                print(f"Error processing image: {e}")
                corrupt_count += 1
        
        valid_image_count = len(class_images) - corrupt_count
        if valid_image_count > 0:
            class_stats["number_of_images"] = valid_image_count
            
            class_stats["dominant_aspect_ratio"] = round(class_aspect_stats.mean(), 2)
            class_stats["aspect_ratio_variation"] = round(class_aspect_stats.std(), 3)
            
            if class_color_modes:
                most_common_mode, mode_count = class_color_modes.most_common(1)[0]
                class_stats["color_mode"] = most_common_mode
                
                if mode_count != valid_image_count:
                    class_stats["preprocessing_suggestions"].append("STANDARDIZE_COLOR_MODE")
            
            if alpha_channel_count > 0:
                class_stats["has_alpha_channel"] = True
                if alpha_channel_count != valid_image_count:
                    class_stats["preprocessing_suggestions"].append("HANDLE_ALPHA_CHANNEL")
            
            class_stats["average_file_size_kb"] = round(class_filesize_stats.mean(), 2)
            
            if class_stats["aspect_ratio_variation"] > 0.1:
                class_stats["preprocessing_suggestions"].append("RESIZE_STANDARDIZE")
        
        class_stats["number_of_missing_values"] = corrupt_count
        
        split_stats["metadata"]["total_images"] += valid_image_count
        split_stats["metadata"]["corrupt_images"] += corrupt_count
        split_stats["classes"].append(class_stats)
    
    split_stats["metadata"]["total_classes"] = len(unique_labels)
    
    # Class balance analysis
    image_counts = [stats["number_of_images"] for stats in split_stats["classes"]]
    if image_counts:
        max_count = max(image_counts)
        min_count = min(image_counts)
        
        if max_count == min_count:
            split_stats["metadata"]["class_balance"] = "perfectly balanced"
        elif min_count >= 0.9 * max_count:
            split_stats["metadata"]["class_balance"] = "well balanced"
        elif min_count >= 0.5 * max_count:
            split_stats["metadata"]["class_balance"] = "moderately imbalanced"
        else:
            split_stats["metadata"]["class_balance"] = "highly imbalanced"
    
    # Global preprocessing suggestions
    if global_pixel_stats.max_val > 1.0 and global_pixel_stats.max_val <= 255.0 and global_pixel_stats.min_val >= 0.0:
        split_stats["preprocessing_suggestions"]["normalize"] = True
    
    if global_color_modes:
        dominant_mode, dominant_count = global_color_modes.most_common(1)[0]
        split_stats["preprocessing_suggestions"]["color_mode_info"]["dominant_mode"] = dominant_mode
        
        if len(global_color_modes) > 1:
            split_stats["preprocessing_suggestions"]["color_mode_info"]["is_mixed"] = True
            split_stats["preprocessing_suggestions"]["color_mode_info"]["conversion_target"] = dominant_mode
        else:
            if dominant_mode == 'L':
                split_stats["preprocessing_suggestions"]["color_mode_info"]["conversion_target"] = 'RGB'
            elif dominant_mode == 'RGB':
                split_stats["preprocessing_suggestions"]["color_mode_info"]["conversion_target"] = 'L'
    
    if global_aspect_stats.std() > 0.1:
        split_stats["preprocessing_suggestions"]["standardize_aspect_ratio"] = True
    
    if total_alpha_channel_count > 0:
        split_stats["preprocessing_suggestions"]["handle_alpha_channel"] = True
    
    if len(global_sizes) > 1:
        most_common_size, _ = global_sizes.most_common(1)[0]
        split_stats["preprocessing_suggestions"]["resize"] = True
        split_stats["preprocessing_suggestions"]["suggested_resolution"] = most_common_size
    
    # Save preprocessing suggestions
    with open(preprocessing_file, 'w') as f:
        json.dump({
            'preprocessing_suggestions': split_stats["preprocessing_suggestions"],
            'number_of_classes': split_stats["metadata"]["total_classes"]
        }, f, indent=4)

    print(split_stats, flush=True)
    
    return jsonify({
        'message': 'EDA completed successfully',
        'metadata': split_stats["metadata"],
        'class_details': split_stats["classes"],
        'preprocessing_suggestions': split_stats["preprocessing_suggestions"]
    })