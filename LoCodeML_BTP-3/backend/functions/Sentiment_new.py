from datasets import load_dataset
from transformers import AutoTokenizer
from transformers import DataCollatorWithPadding
from transformers import AutoModelForSequenceClassification
import numpy as np
from datasets import load_metric
from transformers import TrainingArguments, Trainer
from enum import Enum
from tqdm import tqdm
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix
import pandas as pd
import os
import joblib

repo_name = "finetuning-sentiment-model-3000-samples"

class SentimentAnalysisMetrics(Enum):
    Accuracy = "Accuracy"
    Precision = "Precision"
    Recall = "Recall"
    F1 = "F1"


class SentimentAnalysisUtility_1():
    def __init__(self, data, target_column, trainingMode='AutoML', hyperparameters=None, metric_to_optimize=SentimentAnalysisMetrics.Accuracy.value):
        # load_dataset("imdb")
        self.data = data
        self.target_column = target_column
        self.trainingMode = trainingMode
        self.hyperparameters = hyperparameters
        self.metric_to_optimize = metric_to_optimize
        self.id2label = {0: "negative", 1: "positive"}
        self.label2id = {"negative": 0, "positive": 1}
        self.models = [
            # AutoModelForSequenceClassification.from_pretrained("distilroberta-base", num_labels=2),
            AutoModelForSequenceClassification.from_pretrained("distilbert-base-uncased", num_labels=2, id2label=self.id2label, label2id=self.label2id),
        ]
        # self.tokenizers = [
        #     # AutoTokenizer.from_pretrained("distilroberta-base"),
        #     AutoTokenizer.from_pretrained("distilbert-base-uncased"),
        # ]
        self.tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")                                                   # TODO: Make this a list of tokenizers for multiple models

    # def trainAutoML(self):
    #     pbar = tqdm(self.models)
    #     for model in pbar:
    #         pbar.set_description(f"Training {model}")
    #         self.trainModel(model)

    #     pass
        


    def handle_input(self):
        self.data.rename(columns={"review": "text", "sentiment": "label"}, inplace=True)

        self.target_column = 'label'

        self.data["label"] = self.data["label"].replace(self.label2id)                                             # TODO: Generalise it to other possible labels
        self.output_mapping = self.id2label

        train_dataset, test_dataset = train_test_split(self.data, test_size=50, train_size=150, random_state=42)

        train_dataset.to_csv('train.csv')
        test_dataset.to_csv('test.csv')

        data_files = {"train": "train.csv", "test": "test.csv"}
        imdb = load_dataset('csv', data_files=data_files)

        small_train_dataset = imdb["train"].shuffle(seed=42).select([i for i in list(range(75))])
        small_test_dataset = imdb["test"].shuffle(seed=42).select([i for i in list(range(35))])

        os.remove('train.csv')
        os.remove('test.csv')

        return small_train_dataset, small_test_dataset
    
    def preprocessing(self):
        small_train_dataset, small_test_dataset = self.handle_input()

        def tokenize_function(examples):
            print(examples)
            return self.tokenizer(examples["text"], truncation=True)                                         # TODO: Change this to feature_column after taking user input

        self.tokenized_train_dataset = small_train_dataset.map(tokenize_function, batched=True)
        self.tokenized_test_dataset = small_test_dataset.map(tokenize_function, batched=True)

        self.data_collator = DataCollatorWithPadding(tokenizer=self.tokenizer)
    
    def compute_metrics(self, eval_pred):
        load_accuracy = load_metric("accuracy")
        load_f1 = load_metric("f1")
        load_precision = load_metric("precision")
        load_recall = load_metric("recall")

        logits, labels = eval_pred
        predictions = np.argmax(logits, axis=-1)
        return {
            "accuracy": load_accuracy.compute(predictions=predictions, references=labels)["accuracy"],
            "f1": load_f1.compute(predictions=predictions, references=labels)["f1"],
            "precision": load_precision.compute(predictions=predictions, references=labels)["precision"],
            "recall": load_recall.compute(predictions=predictions, references=labels)["recall"],
        }
    
    def get_params(self):
        return self.param_dict
    
    def getBestModel(self, metric):
        return self.results.iloc[0]                                                                     # TODO: Need to return the best model by sorting
    
    def trainAutoML(self):                                                                                # Going to become trainAutoML
        sentiment_analysis_metrics = SentimentAnalysisMetrics

        self.param_dict = {
            'learning_rate' : 2e-5,
            'per_device_train_batch_size' : 16,
            'per_device_eval_batch_size' : 16,
            'num_train_epochs' : 2,
            'weight_decay' : 0.01,
            'save_strategy' : "epoch"
        }

        self.training_args = TrainingArguments(
            output_dir=repo_name,
            learning_rate=2e-5,                                                                     # TODO: These hyperparams are user inputs
            per_device_train_batch_size=16,
            per_device_eval_batch_size=16,
            num_train_epochs=2,
            weight_decay=0.01,
            save_strategy="epoch",
            push_to_hub=False,
        )

        results = []
        trained_models = {}
        eval_predictions = []

        self.preprocessing()

        pbar = tqdm(self.models)
        for model in pbar:
            pbar.set_description(f"Training {model}")
            trainer = Trainer(
                model=model,
                args=self.training_args,
                train_dataset=self.tokenized_train_dataset,
                eval_dataset=self.tokenized_test_dataset,
                tokenizer=self.tokenizer,
                data_collator=self.data_collator,
                compute_metrics=self.compute_metrics,
            )
            trainer.train()

            # print("FIND", model, "ENENd")

            trained_models[model.__class__.__name__] = model

            # trainer.evaluate()

            eval_results = trainer.evaluate()

            eval_predictions.append(trainer.predict(self.tokenized_test_dataset))

            # classifier_name = model_type._class_._name_
            # results.append({
            #     'sentiment analysis model': classifier_name,
            #     classification_metrics.Accuracy.value: round(eval_results['accuracy'], 4),
            #     classification_metrics.Precision.value: round(eval_results['precision'], 4),
            #     classification_metrics.Recall.value: round(eval_results['recall'], 4),
            #     classification_metrics.F1.value: round(eval_results['f1'], 4),
            # })

            results.append({
                'sentiment_model' : model.__class__.__name__,
                sentiment_analysis_metrics.Accuracy.value : round(eval_results['eval_accuracy'], 4),
                sentiment_analysis_metrics.Precision.value : round(eval_results['eval_precision'], 4),
                sentiment_analysis_metrics.Recall.value : round(eval_results['eval_recall'], 4),
                sentiment_analysis_metrics.F1.value : round(eval_results['eval_f1'], 4),
            })

        # print(self.tokenized_test_dataset)
        # print("Predictions for test dataset: ", eval_predictions[0][1], "End of predictions")

        self.best_eval_predictions = eval_predictions[0][1]
        self.results = pd.DataFrame(results)
        self.trained_models = trained_models
        self.best_model = self.getBestModel(self.metric_to_optimize)

    def saveModel(self, model_name, save_path):
        if self.trainingMode.lower() != 'automl':
            joblib.dump(self.best_model, save_path)
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
        str_key_dict = {'0': self.output_mapping[0], '1': self.output_mapping[1]}
        return str_key_dict

    def get_confusion_matrix(self):
        cm = confusion_matrix(np.array(self.tokenized_test_dataset['label']), self.best_eval_predictions)
        return cm.tolist()

# trainer.to("mps")

# train
# trainer.train()

# util = SentimentAnalysisUtility_1(pd.read_csv("../Datasets/04208.csv"), "review", "AutoML")
# util.trainAutoML()
# util.get_confusion_matrix()

# print(util.results)
