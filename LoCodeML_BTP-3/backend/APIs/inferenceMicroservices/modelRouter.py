from flask import Flask, Blueprint, request, jsonify
import sys
import os
import base64
import io

from dotenv import load_dotenv, find_dotenv
from flask_cors import CORS
import joblib
import pandas as pd
import torch
from torchvision import transforms
from PIL import Image
from transformers import pipeline, DistilBertTokenizerFast
import psutil

load_dotenv(find_dotenv())
project_path = os.getenv('PROJECT_PATH', '')

if project_path:
    functions_path = os.path.join(project_path, 'functions')
    if functions_path not in sys.path:
        sys.path.append(functions_path)
    if project_path not in sys.path:
        sys.path.append(project_path)

from mongoDB import db

from ImageClassificationUtility import ImageClassificationUtility, CNN, ResNet  # noqa: F401

app = Flask(__name__)
CORS(app)

trainModelAPIs = Blueprint('trainModel', __name__)


@app.route('/health', methods=['GET'])
def health():
    return 'OK'

@app.route("/telemetry", methods=["GET"])
def telemetry():
    return jsonify({
        "cpuUsage": psutil.cpu_percent(interval=None),
        "memoryUsage": psutil.virtual_memory().percent
    })


@app.route('/inference/huggingface/batch', methods=['POST'])
def inference_huggingface_batch():
    try:
        payload = request.get_json(silent=True) or {}
        dataset = payload.get('dataset')
        model_name = payload.get('model_name')
        task_name = payload.get('task_name')
        candidate_labels = payload.get('candidate_labels')

        if dataset is None:
            return jsonify({'message': 'Missing inference dataset in request'}), 400

        try:
            if model_name != 'None' and model_name is not None:
                pipeline_task = pipeline(task=task_name, model=model_name)
            else:
                pipeline_task = pipeline(task=task_name)
        except Exception as e:
            print(e)
            return jsonify({'message': 'Model not found'}), 404

        user_input = pd.DataFrame(dataset)
        if user_input.empty:
            return jsonify({'message': 'Inference dataset is empty'}), 400

        user_input.columns = user_input.iloc[0]
        user_input = user_input.drop(user_input.index[0])
        input_texts = user_input['text'].tolist()
        input_values = [row['text'] for _, row in user_input.iterrows()]

        if task_name == 'zero-shot-classification' and isinstance(candidate_labels, str):
            candidate_labels = [label.strip() for label in candidate_labels.split(',') if label.strip()]
            result = pipeline_task(input_values, candidate_labels=candidate_labels)
        else:
            result = pipeline_task(input_values)

        output_data = []
        for index, res in enumerate(result):
            result_dict = {'text': input_texts[index]}
            result_dict.update(res)
            output_data.append(result_dict)

        output_df = pd.DataFrame(output_data)
        df = [output_df.columns.tolist()]
        df.extend(output_df.values.tolist())
        return jsonify(df), 200

    except Exception as e:
        print(e)
        return jsonify({'message': 'Inference Failed'}), 500


def normalize_column_name(col):
    if col is None:
        return ""
    if isinstance(col, list) and len(col) > 0:
        col = col[0]
    if isinstance(col, dict):
        for key in ['column_name', 'name', 'field', 'col_name', 'label']:
            if col.get(key) and isinstance(col.get(key), str):
                col = col.get(key)
                break
        else:
            for val in col.values():
                if isinstance(val, str):
                    col = val
                    break
    import re
    return re.sub(r'[^a-z0-9]', '', str(col).lower().strip())

