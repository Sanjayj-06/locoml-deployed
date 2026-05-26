from flask import Blueprint, request, jsonify
import sys
import os
import joblib
import pandas as pd
import numpy as np
import datetime
import json
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    r2_score, mean_squared_error, mean_absolute_error
)
import bson.json_util as json_util

sys.path.append(os.getenv('PROJECT_PATH', ''))
from mongoDB import db
from functions.stress_testing import (
    inject_noise, inject_missing_values, inject_feature_drift, inject_outliers
)

stressTestAPIs = Blueprint('stressTestAPIs', __name__)

def get_or_create_metadata(model_info):
    """
    Retrieves or generates a companion <model_id>_metadata.json file next to the pickled model.
    """
    model_id = model_info.get('model_id')
    project_path = os.getenv('PROJECT_PATH', '')
    metadata_path = os.path.join(project_path, 'Models', f'{model_id}_metadata.json')
    
    # Extract feature columns from input_schema
    feature_cols = []
    input_schema = model_info.get('input_schema', [])
    if isinstance(input_schema, list):
        for col in input_schema:
            if isinstance(col, dict) and col.get('column_name'):
                feature_cols.append(col.get('column_name'))
            elif isinstance(col, str):
                feature_cols.append(col)
                
    # If the file already exists and is healthy, let's load it
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, 'r') as f:
                meta = json.load(f)
                if meta.get('feature_columns') and meta.get('task_type') and meta.get('target_column'):
                    return meta
        except Exception:
            pass

    # Self-heal and build metadata
    dataset_id = model_info.get('dataset_id')
    dataset_name = ""
    dataset_info = db['Datasets'].find_one({'dataset_id': dataset_id})
    if dataset_info:
        dataset_name = dataset_info.get('dataset_name', '')
    else:
        dataset_name = f"Dataset_{dataset_id}"

    metadata = {
        "model_name": model_info.get('model_name'),
        "task_type": model_info.get('objective'),
        "target_column": model_info.get('target_column'),
        "dataset_name": dataset_name,
        "feature_columns": feature_cols,
        "feature_count": len(feature_cols)
    }

    try:
        os.makedirs(os.path.dirname(metadata_path), exist_ok=True)
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=4)
    except Exception as e:
        print(f"[STRESS TEST] Error saving metadata json: {str(e)}")

    return metadata

def are_models_compatible(meta_a, meta_b):
    """
    Two models are compatible only if:
    1. Same ML task type
    2. Same target column
    3. Same feature names OR same feature count
    """
    if meta_a.get('task_type') != meta_b.get('task_type'):
        return False
    if meta_a.get('target_column') != meta_b.get('target_column'):
        return False
        
    cols_a = set(meta_a.get('feature_columns') or [])
    cols_b = set(meta_b.get('feature_columns') or [])
    
    same_names = (cols_a == cols_b and len(cols_a) > 0)
    same_count = (meta_a.get('feature_count') == meta_b.get('feature_count'))
    
    return same_names or same_count

def calculate_compatibility_score(meta_a, meta_b):
    """
    Calculates a compatibility similarity score from 80% to 100%.
    """
    if not are_models_compatible(meta_a, meta_b):
        return 0.0
        
    cols_a = set(meta_a.get('feature_columns') or [])
    cols_b = set(meta_b.get('feature_columns') or [])
    
    if len(cols_a.union(cols_b)) > 0:
        overlap_ratio = len(cols_a.intersection(cols_b)) / len(cols_a.union(cols_b))
    else:
        overlap_ratio = 1.0
        
    feature_score = overlap_ratio * 100.0
    if feature_score == 0.0 and meta_a.get('feature_count') == meta_b.get('feature_count'):
        # Structurally same count but names differ
        feature_score = 75.0
        
    score = 80.0 + (feature_score * 0.2)
    return round(score, 1)

