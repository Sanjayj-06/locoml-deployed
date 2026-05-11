from sklearn.preprocessing import LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import LabelEncoder, TargetEncoder
from sklearn.model_selection import train_test_split, learning_curve
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.ensemble import AdaBoostClassifier, RandomForestClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, roc_curve, auc, confusion_matrix, precision_recall_curve
from sklearn.inspection import permutation_importance
from tqdm import tqdm
import pandas as pd
import joblib
import numpy as np
import os
import sys
import torch
from icecream import ic 

# new imports
import torch
from datasets import load_dataset
from sklearn.model_selection import train_test_split
from transformers import AutoTokenizer
from transformers import DataCollatorWithPadding
from transformers import AutoModelForSequenceClassification
import numpy as np
from datasets import load_metric
from transformers import TrainingArguments, Trainer

project_path = os.getenv('PROJECT_PATH')
sys.path.append(project_path)
sys.path.append('../Enums/')
# from Enums.enums import ClassificationMetrics
from enum import Enum
class SentimentAnalysisMetrics(Enum):
    Accuracy = "Accuracy"
    Precision = "Precision"
    Recall = "Recall"
    F1 = "F1"

import warnings
warnings.filterwarnings("ignore")

class SentimentAnalysisUtility():
    def __init__(self, data, target_column, trainingMode='AutoML', hyperparameters=None, metric_to_optimize=SentimentAnalysisMetrics.Accuracy.value):
        self.data = data
        self.target_column = target_column
        self.metric_to_optimize = metric_to_optimize
        self.cardinality_threshold = 10
        self.hyperparameters = hyperparameters
        self.trainingMode = trainingMode
        self.classifiers = [
            LogisticRegression(max_iter=1000),
            DecisionTreeClassifier(),
            RandomForestClassifier(),
            AdaBoostClassifier(),
            SVC(kernel='linear', max_iter=1000, probability=True),
            GaussianNB(),
            KNeighborsClassifier()
        ]
        self.classifiers_dict = {
            LogisticRegression().__class__.__name__ : LogisticRegression(max_iter=1000),
            DecisionTreeClassifier().__class__.__name__ : DecisionTreeClassifier(),
            RandomForestClassifier().__class__.__name__ : RandomForestClassifier(),
            AdaBoostClassifier().__class__.__name__ : AdaBoostClassifier(),
            SVC().__class__.__name__ : SVC(kernel='linear', max_iter=1000, probability=True),
            GaussianNB().__class__.__name__ : GaussianNB(),
            KNeighborsClassifier().__class__.__name__ : KNeighborsClassifier()
        }

    def get_numerical_columns(self):
        numerical_columns = []
        for column in self.data.columns:
            if column != self.target_column and (self.data[column].dtype == 'int64' or self.data[column].dtype == 'float64'):
                numerical_columns.append(column)
        self.numerical_columns = numerical_columns
        # return numerical_columns
    
    def get_categorical_columns(self):
        categorical_columns = []
        for column in self.data.columns:
            if self.data[column].dtype == 'object':
                categorical_columns.append(column)
        self.categorical_columns = categorical_columns
        # return categorical_columns

    def get_categorical_column_cardinality(self):
        cardinality = {}
        for column in self.categorical_columns:
            cardinality[column] = len(self.data[column].unique())
        self.cardinality = cardinality

    def get_target_encoding_columns(self):
        target_encoding_columns = []
        for column in self.categorical_columns:
            if column != self.target_column and  self.cardinality[column] > self.cardinality_threshold:
                target_encoding_columns.append(column)
        self.target_encoding_columns = target_encoding_columns
    
    def get_one_hot_encoding_columns(self):
        one_hot_encoding_columns = []
        for column in self.categorical_columns:
            if column != self.target_column and self.cardinality[column] <= self.cardinality_threshold:
                one_hot_encoding_columns.append(column)
        self.one_hot_encoding_columns = one_hot_encoding_columns

    def encode_target_column(self):
        tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
        self.data[self.target_column] = tokenizer(self.target_column, truncation=True)
        data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

    def split_data(self):
        X = self.data.drop(self.target_column, axis=1)
        y = self.data[self.target_column]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        self.X_train = X_train
        self.X_test = X_test
        self.y_train = y_train
        self.y_test = y_test

    def prepare_data(self):
        self.get_numerical_columns()
        self.get_categorical_columns()
        self.get_categorical_column_cardinality()
        self.get_target_encoding_columns()
        self.get_one_hot_encoding_columns()
        self.split_data()
        self.encode_target_column()

    def get_preprocessor(self):
        categorical_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='most_frequent')),
            ('onehot', OneHotEncoder(handle_unknown='ignore'))
        ])

        target_categorical_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='most_frequent')),
            ('target', TargetEncoder())
        ])

        preprocessor = ColumnTransformer(
            transformers=[
                ('one_hot_encoding', categorical_transformer, self.one_hot_encoding_columns),
                ('target_encoding', target_categorical_transformer, self.target_encoding_columns)
            ],
            remainder='passthrough'
        )

        self.preprocessor = preprocessor
    
    def get_estimator(self, estimator):

        estimator = Pipeline(steps=[
            ('preprocessor', self.preprocessor),
            ('classifier', estimator)
        ])
        self.estimator = estimator
    
    def trainAutoML(self):
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        print("Using {} device".format(device))
        torch.set_default_device(device)

        self.prepare_data()
        self.get_preprocessor()
        print("Status: Setting up AutoML Training", file=sys.stderr)
        classification_metrics = SentimentAnalysisMetrics
        
        results = []
        trained_models = {}

        pbar = tqdm(self.classifiers)
        for classifier in pbar:
            self.get_estimator(classifier)
            
            pbar.set_description("Status: %s Current Classifier: %s Processing" % ('Training', classifier.__class__.__name__))
            
            model = AutoModelForSequenceClassification.from_pretrained("distilbert-base-uncased", num_labels=2)
            
            training_args = TrainingArguments(
            output_dir="",
            per_device_train_batch_size=16,
            per_device_eval_batch_size=16,
            num_train_epochs=2,
            save_strategy="epoch",
            )

            trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=self.X_train,  
            eval_dataset=self.X_test,    
            compute_metrics=self.compute_metrics,
            )

            print("Status: Started Training ", file=sys.stderr)
            trainer.train()

            eval_results = trainer.evaluate()

            results.append({
                'classifier': classifier.__class__.__name__,
                classification_metrics.Accuracy.value: round(eval_results['accuracy'], 4),
                classification_metrics.Precision.value: round(eval_results['precision'], 4),
                classification_metrics.Recall.value: round(eval_results['recall'], 4),
                classification_metrics.F1.value: round(eval_results['f1'], 4),
            })
        
        self.trained_models = trained_models
        self.results = pd.DataFrame(results)
        self.best_model = self.getBestModel(self.metric_to_optimize)
        print("Status: Training Completed", file=sys.stderr)

    def trainCustom(self, model_type):
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        print("Using {} device".format(device))
        torch.set_default_device(device)

        self.prepare_data()
        self.get_preprocessor()
        print("Status: Setting up Custom Training", file=sys.stderr)
        classification_metrics = SentimentAnalysisMetrics

        results = []

        model = AutoModelForSequenceClassification.from_pretrained("distilbert-base-uncased", num_labels=2)

        training_args = TrainingArguments(
            output_dir="",
            per_device_train_batch_size=16,
            per_device_eval_batch_size=16,
            num_train_epochs=2,
            save_strategy="epoch",
        )

        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=self.X_train,  
            eval_dataset=self.X_test,   
            compute_metrics=self.compute_metrics,
        )

        print("Status: Started Training ", file=sys.stderr)
        trainer.train()
        eval_results = trainer.evaluate()

        classifier_name = model_type.__class__.__name__
        results.append({
            'classifier': classifier_name,
            classification_metrics.Accuracy.value: round(eval_results['accuracy'], 4),
            classification_metrics.Precision.value: round(eval_results['precision'], 4),
            classification_metrics.Recall.value: round(eval_results['recall'], 4),
            classification_metrics.F1.value: round(eval_results['f1'], 4),
        })

        self.results = pd.DataFrame(results)
        self.best_model = model_type
        self.best_estimator = self.estimator

        print("Status: Training Completed", file=sys.stderr)

    def getBestModel(self, metric):
        ic(self.trainingMode.lower())
        if self.trainingMode.lower() != 'automl':
            return self.best_model
        
        self.results.sort_values(by=metric, ascending=False, inplace=True)
        self.best_model = self.results.iloc[0]
        self.best_estimator = self.trained_models[self.best_model['classifier']]
        return self.best_model
    
    def saveModel(self, model_name, save_path):
        if self.trainingMode.lower() != 'automl':
            joblib.dump(self.best_estimator, save_path)
            self.save_path = save_path
            return
        joblib.dump(self.trained_models[model_name], save_path)
        self.save_path = save_path
    
    def get_input_schema(self):
        self.input_schema = []
        for column in self.data.columns:
            if column != self.target_column:
                self.input_schema.append({
                    'column_name' : column,
                    'column_type' : self.data[column].dtype.name
                })
        return self.input_schema
    
    def get_output_schema(self):
        self.output_schema = []
        self.output_schema.append({
            'column_name' : self.target_column,
            'column_type' : self.data[self.target_column].dtype.name
        })
        return self.output_schema
    
    def get_output_mapping(self):
        self.output_mapping = {}
        for i, class_name in enumerate(self.le.classes_):
            self.output_mapping[str(i)] = str(class_name)
        return self.output_mapping
    
    def get_confusion_matrix(self):
        cm = confusion_matrix(self.y_test, self.best_estimator.predict(self.X_test))
        return cm.tolist()
    
    # def get_learning_curve_data(self):
    #     self.get_estimator(self.classifiers_dict[self.best_model['classifier']])
    #     train_sizes, train_scores, test_scores = learning_curve(self.estimator, self.X_train, self.y_train, scoring='accuracy', n_jobs=4)
    #     learning_curve_data = {}
    #     learning_curve_data['train_sizes'] = train_sizes.tolist()
    #     learning_curve_data['train_scores'] = train_scores.tolist()
    #     learning_curve_data['test_scores'] = test_scores.tolist()
    #     return learning_curve_data

    def get_feature_importance(self):
        feature_importance = {}
        feature_importance['feature_names'] = self.X_train.columns.tolist()
        feature_importance['feature_importance'] = permutation_importance(self.best_estimator, self.X_test, self.y_test, n_repeats=3, random_state=42)['importances_mean'].tolist()
        return feature_importance
    
    def get_precision_recall_data(self):
        precision_recall_data = {}
        output_mapping = self.get_output_mapping()
        # get key corresponding to value 1

        pos_label = output_mapping['1']
        precision_recall_data['precision'] = []
        precision_recall_data['recall'] = []
        precision_recall_data['thresholds'] = []
        if len(self.output_mapping) == 2:
            precision, recall, thresholds = precision_recall_curve(self.y_test, self.best_estimator.predict_proba(self.X_test)[:, 1], pos_label=pos_label)
            precision_recall_data['precision'].append(precision.tolist())
            precision_recall_data['recall'].append(recall.tolist())
            precision_recall_data['thresholds'].append(thresholds.tolist())
            return precision_recall_data
        else:
            for i in range(len(self.output_mapping)):
                precision, recall, thresholds = precision_recall_curve(self.y_test, self.best_estimator.predict_proba(self.X_test)[:, i], pos_label=i)
                precision_recall_data['precision'].append(precision.tolist())
                precision_recall_data['recall'].append(recall.tolist())
                precision_recall_data['thresholds'].append(thresholds.tolist())
            return precision_recall_data
    

test = SentimentAnalysisUtility(pd.read_csv('../Datasets/04208.csv'), 'sentiment')

test.trainAutoML()