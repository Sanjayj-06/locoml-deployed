from flask import Flask, request, jsonify, Blueprint, send_file
from flask_cors import CORS
import subprocess
import os
import json
from huggingface_hub import HfApi
from datasets import load_dataset
import pandas as pd
import io  
import shutil  # Add this import at the top with other imports
from huggingface_hub import login
from dotenv import load_dotenv

login(os.getenv("HUGGINGFACE_TOKEN"))

searchDatasets = Blueprint('searchDatasets', __name__)

KAGGLE_DOWNLOAD_PATH = "kaggle_datasets/"
HUGGINGFACE_DOWNLOAD_PATH = "huggingface_datasets/"

def search_kaggle(query):
    try:
        print(f"🔍 Searching for '{query}' on Kaggle...")

        # Load environment variables from .env file
        load_dotenv()

        KAGGLE_USERNAME = os.getenv("KAGGLE_USERNAME")
        KAGGLE_KEY = os.getenv("KAGGLE_KEY")

        if not KAGGLE_USERNAME or not KAGGLE_KEY:
            print("Kaggle API credentials not found in environment variables")
            return jsonify({
                "error": "Kaggle API credentials not found",
                "message": "Ensure that KAGGLE_USERNAME and KAGGLE_KEY are set in the .env file"
            })

        # Set up Kaggle API credentials dynamically
        kaggle_config_path = "/root/.kaggle"
        kaggle_json_path = os.path.join(kaggle_config_path, "kaggle.json")

        os.makedirs(kaggle_config_path, exist_ok=True)

        # Write credentials to kaggle.json if not exists
        if not os.path.exists(kaggle_json_path):
            with open(kaggle_json_path, "w") as f:
                json.dump({"username": KAGGLE_USERNAME, "key": KAGGLE_KEY}, f)
            
            # Set proper file permissions
            os.chmod(kaggle_json_path, 0o600)

        # Run Kaggle search command
        result = subprocess.run(
            ["kaggle", "datasets", "list", "-s", query, "--csv"],
            capture_output=True,
            text=True,
            check=True
        )

        # Debug output
        print("Command output:", result.stdout)
        print("Command error:", result.stderr)

        if not result.stdout.strip():
            return jsonify({"query": query, "datasets": [], "message": "No datasets found"})

        try:
            df = pd.read_csv(io.StringIO(result.stdout))

            if df.empty:
                return jsonify({"query": query, "datasets": [], "message": "No datasets found"})

            df = df.sort_values(by=["downloadCount", "voteCount", "usabilityRating"], ascending=[False, False, False])
            top_datasets = df.head(10)
            datasets = top_datasets.to_dict(orient="records")

            return jsonify({"query": query, "datasets": datasets})

        except pd.errors.EmptyDataError:
            return jsonify({"query": query, "datasets": [], "message": "No datasets found"})

    except subprocess.CalledProcessError as e:
        print(f"Kaggle command failed with exit status {e.returncode}")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        return jsonify({
            "error": "Failed to execute Kaggle search command",
            "message": "Please ensure Kaggle API is properly configured",
            "details": str(e)
        })
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return jsonify({"error": str(e)})

def search_huggingface(query):
    try:
        print(f"🔍 Searching for '{query}' on Hugging Face Hub...")
        api = HfApi()

        datasets = api.list_datasets(search=query, full=True)  # Get all matching datasets

        dataset_list = []
        for dataset in datasets:
            download_size = 0
            if dataset.card_data:
                if isinstance(dataset.card_data, dict):
                    dataset_info = dataset.card_data.get('dataset_info', {})
                    if dataset_info:
                        download_size = dataset_info.get('download_size', 0)
                elif isinstance(dataset.card_data, list):
                    # Handle the case where card_data is a list
                    for card in dataset.card_data:
                        if isinstance(card, dict) and 'dataset_info' in card:
                            dataset_info = card['dataset_info']
                            download_size = dataset_info.get('download_size', 0)
                            break
            dataset_info = {
                "ref": dataset.id,
                "title": dataset.card_data[0].get("pretty_name", dataset.id.split("/")[-1]) if isinstance(dataset.card_data, list) and dataset.card_data else dataset.id.split("/")[-1],
                "downloadCount": dataset.downloads if hasattr(dataset, "downloads") else 0,
                "voteCount": dataset.likes if hasattr(dataset, "likes") else 0,
                "size": f"{download_size / 1048576:.2f} MB" if download_size else "N/A",
            }
            dataset_list.append(dataset_info)

        # Sort datasets by download count and likes
        dataset_list.sort(key=lambda x: (x['downloadCount'], x['voteCount']), reverse=True)

        # Get top 10 datasets
        top_datasets = dataset_list[:10]

        print(f"\nTop {len(top_datasets)} Datasets:")
        print("--------------------------------")
        for i, dataset in enumerate(top_datasets, 1):
            print(f"{i}. {dataset['title']}")
            print(f"     ID: {dataset['ref']}")
            print(f"     Size: {dataset['size']}")
            print(f"     Downloads: {dataset['downloadCount']}")
            print(f"     Likes: {dataset['voteCount']}")
            print("--------------------------------")

        return jsonify({"query": query, "datasets": top_datasets})

    except Exception as e:
        print(f"Error searching Hugging Face: {e}")
        return jsonify({"error": str(e)})

@searchDatasets.route("/search", methods=["GET"])
def search():
    query = request.args.get("query", "")
    source = request.args.get("source", "kaggle")  # Either 'kaggle' or 'huggingface'

    if source == "kaggle":
        return search_kaggle(query)
    elif source == "huggingface":
        return search_huggingface(query)
    return jsonify({"error": "Invalid source"})

@searchDatasets.route("/download", methods=["POST"])
def download():
    data = request.json
    dataset_name = data.get("dataset_name")
    source = data.get("source")
    
    # Extract the last part of the dataset name after the final "/"
    file_name = dataset_name.split('/')[-1]

    try:
        if source == "kaggle":
            temp_dir = os.path.join(KAGGLE_DOWNLOAD_PATH, "temp")
            os.makedirs(temp_dir, exist_ok=True)
            
            subprocess.run([
                "kaggle", "datasets", "download", "-d", dataset_name, "-p", temp_dir
            ], check=True)
            
            zip_file = None
            for file in os.listdir(temp_dir):
                if file.endswith('.zip'):
                    zip_file = os.path.join(temp_dir, file)
                    break
            
            if zip_file:
                return send_file(
                    zip_file,
                    as_attachment=True,
                    download_name=f"{file_name}.zip"
                )
            else:
                return jsonify({"error": "No zip file found after download"})

        elif source == "huggingface":
            temp_dir = os.path.join(HUGGINGFACE_DOWNLOAD_PATH, "temp")
            os.makedirs(temp_dir, exist_ok=True)
            
            dataset = load_dataset(dataset_name)
            dataset_dir = os.path.join(temp_dir, file_name)
            dataset.save_to_disk(dataset_dir)
            
            zip_path = os.path.join(temp_dir, f"{file_name}.zip")
            shutil.make_archive(zip_path[:-4], 'zip', dataset_dir)
            
            shutil.rmtree(dataset_dir)
            
            return send_file(
                zip_path,
                as_attachment=True,
                download_name=f"{file_name}.zip"
            )

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        try:
            shutil.rmtree(temp_dir)
        except:
            pass

    return jsonify({"error": "Invalid source"})