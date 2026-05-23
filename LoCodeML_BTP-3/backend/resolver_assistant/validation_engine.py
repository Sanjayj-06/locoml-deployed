from .issue_detector import IssueDetector

class ValidationEngine:
    @staticmethod
    def validate_graph(nodes, edges, dataset_meta=None, pipeline_mode=None, execution_context=None):
        """
        Performs deterministic local validation checks on the pipeline graph.
        Returns a dict: { "valid": bool, "issues": list }
        """
        is_training = (pipeline_mode == "TRAINING" or execution_context == "FIT" or (pipeline_mode is None and execution_context is None))
        
        if not is_training or pipeline_mode == "INFERENCE":
            print("[Validation Debug]")
            print("Pipeline mode = INFERENCE")
            print()
            print("[Validation Debug]")
            print("Skipping target-column validation for inference pipeline.")
            
        issues = IssueDetector.detect_issues(
            nodes, edges, dataset_meta, 
            pipeline_mode=pipeline_mode, 
            execution_context=execution_context
        )
        
        # Check if there are any error-level or high-severity issues
        has_errors = any(issue.get('severity', '').lower() in ['error', 'high'] for issue in issues)
        
        # Infer dataset task
        dataset_task = IssueDetector.infer_dataset_task(dataset_meta, nodes)
        
        # Infer model task
        model_task = None
        for n in nodes:
            ntype = n.get('type')
            label = n.get('data', {}).get('label', '')
            
            is_classification = False
            is_regression = False
            is_nlp = False
            is_image = False
            
            live_task_type = str(n.get('task_type') or n.get('data', {}).get('task_type') or n.get('objective') or n.get('data', {}).get('objective') or '').upper()
            if 'CLASSIFICATION' in live_task_type:
                is_classification = True
            elif 'REGRESSION' in live_task_type:
                is_regression = True
            elif 'SENTIMENT' in live_task_type:
                is_nlp = True
            elif 'IMAGE_CLASSIFICATION' in live_task_type:
                is_image = True
            
            if not (is_classification or is_regression or is_nlp or is_image):
                if ntype == 'classification' or label == 'Classification':
                    is_classification = True
                elif ntype == 'regression' or label == 'Regression':
                    is_regression = True
                elif ntype in ['sentiment', 'huggingface'] or label in ['Sentiment', 'Huggingface']:
                    is_nlp = True
                elif ntype == 'imageclassification' or label == 'Image Classification':
                    is_image = True
                
                model_id = n.get('model_id') or n.get('data', {}).get('model_id')
                if not model_id and isinstance(n.get('data', {}).get('entity'), dict):
                    model_id = n.get('data', {}).get('entity', {}).get('model_id')
                    
                if model_id:
                    try:
                        from mongoDB import db
                        model_info = db['Model_zoo'].find_one({'model_id': model_id})
                        if model_info:
                            live_task_db = str(model_info.get('task_type') or model_info.get('objective') or '').upper()
                            if 'CLASSIFICATION' in live_task_db:
                                is_classification = True
                            elif 'REGRESSION' in live_task_db:
                                is_regression = True
                            elif 'SENTIMENT' in live_task_db:
                                is_nlp = True
                            elif 'IMAGE_CLASSIFICATION' in live_task_db:
                                is_image = True
                            
                            if not (is_classification or is_regression or is_nlp or is_image):
                                estimator = str(model_info.get('estimator', '')).lower()
                                objective = str(model_info.get('objective', '')).lower()
                                
                                classifiers = ['logisticregression', 'svc', 'classifier', 'classification']
                                if any(c in estimator for c in classifiers) or 'classification' in objective:
                                    is_classification = True
                                    
                                regressors = ['linearregression', 'ridge', 'lasso', 'regressor', 'regression']
                                if any(r in estimator for r in regressors) or 'regression' in objective:
                                    is_regression = True
                    except Exception:
                        pass

            if is_classification:
                model_task = "CLASSIFICATION"
                break
            elif is_regression:
                model_task = "REGRESSION"
                break
            elif is_nlp:
                model_task = "SENTIMENT_ANALYSIS"
                break
            elif is_image:
                model_task = "IMAGE_CLASSIFICATION"
                break
        
        # [Resolver Debug] logging
        dataset_name = dataset_meta.get('name', 'N/A') if dataset_meta else 'N/A'
        dataset_cols = dataset_meta.get('columns', []) if dataset_meta else []
        
        selected_node_type = 'N/A'
        selected_model = 'N/A'
        model_nodes = [n for n in nodes if n.get('type') in ['classification', 'regression', 'sentiment', 'imageclassification', 'huggingface']]
        if model_nodes:
            selected_node_type = model_nodes[0].get('type', 'N/A')
            selected_model = model_nodes[0].get('model_id') or model_nodes[0].get('data', {}).get('model_id') or model_nodes[0].get('data', {}).get('entity', 'N/A')
            if isinstance(selected_model, dict):
                selected_model = selected_model.get('model_id') or selected_model.get('id') or 'N/A'
                
        detected_target = 'N/A'
        if model_nodes:
            target_val = model_nodes[0].get('target_column') or model_nodes[0].get('data', {}).get('target_column')
            if target_val:
                if isinstance(target_val, list) and target_val:
                    detected_target = target_val[0]
                elif isinstance(target_val, dict):
                    detected_target = target_val.get('column_name') or target_val.get('name') or str(target_val)
                else:
                    detected_target = str(target_val)

        print(f"[Resolver Debug] Dataset Name: {dataset_name}")
        print(f"[Resolver Debug] Dataset Columns: {dataset_cols}")
        print(f"[Resolver Debug] Detected Target: {detected_target}")
        print(f"[Resolver Debug] Detected Dataset Task: {dataset_task}")
        print(f"[Resolver Debug] Selected Node Type: {selected_node_type}")
        print(f"[Resolver Debug] Selected Model: {selected_model}")
        print(f"[Resolver Debug] Selected Model Task: {model_task}")
        print(f"[Resolver Debug] Validation Result: {'VALID' if not has_errors else 'INVALID'}")

        return {
            "valid": not has_errors,
            "issues": issues,
            "dataset_task": dataset_task,
            "model_task": model_task
        }
