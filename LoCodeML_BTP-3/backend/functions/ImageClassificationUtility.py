import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import models, transforms
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
import joblib
from tqdm import tqdm
import os
import sys
import pandas as pd
from sklearn.metrics import confusion_matrix
import numpy as np
import json
from transformers import AutoImageProcessor
project_path = os.getenv('PROJECT_PATH')
sys.path.append(project_path)
sys.path.append('../Enums/')
from enum import Enum
from datasets import load_dataset

class ImageClassificationMetrics(Enum):
    Accuracy = "Accuracy"
    Precision = "Precision"
    Recall = "Recall"
    F1 = "F1"
    AUC = "AUC"

import warnings
warnings.filterwarnings("ignore")

# Define the CNN model
class CNN(nn.Module):
    def __init__(self, num_classes=10, in_channels=3, image_size=(32, 32)):
        super(CNN, self).__init__()
        height, width = image_size
        
        # Convolutional layers
        self.conv_layers = nn.Sequential(
            nn.Conv2d(in_channels, 32, kernel_size=3, stride=1, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=2, stride=2),
            nn.Conv2d(32, 64, kernel_size=3, stride=1, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=2, stride=2)
        )
        
        # Calculate size of flattened features after conv layers
        # After 2 MaxPool layers, dimensions are reduced by factor of 4
        conv_height = height // 4
        conv_width = width // 4
        flatten_size = 64 * conv_height * conv_width
        
        # Fully connected layers
        self.fc_layers = nn.Sequential(
            nn.Linear(flatten_size, 512),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(512, num_classes)
        )

    def forward(self, x):
        # Pass through convolutional layers
        x = self.conv_layers(x)
        # Flatten
        x = x.view(x.size(0), -1)
        # Pass through fully connected layers
        x = self.fc_layers(x)
        return x

