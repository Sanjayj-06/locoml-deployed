import os

class IssueDetector:
    @staticmethod
    def detect_issues(nodes, edges, dataset_meta=None, pipeline_mode=None, execution_context=None):
        """
        Analyzes a ReactFlow graph (nodes and edges) and detects issues.
        Returns a list of issue dicts.
        """
        is_training = (pipeline_mode == "TRAINING" or execution_context == "FIT" or (pipeline_mode is None and execution_context is None))
        issues = []
        node_map = {n['id']: n for n in nodes}
        
        # 1. Missing Inputs node
        input_nodes = [n for n in nodes if n.get('type') == 'inputData' or n.get('data', {}).get('label') == 'Inputs']
        if not input_nodes:
            issues.append({
                "id": "missing_inputs_node",
                "severity": "error",
                "type": "missing_required_node",
                "message": "The pipeline is missing an Inputs node. Please add an Inputs node to define your data source.",
                "node_id": None
            })
        else:
            # Check if dataset is selected
            for in_node in input_nodes:
                entity = in_node.get('data', {}).get('entity')
                if not entity:
                    issues.append({
                        "id": "missing_dataset_selection",
                        "severity": "error",
                        "type": "missing_dataset",
                        "message": f"Inputs node '{in_node.get('id')}' is missing a dataset selection.",
                        "node_id": in_node.get('id')
                    })

        # 2. Check for disconnected nodes or components
        adj = {n['id']: [] for n in nodes}
        in_degree = {n['id']: 0 for n in nodes}
        for e in edges:
            src = e.get('source')
            tgt = e.get('target')
            if src in adj and tgt in adj:
                adj[src].append(tgt)
                in_degree[tgt] += 1

        # Check reachability from Inputs
        reachable = set()
        def dfs(u):
            reachable.add(u)
            for v in adj[u]:
                if v not in reachable:
                    dfs(v)

        for in_node in input_nodes:
            dfs(in_node['id'])

        for n in nodes:
            nid = n['id']
            label = n.get('data', {}).get('label', nid)
            # Node completely isolated
            is_isolated = True
            for e in edges:
                if e.get('source') == nid or e.get('target') == nid:
                    is_isolated = False
                    break
            
            if is_isolated:
                issues.append({
                    "id": f"isolated_node_{nid}",
                    "severity": "warning",
                    "type": "disconnected_graph",
                    "message": f"Node '{label}' ({nid}) is completely isolated from the graph.",
                    "node_id": nid
                })
            elif nid not in reachable:
                issues.append({
                    "id": f"unreachable_node_{nid}",
                    "severity": "error",
                    "type": "disconnected_graph",
                    "message": f"Node '{label}' ({nid}) is not reachable from any Inputs node.",
                    "node_id": nid
                })

        # 3. Cycles detection (Simple DFS)
        visited = {} # 0 = unvisited, 1 = visiting, 2 = visited
        has_cycle = False
        cycle_edges = []
        
        def find_cycle(u):
            nonlocal has_cycle
            visited[u] = 1
            for v in adj[u]:
                if visited.get(v, 0) == 1:
                    has_cycle = True
                    cycle_edges.append((u, v))
                elif visited.get(v, 0) == 0:
                    find_cycle(v)
            visited[u] = 2

        for n in nodes:
            if visited.get(n['id'], 0) == 0:
                find_cycle(n['id'])

        if has_cycle:
            issues.append({
                "id": "graph_has_cycle",
                "severity": "error",
                "type": "invalid_edges",
                "message": "The pipeline graph contains cycles or loops, but must be a directed acyclic graph (DAG).",
                "node_id": None,
                "cycle_edges": cycle_edges
            })

        # 4. Incompatible preprocessors and node/task combinations
        dataset_type = None
        if dataset_meta:
            dataset_type = dataset_meta.get("dataset_type")
        elif input_nodes:
            # fallback to inferring type from node info if present
            dataset_type = input_nodes[0].get('data', {}).get('dataset_type')

        for n in nodes:
            ntype = n.get('type')
            label = n.get('data', {}).get('label', '')
            
            # Tabular nodes: classification, regression, sentiment
            # Image nodes: imageclassification
            if dataset_type == 'image' or (dataset_meta and 'image' in dataset_meta.get('name', '').lower()):
                if ntype in ['classification', 'regression', 'sentiment']:
                    issues.append({
                        "id": f"incompatible_task_{n['id']}",
                        "severity": "error",
                        "type": "incompatible_node_task",
                        "message": f"Tabular model '{label}' is incompatible with an image dataset. Use 'Image Classification' node instead.",
                        "node_id": n['id']
                    })
            elif dataset_type == 'text' or (dataset_meta and 'text' in dataset_meta.get('name', '').lower()):
                if ntype in ['regression', 'imageclassification']:
                    issues.append({
                        "id": f"incompatible_task_{n['id']}",
                        "severity": "error",
                        "type": "incompatible_node_task",
                        "message": f"Model '{label}' is not suitable for text datasets. Use 'Sentiment' or 'Classification' models.",
                        "node_id": n['id']
                    })
            elif dataset_type == 'tabular':
                if ntype == 'imageclassification':
                    issues.append({
                        "id": f"incompatible_task_{n['id']}",
                        "severity": "error",
                        "type": "incompatible_node_task",
                        "message": f"Image classification model '{label}' is incompatible with a tabular dataset.",
                        "node_id": n['id']
                    })

        # 5. Invalid evaluator check: Ensure we have at least one model node if there's an inputs node
        model_nodes = [n for n in nodes if n.get('type') in ['classification', 'regression', 'sentiment', 'imageclassification', 'huggingface']]
        if input_nodes and not model_nodes:
            issues.append({
                "id": "missing_model_node",
                "severity": "error",
                "type": "missing_required_node",
                "message": "The pipeline has data inputs but no model node (Classification, Regression, Sentiment, Image Classification) to process it.",
                "node_id": None
            })

        # 6. Detailed model node validations (selection and file existence)
        for n in nodes:
            ntype = n.get('type')
            label = n.get('data', {}).get('label', '')
            
            if ntype in ['classification', 'regression', 'sentiment', 'imageclassification']:
                model_id = n.get('model_id')
                if not model_id:
                    entity = n.get('data', {}).get('entity')
                    if isinstance(entity, dict):
                        model_id = entity.get('model_id') or entity.get('id') or entity.get('_id')
                    elif isinstance(entity, str) and entity:
                        model_id = entity
                    if not model_id:
                        model_id = n.get('data', {}).get('model_id')
                
                is_bound = n.get('bound_model') or n.get('data', {}).get('bound_model')
                
                # Backward compatibility: if bound_model is not explicitly specified (neither True nor False)
                # but a valid model_id has been resolved, treat it as bound.
                has_bound_key = ('bound_model' in n) or ('bound_model' in n.get('data', {}))
                if not has_bound_key and model_id:
                    is_bound = True
                
                if not model_id or not is_bound:
                    issues.append({
                        "id": f"missing_model_selection_{n['id']}",
                        "severity": "error",
                        "type": "missing_model_selection",
                        "message": f"Model node '{label}' has no trained model selected. Please select a model.",
                        "node_id": n['id']
                    })
                else:
                    # Model is selected, check if its file exists on disk
                    try:
                        from mongoDB import db
                        model_info = db['Model_zoo'].find_one({'model_id': model_id})
                        if model_info:
                            saved_model_path = model_info.get('saved_model_path')
                            if saved_model_path:
                                if not os.path.exists(saved_model_path):
                                    issues.append({
                                        "id": f"missing_model_file_{n['id']}",
                                        "severity": "error",
                                        "type": "missing_model_file",
                                        "message": f"Trained model file for '{model_info.get('model_name', model_id)}' (ID: {model_id}) was not found on disk. Please retrain this model or select a different one.",
                                        "node_id": n['id']
                                    })
                            else:
                                issues.append({
                                    "id": f"missing_model_path_{n['id']}",
                                    "severity": "error",
                                    "type": "missing_model_file",
                                    "message": f"Model '{model_id}' is missing a saved model path in the database. Please select a different model.",
                                    "node_id": n['id']
                                })
                        else:
                            issues.append({
                                "id": f"invalid_model_selection_{n['id']}",
                                "severity": "error",
                                "type": "missing_model_selection",
                                "message": f"Model node '{label}' has an invalid model selection (Model ID '{model_id}' not found in the registry).",
                                "node_id": n['id']
                            })
                    except Exception as e:
                        # Log error or fallback gracefully
                        print(f"Error checking model file existence: {e}")
            
            elif ntype == 'huggingface':
                task_name = n.get('data', {}).get('task_name')
                if not task_name:
                    issues.append({
                        "id": f"missing_hf_task_{n['id']}",
                        "severity": "error",
                        "type": "missing_model_selection",
                        "message": f"HuggingFace node '{label}' has no NLP task selected. Please edit the node and select a task.",
                        "node_id": n['id']
                    })

        # Check for multiple model nodes
        model_nodes = [n for n in nodes if n.get('type') in ['classification', 'regression', 'sentiment', 'imageclassification', 'huggingface']]
        if len(model_nodes) > 1:
            issues.append({
                "id": "multiple_model_nodes",
                "severity": "error",
                "type": "multiple_model_nodes",
                "message": "Multiple incompatible model nodes detected in the pipeline.",
                "node_id": None
            })

        # --- NEW SEMANTIC COMPATIBILITY CHECKS ---
        inferred_task = IssueDetector.infer_dataset_task(dataset_meta, nodes)
        
        for n in nodes:
            ntype = n.get('type')
            label = n.get('data', {}).get('label', '')
            nid = n['id']
            
            # 1. Preprocessing Node Consistency
            if ntype == 'preprocessing' or label == 'Preprocessing':
                prep_type = n.get('data', {}).get('preprocessingType')
                if prep_type == 'csv':
                    if inferred_task == 'IMAGE_CLASSIFICATION':
                        issues.append({
                            "id": f"incompatible_preprocessing_{nid}",
                            "type": "SEMANTIC_INCOMPATIBILITY",
                            "severity": "HIGH",
                            "message": "Tabular preprocessing used for image dataset.",
                            "node_id": nid,
                            "suggested_fix": "Remove or change the preprocessing node type."
                        })
                    elif inferred_task == 'SENTIMENT_ANALYSIS':
                        issues.append({
                            "id": f"incompatible_preprocessing_{nid}",
                            "type": "SEMANTIC_INCOMPATIBILITY",
                            "severity": "HIGH",
                            "message": "Tabular preprocessing used for text dataset.",
                            "node_id": nid,
                            "suggested_fix": "Remove or change the preprocessing node type."
                        })
                elif prep_type == 'image':
                    if inferred_task in ['REGRESSION', 'CLASSIFICATION', 'SENTIMENT_ANALYSIS']:
                        issues.append({
                            "id": f"incompatible_preprocessing_{nid}",
                            "type": "SEMANTIC_INCOMPATIBILITY",
                            "severity": "HIGH",
                            "message": "Image preprocessing used for tabular/text dataset.",
                            "node_id": nid,
                            "suggested_fix": "Remove or change the preprocessing node type."
                        })

            # Check if it's a model node
            if ntype not in ['classification', 'regression', 'sentiment', 'imageclassification', 'huggingface']:
                continue

            node_task = None
            if ntype == 'classification' or label == 'Classification':
                node_task = 'CLASSIFICATION'
            elif ntype == 'regression' or label == 'Regression':
                node_task = 'REGRESSION'
            elif ntype in ['sentiment', 'huggingface'] or label in ['Sentiment', 'Huggingface']:
                node_task = 'SENTIMENT_ANALYSIS'
            elif ntype == 'imageclassification' or label == 'Image Classification':
                node_task = 'IMAGE_CLASSIFICATION'

            # If bound to a model, inspect its database metadata
            model_id = n.get('model_id') or n.get('data', {}).get('model_id')
            if not model_id and isinstance(n.get('data', {}).get('entity'), dict):
                model_id = n.get('data', {}).get('entity', {}).get('model_id')

            model_info = None
            if model_id:
                try:
                    from mongoDB import db
                    model_info = db['Model_zoo'].find_one({'model_id': model_id})
                except Exception:
                    pass

            node_task_type = str(n.get('task_type') or n.get('data', {}).get('task_type') or '').upper()

            model_task = ""
            if model_info:
                model_task = str(model_info.get('task_type') or model_info.get('objective') or '').upper()
            if not model_task:
                model_task = node_task_type
            
            if not model_task and model_info:
                # Fallback to objective/estimator parsing if task_type is empty
                estimator = str(model_info.get('estimator', '')).lower()
                objective = str(model_info.get('objective', '')).lower()
                classifiers = ['logisticregression', 'svc', 'classifier', 'classification']
                regressors = ['linearregression', 'ridge', 'lasso', 'regressor', 'regression']
                if any(c in estimator for c in classifiers) or 'classification' in objective:
                    model_task = 'CLASSIFICATION'
                elif any(r in estimator for r in regressors) or 'regression' in objective:
                    model_task = 'REGRESSION'
            
            # Standardize model_task string
            if 'CLASSIFICATION' in model_task:
                model_task = 'CLASSIFICATION'
            elif 'REGRESSION' in model_task:
                model_task = 'REGRESSION'
            elif 'SENTIMENT' in model_task:
                model_task = 'SENTIMENT_ANALYSIS'
            elif 'IMAGE' in model_task:
                model_task = 'IMAGE_CLASSIFICATION'

            final_model_task = model_task or node_task

            # --- RULE 1: TASK MISMATCH ---
            if inferred_task and final_model_task and inferred_task != final_model_task:
                msg = ""
                fix = ""
                if inferred_task == 'REGRESSION':
                    if final_model_task == 'CLASSIFICATION':
                        msg = "Classification model selected for regression dataset."
                        fix = "Replace the classification model with a compatible regression model."
                    elif final_model_task == 'SENTIMENT_ANALYSIS':
                        msg = "Sentiment model incompatible with regression dataset."
                        fix = "Replace the sentiment model with a compatible regression model."
                    else:
                        msg = "Image classification model incompatible with regression dataset."
                        fix = "Replace the image classification model with a compatible regression model."
                elif inferred_task == 'CLASSIFICATION':
                    if final_model_task == 'REGRESSION':
                        msg = "Regression model selected for classification dataset."
                        fix = "Replace the regression model with a compatible classification model."
                    elif final_model_task == 'SENTIMENT_ANALYSIS':
                        msg = "Sentiment model incompatible with classification dataset."
                        fix = "Replace the sentiment model with a compatible classification model."
                    else:
                        msg = "Image classification model incompatible with classification dataset."
                        fix = "Replace the image classification model with a compatible classification model."
                elif inferred_task == 'SENTIMENT_ANALYSIS':
                    if final_model_task == 'REGRESSION':
                        msg = "Regression model incompatible with sentiment dataset."
                        fix = "Replace the regression model with a compatible sentiment/NLP model."
                    elif final_model_task == 'CLASSIFICATION':
                        msg = "Classification model incompatible with sentiment dataset."
                        fix = "Replace the classification model with a compatible sentiment/NLP model."
                    else:
                        msg = "Image classification model incompatible with sentiment dataset."
                        fix = "Replace the image classification model with a compatible sentiment/NLP model."
                elif inferred_task == 'IMAGE_CLASSIFICATION':
                    if final_model_task == 'REGRESSION':
                        msg = "Regression model incompatible with image dataset."
                        fix = "Replace the regression model with a compatible image classification model."
                    elif final_model_task == 'CLASSIFICATION':
                        msg = "Classification model incompatible with image dataset."
                        fix = "Replace the classification model with a compatible image classification model."
                    else:
                        msg = "Sentiment model incompatible with image dataset."
                        fix = "Replace the sentiment model with a compatible image classification model."

                has_model_meta = bool(model_info or node_task_type)
                issue_type = "MODEL_TASK_MISMATCH" if has_model_meta else "SEMANTIC_INCOMPATIBILITY"

                issues.append({
                    "id": f"model_task_mismatch_{nid}",
                    "type": issue_type,
                    "severity": "HIGH",
                    "message": msg,
                    "node_id": nid,
                    "suggested_fix": fix
                })

            # --- RULE 3: TARGET COLUMN MISMATCH ---
            target_col_raw = (model_info.get('target_column') if model_info else None) or n.get('target_column') or n.get('data', {}).get('target_column')
            target_col = ""
            if isinstance(target_col_raw, list):
                if target_col_raw:
                    target_col = IssueDetector._extract_column_name(target_col_raw[0])
            else:
                target_col = IssueDetector._extract_column_name(target_col_raw)

            if is_training and dataset_meta and 'columns' in dataset_meta and target_col:
                dataset_columns = dataset_meta.get('columns', [])
                norm_dataset_cols = {IssueDetector.normalize_column_name(c): c for c in dataset_columns}
                norm_target_col = IssueDetector.normalize_column_name(target_col)
                if norm_target_col not in norm_dataset_cols:
                    issues.append({
                        "id": f"target_column_mismatch_{nid}",
                        "type": "TARGET_COLUMN_MISMATCH",
                        "severity": "HIGH",
                        "message": "Target column missing from dataset",
                        "node_id": nid,
                        "suggested_fix": f"Ensure your dataset contains the target column '{target_col}'."
                    })
                else:
                    matched_target_col = norm_dataset_cols[norm_target_col]
                    # Check target type compatibility
                    dtypes = dataset_meta.get('dtypes', {})
                    dtype = dtypes.get(matched_target_col, '').lower()
                    if 'float' in dtype and final_model_task == 'CLASSIFICATION':
                        issues.append({
                            "id": f"target_type_mismatch_{nid}",
                            "type": "TARGET_COLUMN_MISMATCH",
                            "severity": "HIGH",
                            "message": f"Classification target column '{target_col}' is continuous in the dataset.",
                            "node_id": nid,
                            "suggested_fix": "Choose a classification dataset or a regression model."
                        })
                    elif any(t in dtype for t in ['object', 'str', 'bool', 'category', 'char']) and final_model_task == 'REGRESSION':
                        issues.append({
                            "id": f"target_type_mismatch_{nid}",
                            "type": "TARGET_COLUMN_MISMATCH",
                            "severity": "HIGH",
                            "message": f"Regression target column '{target_col}' is categorical/non-numerical in the dataset.",
                            "node_id": nid,
                            "suggested_fix": "Choose a numerical/continuous target or a classification model."
                        })

            # --- RULE 2: FEATURE SCHEMA MISMATCH ---
            training_columns_raw = (model_info.get('training_columns') if model_info else None) or n.get('training_columns') or n.get('data', {}).get('training_columns')
            
            training_columns = []
            if isinstance(training_columns_raw, list):
                for col in training_columns_raw:
                    col_str = IssueDetector._extract_column_name(col)
                    if col_str:
                        training_columns.append(col_str)
            elif isinstance(training_columns_raw, str):
                training_columns = [training_columns_raw]

            if not training_columns and model_info and isinstance(model_info.get('input_schema'), list):
                training_columns = [
                    IssueDetector._extract_column_name(col) for col in model_info['input_schema']
                    if IssueDetector._extract_column_name(col)
                ]
            
            if dataset_meta and 'columns' in dataset_meta and training_columns:
                dataset_columns = dataset_meta.get('columns', [])
                norm_dataset_cols = {IssueDetector.normalize_column_name(c) for c in dataset_columns}
                
                norm_target_col = IssueDetector.normalize_column_name(target_col) if target_col else ""
                
                # Check target leakage: is the target column in training_columns?
                target_leakage_detected = False
                if norm_target_col:
                    for col in training_columns:
                        if IssueDetector.normalize_column_name(col) == norm_target_col:
                            target_leakage_detected = True
                            break
                
                missing_cols = [col for col in training_columns if IssueDetector.normalize_column_name(col) not in norm_dataset_cols]
                
                if target_leakage_detected:
                    # Exclude target column from missing_cols!
                    missing_cols = [col for col in missing_cols if IssueDetector.normalize_column_name(col) != norm_target_col]
                    
                    # Append target leakage warning:
                    issues.append({
                        "id": f"target_leakage_warning_{nid}",
                        "type": "TARGET_LEAKAGE_WARNING",
                        "severity": "WARNING",
                        "message": f"Target column '{target_col}' is included in the expected training features list. This may cause target leakage.",
                        "node_id": nid,
                        "suggested_fix": "Exclude target column from feature inputs during inference."
                    })

                if missing_cols:
                    issues.append({
                        "id": f"feature_schema_mismatch_{nid}",
                        "type": "FEATURE_SCHEMA_MISMATCH",
                        "severity": "HIGH",
                        "message": "Required model features missing from uploaded dataset",
                        "node_id": nid,
                        "suggested_fix": f"Upload a dataset containing expected features: {', '.join(missing_cols)}."
                    })


        return issues

    @staticmethod
    def _extract_column_name(col):
        if not col:
            return ""
        if isinstance(col, str):
            return col
        if isinstance(col, list) and len(col) > 0:
            return IssueDetector._extract_column_name(col[0])
        if isinstance(col, dict):
            for key in ['column_name', 'name', 'field', 'col_name', 'label']:
                if col.get(key) and isinstance(col.get(key), str):
                    return col.get(key)
            for val in col.values():
                if isinstance(val, str):
                    return val
        return str(col)

    @staticmethod
    def normalize_column_name(col):
        extracted = IssueDetector._extract_column_name(col)
        if not extracted:
            return ""
        import re
        return re.sub(r'[^a-z0-9]', '', str(extracted).lower().strip())

    @staticmethod
    def infer_dataset_task(dataset_meta, nodes):
        """
        Infers the dataset's task type locally from dataset metadata.
        Rules:
        - Numerical target/data -> REGRESSION
        - Categorical target/data -> CLASSIFICATION
        - Text-heavy target/data -> SENTIMENT_ANALYSIS
        - Image metadata/zip -> IMAGE_CLASSIFICATION
        """
        dataset_type = None
        dataset_name = ""
        
        if dataset_meta:
            dataset_type = dataset_meta.get("dataset_type")
            dataset_name = dataset_meta.get("name", "").lower()
            
        # Fallback to inputData nodes if needed
        input_nodes = [n for n in nodes if n.get('type') == 'inputData' or n.get('data', {}).get('label') == 'Inputs']
        if not dataset_type and input_nodes:
            dataset_type = input_nodes[0].get('data', {}).get('dataset_type')
            if not dataset_type and isinstance(input_nodes[0].get('data', {}).get('entity'), dict):
                dataset_type = input_nodes[0].get('data', {}).get('entity', {}).get('dataset_type')

        # Robustly extract name/id from input node entity if dataset_name is empty/unknown
        if input_nodes:
            ent = input_nodes[0].get('data', {}).get('entity')
            if isinstance(ent, dict) and ent.get('filename'):
                dataset_name = ent.get('filename').lower()
            elif isinstance(ent, str) and ent:
                dataset_name = ent.lower()
                
        # Rule for IMAGE_CLASSIFICATION
        if dataset_type in ['image', 'zip'] or 'image' in dataset_name or 'zip' in dataset_name:
            return 'IMAGE_CLASSIFICATION'
            
        # Rule for SENTIMENT_ANALYSIS (text-heavy target/data)
        if dataset_type == 'text' or any(keyword in dataset_name for keyword in ['sentiment', 'review', 'text', 'twitter', 'comment']):
            return 'SENTIMENT_ANALYSIS'

        # Check standard keywords in dataset name for quick task detection before falling back
        if any(keyword in dataset_name for keyword in ['house', 'price', 'sales', 'regression', 'housing', 'hp.csv']):
            return 'REGRESSION'
            
        if any(keyword in dataset_name for keyword in ['classification', 'class', 'churn', 'wine', 'heart', 'cancer', 'iris']):
            return 'CLASSIFICATION'
            
        # Text-heavy check on sample_head
        if dataset_meta and "sample_head" in dataset_meta and "dtypes" in dataset_meta:
            for col, dtype in dataset_meta.get("dtypes", {}).items():
                if dtype in ['object', 'str', 'string']:
                    vals = [str(row[col]) for row in dataset_meta["sample_head"] if col in row and row[col] is not None]
                    if vals:
                        avg_len = sum(len(v) for v in vals) / len(vals)
                        if avg_len > 25:
                            return 'SENTIMENT_ANALYSIS'
                            
        # Standard tabular checks: REGRESSION vs CLASSIFICATION
        if not dataset_meta or "columns" not in dataset_meta or not dataset_meta["columns"]:
            # Fallback to REGRESSION/CLASSIFICATION using name keywords since metadata could not be fully parsed
            if any(keyword in dataset_name for keyword in ['house', 'price', 'sales', 'regression', 'housing', 'hp.csv']):
                return 'REGRESSION'
            return 'CLASSIFICATION'
            
        columns = dataset_meta["columns"]
        dtypes = dataset_meta.get("dtypes", {})
        sample_head = dataset_meta.get("sample_head", [])
        
        # Determine target column
        target_col = None
        
        # 1. Check bound models' target column
        for n in nodes:
            model_id = n.get('model_id') or n.get('data', {}).get('model_id')
            if not model_id and isinstance(n.get('data', {}).get('entity'), dict):
                model_id = n.get('data', {}).get('entity', {}).get('model_id')
            if model_id:
                try:
                    from mongoDB import db
                    model_info = db['Model_zoo'].find_one({'model_id': model_id})
                    if model_info and model_info.get('target_column'):
                        t_col = model_info.get('target_column')
                        normalized_columns = {IssueDetector.normalize_column_name(c): c for c in columns}
                        norm_t_col = IssueDetector.normalize_column_name(t_col)
                        if norm_t_col in normalized_columns:
                            target_col = normalized_columns[norm_t_col]
                            break
                except Exception:
                    pass
                    
        # 2. Check common column names
        if not target_col:
            for col in columns:
                norm_col = IssueDetector.normalize_column_name(col)
                if any(k in norm_col for k in ['target', 'label', 'class', 'churn', 'output', 'prediction']) or norm_col == 'y':
                    target_col = col
                    break
                if any(k in norm_col for k in ['price', 'sales', 'value', 'amount', 'cost', 'temp']):
                    target_col = col
                    break
                    
        # 3. Fallback to last column
        if not target_col and columns:
            target_col = columns[-1]
            
        if not target_col:
            if any(keyword in dataset_name for keyword in ['house', 'price', 'sales', 'regression', 'housing', 'hp.csv']):
                return 'REGRESSION'
            return 'CLASSIFICATION'
            
        # Target column task type inference
        dtype = dtypes.get(target_col, '').lower()
        
        if any(keyword in target_col.lower() for keyword in ['price', 'sales', 'amount', 'value', 'cost', 'temp']):
            return 'REGRESSION'
            
        if any(keyword in target_col.lower() for keyword in ['class', 'label', 'category', 'churn', 'status', 'type', 'output']):
            return 'CLASSIFICATION'
            
        if 'float' in dtype:
            return 'REGRESSION'
            
        if any(t in dtype for t in ['object', 'str', 'bool', 'category', 'char']):
            return 'CLASSIFICATION'
            
        if 'int' in dtype:
            if sample_head:
                unique_vals = set(row[target_col] for row in sample_head if target_col in row and row[target_col] is not None)
                if len(unique_vals) > 10:
                    return 'REGRESSION'
                else:
                    return 'CLASSIFICATION'
            return 'CLASSIFICATION'
            
        if any(keyword in dataset_name for keyword in ['house', 'price', 'sales', 'regression', 'housing', 'hp.csv']):
            return 'REGRESSION'
        return 'CLASSIFICATION'
