
from mongoDB import db
from flask import Blueprint, request, send_file
import os
import sys
import inspect
import sklearn
sys.path.append(os.getenv('PROJECT_PATH'))
sys.path.append('../')
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.ensemble import AdaBoostClassifier, RandomForestClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestRegressor, AdaBoostRegressor
from sklearn.linear_model import Ridge, BayesianRidge

# from functions.Sentiment_new import SentimentAnalysisUtility_1

#from transformers import DistilBertModel as DistilBERT, DistilBertTokenizer
from Enums import enums
utilityAPIs = Blueprint('utilityAPIs', __name__)


classifier_map = {
    enums.Classifiers.AdaBoost.value: 'AdaBoostClassifier',
    enums.Classifiers.DecisionTree.value: 'DecisionTreeClassifier',
    enums.Classifiers.KNN.value: 'KNeighborsClassifier',
    enums.Classifiers.LogisticRegression.value: 'LogisticRegression',
    enums.Classifiers.NaiveBayes.value: 'GaussianNB',
    enums.Classifiers.SVM.value: 'SVC',
    enums.Classifiers.RandomForest.value: 'RandomForestClassifier',
}

reversed_classifier_map = {str(v): k for k, v in classifier_map.items()}

regressor_map = {
    enums.Regressors.Ridge.value: 'Ridge',
    enums.Regressors.BayesianRidge.value: 'BayesianRidge',
    enums.Regressors.RandomForestRegressor.value: 'RandomForestRegressor',
    enums.Regressors.AdaBoostRegressor.value: 'AdaBoostRegressor',
}

reversed_regressor_map = {str(v): k for k, v in regressor_map.items()}

sentiment_map = {
    enums.SentimentAnalysisClassifiers.DistilBert.value: 'DistilBertForSequenceClassification',
}

reversed_sentiment_map = {str(v): k for k, v in sentiment_map.items()}

estimator_map = {
    'AdaBoostClassifier' : AdaBoostClassifier,
    'DecisionTreeClassifier' : DecisionTreeClassifier,
    'KNeighborsClassifier' : KNeighborsClassifier,
    'LogisticRegression' : LogisticRegression,
    'GaussianNB' : GaussianNB,
    'SVC' : SVC,
    'RandomForestClassifier' : RandomForestClassifier,
    'Ridge': Ridge,
    'BayesianRidge' : BayesianRidge,
    'RandomForestRegressor' : RandomForestRegressor,
    'AdaBoostRegressor' : AdaBoostRegressor,
    # 'DistilBertForSequenceClassification' : SentimentAnalysisUtility_1,
    #'DistilBERT' : DistilBERT,
}


@utilityAPIs.route('/getAllClassifiers', methods=['GET'])
def getAllClassifiers():
    classifiers = []
    for cls in enums.Classifiers:
        classifiers.append(cls.value)
    return classifiers


@utilityAPIs.route('/getAllRegressors', methods=['GET'])
def getAllRegressors():
    regressors = []
    for reg in enums.Regressors:
        regressors.append(reg.value)
    return regressors


@utilityAPIs.route('/getAllSentimentClassifiers', methods=['GET'])
def getAllSentimentClassifiers():
    sentimentClassifiers = []
    for cls in enums.SentimentAnalysisClassifiers:
        sentimentClassifiers.append(cls.value)
    return sentimentClassifiers

@utilityAPIs.route('/getClassifierMap', methods=['GET'])
def getClassifiersMap():
    return {
        'forward_map': classifier_map,
        'reverse_map': reversed_classifier_map,
    }

@utilityAPIs.route('/getRegressorMap', methods=['GET'])
def getRegressorsMap():
    return {
        'forward_map': regressor_map,
        'reverse_map': reversed_regressor_map,
    }

@utilityAPIs.route('/getSentimentMap', methods=['GET'])
def getSentimentMap():
    return {
        'forward_map': sentiment_map,
        'reverse_map': reversed_sentiment_map,
    }

@utilityAPIs.route('/getHyperparameters', methods=['POST'])
def getHyperparameters():
    data = request.json
    print(data)
    estimator_n = data['estimator_name']
    estimator = estimator_map[estimator_n]

    hyperparams = inspect.getfullargspec(estimator.__init__).kwonlydefaults
    print(hyperparams)
    return hyperparams