@app.route('/inference/batch', methods=['POST'])
def inference_batch():
    try:
        payload = request.get_json(silent=True) or {}
        dataset = payload.get('dataset')
        model_id = payload.get('model_id')
        preprocessing_tasks = payload.get('preprocessing_tasks') or {}

        print(f"[DEBUG] [INFERENCE START] Model ID: {model_id}", file=sys.stdout)

        if dataset is None:
            print("[ERROR] Missing inference dataset in request", file=sys.stderr)
            return jsonify({'message': 'Missing inference dataset in request'}), 400

        if not model_id:
            print("[ERROR] Missing model_id in request", file=sys.stderr)
            return jsonify({'message': 'Missing model_id in request'}), 400

        collection = db['Model_zoo']
        model_info = collection.find_one({'model_id': model_id})
        if not model_info:
            print(f"[ERROR] Model '{model_id}' was not found in Model_zoo database registry", file=sys.stderr)
            return jsonify({'message': f"Model '{model_id}' was not found in the model registry"}), 404

        objective = model_info.get('objective')
        if not objective:
            print(f"[ERROR] Model '{model_id}' is missing objective", file=sys.stderr)
            return jsonify({'message': f"Model '{model_id}' is missing an objective and cannot be used for inference"}), 400

        model_path = model_info.get('saved_model_path')
        if not model_path:
            print(f"[ERROR] Model '{model_id}' is missing a saved model path", file=sys.stderr)
            return jsonify({'message': f"Model '{model_id}' is missing a saved model path"}), 400

        print(f"[DEBUG] [MODEL REGISTRY] Objective: {objective}, Saved Model Path: {model_path}", file=sys.stdout)

        # Load the model artifact
        try:
            print(f"[DEBUG] [ARTIFACT LOADING] Saved Model Path from DB: {model_path}", file=sys.stdout)
            
            # Check if artifact path exists
            path_exists = os.path.exists(model_path)
            print(f"[DEBUG] [ARTIFACT LOADING] Whether file/directory exists: {path_exists}", file=sys.stdout)
            
            if not path_exists:
                print(f"[ERROR] [ARTIFACT MISSING] Model artifact file not found: {model_path}", file=sys.stderr)
                return jsonify({
                    'message': f"Model loading failed: Artifact missing at path '{model_path}'",
                    'error': f"Artifact missing at path '{model_path}'"
                }), 404
                
            model_data = joblib.load(model_path)
            if model_data is None:
                print(f"[ERROR] [ARTIFACT LOADING FAILED] joblib.load returned None for path '{model_path}'", file=sys.stderr)
                return jsonify({
                    'message': "Model loading failed: load_model returned None",
                    'error': "load_model returned None"
                }), 500
                
            model = model_data['model'] if isinstance(model_data, dict) and 'model' in model_data else model_data
            if model is None:
                print("[ERROR] [ARTIFACT LOADING FAILED] Loaded model estimator is None", file=sys.stderr)
                return jsonify({
                    'message': "Model loading failed: estimator is None",
                    'error': "estimator is None"
                }), 500
                
            estimator_type = type(model)
            print(f"[DEBUG] [ARTIFACT LOADING] Loaded estimator type: {estimator_type}", file=sys.stdout)
            
            # tabular models (i.e. not imageclassification, sentiment, machinetranslation) must have predict()
            if objective.lower() not in ['imageclassification', 'sentiment', 'machinetranslation']:
                if not hasattr(model, 'predict') or not callable(getattr(model, 'predict')):
                    print(f"[ERROR] [MODEL VERIFICATION FAILED] Loaded estimator type '{estimator_type}' is missing predict() method", file=sys.stderr)
                    return jsonify({
                        'message': f"Model validation failed: Loaded estimator type '{estimator_type}' is missing predict() method",
                        'error': f"Loaded estimator type '{estimator_type}' is missing predict() method"
                    }), 400
                    
        except Exception as e:
            import traceback
            tb_str = traceback.format_exc()
            print(f"[ERROR] [ARTIFACT LOADING FAILED] Exception loading model: {str(e)}\n{tb_str}", file=sys.stderr)
            return jsonify({
                'message': f"Model loading failed: {str(e)}",
                'error': f"Model loading failed: {str(e)}",
                'traceback': tb_str
            }), 500

        expected_features = []
        if isinstance(model_info.get('input_schema'), list):
            expected_features = [
                column.get('column_name')
                for column in model_info['input_schema']
                if isinstance(column, dict) and column.get('column_name')
            ]

        target_column = model_info.get('target_column')
        print(f"[DEBUG] [MODEL SCHEMA] Expected Features: {expected_features}, Target Column: {target_column}", file=sys.stdout)

        if isinstance(objective, str) and objective.lower() == 'imageclassification':
            try:
                model.eval()
                results = []
                input_data = dataset[1:]
                batch_size = 32

                print(f"[DEBUG] [IMAGE INFERENCE] Total records: {len(input_data)}, Batch size: {batch_size}", file=sys.stdout)

                for i in range(0, len(input_data), batch_size):
                    batch = input_data[i:i + batch_size]
                    images = []
                    labels = []

                    for item in batch:
                        try:
                            img_data = base64.b64decode(item[0])
                            img = Image.open(io.BytesIO(img_data))
                            processed_img = preprocess_image(img, preprocessing_tasks)
                            images.append(processed_img)
                            labels.append(item[1])
                        except Exception as e:
                            print(f'Error processing image in batch: {str(e)}', file=sys.stderr)
                            continue

                    if not images:
                        continue

                    inputs = torch.stack(images)
                    labels = torch.tensor(labels)

                    with torch.no_grad():
                        outputs = model(inputs)
                        probs = torch.softmax(outputs, dim=1)
                        _, preds = torch.max(outputs, 1)

                    for img, pred, prob, label in zip(images, preds.cpu().numpy(), probs.cpu().numpy(), labels.cpu().numpy()):
                        img_pil = transforms.ToPILImage()(img)
                        buffered = io.BytesIO()
                        img_pil.save(buffered, format='PNG')
                        img_str = base64.b64encode(buffered.getvalue()).decode()

                        results.append({
                            'image': img_str,
                            'predicted_label': int(pred),
                            'confidence': float(prob[pred]),
                            'actual_label': int(label),
                        })

                print(f"[DEBUG] [IMAGE INFERENCE END] Produced {len(results)} results", file=sys.stdout)
                return jsonify({'results': results, 'objective': objective}), 200
            except Exception as e:
                import traceback
                tb_str = traceback.format_exc()
                print(f"[ERROR] [IMAGE INFERENCE FAILED] Error: {str(e)}\n{tb_str}", file=sys.stderr)
                return jsonify({'message': f"Image inference failed: {str(e)}", "traceback": tb_str}), 500

        user_input = pd.DataFrame(dataset)
        print(f"[DEBUG] [INPUT DATAFRAME] Initial user input shape: {user_input.shape}", file=sys.stdout)
        if user_input.empty:
            print("[ERROR] [INPUT DATAFRAME] Inference dataset is empty", file=sys.stderr)
            return jsonify({'message': 'Inference dataset is empty'}), 400

        user_input.columns = user_input.iloc[0]
        user_input = user_input.drop(user_input.index[0])
        print(f"[DEBUG] [INPUT DATAFRAME] Parsed dataframe columns: {list(user_input.columns)}, shape: {user_input.shape}", file=sys.stdout)

        # Apply Casing- and Whitespace-Insensitive Normalization Mapping
        target_norm = normalize_column_name(target_column) if target_column else ""
        if target_norm:
            cols_to_drop = [c for c in user_input.columns if normalize_column_name(c) == target_norm]
            if cols_to_drop:
                print(f"[DEBUG] [TARGET COLUMN EXEMPTION] Dropping target column(s) from inference features: {cols_to_drop}", file=sys.stdout)
                user_input = user_input.drop(columns=cols_to_drop)

        # Print expected training columns and actual inference columns before alignment
        print(f"[DEBUG] [FEATURE ALIGNMENT] Expected training features: {expected_features}", file=sys.stdout)
        print(f"[DEBUG] [FEATURE ALIGNMENT] Actual inference columns: {list(user_input.columns)}", file=sys.stdout)

        if expected_features:
            norm_to_expected = {normalize_column_name(f): f for f in expected_features if f}
            user_norm_to_actual = {normalize_column_name(col): col for col in user_input.columns if col}

            missing_columns = []
            rename_dict = {}
            for expected_feat in expected_features:
                feat_norm = normalize_column_name(expected_feat)
                if target_norm and feat_norm == target_norm:
                    continue  # DO NOT require target column during inference mode
                if feat_norm in user_norm_to_actual:
                    actual_col = user_norm_to_actual[feat_norm]
                    rename_dict[actual_col] = expected_feat
                else:
                    missing_columns.append(expected_feat)

            if missing_columns:
                print(f"[ERROR] [COLUMN ALIGNMENT FAILED] Missing columns for inference: {missing_columns}", file=sys.stderr)
                return jsonify({'message': f"Missing required input columns for inference: {', '.join(missing_columns)}"}), 400

            print(f"[DEBUG] [COLUMN ALIGNMENT] Renaming columns using map: {rename_dict}", file=sys.stdout)
            user_input = user_input.rename(columns=rename_dict)
            
            # Reindex columns to match expected order, excluding target column
            features_to_keep = [f for f in expected_features if not (target_norm and normalize_column_name(f) == target_norm)]
            print(f"[DEBUG] [COLUMN ALIGNMENT] Reindexing columns to match expected features: {features_to_keep}", file=sys.stdout)
            user_input = user_input.reindex(columns=features_to_keep)
        
        print(f"[DEBUG] [DATAFRAME PROCESSING] Aligned input shape: {user_input.shape}, Columns: {list(user_input.columns)}", file=sys.stdout)

        if user_input.empty:
            print("[ERROR] [INPUT DATAFRAME] Aligned input dataframe is empty", file=sys.stderr)
            return jsonify({'message': 'Aligned input dataframe is empty'}), 400

        if isinstance(objective, str) and objective.lower() == 'sentiment':
            try:
                tokenizer = DistilBertTokenizerFast.from_pretrained('distilbert-base-uncased')
                batch_size = 8
                if 'review' not in user_input.columns:
                    print("[ERROR] [SENTIMENT] Missing 'review' column", file=sys.stderr)
                    return jsonify({'message': "Sentiment model expects 'review' column in input"}), 400
                context = user_input['review'].to_list()
                model_max_length = 512
                new_prediction = []
                model.to('cpu')

                inputs = tokenizer(context, return_tensors='pt', padding=True, truncation=True, max_length=model_max_length)

                with torch.no_grad():
                    for i in range(0, len(context), batch_size):
                        batch_inputs = {key: tensor[i:i + batch_size] for key, tensor in inputs.items()}
                        logits = model(**batch_inputs).logits
                        predicted_class_ids = torch.argmax(logits, dim=1).tolist()
                        for class_id in predicted_class_ids:
                            new_prediction.append(model.config.id2label[class_id])
            except Exception as e:
                import traceback
                tb_str = traceback.format_exc()
                print(f"[ERROR] [SENTIMENT PREDICTION FAILED] Error: {str(e)}\n{tb_str}", file=sys.stderr)
                return jsonify({'message': f"Sentiment prediction failed: {str(e)}", "traceback": tb_str}), 500

        elif isinstance(objective, str) and objective.lower() == 'machinetranslation':
            try:
                translator = pipeline('translation', model=model_info['estimator_type'], device='cpu' if not torch.cuda.is_available() else 0)
                text_column = list(user_input.columns)[0]
                texts = user_input[text_column].tolist()

                new_prediction = []
                for text in texts:
                    if isinstance(text, str) and len(text.strip()) > 0:
                        try:
                            result = translator(text, max_length=512)
                            new_prediction.append(result[0]['translation_text'])
                        except Exception as e:
                            print(f'Translation error: {str(e)}', file=sys.stderr)
                            new_prediction.append('')
                    else:
                        new_prediction.append('')
            except Exception as e:
                import traceback
                tb_str = traceback.format_exc()
                print(f"[ERROR] [MT PREDICTION FAILED] Error: {str(e)}\n{tb_str}", file=sys.stderr)
                return jsonify({'message': f"Machine Translation prediction failed: {str(e)}", "traceback": tb_str}), 500

        else:
            try:
                print(f"[DEBUG] [PREDICTION START] Invoking predict() using model of type: {type(model)}", file=sys.stdout)
                new_prediction = model.predict(user_input)
                
                # Check prediction shape
                if hasattr(new_prediction, 'shape'):
                    pred_shape = new_prediction.shape
                else:
                    pred_shape = len(new_prediction)
                print(f"[DEBUG] [PREDICTION END] Prediction output type: {type(new_prediction)}, Shape/Length: {pred_shape}", file=sys.stdout)
            except Exception as e:
                import traceback
                tb_str = traceback.format_exc()
                print(f"[ERROR] [PREDICTION FAILED] Error: {str(e)}\n{tb_str}", file=sys.stderr)
                return jsonify({'message': f"Model prediction failed: {str(e)}", "traceback": tb_str}), 500

        user_input['prediction'] = new_prediction
        df = [user_input.columns.tolist()]
        df.extend(user_input.values.tolist())
        return jsonify(df), 200

    except FileNotFoundError as fnf:
        print(f"[ERROR] [INFERENCE BATCH FAILED] File not found: {str(fnf)}", file=sys.stderr)
        return jsonify({'message': f'Model file not found: {str(fnf)}'}), 404
    except Exception as e:
        import traceback
        tb_str = traceback.format_exc()
        print(f'[ERROR] [INFERENCE BATCH FAILED] Exception: {str(e)}\n{tb_str}', file=sys.stderr)
        return jsonify({'message': f'Inference failed: {str(e)}', 'traceback': tb_str}), 500


