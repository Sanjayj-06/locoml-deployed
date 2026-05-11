from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import TargetEncoder
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, AdaBoostRegressor
from sklearn.linear_model import Ridge, BayesianRidge
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
from sklearn.inspection import permutation_importance
from tqdm import tqdm
from statsmodels.stats.outliers_influence import OLSInfluence
import pandas as pd
import joblib
import os
import sys 
project_path = os.getenv('PROJECT_PATH')
sys.path.append(project_path)
sys.path.append('../Enums/')
# from Enums.enums import RegressionMetrics
from enum import Enum
class RegressionMetrics(Enum):
    R2 = "R2 Score"
    MAE = "Mean Absolute Error"
    MSE = "Mean Squared Error"
    RMSE = "Root Mean Squared Error"

import warnings
warnings.filterwarnings("ignore")

class RegressionUtility():
    def __init__(self, data, target_column, trainingMode='AutoML', hyperparameters=None, metric_type=RegressionMetrics.R2.value):
        self.data = data
        self.target_column = target_column
        self.cardinality_threshold = 10
        self.hyperparameters = hyperparameters
        self.trainingMode = trainingMode
        self.metric_type = metric_type
        self.regressors = [
            Ridge(alpha=0.5),
            BayesianRidge(),
            RandomForestRegressor(),
            AdaBoostRegressor()
        ]
        self.regressors_dict = {
            Ridge().__class__.__name__ : Ridge(alpha=0.5),
            BayesianRidge().__class__.__name__ : BayesianRidge(),
            RandomForestRegressor().__class__.__name__ : RandomForestRegressor(),
            AdaBoostRegressor().__class__.__name__ : AdaBoostRegressor()
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
        self.split_data()
        self.get_one_hot_encoding_columns()

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

        target_categorical_transformer['target'].target_type = "continuous"

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
            ('regressor', estimator)
        ])
        self.estimator = estimator
    
    def trainAutoML(self):
        self.prepare_data()
        self.get_preprocessor()
        print("Status: Setting up AutoML Training", file=sys.stderr)

        results = []
        trained_models = {}

        pbar = tqdm(self.regressors)
        for regressor in pbar:
            self.get_estimator(regressor)
            
            pbar.set_description("Status: %s Current Regressor: %s Processing" % ('Training', regressor.__class__.__name__))

            self.estimator.fit(self.X_train, self.y_train)
            trained_models[regressor.__class__.__name__] = self.estimator

            y_pred = self.estimator.predict(self.X_test)
            # print(y_pred)

            r2 = r2_score(self.y_test, y_pred)
            mse = mean_squared_error(self.y_test, y_pred)
            mae = mean_absolute_error(self.y_test, y_pred)
            rmse = mean_squared_error(self.y_test, y_pred, squared=False)

            results.append({
                'regressor' : regressor.__class__.__name__,
                RegressionMetrics.R2.value : round(r2, 2),
                RegressionMetrics.MSE.value : round(mse, 2),
                RegressionMetrics.MAE.value : round(mae, 2),
                RegressionMetrics.RMSE.value : round(rmse, 2)
            })
        
        self.trained_models = trained_models
        self.results = pd.DataFrame(results)
        self.getBestModel(self.metric_type)

    def trainCustom(self, model_type):
        self.prepare_data()
        self.get_preprocessor()
        print("Status: Setting up Custom Training", file=sys.stderr)
        regression_metrics = RegressionMetrics

        results = []
        regressor = self.regressors_dict[model_type]
        if self.hyperparameters != 'None':
            regressor.set_params(**self.hyperparameters)

        self.get_estimator(regressor)

        print("Status: Started Training ", file=sys.stderr)
        self.estimator.fit(self.X_train, self.y_train)
        y_pred = self.estimator.predict(self.X_test)
        # print(y_pred)

        r2 = r2_score(self.y_test, y_pred)
        mse = mean_squared_error(self.y_test, y_pred)
        mae = mean_absolute_error(self.y_test, y_pred)
        rmse = mean_squared_error(self.y_test, y_pred, squared=False)

        results.append({
            'regressor' : regressor.__class__.__name__,
            RegressionMetrics.R2.value : round(r2, 2),
            RegressionMetrics.MSE.value : round(mse, 2),
            RegressionMetrics.MAE.value : round(mae, 2),
            RegressionMetrics.RMSE.value : round(rmse, 2)
        })
        

        self.results = pd.DataFrame(results)
        self.best_model = model_type
        self.best_estimator = self.estimator
        # self.best_model = self.getBestModel(self.metric_to_optimize)

        print("Status: Training Completed", file=sys.stderr)

    def getBestModel(self, metric):
        if self.trainingMode.lower() != 'automl':
            return self.best_model
        self.results.sort_values(by=metric, ascending=False, inplace=True)
        self.best_model = self.results.iloc[0]
        self.best_estimator = self.trained_models[self.best_model['regressor']]
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
        return self.output_mapping

    def get_feature_importance(self):
        feature_importance = {}
        feature_importance['feature_names'] = self.X_train.columns.tolist()
        feature_importance['feature_importance'] = permutation_importance(self.best_estimator, self.X_test, self.y_test, n_repeats=3, random_state=42)['importances_mean'].tolist()
        return feature_importance
    
    def get_scatter_plot_data(self):
        scatter_plot_data = {}
        scatter_plot_data['y_true'] = self.y_test.tolist()
        scatter_plot_data['y_pred'] = self.best_estimator.predict(self.X_test).tolist()
        return scatter_plot_data

    def get_residual_plot_data(self):
        residual_plot_data = {}
        residual_plot_data['y_pred'] = self.best_estimator.predict(self.X_test).tolist()
        residual_plot_data['residuals'] = (self.best_estimator.predict(self.X_test) - self.y_test).tolist()
        return residual_plot_data
    