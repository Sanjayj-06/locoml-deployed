from datasets import load_dataset
from transformers import AutoTokenizer
from transformers import DataCollatorWithPadding
from transformers import AutoModelForSequenceClassification
import numpy as np
from datasets import load_metric
from transformers import TrainingArguments, Trainer

from sklearn.model_selection import train_test_split

from enum import Enum
from tqdm import tqdm

import os

import pandas as pd

# class SentimentAnalysisMetrics(Enum):
#     Accuracy = "Accuracy"
#     Precision = "Precision"
#     Recall = "Recall"
#     F1 = "F1"

# class SentimentAnalysisUtility():
#     def __init__(self, data, target_column, trainingMode='AutoML', hyperparameters=None, metric_to_optimize=SentimentAnalysisMetrics.Accuracy.value):
#         self.data = data
#         self.target_column = target_column
#         self.trainingMode = trainingMode
#         self.hyperparameters = hyperparameters
#         self.metric_to_optimize = metric_to_optimize
#         self.models = [
#             # AutoModelForSequenceClassification.from_pretrained("distilbert-base-uncased", num_labels=2),
#             AutoModelForSequenceClassification.from_pretrained("distilroberta-base", num_labels=2),
#         ]

#     def trainAutoML(self):
#         pbar = tqdm(self.models)
#         for model in pbar:
#             pbar.set_description(f"Training {model}")
#             self.trainModel(model)

#         pass

imdb = pd.read_csv("../Datasets/04208.csv")
imdb.rename(columns={"review": "text", "sentiment": "label"}, inplace=True)
train_dataset, test_dataset = train_test_split(imdb, test_size=300, train_size=3000, random_state=42)


# imdb = load_dataset("imdb")

# print(type(train_dataset))

train_dataset.to_csv('train.csv')
test_dataset.to_csv('test.csv')

data_files = {"train": "train.csv", "test": "test.csv"}

imdb = load_dataset('csv', data_files=data_files)
# print(type(imdb['train']))
# print(imdb)

small_train_dataset = imdb["train"].shuffle(seed=42).select([i for i in list(range(3000))])
small_test_dataset = imdb["test"].shuffle(seed=42).select([i for i in list(range(300))])

# preprocess
tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")

# prepare text inputs for model
def preprocess_function(examples):
   return tokenizer(examples["text"], truncation=True)

tokenized_train = small_train_dataset.map(preprocess_function, batched=True)
tokenized_test = small_test_dataset.map(preprocess_function, batched=True)

os.remove('train.csv')
os.remove('test.csv')

# exit()

# convert training samples to PyTorch sensor
data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

# define DistilBERT as base model
model = AutoModelForSequenceClassification.from_pretrained("distilbert-base-uncased", num_labels=2)

# define metrics
def compute_metrics(eval_pred):
   load_accuracy = load_metric("accuracy")
   load_f1 = load_metric("f1")
  
   logits, labels = eval_pred
   predictions = np.argmax(logits, axis=-1)
   accuracy = load_accuracy.compute(predictions=predictions, references=labels)["accuracy"]
   f1 = load_f1.compute(predictions=predictions, references=labels)["f1"]
   return {"accuracy": accuracy, "f1": f1}

# define training arguments

repo_name = "finetuning-sentiment-model-3000-samples"
 
training_args = TrainingArguments(
   output_dir=repo_name,
   learning_rate=2e-5,
   per_device_train_batch_size=16,
   per_device_eval_batch_size=16,
   num_train_epochs=2,
   weight_decay=0.01,
   save_strategy="epoch",
   push_to_hub=False,
)
 
trainer = Trainer(
   model=model,
   args=training_args,
   train_dataset=tokenized_train,
   eval_dataset=tokenized_test,
   tokenizer=tokenizer,
   data_collator=data_collator,
   compute_metrics=compute_metrics,
)

# trainer.to("mps")

# train
trainer.train()

# evaluate metrics
trainer.evaluate()