def create_transform_pipeline(preprocessing_tasks):
    """Create a torchvision transforms pipeline based on preprocessing tasks"""
    transform_list = []
    is_grayscale = False

    if 'Color Space Conversion' in preprocessing_tasks:
        params = preprocessing_tasks['Color Space Conversion']
        if params.get('colorSpace') == 'GRAY':
            transform_list.append(transforms.Grayscale(num_output_channels=1))
            is_grayscale = True
        elif params.get('colorSpace') == 'RGB':
            transform_list.append(transforms.Grayscale(num_output_channels=1))
            is_grayscale = True

    if 'Resize Image' in preprocessing_tasks:
        params = preprocessing_tasks['Resize Image']
        width = params.get('width', 32)
        height = params.get('height', 32)
        transform_list.append(transforms.Resize((height, width)))

    if 'Data Augmentation' in preprocessing_tasks:
        transform_list.extend([
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(10),
        ])

    transform_list.append(transforms.ToTensor())

    if 'Image Normalization' in preprocessing_tasks:
        if is_grayscale:
            transform_list.append(transforms.Normalize(mean=[0.5], std=[0.5]))
        else:
            transform_list.append(
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225],
                )
            )

    return transforms.Compose(transform_list)


def preprocess_image(img, preprocessing_tasks):
    """Preprocess image using the specified preprocessing tasks"""
    transform = create_transform_pipeline(preprocessing_tasks)
    return transform(img)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5004, debug=False)