def evaluate_model(model, X, y, objective, metric_type):
    """
    Evaluates a specific metric score for the model.
    """
    try:
        y_pred = model.predict(X)
    except Exception as e:
        print(f"[STRESS TEST ERROR] Prediction failed: {str(e)}")
        return 0.0

    if objective.lower() == 'classification':
        if metric_type == 'Accuracy':
            return float(accuracy_score(y, y_pred))
        elif metric_type == 'Precision':
            return float(precision_score(y, y_pred, average='macro'))
        elif metric_type == 'Recall':
            return float(recall_score(y, y_pred, average='macro'))
        elif metric_type == 'F1':
            return float(f1_score(y, y_pred, average='macro'))
        elif metric_type == 'AUC':
            if hasattr(model, 'predict_proba'):
                try:
                    proba = model.predict_proba(X)
                    if proba.shape[1] == 2:
                        return float(roc_auc_score(y, proba[:, 1]))
                    else:
                        return float(roc_auc_score(y, proba, average='macro', multi_class='ovo'))
                except Exception:
                    pass
            return float(accuracy_score(y, y_pred)) # fallback

    elif objective.lower() == 'regression':
        if metric_type == 'R2 Score':
            return float(r2_score(y, y_pred))
        elif metric_type == 'Mean Squared Error':
            return float(mean_squared_error(y, y_pred))
        elif metric_type == 'Mean Absolute Error':
            return float(mean_absolute_error(y, y_pred))
        elif metric_type == 'Root Mean Squared Error':
            return float(mean_squared_error(y, y_pred, squared=False))

    return 0.0

def evaluate_all_metrics(model, X, y, objective):
    """
    Computes all standard metrics for the given objective.
    """
    results = {}
    try:
        y_pred = model.predict(X)
    except Exception as e:
        print(f"[STRESS TEST ERROR] Batch prediction failed: {str(e)}")
        return results

    if objective.lower() == 'classification':
        results['Accuracy'] = float(accuracy_score(y, y_pred))
        results['Precision'] = float(precision_score(y, y_pred, average='macro'))
        results['Recall'] = float(recall_score(y, y_pred, average='macro'))
        results['F1'] = float(f1_score(y, y_pred, average='macro'))
        if hasattr(model, 'predict_proba'):
            try:
                proba = model.predict_proba(X)
                if proba.shape[1] == 2:
                    results['AUC'] = float(roc_auc_score(y, proba[:, 1]))
                else:
                    results['AUC'] = float(roc_auc_score(y, proba, average='macro', multi_class='ovo'))
            except Exception:
                results['AUC'] = 0.0
        else:
            results['AUC'] = 0.0
    elif objective.lower() == 'regression':
        results['R2 Score'] = float(r2_score(y, y_pred))
        results['Mean Squared Error'] = float(mean_squared_error(y, y_pred))
        results['Mean Absolute Error'] = float(mean_absolute_error(y, y_pred))
        results['Root Mean Squared Error'] = float(mean_squared_error(y, y_pred, squared=False))
    return results

def compute_robustness(original_score, degraded_score, metric_name):
    """
    Formula:
    For higher-is-better metrics (Accuracy, R2, etc.): (degraded / original) * 100
    For lower-is-better metrics (MSE, MAE, etc.): (original / degraded) * 100
    """
    if original_score == 0:
        return 0.0

    lower_is_better = metric_name in ['Mean Squared Error', 'Mean Absolute Error', 'Root Mean Squared Error']

    if lower_is_better:
        score = (original_score / degraded_score) * 100 if degraded_score != 0 else 100.0
    else:
        score = (degraded_score / original_score) * 100

    return float(np.clip(score, 0.0, 100.0))

