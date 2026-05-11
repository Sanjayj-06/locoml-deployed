from flask import Flask, Blueprint, current_app, request, jsonify
from flask_sse import sse
import sys
import os
from dotenv import load_dotenv, find_dotenv

# Load environment variables first
load_dotenv(find_dotenv())
project_path = os.getenv("PROJECT_PATH")

# print(f"[DEBUG] project_path: {project_path}")

# Add paths only once at the start
if project_path:
    # Add path to functions directory
    functions_path = os.path.join(project_path, 'functions')
    if functions_path not in sys.path:
        sys.path.append(functions_path)
    
    # Add project path
    if project_path not in sys.path:
        sys.path.append(project_path)

# Now import the required classes
from ImageClassificationUtility import ImageClassificationUtility, CNN, ResNet

# Rest of the imports
import time
import subprocess
import pickle
import json
import itertools
from tqdm import tqdm
import requests
import torch
import bson.json_util as json_util
from transformers import pipeline, AutoModelForSequenceClassification, DistilBertTokenizerFast
from datasets import Dataset
from flask_cors import CORS
import joblib
import pandas as pd
from transformers import pipeline
from torchvision import transforms
import base64
import io
import numpy as np
from PIL import Image
from mongoDB import db

app = Flask(__name__)
CORS(app)

trainModelAPIs = Blueprint('trainModel', __name__)


@app.route('/health', methods=["GET"])
def health():
    return "OK"


# def matchInputSchema(user_input, model_input_schema):
#     # Check if columns match
#     if len(user_input.columns) != len(model_input_schema):
#         return False
#
#     schema_columns = []
#     # Chceck if all columns from model_input_schema are in user_input and of the same type
#     for column in model_input_schema:
#         if column["column_name"] not in user_input.columns:
#             return False
#         if column["column_type"] not in user_input[column["column_name"]].dtype.name:
#             return False
#
#         schema_columns.append(column["column_name"])
#
#     # check for any extra columns in user_input
#     for column in user_input.columns:
#         if column not in schema_columns:
#             return False
#
#     return True

@app.route('/inference/huggingface/batch', methods=['POST'])
def inference_huggingface_batch():
    print("Hit inference_huggingface_batch")
    dataset = request.json['dataset']
    # print(dataset)
    model_name = request.json['model_name']
    task_name = request.json['task_name']
    candidate_labels = request.json['candidate_labels']  # for zero-shot-classification   

    try:
        if model_name != "None":
            pipeline_task = pipeline(task=task_name, model=model_name)
        else:
            pipeline_task = pipeline(task=task_name)
    except Exception as e:
        print(e)
        return jsonify({'message': 'Model not found'}), 404
    
    try:  
        user_input = pd.DataFrame(dataset)
        user_input.columns = user_input.iloc[0]
        user_input = user_input.drop(user_input.index[0])
        input_texts = user_input['text'].tolist()
        input = []
        for index, row in user_input.iterrows():
            input.append(row['text'])
        
        print("Input: ", input)
        if task_name == "zero-shot-classification":
            candidate_labels = [label.strip() for label in candidate_labels.split(",")]
            result = pipeline_task(input, candidate_labels=candidate_labels)
        else:
            result = pipeline_task(input)

        print(result)
        
        output_data = []
        for index, res in enumerate(result):
            result_dict = {
                'text': input_texts[index]
            }
            result_dict.update(res)  # Merge the result into the dictionary
            output_data.append(result_dict)

        # Convert output data to DataFrame
        output_df = pd.DataFrame(output_data)
        # output_df = output_df.drop(output_df.index[0])
        print(output_df)

    except Exception as e:
        print(e)
        return jsonify({'message': 'Inference Failed'}), 404
    
    df = [output_df.columns.tolist()]
    df.extend(output_df.values.tolist())
    
    return jsonify(df), 200
            

