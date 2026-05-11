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
from icecream import ic 
project_path = os.getenv('PROJECT_PATH')
sys.path.append(project_path)
sys.path.append('../Enums/')
# from Enums.enums import ClassificationMetrics
from enum import Enum
class ClassificationMetrics(Enum):
    Accuracy = "Accuracy"
    AUC = "AUC"
    Precision = "Precision"
    Recall = "Recall"
    F1 = "F1"

import warnings
warnings.filterwarnings("ignore")

class ClassificationUtility():
    def __init__(self, data, target_column, trainingMode='AutoML', hyperparameters=None, metric_to_optimize=ClassificationMetrics.Accuracy.value):
        self.data = data
        self.target_column = target_column
        self.metric_to_optimize = metric_to_optimize
        self.cardinality_threshold = 10
        self.hyperparameters = hyperparameters
        self.trainingMode = trainingMode
        self.classifiers = [
            LogisticRegression(max_iter=1000),
            DecisionTreeClassifier(),
            RandomForestClassifier(bootstrap=True),
            AdaBoostClassifier(),
            SVC(kernel='linear', max_iter=1000, probability=True),
            GaussianNB(),
            KNeighborsClassifier()
        ]
        self.classifiers_dict = {
            LogisticRegression().__class__.__name__ : LogisticRegression(max_iter=1000),
            DecisionTreeClassifier().__class__.__name__ : DecisionTreeClassifier(),
            RandomForestClassifier().__class__.__name__ : RandomForestClassifier(bootstrap=True),
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
        le = LabelEncoder()
        self.data[self.target_column] = le.fit_transform(self.data[self.target_column])
        self.le = le

    def split_data(self):
        X = self.data.drop(self.target_column, axis=1)
        y = self.data[self.target_column]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
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
        numerical_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler())
        ])

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
                ('numerical', numerical_transformer, self.numerical_columns),
                ('one_hot_encoding', categorical_transformer, self.one_hot_encoding_columns),
                ('target_encoding', target_categorical_transformer, self.target_encoding_columns)
            ]
        )

        self.preprocessor = preprocessor
    
    def get_estimator(self, estimator):

        estimator = Pipeline(steps=[
            ('preprocessor', self.preprocessor),
            ('classifier', estimator)
        ])
        self.estimator = estimator
    
    def trainAutoML(self):
        self.prepare_data()
        self.get_preprocessor()
        print("Status: Setting up AutoML Training", file=sys.stderr)
        classification_metrics = ClassificationMetrics
        
        results = []
        trained_models = {}

        i = 0

        pbar = tqdm(self.classifiers)
        for classifier in pbar:
            if i == 5:
                break
            self.get_estimator(classifier)

            print("ESTIMATOR DETAILS", self.estimator, "END OF DEATAIALS")
            
            pbar.set_description("Status: %s Current Classifier: %s Processing" % ('Training', classifier.__class__.__name__))
            self.estimator.fit(self.X_train, self.y_train)

            trained_models[classifier.__class__.__name__] = self.estimator

            y_pred = self.estimator.predict(self.X_test)
            # print(y_pred)

            accuracy = accuracy_score(self.y_test, y_pred)
            precision = precision_score(self.y_test, y_pred, average='macro')
            recall = recall_score(self.y_test, y_pred, average='macro')
            f1 = f1_score(self.y_test, y_pred, average='macro')
            if len(self.le.classes_) == 2:
                auc = roc_auc_score(self.y_test, self.estimator.predict_proba(self.X_test)[:, 1])
            else:
                estimation_X_test = self.estimator.predict_proba(self.X_test)
                print(estimation_X_test)
                auc = roc_auc_score(self.y_test, estimation_X_test, average='macro', multi_class='ovo')

            results.append({
                'classifier' : classifier.__class__.__name__,
                classification_metrics.Accuracy.value : round(accuracy, 4),
                classification_metrics.Precision.value : round(precision, 4),
                classification_metrics.Recall.value : round(recall, 4),
                classification_metrics.F1.value : round(f1, 4),
                classification_metrics.AUC.value : round(auc, 4)
            })

            i += 1
        
        self.trained_models = trained_models
        self.results = pd.DataFrame(results)
        self.best_model = self.getBestModel(self.metric_to_optimize)

    def trainCustom(self, model_type):
        self.prepare_data()
        self.get_preprocessor()
        print("Status: Setting up Custom Training", file=sys.stderr)
        classification_metrics = ClassificationMetrics

        results = []
        classifier = self.classifiers_dict[model_type]
        
        # Only set hyperparameters if they are not None
        if self.hyperparameters is not None and self.hyperparameters != 'None':
            classifier.set_params(**self.hyperparameters)
            
        self.get_estimator(classifier)

        print("Status: Started Training ", file=sys.stderr)
        self.estimator.fit(self.X_train, self.y_train)
        y_pred = self.estimator.predict(self.X_test)
        # print(y_pred)

        accuracy = accuracy_score(self.y_test, y_pred)
        precision = precision_score(self.y_test, y_pred, average='macro')
        recall = recall_score(self.y_test, y_pred, average='macro')
        f1 = f1_score(self.y_test, y_pred, average='macro')
        if len(self.le.classes_) == 2:
            auc = roc_auc_score(self.y_test, self.estimator.predict_proba(self.X_test)[:, 1])
        else:
            auc = roc_auc_score(self.y_test, self.estimator.predict_proba(self.X_test), average='macro', multi_class='ovo')

        results.append({
            'classifier' : classifier.__class__.__name__,
            classification_metrics.Accuracy.value : round(accuracy, 4),
            classification_metrics.Precision.value : round(precision, 4),
            classification_metrics.Recall.value : round(recall, 4),
            classification_metrics.F1.value : round(f1, 4),
            classification_metrics.AUC.value : round(auc, 4)
        })

        self.results = pd.DataFrame(results)
        self.best_model = model_type
        self.best_estimator = self.estimator
        # self.best_model = self.getBestModel(self.metric_to_optimize)

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

        print("OUTPUT MAPPING", self.output_mapping)
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
        precision_recall_data['auc'] = []
        if len(self.output_mapping) == 2:
            precision, recall, thresholds = precision_recall_curve(self.y_test, self.best_estimator.predict_proba(self.X_test)[:, 1], pos_label=pos_label)
            precision_recall_data['precision'].append(precision.tolist())
            precision_recall_data['recall'].append(recall.tolist())
            precision_recall_data['thresholds'].append(thresholds.tolist())
            precision_recall_data['auc'].append(auc(recall, precision))
            return precision_recall_data
        else:
            for i in range(len(self.output_mapping)):
                precision, recall, thresholds = precision_recall_curve(self.y_test, self.best_estimator.predict_proba(self.X_test)[:, i], pos_label=i)
                precision_recall_data['precision'].append(precision.tolist())
                precision_recall_data['recall'].append(recall.tolist())
                precision_recall_data['thresholds'].append(thresholds.tolist())
                precision_recall_data['auc'].append(auc(recall, precision))
            return precision_recall_data
    
    def get_auc_data(self):
        output_mapping = self.get_output_mapping()
        # get key corresponding to value 1

        pos_label = output_mapping['1']

        auc_data = {}
        auc_data['fpr'] = []
        auc_data['tpr'] = []
        auc_data['thresholds'] = []
        auc_data['auc'] = []
        if len(output_mapping) == 2:
            fpr, tpr, thresholds = roc_curve(self.y_test, self.best_estimator.predict_proba(self.X_test)[:, 1], pos_label=pos_label)
            fpr = np.nan_to_num(fpr)
            tpr = np.nan_to_num(tpr)
            auc_data['fpr'].append(fpr.tolist())
            auc_data['tpr'].append(tpr.tolist())
            auc_data['thresholds'].append(np.nan_to_num(thresholds).tolist())
            auc_classification = auc(fpr, tpr)
            # if auc_classification is
            # print('auc: ', auc_classification, type(auc_classification))
            auc_data['auc'].append(auc_classification)
            return auc_data
        else:
            for i in range(len(output_mapping)):
                fpr, tpr, thresholds = roc_curve(self.y_test, self.best_estimator.predict_proba(self.X_test)[:, i], pos_label=i)
                fpr = np.nan_to_num(fpr)
                tpr = np.nan_to_num(tpr)
                auc_data['fpr'].append(fpr.tolist())
                auc_data['tpr'].append(tpr.tolist())
                auc_data['thresholds'].append(np.nan_to_num(thresholds).tolist())
                auc_classification = auc(fpr, tpr)
                # if auc_classification is
                # print('auc: ', auc_classification, type(auc_classification))
                auc_data['auc'].append(auc_classification)
            return auc_data