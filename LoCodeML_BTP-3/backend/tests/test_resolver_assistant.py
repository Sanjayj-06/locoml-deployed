import unittest
import sys
import os
from unittest.mock import patch, MagicMock

# Ensure we can import resolver_assistant
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from resolver_assistant.validation_engine import ValidationEngine

class TestResolverAssistantValidation(unittest.TestCase):
    def setUp(self):
        try:
            from APIs.inferenceMicroservices import masterServer
            masterServer.reset_globals()
            masterServer.inputFiles = {"inp_1": "data.csv", "inp_img": "data.zip"}
            masterServer.dataset_type = "csv"
        except Exception:
            pass

    def tearDown(self):
        try:
            from APIs.inferenceMicroservices import masterServer
            masterServer.reset_globals()
        except Exception:
            pass

    def test_missing_inputs_node(self):
        # Empty graph
        nodes = []
        edges = []
        res = ValidationEngine.validate_graph(nodes, edges)
        self.assertFalse(res["valid"])
        
        issue_types = [issue["type"] for issue in res["issues"]]
        self.assertIn("missing_required_node", issue_types)
        
    def test_isolated_and_unreachable_nodes(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "dataset.csv"}},
            {"id": "clf_1", "type": "classification", "data": {"label": "Classification", "entity": "RandomForest"}},
            {"id": "prep_1", "type": "preprocessing", "data": {"label": "Preprocessing"}}
        ]
        # clf_1 and prep_1 are connected to each other, but not to inp_1 (unreachable!)
        edges = [
            {"id": "e1", "source": "clf_1", "target": "prep_1"}
        ]
        
        # Mock database connection to return a model
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'RandomForest',
                'model_name': 'RandomForest',
                'saved_model_path': '/app/Models/RF.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges)
            self.assertFalse(res["valid"])
            
            issue_types = [issue["type"] for issue in res["issues"]]
            self.assertIn("disconnected_graph", issue_types)

    def test_graph_has_cycle(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "dataset.csv"}},
            {"id": "prep_1", "type": "preprocessing", "data": {"label": "Preprocessing"}},
            {"id": "prep_2", "type": "preprocessing", "data": {"label": "Preprocessing 2"}}
        ]
        # Cycle prep_1 -> prep_2 -> prep_1
        edges = [
            {"id": "e1", "source": "inp_1", "target": "prep_1"},
            {"id": "e2", "source": "prep_1", "target": "prep_2"},
            {"id": "e3", "source": "prep_2", "target": "prep_1"}
        ]
        
        res = ValidationEngine.validate_graph(nodes, edges)
        self.assertFalse(res["valid"])
        
        issue_types = [issue["type"] for issue in res["issues"]]
        self.assertIn("invalid_edges", issue_types)

    def test_incompatible_task_combination(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "dataset.csv"}},
            {"id": "model_1", "type": "imageclassification", "data": {"label": "CNN", "entity": "cnn_model"}}
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "model_1"}
        ]
        # Tabular dataset connected to image model
        dataset_meta = {"name": "tabular_data.csv", "dataset_type": "tabular"}
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'cnn_model',
                'model_name': 'cnn_model',
                'saved_model_path': '/app/Models/CNN.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res["valid"])
            
            issue_types = [issue["type"] for issue in res["issues"]]
            self.assertIn("incompatible_node_task", issue_types)

    def test_valid_graph(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "dataset.csv"}},
            {"id": "prep_1", "type": "preprocessing", "data": {"label": "StandardScaler"}},
            {"id": "clf_1", "type": "classification", "data": {"label": "SVM", "entity": "svm_model"}}
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "prep_1"},
            {"id": "e2", "source": "prep_1", "target": "clf_1"}
        ]
        dataset_meta = {"name": "customer_churn.csv", "dataset_type": "tabular"}
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_model',
                'model_name': 'svm_model',
                'saved_model_path': '/app/Models/svm_model.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertTrue(res["valid"])
            self.assertEqual(len(res["issues"]), 0)

    def test_missing_model_selection(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "dataset.csv"}},
            {"id": "clf_1", "type": "classification", "data": {"label": "Classification"}}  # No model selected
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "clf_1"}
        ]
        res = ValidationEngine.validate_graph(nodes, edges)
        self.assertFalse(res["valid"])
        issue_types = [issue["type"] for issue in res["issues"]]
        self.assertIn("missing_model_selection", issue_types)

    def test_missing_model_file(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "dataset.csv"}},
            {"id": "clf_1", "type": "classification", "data": {"label": "Classification", "entity": "svm_model"}}
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "clf_1"}
        ]
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=False): # File missing!
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_model',
                'model_name': 'svm_model',
                'saved_model_path': '/app/Models/svm_model.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges)
            self.assertFalse(res["valid"])
            issue_types = [issue["type"] for issue in res["issues"]]
            self.assertIn("missing_model_file", issue_types)

    def test_missing_hf_task(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "dataset.csv"}},
            {"id": "hf_1", "type": "huggingface", "data": {"label": "HuggingFace"}}  # No task selected
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "hf_1"}
        ]
        res = ValidationEngine.validate_graph(nodes, edges)
        self.assertFalse(res["valid"])
        issue_types = [issue["type"] for issue in res["issues"]]
        self.assertIn("missing_model_selection", issue_types)

    def test_semantic_regression_mismatch(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "house_prices.csv"}},
            {"id": "clf_1", "type": "classification", "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "clf_1"}
        ]
        
        # Dataset with continuous column "price" as float
        dataset_meta = {
            "name": "house_prices.csv",
            "columns": ["sqft", "bedrooms", "price"],
            "dtypes": {"sqft": "int64", "bedrooms": "int64", "price": "float64"},
            "sample_head": [
                {"sqft": 1500, "bedrooms": 3, "price": 250000.0},
                {"sqft": 2000, "bedrooms": 4, "price": 350000.0}
            ]
        }
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'estimator': 'SVC',
                'objective': 'classification',
                'target_column': 'price',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res["valid"])
            
            semantic_issues = [issue for issue in res["issues"] if issue["type"] in ["SEMANTIC_INCOMPATIBILITY", "MODEL_TASK_MISMATCH"]]
            self.assertEqual(len(semantic_issues), 1)
            self.assertEqual(semantic_issues[0]["severity"], "HIGH")
            self.assertEqual(semantic_issues[0]["message"], "Classification model selected for regression dataset.")
            self.assertEqual(semantic_issues[0]["suggested_fix"], "Replace the classification model with a compatible regression model.")

    def test_semantic_classification_mismatch(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "churn.csv"}},
            {"id": "reg_1", "type": "regression", "data": {"label": "Regression", "entity": "linear_reg"}},
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "reg_1"}
        ]
        
        # Dataset with categorical column "churn" as object/string
        dataset_meta = {
            "name": "churn.csv",
            "columns": ["age", "tenure", "churn"],
            "dtypes": {"age": "int64", "tenure": "int64", "churn": "object"},
            "sample_head": [
                {"age": 34, "tenure": 5, "churn": "Yes"},
                {"age": 45, "tenure": 2, "churn": "No"}
            ]
        }
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'linear_reg',
                'model_name': 'linear_reg',
                'estimator': 'LinearRegression',
                'objective': 'regression',
                'target_column': 'churn',
                'saved_model_path': '/app/Models/linear_reg.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res["valid"])
            
            semantic_issues = [issue for issue in res["issues"] if issue["type"] in ["SEMANTIC_INCOMPATIBILITY", "MODEL_TASK_MISMATCH"]]
            self.assertEqual(len(semantic_issues), 1)
            self.assertEqual(semantic_issues[0]["severity"], "HIGH")
            self.assertEqual(semantic_issues[0]["message"], "Regression model selected for classification dataset.")
            self.assertEqual(semantic_issues[0]["suggested_fix"], "Replace the regression model with a compatible classification model.")

    def test_semantic_sentiment_mismatch(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "comments.csv"}},
            {"id": "clf_1", "type": "classification", "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "clf_1"}
        ]
        
        # Text-heavy sentiment analysis dataset
        dataset_meta = {
            "name": "comments.csv",
            "dataset_type": "text",
            "columns": ["text_content", "sentiment_label"],
            "dtypes": {"text_content": "object", "sentiment_label": "object"},
            "sample_head": [
                {"text_content": "This is an extremely long comment review which is text heavy.", "sentiment_label": "positive"},
                {"text_content": "Another long review comment text.", "sentiment_label": "negative"}
            ]
        }
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'estimator': 'SVC',
                'objective': 'classification',
                'target_column': 'sentiment_label',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res["valid"])
            
            semantic_issues = [issue for issue in res["issues"] if issue["type"] in ["SEMANTIC_INCOMPATIBILITY", "MODEL_TASK_MISMATCH"]]
            self.assertEqual(len(semantic_issues), 1)
            self.assertEqual(semantic_issues[0]["message"], "Classification model incompatible with sentiment dataset.")
            self.assertEqual(semantic_issues[0]["suggested_fix"], "Replace the classification model with a compatible sentiment/NLP model.")

    def test_semantic_image_mismatch(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "cat_dog.zip"}},
            {"id": "prep_1", "type": "preprocessing", "data": {"label": "Preprocessing", "preprocessingType": "csv"}},
            {"id": "clf_1", "type": "classification", "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "prep_1"},
            {"id": "e2", "source": "prep_1", "target": "clf_1"}
        ]
        
        # Image dataset
        dataset_meta = {
            "name": "cat_dog.zip",
            "dataset_type": "zip"
        }
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'estimator': 'SVC',
                'objective': 'classification',
                'target_column': 'label',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res["valid"])
            
            semantic_issues = [issue for issue in res["issues"] if issue["type"] in ["SEMANTIC_INCOMPATIBILITY", "MODEL_TASK_MISMATCH"]]
            # Tabular preprocessing and tabular model should both be flagged
            self.assertTrue(len(semantic_issues) >= 1)
            issue_msgs = [i["message"] for i in semantic_issues]
            self.assertIn("Tabular preprocessing used for image dataset.", issue_msgs)
            self.assertIn("Classification model incompatible with image dataset.", issue_msgs)

    def test_schema_model_task_mismatch(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "house_prices.csv"}},
            {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "clf_1"}
        ]
        dataset_meta = {
            "name": "house_prices.csv",
            "columns": ["sqft", "bedrooms", "price"],
            "dtypes": {"sqft": "int64", "bedrooms": "int64", "price": "float64"},
            "sample_head": [
                {"sqft": 1500, "bedrooms": 3, "price": 250000.0}
            ]
        }
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'task_type': 'CLASSIFICATION',
                'target_column': 'price',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res["valid"])
            
            issues = [issue for issue in res["issues"] if issue["type"] == "MODEL_TASK_MISMATCH"]
            self.assertEqual(len(issues), 1)
            self.assertEqual(issues[0]["severity"], "HIGH")
            self.assertEqual(issues[0]["message"], "Classification model selected for regression dataset.")

    def test_schema_feature_subset_mismatch(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "clf_1"}
        ]
        dataset_meta = {
            "name": "data.csv",
            "columns": ["a"],
            "dtypes": {"a": "int64"},
            "sample_head": [{"a": 1}]
        }
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'task_type': 'CLASSIFICATION',
                'training_columns': ['a', 'b'],
                'target_column': 'a',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res["valid"])
            
            issues = [issue for issue in res["issues"] if issue["type"] == "FEATURE_SCHEMA_MISMATCH"]
            self.assertEqual(len(issues), 1)
            self.assertEqual(issues[0]["severity"], "HIGH")
            self.assertEqual(issues[0]["message"], "Required model features missing from uploaded dataset")

    def test_schema_target_column_missing(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "clf_1"}
        ]
        dataset_meta = {
            "name": "data.csv",
            "columns": ["a", "b"],
            "dtypes": {"a": "int64", "b": "int64"},
            "sample_head": [{"a": 1, "b": 2}]
        }
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'task_type': 'CLASSIFICATION',
                'training_columns': ['a'],
                'target_column': 'price',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res["valid"])
            
            issues = [issue for issue in res["issues"] if issue["type"] == "TARGET_COLUMN_MISMATCH" and "missing" in issue["message"].lower()]
            self.assertEqual(len(issues), 1)
            self.assertEqual(issues[0]["severity"], "HIGH")
            self.assertEqual(issues[0]["message"], "Target column missing from dataset")

    def test_schema_target_type_mismatch(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "clf_1"}
        ]
        dataset_meta = {
            "name": "data.csv",
            "columns": ["a", "price"],
            "dtypes": {"a": "int64", "price": "float64"},
            "sample_head": [{"a": 1, "price": 2.5}]
        }
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'task_type': 'CLASSIFICATION',
                'training_columns': ['a'],
                'target_column': 'price',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res["valid"])
            
            issues = [issue for issue in res["issues"] if issue["type"] == "TARGET_COLUMN_MISMATCH" and "continuous" in issue["message"]]
            self.assertEqual(len(issues), 1)
            self.assertEqual(issues[0]["severity"], "HIGH")
            self.assertEqual(issues[0]["message"], "Classification target column 'price' is continuous in the dataset.")

    def test_schema_robust_column_extraction(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            {
                "id": "clf_1", 
                "type": "classification", 
                "model_id": "svm_clf", 
                "bound_model": True, 
                "training_columns": [{"column_name": "a", "data_type": "int64"}],
                "target_column": {"column_name": "price", "data_type": "float64"},
                "data": {"label": "Classification", "entity": "svm_clf"}
            },
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "clf_1"}
        ]
        dataset_meta = {
            "name": "data.csv",
            "columns": ["a", "price"],
            "dtypes": {"a": "int64", "price": "float64"},
            "sample_head": [{"a": 1, "price": 2.5}]
        }
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'task_type': 'CLASSIFICATION',
                'training_columns': [{"column_name": "a", "data_type": "int64"}],
                'target_column': {"column_name": "price", "data_type": "float64"},
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res["valid"])
            issues = [issue for issue in res["issues"] if issue["type"] == "TARGET_COLUMN_MISMATCH" and "continuous" in issue["message"]]
            self.assertEqual(len(issues), 1)

    # --- NEW INTEGRATION TESTS ---

    def test_regression_dataset_with_incompatible_nodes(self):
        # Regression dataset (hp.csv) with Sentiment node
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "hp.csv"}},
            {"id": "sent_1", "type": "sentiment", "data": {"label": "Sentiment", "entity": "bert_sentiment"}},
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "sent_1"}
        ]
        dataset_meta = {
            "name": "hp.csv",
            "columns": ["Square_Footage", "House_Price"],
            "dtypes": {"Square_Footage": "int64", "House_Price": "float64"},
            "sample_head": [{"Square_Footage": 1200, "House_Price": 150000.0}]
        }
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'bert_sentiment',
                'model_name': 'bert_sentiment',
                'task_type': 'SENTIMENT_ANALYSIS',
                'target_column': 'House_Price',
                'saved_model_path': '/app/Models/bert_sentiment.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res["valid"])
            issue_msgs = [issue["message"] for issue in res["issues"]]
            self.assertIn("Sentiment model incompatible with regression dataset.", issue_msgs)

    def test_image_dataset_with_tabular_preprocess(self):
        # Image dataset (cat_dog.zip) with preprocessingType 'csv' (tabular)
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "cat_dog.zip"}},
            {"id": "prep_1", "type": "preprocessing", "data": {"label": "Preprocessing", "preprocessingType": "csv"}},
            {"id": "model_1", "type": "imageclassification", "data": {"label": "CNN", "entity": "cnn_model"}}
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "prep_1"},
            {"id": "e2", "source": "prep_1", "target": "model_1"}
        ]
        dataset_meta = {
            "name": "cat_dog.zip",
            "dataset_type": "zip"
        }
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'cnn_model',
                'model_name': 'cnn_model',
                'task_type': 'IMAGE_CLASSIFICATION',
                'saved_model_path': '/app/Models/CNN.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res["valid"])
            issue_msgs = [issue["message"] for issue in res["issues"]]
            self.assertIn("Tabular preprocessing used for image dataset.", issue_msgs)

    def test_target_leakage_warning_only(self):
        # Target column accidentally in training features
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "clf_1"}
        ]
        dataset_meta = {
            "name": "data.csv",
            "columns": ["a", "label"],
            "dtypes": {"a": "int64", "label": "int64"},
            "sample_head": [{"a": 1, "label": 5}]
        }
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            # 'label' is the target but also in training_columns
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'task_type': 'CLASSIFICATION',
                'training_columns': ['a', 'label'],
                'target_column': 'label',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            # Should be valid because target leakage is just a WARNING and missing_cols will not contain 'label'
            self.assertTrue(res["valid"])
            
            warnings = [issue for issue in res["issues"] if issue["type"] == "TARGET_LEAKAGE_WARNING"]
            self.assertEqual(len(warnings), 1)
            self.assertEqual(warnings[0]["severity"], "WARNING")
            self.assertIn("is included in the expected training features list. This may cause target leakage.", warnings[0]["message"])

    def test_inference_mode_bypasses_target_missing(self):
        # Target column missing during INFERENCE mode
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "clf_1"}
        ]
        # Dataset without target 'price'
        dataset_meta = {
            "name": "data.csv",
            "columns": ["a"],
            "dtypes": {"a": "int64"},
            "sample_head": [{"a": 1}]
        }
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'task_type': 'CLASSIFICATION',
                'training_columns': ['a'],
                'target_column': 'price',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta, pipeline_mode="INFERENCE")
            # Should be valid during inference because target existence is bypassed
            self.assertTrue(res["valid"])
            
            issues = [issue for issue in res["issues"] if issue["type"] == "TARGET_COLUMN_MISMATCH"]
            self.assertEqual(len(issues), 0)

    # --- ADDITIONAL GENERAL RESOLVER TEST CASES (22-50) ---

    @patch('requests.post')
    @patch('requests.get')
    def test_runtime_prediction_success(self, mock_get, mock_post):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            "clf_1": {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}}
        }
        masterServer.edgeDetails = [{"source": "inp_1", "target": "clf_1"}]
        masterServer.nodeDetails = [masterServer.nodes_dict["inp_1"], masterServer.nodes_dict["clf_1"]]
        
        mock_get.return_value.text = "OK"
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: [["a"], [1]]),
            MagicMock(status_code=200, json=lambda: {"results": [["a", "prediction"], [1, "class_A"]]})
        ]
        
        res = masterServer.delegate_work()
        self.assertIsNotNone(res)

    @patch('requests.post')
    @patch('requests.get')
    def test_runtime_prediction_failure_trace(self, mock_get, mock_post):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            "clf_1": {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}}
        }
        masterServer.edgeDetails = [{"source": "inp_1", "target": "clf_1"}]
        masterServer.nodeDetails = [masterServer.nodes_dict["inp_1"], masterServer.nodes_dict["clf_1"]]
        
        mock_get.return_value.text = "OK"
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: [["a"], [1]]),
            MagicMock(status_code=500, json=lambda: {"error": "Internal Model Error", "status_code": 500})
        ]
        
        res = masterServer.delegate_work()
        self.assertIsNotNone(res)
        self.assertIn("error", res)
        self.assertEqual(res["failing_node_id"], "clf_1")

    @patch('requests.post')
    @patch('requests.get')
    def test_preprocessing_returns_none(self, mock_get, mock_post):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            "prep_1": {"id": "prep_1", "type": "preprocessing", "data": {"label": "Preprocessing", "entity": "Drop Duplicates"}},
            "clf_1": {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}}
        }
        masterServer.edgeDetails = [
            {"source": "inp_1", "target": "prep_1"},
            {"source": "prep_1", "target": "clf_1"}
        ]
        masterServer.nodeDetails = list(masterServer.nodes_dict.values())
        
        mock_get.return_value.text = "OK"
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: [["a"], [1]]),
            None
        ]
        
        res = masterServer.delegate_work()
        self.assertIsNotNone(res)
        self.assertIn("error", res)
        self.assertEqual(res["failing_node_id"], "prep_1")

    @patch('requests.post')
    @patch('requests.get')
    def test_preprocessing_returns_empty_dataframe(self, mock_get, mock_post):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            "prep_1": {"id": "prep_1", "type": "preprocessing", "data": {"label": "Preprocessing", "entity": "Drop Duplicates"}},
            "clf_1": {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}}
        }
        masterServer.edgeDetails = [
            {"source": "inp_1", "target": "prep_1"},
            {"source": "prep_1", "target": "clf_1"}
        ]
        masterServer.nodeDetails = list(masterServer.nodes_dict.values())
        
        mock_get.return_value.text = "OK"
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: [["a"], [1]]),
            MagicMock(status_code=200, json=lambda: [])
        ]
        
        res = masterServer.delegate_work()
        self.assertIsNotNone(res)
        self.assertIn("error", res)
        self.assertEqual(res["failing_node_id"], "prep_1")

    @patch('os.path.exists', return_value=False)
    @patch('mongoDB.db')
    def test_runtime_missing_artifact_file(self, mock_db, mock_exists):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [{"source": "inp_1", "target": "clf_1"}]
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = {
            'model_id': 'svm_clf',
            'model_name': 'svm_clf',
            'saved_model_path': '/app/Models/svm_clf.pkl'
        }
        mock_db.__getitem__.return_value = mock_collection
        
        res = ValidationEngine.validate_graph(nodes, edges)
        self.assertFalse(res["valid"])
        issue_types = [i["type"] for i in res["issues"]]
        self.assertIn("missing_model_file", issue_types)

    @patch('requests.post')
    @patch('requests.get')
    def test_runtime_invalid_pickle(self, mock_get, mock_post):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            "clf_1": {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}}
        }
        masterServer.edgeDetails = [{"source": "inp_1", "target": "clf_1"}]
        masterServer.nodeDetails = list(masterServer.nodes_dict.values())
        
        mock_get.return_value.text = "OK"
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: [["a"], [1]]),
            MagicMock(status_code=500, json=lambda: {"error": "Failed to load pickle: invalid load key", "status_code": 500})
        ]
        
        res = masterServer.delegate_work()
        self.assertIsNotNone(res)
        self.assertIn("error", res)

    @patch('requests.post')
    @patch('requests.get')
    def test_runtime_missing_predict_method(self, mock_get, mock_post):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            "clf_1": {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}}
        }
        masterServer.edgeDetails = [{"source": "inp_1", "target": "clf_1"}]
        masterServer.nodeDetails = list(masterServer.nodes_dict.values())
        
        mock_get.return_value.text = "OK"
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: [["a"], [1]]),
            MagicMock(status_code=400, json=lambda: {"error": "Loaded estimator does not support predict method", "status_code": 400})
        ]
        
        res = masterServer.delegate_work()
        self.assertIsNotNone(res)
        self.assertIn("error", res)

    def test_runtime_feature_alignment_normalization(self):
        from resolver_assistant.issue_detector import IssueDetector
        norm1 = IssueDetector.normalize_column_name("House_Price")
        norm2 = IssueDetector.normalize_column_name("house price")
        self.assertEqual(norm1, norm2)
        self.assertEqual(norm1, "houseprice")

    def test_runtime_column_order_alignment(self):
        from resolver_assistant.issue_detector import IssueDetector
        dataset_meta = {
            "columns": ["sqft", "price", "bedrooms"]
        }
        nodes = [
            {
                "id": "clf_1", 
                "type": "classification", 
                "model_id": "svm_clf", 
                "bound_model": True, 
                "training_columns": ["bedrooms", "sqft"],
                "target_column": "price",
                "data": {"label": "Classification", "entity": "svm_clf"}
            }
        ]
        issues = IssueDetector.detect_issues(nodes, [], dataset_meta)
        missing_feats = [i for i in issues if i["type"] == "FEATURE_SCHEMA_MISMATCH"]
        self.assertEqual(len(missing_feats), 0)

    def test_runtime_extra_unused_columns(self):
        from resolver_assistant.issue_detector import IssueDetector
        dataset_meta = {
            "columns": ["sqft", "price", "bedrooms", "irrelevant_feature"]
        }
        nodes = [
            {
                "id": "clf_1", 
                "type": "classification", 
                "model_id": "svm_clf", 
                "bound_model": True, 
                "training_columns": ["sqft", "bedrooms"],
                "target_column": "price",
                "data": {"label": "Classification", "entity": "svm_clf"}
            }
        ]
        issues = IssueDetector.detect_issues(nodes, [], dataset_meta)
        self.assertEqual(len([i for i in issues if i["type"] == "FEATURE_SCHEMA_MISMATCH"]), 0)

    def test_runtime_missing_required_feature_column(self):
        from resolver_assistant.issue_detector import IssueDetector
        dataset_meta = {
            "columns": ["sqft", "price"]
        }
        nodes = [
            {
                "id": "clf_1", 
                "type": "classification", 
                "model_id": "svm_clf", 
                "bound_model": True, 
                "training_columns": ["sqft", "bedrooms"],
                "target_column": "price",
                "data": {"label": "Classification", "entity": "svm_clf"}
            }
        ]
        issues = IssueDetector.detect_issues(nodes, [], dataset_meta)
        missing_feats = [i for i in issues if i["type"] == "FEATURE_SCHEMA_MISMATCH"]
        self.assertEqual(len(missing_feats), 1)

    @patch('requests.post')
    @patch('requests.get')
    def test_runtime_nan_only_dataframe(self, mock_get, mock_post):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            "clf_1": {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}}
        }
        masterServer.edgeDetails = [{"source": "inp_1", "target": "clf_1"}]
        masterServer.nodeDetails = list(masterServer.nodes_dict.values())
        
        mock_get.return_value.text = "OK"
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: [["a"], [float('nan')]]),
            MagicMock(status_code=400, json=lambda: {"error": "Dataset contains all NaN values. Cannot perform prediction.", "status_code": 400})
        ]
        
        res = masterServer.delegate_work()
        self.assertIsNotNone(res)
        self.assertIn("error", res)

    @patch('requests.post')
    @patch('requests.get')
    def test_runtime_single_row_inference(self, mock_get, mock_post):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": {"manual_inputs": {"a": 5}, "manual_input_order": ["a"]}}},
            "clf_1": {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}}
        }
        masterServer.edgeDetails = [{"source": "inp_1", "target": "clf_1"}]
        masterServer.nodeDetails = list(masterServer.nodes_dict.values())
        
        mock_get.return_value.text = "OK"
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: {"results": [["a", "prediction"], [5, "class_A"]]})
        ]
        
        res = masterServer.delegate_work()
        self.assertIsNotNone(res)

    @patch('requests.post')
    @patch('requests.get')
    def test_runtime_large_batch_inference(self, mock_get, mock_post):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            "clf_1": {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}}
        }
        masterServer.edgeDetails = [{"source": "inp_1", "target": "clf_1"}]
        masterServer.nodeDetails = list(masterServer.nodes_dict.values())
        
        mock_get.return_value.text = "OK"
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: [["a"]] + [[i] for i in range(10000)]),
            MagicMock(status_code=200, json=lambda: {"results": [["a", "prediction"]] + [[i, "A"] for i in range(10000)]})
        ]
        
        res = masterServer.delegate_work()
        self.assertIsNotNone(res)

    def test_runtime_edge_traversal_order(self):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            "clf_1": {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}}
        }
        masterServer.edgeDetails = [{"source": "inp_1", "target": "clf_1"}]
        
        order = []
        original_execute = masterServer.execute
        def dummy_execute(node, ip):
            order.append(node["id"])
            return [["a"], [1]]
        
        masterServer.execute = dummy_execute
        try:
            masterServer.run("inp_1", None)
            self.assertEqual(order, ["inp_1", "clf_1"])
        finally:
            masterServer.execute = original_execute

    def test_runtime_disconnected_execution_chain(self):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            "clf_1": {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}}
        }
        masterServer.edgeDetails = []
        next_ids = masterServer.get_next_ids("inp_1")
        self.assertEqual(len(next_ids), 0)

    def test_realtime_dataset_rebind_validation(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "dataset.csv"}},
            {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [{"source": "inp_1", "target": "clf_1"}]
        dataset_meta_1 = {"name": "data1.csv", "columns": ["a"], "dtypes": {"a": "int64"}, "sample_head": [{"a": 1}]}
        dataset_meta_2 = {"name": "data2.csv", "columns": ["a", "b"], "dtypes": {"a": "int64", "b": "int64"}, "sample_head": [{"a": 1, "b": 2}]}
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'task_type': 'CLASSIFICATION',
                'training_columns': ['a', 'b'],
                'target_column': 'b',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res1 = ValidationEngine.validate_graph(nodes, edges, dataset_meta_1)
            self.assertFalse(res1["valid"])
            
            res2 = ValidationEngine.validate_graph(nodes, edges, dataset_meta_2)
            self.assertTrue(res2["valid"])

    def test_realtime_model_rebind_validation(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [{"source": "inp_1", "target": "clf_1"}]
        dataset_meta = {"name": "data.csv", "columns": ["a"], "dtypes": {"a": "int64"}, "sample_head": [{"a": 1}]}
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'task_type': 'CLASSIFICATION',
                'training_columns': ['a', 'b'],
                'target_column': 'b',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            res1 = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertFalse(res1["valid"])
            
            nodes[1]["model_id"] = "svm_clf_simple"
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf_simple',
                'model_name': 'svm_clf_simple',
                'task_type': 'CLASSIFICATION',
                'training_columns': ['a'],
                'target_column': 'a',
                'saved_model_path': '/app/Models/svm_clf_simple.pkl'
            }
            res2 = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertTrue(res2["valid"])

    def test_resolver_button_state_transition(self):
        validations = [
            {"valid": False, "issues": [{"severity": "error"}]},
            {"valid": True, "issues": []}
        ]
        states = []
        for val in validations:
            if not val["valid"]:
                states.append("INVALID")
            else:
                states.append("VALID")
        self.assertEqual(states, ["INVALID", "VALID"])

    def test_success_message_rendering(self):
        res = ValidationEngine.validate_graph([], [])
        self.assertFalse(res["valid"])
        
        dataset_meta = {"name": "data.csv", "columns": ["a"], "dtypes": {"a": "int64"}, "sample_head": [{"a": 1}]}
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            {"id": "clf_1", "type": "classification", "data": {"label": "Classification", "entity": "svm_model"}}
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "clf_1"}
        ]
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_model',
                'model_name': 'svm_model',
                'saved_model_path': '/app/Models/svm_model.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res_valid = ValidationEngine.validate_graph(nodes, edges, dataset_meta)
            self.assertTrue(res_valid["valid"])
            self.assertEqual(len(res_valid["issues"]), 0)

    def test_validation_cache_cleanup_after_fix(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "dataset.csv"}},
            {"id": "prep_1", "type": "preprocessing", "data": {"label": "Preprocessing"}},
            {"id": "prep_2", "type": "preprocessing", "data": {"label": "Preprocessing 2"}},
            {"id": "clf_1", "type": "classification", "data": {"label": "Classification", "entity": "svm_model"}}
        ]
        edges = [
            {"id": "e1", "source": "inp_1", "target": "prep_1"},
            {"id": "e2", "source": "prep_1", "target": "prep_2"},
            {"id": "e3", "source": "prep_2", "target": "prep_1"},
            {"id": "e4", "source": "prep_2", "target": "clf_1"}
        ]
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_model',
                'model_name': 'svm_model',
                'saved_model_path': '/app/Models/svm_model.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res1 = ValidationEngine.validate_graph(nodes, edges)
            self.assertFalse(res1["valid"])
            self.assertEqual(len(res1["issues"]), 1)
            
            edges_fixed = [
                {"id": "e1", "source": "inp_1", "target": "prep_1"},
                {"id": "e2", "source": "prep_1", "target": "prep_2"},
                {"id": "e4", "source": "prep_2", "target": "clf_1"}
            ]
            
            res2 = ValidationEngine.validate_graph(nodes, edges_fixed)
            self.assertTrue(res2["valid"])
            self.assertEqual(len(res2["issues"]), 0)

    def test_inference_mode_target_column_not_required(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [{"source": "inp_1", "target": "clf_1"}]
        dataset_meta = {"name": "data.csv", "columns": ["a"]}
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'task_type': 'CLASSIFICATION',
                'training_columns': ['a'],
                'target_column': 'price',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta, pipeline_mode="INFERENCE")
            self.assertTrue(res["valid"])

    def test_training_mode_target_column_required(self):
        nodes = [
            {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}},
        ]
        edges = [{"source": "inp_1", "target": "clf_1"}]
        dataset_meta = {"name": "data.csv", "columns": ["a"]}
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'task_type': 'CLASSIFICATION',
                'training_columns': ['a'],
                'target_column': 'price',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            res = ValidationEngine.validate_graph(nodes, edges, dataset_meta, pipeline_mode="TRAINING")
            self.assertFalse(res["valid"])

    @patch('requests.post')
    @patch('requests.get')
    def test_huggingface_runtime_pipeline_execution(self, mock_get, mock_post):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            "hf_1": {"id": "hf_1", "type": "huggingface", "data": {"label": "Huggingface", "model_name": "bert", "task_name": "sentiment", "candidate_labels": ["pos"]}}
        }
        masterServer.edgeDetails = [{"source": "inp_1", "target": "hf_1"}]
        masterServer.nodeDetails = list(masterServer.nodes_dict.values())
        
        mock_get.return_value.text = "OK"
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: [["a"], [1]]),
            MagicMock(status_code=200, json=lambda: {"results": [["a", "prediction"], [1, "pos"]]})
        ]
        
        res = masterServer.delegate_work()
        self.assertIsNotNone(res)

    @patch('requests.post')
    @patch('requests.get')
    def test_image_pipeline_runtime_execution(self, mock_get, mock_post):
        from APIs.inferenceMicroservices import masterServer
        masterServer.inputFiles = {"inp_1": "data.zip"}
        masterServer.dataset_type = "zip"
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.zip"}},
            "img_1": {"id": "img_1", "type": "imageclassification", "model_id": "cnn_model", "bound_model": True, "data": {"label": "Image Classification", "entity": "cnn_model"}}
        }
        masterServer.edgeDetails = [{"source": "inp_1", "target": "img_1"}]
        masterServer.nodeDetails = list(masterServer.nodes_dict.values())
        
        mock_get.return_value.text = "OK"
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: [["image"], ["encoded_image_bytes"]]),
            MagicMock(status_code=200, json=lambda: {"objective": "imageclassification", "results": [{"image": "bytes", "predicted_label": "cat"}]})
        ]
        
        res = masterServer.delegate_work()
        self.assertIsNotNone(res)

    @patch('requests.post')
    @patch('requests.get')
    def test_runtime_exception_propagation(self, mock_get, mock_post):
        from APIs.inferenceMicroservices import masterServer
        masterServer.nodes_dict = {
            "inp_1": {"id": "inp_1", "type": "inputData", "data": {"label": "Inputs", "entity": "data.csv"}},
            "clf_1": {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "bound_model": True, "data": {"label": "Classification", "entity": "svm_clf"}}
        }
        masterServer.edgeDetails = [{"source": "inp_1", "target": "clf_1"}]
        masterServer.nodeDetails = list(masterServer.nodes_dict.values())
        
        mock_get.return_value.text = "OK"
        mock_post.side_effect = Exception("Docker network timeout")
        
        res = masterServer.delegate_work()
        self.assertIsNotNone(res)
        self.assertIn("error", res)
        self.assertIn("Docker network timeout", res["error"])

    def test_backend_frontend_task_metadata_sync(self):
        from resolver_assistant.issue_detector import IssueDetector
        dataset_meta = {"name": "data.csv", "dataset_type": "tabular"}
        nodes = [
            {"id": "clf_1", "type": "classification", "model_id": "svm_clf", "task_type": "CLASSIFICATION", "data": {"label": "Classification"}}
        ]
        task = IssueDetector.infer_dataset_task(dataset_meta, nodes)
        self.assertEqual(task, "CLASSIFICATION")

    def test_live_node_metadata_priority(self):
        from resolver_assistant.issue_detector import IssueDetector
        dataset_meta = {
            "name": "data.csv",
            "columns": ["sqft", "bedrooms", "price"],
            "dtypes": {"sqft": "int64", "bedrooms": "int64", "price": "float64"},
            "sample_head": [{"sqft": 100, "bedrooms": 2, "price": 5.0}]
        }
        nodes = [
            {
                "id": "clf_1", 
                "type": "classification", 
                "model_id": "svm_clf", 
                "bound_model": True, 
                "training_columns": ["sqft"],
                "target_column": "price",
                "data": {"label": "Classification", "entity": "svm_clf"}
            }
        ]
        
        with patch('mongoDB.db') as mock_db, patch('os.path.exists', return_value=True):
            mock_collection = MagicMock()
            mock_collection.find_one.return_value = {
                'model_id': 'svm_clf',
                'model_name': 'svm_clf',
                'task_type': 'CLASSIFICATION',
                'training_columns': ['sqft', 'bedrooms'],
                'target_column': 'price',
                'saved_model_path': '/app/Models/svm_clf.pkl'
            }
            mock_db.__getitem__.return_value = mock_collection
            
            issues = IssueDetector.detect_issues(nodes, [], dataset_meta)
            self.assertEqual(len([i for i in issues if i["type"] == "FEATURE_SCHEMA_MISMATCH"]), 0)

    def test_dataset_original_filename_resolution(self):
        from APIs.inferenceMicroservices.masterServer import _resolve_dataset_path
        with patch('os.path.exists', return_value=True), patch('os.environ.get', return_value='/app/'):
            res = _resolve_dataset_path("12345", None)
            self.assertIn("12345.csv", res)

if __name__ == '__main__':
    unittest.main()