@stressTestAPIs.route('/stress-test', methods=['POST'])
def run_stress_test():
    try:
        data = request.get_json() or {}
        model_id = data.get('model_id')
        failure_types = data.get('failure_types') or []
        severity = data.get('severity', 'medium')
        primary_model_id = data.get('primary_model_id')

        if not model_id:
            return jsonify({'error': 'Missing model_id parameter'}), 400

        # 1. Fetch from Model Zoo
        collection = db['Model_zoo']
        model_info = collection.find_one({'model_id': model_id})
        if not model_info:
            return jsonify({'error': f'Model {model_id} not found'}), 404

        # Error Prevention inside backend: Validate compatibility if primary_model_id is specified
        primary_model = None
        if primary_model_id:
            primary_model = collection.find_one({'model_id': primary_model_id})
            if primary_model:
                prim_meta = get_or_create_metadata(primary_model)
                curr_meta = get_or_create_metadata(model_info)
                if not are_models_compatible(prim_meta, curr_meta):
                    return jsonify({'error': 'Incompatible model schemas for comparison.'}), 400

        # Resolve dataset ID from primary model if this is a comparison request, else from current model
        if primary_model:
            dataset_id = primary_model.get('dataset_id')
            objective = primary_model.get('objective')
            target_column = primary_model.get('target_column')
            metric_type = primary_model.get('metric_type')
        else:
            dataset_id = model_info.get('dataset_id')
            objective = model_info.get('objective')
            target_column = model_info.get('target_column')
            metric_type = model_info.get('metric_type')

        # 2. Resolve Model File Path
        model_path = model_info.get('saved_model_path')
        if not model_path:
            return jsonify({'error': 'Model has no saved path'}), 400

        if not os.path.exists(model_path):
            project_path = os.getenv('PROJECT_PATH', '')
            idx = model_path.find('Models')
            if idx != -1:
                model_path = os.path.join(project_path, model_path[idx:])

        if not os.path.exists(model_path):
            return jsonify({'error': f'Saved model pkl not found at {model_path}'}), 404

        # 3. Resolve Dataset File Path
        dataset_path = None
        dataset_info = db['Datasets'].find_one({'dataset_id': dataset_id})
        if dataset_info and dataset_info.get('dataset_path'):
            dataset_path = dataset_info['dataset_path']
            if not os.path.exists(dataset_path):
                idx = dataset_path.find('Datasets')
                if idx != -1:
                    dataset_path = os.path.join(os.getenv('PROJECT_PATH', ''), dataset_path[idx:])
        else:
            dataset_path = os.path.join(os.getenv('PROJECT_PATH', ''), 'Datasets', f'{dataset_id}.csv')

        if not dataset_path or not os.path.exists(dataset_path):
            return jsonify({'error': f'Associated dataset not found at {dataset_path}'}), 404

        # 4. Load Dataset and Re-split
        df = pd.read_csv(dataset_path)
        X = df.drop(columns=[target_column])
        y = df[target_column]

        # Standard split matching training splits
        if objective.lower() == 'classification':
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        else:
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # 5. Load model pipeline
        model = joblib.load(model_path)

        # 6. Evaluate baseline original score
        original_score = evaluate_model(model, X_test, y_test, objective, metric_type)
        original_all_metrics = evaluate_all_metrics(model, X_test, y_test, objective)

        # 7. Evaluate individual failure types (for Radar Chart)
        individual_results = {}
        failure_fns = {
            'noise': inject_noise,
            'missing': inject_missing_values,
            'drift': inject_feature_drift,
            'outliers': inject_outliers
        }

        for name, fn in failure_fns.items():
            try:
                X_test_ind = fn(X_test, severity, target_column=None)
                score_ind = evaluate_model(model, X_test_ind, y_test, objective, metric_type)
                rob_ind = compute_robustness(original_score, score_ind, metric_type)
                individual_results[name] = {
                    'score': float(score_ind),
                    'robustness': float(rob_ind)
                }
            except Exception as e:
                individual_results[name] = {
                    'error': str(e),
                    'robustness': 0.0
                }

        # 8. Evaluate combined failures
        X_test_corrupted = X_test.copy()
        for f_type in failure_types:
            if f_type in failure_fns:
                X_test_corrupted = failure_fns[f_type](X_test_corrupted, severity, target_column=None)

        degraded_score = evaluate_model(model, X_test_corrupted, y_test, objective, metric_type)
        robustness_score = compute_robustness(original_score, degraded_score, metric_type)
        degraded_all_metrics = evaluate_all_metrics(model, X_test_corrupted, y_test, objective)

        # 9. Independent Prediction & Pipeline debug logging for compared models
        if primary_model_id and primary_model:
            try:
                prim_model_path = primary_model.get('saved_model_path')
                if prim_model_path:
                    if not os.path.exists(prim_model_path):
                        project_path = os.getenv('PROJECT_PATH', '')
                        idx = prim_model_path.find('Models')
                        if idx != -1:
                            prim_model_path = os.path.join(project_path, prim_model_path[idx:])
                    if os.path.exists(prim_model_path):
                        prim_model = joblib.load(prim_model_path)
                        
                        # Generate fresh predictions independently using each model's pipeline
                        current_preds = np.array(prim_model.predict(X_test_corrupted))
                        compare_preds = np.array(model.predict(X_test_corrupted))
                        
                        # Output exactly the requested debug prints
                        print("Current Model:", primary_model.get('model_name'))
                        print("Compare Model:", model_info.get('model_name'))
                        print("Current Predictions Sample:", list(current_preds[:10]))
                        print("Compare Predictions Sample:", list(compare_preds[:10]))
                        print("Predictions Identical:", (current_preds == compare_preds).all())
            except Exception as e:
                print(f"[STRESS TEST DEBUG ERROR] Failed generating comparison logs: {str(e)}")

        # 9. Generate stability badge
        if robustness_score >= 85.0:
            badge = 'Stable'
            badge_color = 'green'
            badge_emoji = '🟢'
        elif robustness_score >= 70.0:
            badge = 'Moderate'
            badge_color = 'yellow'
            badge_emoji = '🟡'
        else:
            badge = 'Fragile'
            badge_color = 'red'
            badge_emoji = '🔴'

        # 10. Save stress report history
        report = {
            'time': datetime.datetime.now(),
            'model_id': model_id,
            'model_name': model_info.get('model_name'),
            'estimator_type': model_info.get('estimator_type'),
            'failure_types': failure_types,
            'severity': severity,
            'metric_type': metric_type,
            'original_score': float(original_score),
            'degraded_score': float(degraded_score),
            'robustness_score': float(robustness_score),
            'badge': badge,
            'badge_color': badge_color,
            'badge_emoji': badge_emoji,
            'individual_results': individual_results,
            'original_all_metrics': original_all_metrics,
            'degraded_all_metrics': degraded_all_metrics
        }

        # Save to DB
        db['Stress_reports'].insert_one(report)

        from flask import Response
        return Response(json_util.dumps(report), mimetype='application/json'), 200

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"[STRESS TEST EXCEPTION] {str(e)}\n{tb}")
        return jsonify({'error': str(e), 'traceback': tb}), 500

@stressTestAPIs.route('/stress-test/compatible-models/<model_id>', methods=['GET'])
def get_compatible_models(model_id):
    try:
        collection = db['Model_zoo']
        current_model = collection.find_one({'model_id': model_id})
        if not current_model:
            return jsonify({'error': f'Model {model_id} not found'}), 404

        current_meta = get_or_create_metadata(current_model)

        compatible_list = []
        for model in collection.find():
            if model.get('model_id') == model_id:
                continue
            try:
                other_meta = get_or_create_metadata(model)
                if are_models_compatible(current_meta, other_meta):
                    score = calculate_compatibility_score(current_meta, other_meta)
                    model.pop('_id')
                    model['compatibility_score'] = score
                    compatible_list.append(model)
            except Exception as e:
                print(f"[STRESS TEST] Error verifying compatibility for {model.get('model_id')}: {str(e)}")

        return json_util.dumps({'compatible_models': compatible_list}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stressTestAPIs.route('/stress-test/history/<model_id>', methods=['GET'])
def get_stress_test_history(model_id):
    try:
        collection = db['Stress_reports']
        results = list(collection.find({'model_id': model_id}).sort('time', -1))
        return json_util.dumps({'history': results}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