# Define the ResNet model
class ResNet(nn.Module):
    def __init__(self, num_classes=10, in_channels=3):
        super(ResNet, self).__init__()
        self.resnet = models.resnet18(pretrained=False)
        # Modify first conv layer to accept different number of input channels
        if in_channels != 3:
            self.resnet.conv1 = nn.Conv2d(in_channels, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.resnet.fc = nn.Linear(self.resnet.fc.in_features, num_classes)

    def forward(self, x):
        return self.resnet(x)

# Define the VGG model

# Complete the ImageClassificationUtility class
class ImageClassificationUtility:
    def __init__(self, data, target_column=None, trainingMode='AutoML', hyperparameters=None, metric_to_optimize=ImageClassificationMetrics.Accuracy.value, dataset_id=None):
        # Take 20% random sample of the data
        if 'train' in data:
            total_size = len(data['train'])
            sample_size = int(total_size*0.1)
            indices = torch.randperm(total_size)[:sample_size]
            # Create new dataset with sampled indices
            self.dataset = {
                'train': data['train'].select(indices.tolist())
            }
            if 'validation' in data:
                self.dataset['validation'] = data['validation']
            if 'test' in data:
                self.dataset['test'] = data['test']
        else:
            self.dataset = data  # Keep original if not a HuggingFace dataset
        # self.dataset = data  # Keep original if not a HuggingFace dataset

        self.trainingMode = trainingMode
        self.hyperparameters = hyperparameters
        self.metric_to_optimize = metric_to_optimize
        self.dataset_id = dataset_id
        self.models_dict = {}  # Will be initialized after preprocessing
        self.trained_models = {}
        self.best_estimator = None
        self.save_path = None
        self.results = None
        self.training_history = None
        self.training_histories = {}  # Add this line

    def handle_input(self):
        pass

    def preprocessing(self):
        print("DEBUG: Starting preprocessing", file=sys.stderr)
        
        try:
            # Extract dataset_id from dataset path
            if self.dataset_id == None:
                self.dataset_id = os.path.basename(os.path.dirname(self.dataset._data_files['train'][0]))
            print(self.dataset_id, file=sys.stderr)
            preprocessing_config_path = os.path.join('./PreprocessingTasks', f'{self.dataset_id}.json')
            
            # Load preprocessing configuration
            with open(preprocessing_config_path, 'r') as f:
                config = json.load(f)
                preprocessing_config = config['preprocessing_suggestions']

            # Automatically determine number of classes from dataset
            unique_labels = set(item['label'] for item in self.dataset['train'])
            num_classes = len(unique_labels)
            print(f"DEBUG: Detected {num_classes} unique classes", file=sys.stderr)

            # Build transform pipeline based on configuration
            transform_list = []
            
            # Handle color mode conversion if needed
            if preprocessing_config['color_mode_info'].get('handle_conversion', False):
                transform_list.append(
                    transforms.Lambda(lambda x: x.convert(
                        preprocessing_config['color_mode_info']['conversion_target']
                    ))
                )
            
            # Handle alpha channel if needed
            if preprocessing_config['handle_alpha_channel']:
                transform_list.append(
                    transforms.Lambda(lambda x: x.convert('RGB') if x.mode == 'RGBA' else x)
                )
            
            # Resize images if needed
            if preprocessing_config['resize']:
                size = preprocessing_config['suggested_resolution'] or 32
                transform_list.append(transforms.Resize((size, size)))
            else:
                transform_list.append(transforms.Resize((32, 32)))
            
            transform_list.append(transforms.ToTensor())
            
            if preprocessing_config['normalize']:
                transform_list.append(
                    transforms.Normalize(
                        (0.5,) if self.dataset['train'][0]['image'].mode == 'L' else (0.5, 0.5, 0.5),
                        (0.5,) if self.dataset['train'][0]['image'].mode == 'L' else (0.5, 0.5, 0.5)
                    )
                )
            
            self.transform = transforms.Compose(transform_list)
            print("DEBUG: Transform pipeline created", file=sys.stderr)
            
            # Transform all data at once
            processed_data = []
            for item in self.dataset['train']:
                image_tensor = self.transform(item['image'])
                label = torch.tensor(item['label'])
                processed_data.append((image_tensor, label))
            
            # Store processed data
            self.processed_dataset = processed_data
            print(f"DEBUG: Successfully processed {len(processed_data)} images", file=sys.stderr)
            
            # Get dimensions from first processed tensor
            sample_tensor = processed_data[0][0]
            in_channels = sample_tensor.shape[0]
            height = sample_tensor.shape[1]
            width = sample_tensor.shape[2]
            
            # Initialize models with correct dimensions
            self.models_dict = {
                "CNN": CNN(num_classes=num_classes, 
                          in_channels=in_channels, 
                          image_size=(height, width)),
                "ResNet": ResNet(in_channels=in_channels, 
                               num_classes=num_classes)
            }
            
        except Exception as e:
            print(f"DEBUG: Error in preprocessing: {str(e)}", file=sys.stderr)
            raise

    def compute_metrics(self, y_true, y_pred, y_prob=None):
        metrics = {
            "Accuracy": accuracy_score(y_true, y_pred),
            "Precision": precision_score(y_true, y_pred, average='macro'),
            "Recall": recall_score(y_true, y_pred, average='macro'),
            "F1": f1_score(y_true, y_pred, average='macro'),
        }
        
        # Only calculate AUC if probability scores are provided
        if y_prob is not None:
            try:
                metrics["AUC"] = roc_auc_score(y_true, y_prob, multi_class='ovr')
            except:
                metrics["AUC"] = 0.0  # Fallback value if AUC calculation fails
        else:
            metrics["AUC"] = 0.0
        
        return metrics

    def trainAutoML(self):
        print("DEBUG: Starting AutoML training", file=sys.stderr)
        self.preprocessing()
        print("Status: Setting up AutoML Training", file=sys.stderr)
        
        # Split the processed dataset
        total_size = len(self.processed_dataset)
        train_size = int(0.8 * total_size)
        val_size = total_size - train_size
        
        train_data, val_data = torch.utils.data.random_split(
            self.processed_dataset,
            [train_size, val_size],
            generator=torch.Generator().manual_seed(42)
        )
        
        train_loader = DataLoader(train_data, batch_size=32, shuffle=True)
        val_loader = DataLoader(val_data, batch_size=32, shuffle=False)
        
        results = []
        trained_models = {}
        
        pbar = tqdm(self.models_dict.items())
        for model_name, model in pbar:
            print(f"\nStarting training for {model_name}", file=sys.stderr)
            # print(f"Model architecture:\n{model}", file=sys.stderr))
            pbar.set_description(f"Status: Training Current Model: {model_name}")
            
            optimizer = optim.Adam(model.parameters(), lr=0.001)
            criterion = nn.CrossEntropyLoss()

            training_history = {
                'loss': [], 'accuracy': [],
                'val_loss': [], 'val_accuracy': []
            }
            
            for epoch in range(5):
                print(f"\nEpoch {epoch+1}", file=sys.stderr)
                model.train()
                running_loss = 0.0
                correct = 0
                total = 0
                batch_count = 0
                
                # Training loop
                for inputs, labels in train_loader:
                    batch_count += 1
                    if batch_count % 10 == 0:  # Log every 10 batches
                        print(f"Processing batch {batch_count}/{len(train_loader)}", file=sys.stderr)
                    
                    optimizer.zero_grad()
                    outputs = model(inputs)
                    loss = criterion(outputs, labels)
                    loss.backward()
                    optimizer.step()
                    
                    running_loss += loss.item()
                    _, predicted = torch.max(outputs.data, 1)
                    total += labels.size(0)
                    correct += (predicted == labels).sum().item()
                
                epoch_loss = running_loss / len(train_loader)
                epoch_acc = correct / total
                print(f"Training - Loss: {epoch_loss:.4f}, Accuracy: {epoch_acc:.4f}", file=sys.stderr)
                
                # Validation loop
                print("Starting validation...", file=sys.stderr)
                val_loss, val_acc = self.evaluate_model(model, val_loader, criterion)
                print(f"Validation - Loss: {val_loss:.4f}, Accuracy: {val_acc:.4f}", file=sys.stderr)
                
                # Store metrics
                training_history['loss'].append(epoch_loss)
                training_history['accuracy'].append(epoch_acc)
                training_history['val_loss'].append(val_loss)
                training_history['val_accuracy'].append(val_acc)

            self.training_histories[model_name] = training_history  # Add this line
            print(f"\nFinal evaluation for {model_name}", file=sys.stderr)
            
            # Evaluate the model
            model.eval()
            all_preds = []
            all_probs = []
            all_labels = []
            with torch.no_grad():
                for inputs, labels in val_loader:
                    outputs = model(inputs)
                    probs = torch.softmax(outputs, dim=1)
                    _, preds = torch.max(outputs, 1)
                    all_preds.extend(preds.cpu().numpy())
                    all_probs.extend(probs.cpu().numpy())
                    all_labels.extend(labels.cpu().numpy())

            metrics = self.compute_metrics(all_labels, all_preds, np.array(all_probs))
            print("Final metrics:", file=sys.stderr)
            for metric_name, value in metrics.items():
                print(f"{metric_name}: {value:.4f}", file=sys.stderr)
            
            results.append({
                'classifier': model_name,
                'Accuracy': round(metrics['Accuracy'], 4),
                'Precision': round(metrics['Precision'], 4),
                'Recall': round(metrics['Recall'], 4),
                'F1': round(metrics['F1'], 4),
                'AUC': round(metrics['AUC'], 4)
            })
            trained_models[model_name] = model

        self.trained_models = trained_models
        self.results = pd.DataFrame(results)
        print("\nAll models trained. Final results:", file=sys.stderr)
        print(self.results.to_string(), file=sys.stderr)
        best_model = self.getBestModel(self.metric_to_optimize)
        self.training_history = self.training_histories[self.best_model['classifier']]  # Add this line
        print(f"\nBest model: {best_model['classifier']} with {self.metric_to_optimize} = {best_model[self.metric_to_optimize]}", file=sys.stderr)

    def getBestModel(self, metric):
        if self.trainingMode.lower() != 'automl':
            return self.best_model
        
        self.results.sort_values(by=metric, ascending=False, inplace=True)
        self.best_model = self.results.iloc[0]
        self.best_estimator = self.trained_models[self.best_model['classifier']]
        return self.best_model

    def get_confusion_matrix(self):
        if self.best_estimator is None:
            raise ValueError("No model has been trained yet")
            
        # Split training data for validation
        _, val_dataset = train_test_split(self.dataset['train'], test_size=0.2, random_state=42)
        val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)
        
        all_preds = []
        all_labels = []
        self.best_estimator.eval()
        with torch.no_grad():
            for inputs, labels in val_loader:
                outputs = self.best_estimator(inputs)
                _, preds = torch.max(outputs, 1)
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
                
        cm = confusion_matrix(all_labels, all_preds)
        return cm.tolist()

    def trainCustom(self, model_type):
        print("DEBUG: Starting custom training", file=sys.stderr)
        self.preprocessing()
        
        if model_type not in self.models_dict:
            raise ValueError(f"Model {model_type} not found in available models. Available models: {list(self.models_dict.keys())}")

        print("Status: Setting up Custom Training", file=sys.stderr)
        
        # Split the processed dataset
        total_size = len(self.processed_dataset)
        train_size = int(0.8 * total_size)
        val_size = total_size - train_size
        
        train_dataset, val_dataset = torch.utils.data.random_split(
            self.processed_dataset,
            [train_size, val_size],
            generator=torch.Generator().manual_seed(42)
        )
        
        train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
        val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)

        results = []
        model = self.models_dict[model_type]
        if self.hyperparameters is not None:
            # Apply hyperparameters if provided
            for param, value in self.hyperparameters.items():
                setattr(model, param, value)

        optimizer = optim.Adam(model.parameters(), lr=0.001)
        criterion = nn.CrossEntropyLoss()

        print("Status: Started Training", file=sys.stderr)
        training_history = {
            'loss': [], 'accuracy': [],
            'val_loss': [], 'val_accuracy': []
        }
        for epoch in range(5):  # Number of epochs
            model.train()
            running_loss = 0.0
            correct = 0
            total = 0
            for inputs, labels in tqdm(train_loader):
                optimizer.zero_grad()
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                loss.backward()
                optimizer.step()
                running_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
            epoch_loss = running_loss / len(train_loader)
            epoch_acc = correct / total
            # Validation
            val_loss, val_acc = self.evaluate_model(model, val_loader, criterion)
            training_history['loss'].append(epoch_loss)
            training_history['accuracy'].append(epoch_acc)
            training_history['val_loss'].append(val_loss)
            training_history['val_accuracy'].append(val_acc)
            print(f"Epoch {epoch+1}, Loss: {epoch_loss}")

        # Save training history for custom model
        self.training_histories[model_type] = training_history

        # Evaluate the model
        model.eval()
        all_preds = []
        all_probs = []
        all_labels = []
        with torch.no_grad():
            for inputs, labels in val_loader:
                outputs = model(inputs)
                probs = torch.softmax(outputs, dim=1)
                _, preds = torch.max(outputs, 1)
                all_preds.extend(preds.cpu().numpy())
                all_probs.extend(probs.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())

        metrics = self.compute_metrics(all_labels, all_preds, np.array(all_probs))
        results.append({
            'classifier': model_type,
            'Accuracy': round(metrics['Accuracy'], 4),
            'Precision': round(metrics['Precision'], 4),
            'Recall': round(metrics['Recall'], 4),
            'F1': round(metrics['F1'], 4),
            'AUC': round(metrics['AUC'], 4)
        })

        self.results = pd.DataFrame(results)
        self.best_model = model_type
        self.best_estimator = model
        
        print("Status: Training Completed", file=sys.stderr)

    def saveModel(self, model_name, save_path):
        
        if self.trainingMode.lower() != 'automl':
            joblib.dump(self.best_estimator, save_path)
            self.save_path = save_path
            return
        
        # Convert pandas Series to string if needed
        if isinstance(model_name, pd.Series):
            model_name = model_name['classifier']  # Assuming 'classifier' is the column name
                
        if model_name not in self.trained_models:
            raise ValueError(f"Model {model_name} not found in trained models")
        
        joblib.dump(self.trained_models[model_name], save_path)
        self.save_path = save_path

    def get_class_distribution(self):
        """Returns the distribution of classes in the dataset"""
        if self.dataset is None:
            raise ValueError("No dataset has been loaded")
        
        try:
            if isinstance(self.dataset['train'], list):
                # For processed dataset (list of tuples)
                labels = [label.item() for _, label in self.dataset['train']]
            else:
                # For original HuggingFace dataset
                labels = [item['label'] for item in self.dataset['train']]
            
            unique_labels, counts = np.unique(labels, return_counts=True)
            return {
                'labels': unique_labels.tolist(),
                'counts': counts.tolist()
            }
        except Exception as e:
            raise ValueError(f"Error computing class distribution: {str(e)}")

    # def get_sample_predictions(self):
    #     try:
    #         if self.best_estimator is None:
    #             raise ValueError("No model has been trained yet")

    #         # Use the processed dataset that we created during preprocessing
    #         num_samples = min(5, len(self.processed_dataset))
            
    #         # Create a small validation dataset
    #         val_indices = torch.randperm(len(self.processed_dataset))[:num_samples]
    #         sample_data = [self.processed_dataset[i] for i in val_indices]
            
    #         # Create a DataLoader for the samples
    #         sample_loader = DataLoader(sample_data, batch_size=num_samples, shuffle=False)
            
    #         # Get predictions
    #         self.best_estimator.eval()
    #         all_preds = []
    #         all_probs = []
    #         all_labels = []
    #         original_images = []
            
    #         with torch.no_grad():
    #             for inputs, labels in sample_loader:
    #                 outputs = self.best_estimator(inputs)
    #                 probs = torch.softmax(outputs, dim=1)
    #                 _, preds = torch.max(outputs, 1)
                    
    #                 # Convert tensors to numpy for serialization
    #                 all_preds.extend(preds.cpu().numpy())
    #                 all_probs.extend(probs.cpu().numpy())
    #                 all_labels.extend(labels.cpu().numpy())
                    
    #                 # Convert image tensors to list for serialization
    #                 for img in inputs:
    #                     # Normalize image data to 0-255 range
    #                     img_np = img.cpu().numpy()
    #                     img_np = ((img_np - img_np.min()) * 255 / (img_np.max() - img_np.min())).astype(np.uint8)
    #                     original_images.append(img_np.tolist())

    #         # Prepare the results
    #         sample_predictions = []
    #         for i in range(num_samples):
    #             sample_predictions.append({
    #                 'image': original_images[i],
    #                 'true_label': int(all_labels[i]),
    #                 'predicted_label': int(all_preds[i]),
    #                 'confidence': float(max(all_probs[i]))
    #             })

    #         return sample_predictions

        # except Exception as e:
        #     print(f"DEBUG: Error in get_sample_predictions: {str(e)}", file=sys.stderr)
        #     raise ValueError(f"Error getting sample predictions: {str(e)}")
    
    def get_sample_predictions(self, num_samples=5):
        """Returns sample images with their predictions and true labels"""
        if self.best_estimator is None:
            raise ValueError("No model has been trained yet")
        self.best_estimator.eval()

        # Prepare validation set
        if isinstance(self.dataset['train'], list):
            # Already processed dataset
            total_data = self.dataset['train']
        else:
            # HuggingFace dataset
            total_data = [ (item['image'], item['label']) for item in self.dataset['train'] ]

        val_size = int(0.2 * len(total_data))
        val_indices = np.random.choice(len(total_data), val_size, replace=False)
        val_dataset = [total_data[i] for i in val_indices]

        max_samples = min(num_samples, len(val_dataset))
        sample_indices = np.random.choice(len(val_dataset), max_samples, replace=False)
        samples = []

        with torch.no_grad():
            for idx in sample_indices:
                image, true_label = val_dataset[idx]
                if not torch.is_tensor(image):
                    image = self.transform(image)
                if len(image.shape) == 3:
                    image = image.unsqueeze(0)
                output = self.best_estimator(image)
                _, predicted = torch.max(output, 1)
                image_np = image.squeeze(0).permute(1, 2, 0).numpy()
                samples.append({
                    'image': image_np.tolist(),
                    'true_label': int(true_label if not torch.is_tensor(true_label) else true_label.item()),
                    'predicted_label': int(predicted.item())
                })
        return samples

    def get_training_history(self):
        """Returns the training history (loss and accuracy over epochs) for the best model"""
        if hasattr(self, 'best_model') and hasattr(self, 'training_histories'):
            # Correctly extract model name whether best_model is a dict, Series, or string
            if isinstance(self.best_model, (dict, pd.Series)):
                model_name = self.best_model['classifier']
            else:
                model_name = self.best_model
            print(f"DEBUG: Training history for {model_name}: {self.training_histories}")
            history = self.training_histories.get(model_name)
            if history:
                return {
                    'loss': history['loss'],
                    'accuracy': history['accuracy'],
                    'val_loss': history['val_loss'],
                    'val_accuracy': history['val_accuracy']
                }
        # Fallback if not available
        return {
            'loss': [],
            'accuracy': [],
            'val_loss': [],
            'val_accuracy': []
        }

    def evaluate_model(self, model, loader, criterion):
        """Helper method to evaluate model during training"""
        if not model or not loader or not criterion:
            raise ValueError("Model, loader, and criterion must be provided")
        
        try:
            model.eval()
            running_loss = 0.0
            correct = 0
            total = 0
            
            with torch.no_grad():
                for inputs, labels in loader:
                    if torch.cuda.is_available():
                        inputs = inputs.cuda()
                        labels = labels.cuda()
                        
                    outputs = model(inputs)
                    loss = criterion(outputs, labels)
                    running_loss += loss.item()
                    
                    _, predicted = torch.max(outputs.data, 1)
                    total += labels.size(0)
                    correct += (predicted == labels).sum().item()
            
            if total == 0:
                raise ValueError("No samples in the loader")
            
            return running_loss / len(loader), correct / total
        except Exception as e:
            raise ValueError(f"Error during model evaluation: {str(e)}")

    def get_input_schema(self):
        """Returns the schema of input data expected by the model"""
        return {
            'type': 'image',
            'format': 'RGB',
            'dimensions': {
                'height': 32,
                'width': 32,
                'channels': 3
            },
            'preprocessing': {
                'resize': [32, 32],
                'normalize': {
                    'mean': [0.5, 0.5, 0.5],
                    'std': [0.5, 0.5, 0.5]
                }
            }
        }

    def get_output_schema(self):
        """Returns the schema of model outputs"""
        try:
            # Get number of classes from the dataset
            if isinstance(self.dataset['train'], list):
                # For processed dataset (list of tuples)
                unique_labels = set(label.item() for _, label in self.dataset['train'])
            else:
                # For original HuggingFace dataset
                unique_labels = set(item['label'] for item in self.dataset['train'])
            
            return {
                'type': 'classification',
                'num_classes': len(unique_labels),
                'output_type': 'probabilities',
                'label_range': [min(unique_labels), max(unique_labels)]
            }
        except Exception as e:
            raise ValueError(f"Error getting output schema: {str(e)}")

    def get_output_mapping(self):
        """Returns mapping of model output indices to class labels"""
        # Create mapping of indices to unique labels
        if isinstance(self.dataset['train'], list):
            # For processed dataset (list of tuples)
            unique_labels = sorted(set(label.item() for _, label in self.dataset['train']))
        else:
            # For original HuggingFace dataset
            unique_labels = sorted(set(item['label'] for item in self.dataset['train']))
        
        return {str(idx): str(label) for idx, label in enumerate(unique_labels)}

    def get_params(self):
        """Returns the parameters of the best model"""
        if self.best_estimator is None:
            raise ValueError("No model has been trained yet")
        
        # Get model architecture details
        model_params = {
            # 'architecture': self.best_model['classifier'],
            'input_shape': [3, 32, 32],
            'optimizer': 'Adam',
            'learning_rate': 0.001,
            'batch_size': 32,
            'epochs': 5,
            'loss_function': 'CrossEntropyLoss'
        }
        
        return model_params