@app.route('/inference/batch', methods=['POST'])
def inference_batch():
    # print("hit")

    dataset = request.json['dataset']
    model_id = request.json['model_id']
    preprocessing_tasks = request.json['preprocessing_tasks']
    collection = db['Model_zoo']
    model_info = collection.find_one({'model_id': model_id})
    objective = model_info['objective']

    # Load the pickled model from the file
    try:
        model_path = model_info['saved_model_path']
        model_data = joblib.load(model_path)
    except FileNotFoundError:
        print("not found")
        return jsonify({'message': 'Model not found'}), 404
    if isinstance(model_data, dict):
            model = model_data['model']
    else:
            model = model_data  # Fallback for older saved models

    
    if objective.lower() == "imageclassification":
        model.eval()
        results = []
        
        # Skip the header row and process the data
        input_data = dataset[1:]  # Skip header
        
        # Prepare data batches
        batch_size = 32
        for i in range(0, len(input_data), batch_size):
            batch = input_data[i:i + batch_size]
            images = []
            labels = []
            
            # Process each image in the batch
            for item in batch:
                # Decode base64 image
                try:
                    img_data = base64.b64decode(item[0])
                    img = Image.open(io.BytesIO(img_data))
                    # Use the preprocessing tasks to transform the image
                    processed_img = preprocess_image(img, preprocessing_tasks)
                    images.append(processed_img)
                    labels.append(item[1])
                except Exception as e:
                    print(f"Error processing image: {str(e)}", file=sys.stderr)
                    continue
            
            if not images:  # Skip if no valid images in batch
                continue
                
            # Stack processed images and convert labels
            inputs = torch.stack(images)
            labels = torch.tensor(labels)
            
            with torch.no_grad():
                outputs = model(inputs)
                probs = torch.softmax(outputs, dim=1)
                _, preds = torch.max(outputs, 1)
        
            # Store results
            for img, pred, prob, label in zip(images, preds.cpu().numpy(), probs.cpu().numpy(), labels.cpu().numpy()):
                # Convert tensor back to PIL Image for display
                img_pil = transforms.ToPILImage()(img)
                buffered = io.BytesIO()
                img_pil.save(buffered, format="PNG")
                img_str = base64.b64encode(buffered.getvalue()).decode()

                results.append({
                    "image": img_str,
                    "predicted_label": int(pred),
                    "confidence": float(prob[pred]),  # Add confidence score
                    "actual_label": int(label)
                })

        return jsonify({"results": results, "objective": objective}), 200
        
    # convert dataset in json to dataframe
    user_input = pd.DataFrame(dataset)
    user_input.columns = user_input.iloc[0]
    user_input = user_input.drop(user_input.index[0])

    # print("HERE WE ARE", user_input.head(20))

    # if not matchInputSchema(user_input, model_info['input_schema']):
    #     return jsonify({'message': 'Invalid file format'}), 400

    # print(model)
    if objective == "sentiment":
        tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")

        BATCH_SIZE = 8
        # context = ["Amazing movie.", "Garbage movie.", "Absolutely the worst movie I've ever seen.", "Why is this a movie?", "One of the other reviewers has mentioned that after watching just 1 Oz episode you'll be hooked. They are right, as this is exactly what happened with me.<br /><br />The first thing that struck me about Oz was its brutality and unflinching scenes of violence, which set in right from the word GO. Trust me, this is not a show for the faint hearted or timid. This show pulls no punches with regards to drugs, sex or violence. Its is hardcore, in the classic use of the word.<br /><br />It is called OZ as that is the nickname given to the Oswald Maximum Security State Penitentary. It focuses mainly on Emerald City, an experimental section of the prison where all the cells have glass fronts and face inwards, so privacy is not high on the agenda. Em City is home to many..Aryans, Muslims, gangstas, Latinos, Christians, Italians, Irish and more....so scuffles, death stares, dodgy dealings and shady agreements are never far away.<br /><br />I would say the main appeal of the show is due to the fact that it goes where other shows wouldn't dare. Forget pretty pictures painted for mainstream audiences, forget charm, forget romance...OZ doesn't mess around. The first episode I ever saw struck me as so nasty it was surreal, I couldn't say I was ready for it, but as I watched more, I developed a taste for Oz, and got accustomed to the high levels of graphic violence. Not just violence, but injustice (crooked guards who'll be sold out for a nickel, inmates who'll kill on order and get away with it, well mannered, middle class inmates being turned into prison bitches due to their lack of street skills or prison experience) Watching Oz, you may become comfortable with what is uncomfortable viewing....thats if you can get in touch with your darker side.", "Basically there's a family where a little boy (Jake) thinks there's a zombie in his closet & his parents are fighting all the time.<br /><br />This movie is slower than a soap opera... and suddenly, Jake decides to become Rambo and kill the zombie.<br /><br />OK, first of all when you're going to make a film you must Decide if its a thriller or a drama! As a drama the movie is watchable. Parents are divorcing & arguing like in real life. And then we have Jake with his closet which totally ruins all the film! I expected to see a BOOGEYMAN similar movie, and instead i watched a drama with some meaningless thriller spots.<br /><br />3 out of 10 just for the well playing parents & descent dialogs. As for the shots with Jake: just ignore them."]
        context = user_input[
            "review"].to_list()  # TODO: REMOVE THIS "REVIEW" HARDCODING IF POSSIBLE. DO THE SAME IN MODEL TRAINING ALSO
        model_max_length = 512
        new_prediction = []
        # device = 'cuda' if torch.cuda.is_available() else 'cpu'
        device = 'cpu'
        model.to(device)

        inputs = tokenizer(context, return_tensors="pt", padding=True, truncation=True,
                           max_length=model_max_length).to(device)

        # trying to move it to the device (could be GPU or CPU) so that inference can be done
        inputs = {key: tensor.to(device) for key, tensor in inputs.items()}

        with torch.no_grad():
            for i in range(0, len(context), BATCH_SIZE):
                batch_inputs = {key: tensor[i:i + BATCH_SIZE] for key, tensor in inputs.items()}
                logits = model(**batch_inputs).logits
                predicted_class_ids = torch.argmax(logits, dim=1).tolist()
                for class_id in predicted_class_ids:
                    predicted_label = model.config.id2label[class_id]
                    new_prediction.append(predicted_label)

        # print("Predicted labels:", predictions)
    else:
        new_prediction = model.predict(user_input)

    user_input['prediction'] = new_prediction

    # print(user_input.head(20))

    df = [user_input.columns.tolist()]

    df.extend(user_input.values.tolist())

    # print(df[0])
    # print(df[1])
    JSONP_data = jsonify(df)
    return JSONP_data, 200


def create_transform_pipeline(preprocessing_tasks):
    """Create a torchvision transforms pipeline based on preprocessing tasks"""
    transform_list = []
    is_grayscale = False
    
    # Handle Color Space Conversion first
    if 'Color Space Conversion' in preprocessing_tasks:
        params = preprocessing_tasks['Color Space Conversion']
        if params.get('colorSpace') == 'GRAY':
            transform_list.append(transforms.Grayscale(num_output_channels=1))
            is_grayscale = True
        elif params.get('colorSpace') == 'RGB':
            # transform_list.append(transforms.Lambda(lambda img: img.convert('RGB')))
            transform_list.append(transforms.Grayscale(num_output_channels=1))
            is_grayscale = True
    
    # Handle Resize Image
    if 'Resize Image' in preprocessing_tasks:
        params = preprocessing_tasks['Resize Image']
        width = params.get('width', 32)
        height = params.get('height', 32)
        transform_list.append(transforms.Resize((height, width)))
    
    # Handle Data Augmentation
    if 'Data Augmentation' in preprocessing_tasks:
        transform_list.extend([
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(10)
        ])

    # Add ToTensor
    transform_list.append(transforms.ToTensor())
    
    # Handle Image Normalization with appropriate channels
    if 'Image Normalization' in preprocessing_tasks:
        if is_grayscale:
            transform_list.append(
                transforms.Normalize(mean=[0.5], std=[0.5])  # Grayscale normalization
            )
        else:
            transform_list.append(
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],  # RGB normalization
                    std=[0.229, 0.224, 0.225]
                )
            )
    
    return transforms.Compose(transform_list)

def preprocess_image(img, preprocessing_tasks):
    """Preprocess image using the specified preprocessing tasks"""
    transform = create_transform_pipeline(preprocessing_tasks)
    return transform(img)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5004, debug=True)
