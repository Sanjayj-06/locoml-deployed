from flask import Flask, Blueprint, jsonify, request
import os
import joblib
import sys
import pandas as pd
import shutil
import subprocess
from docker import from_env
sys.path.append(os.getenv('PROJECT_PATH'))

from mongoDB import db
collection = db['Model_zoo']

cli = from_env()

deployModel = Blueprint('deployModel', __name__)
deployed_model_id = None
deployed_model = None

@deployModel.route('/deploy', methods=['POST'])
def test():
    # Get Model ID
    data = request.get_json()
    version_number = data['version_number']
    original_ID = data['model_id']

    collection = db['Model_zoo']
    model = collection.find_one({"model_id": original_ID})

    model_id = model['versions'][int(version_number) - 1]['model_id']
    print(model_id)

    src = "./Models/" + model_id + ".pkl"
    dst = "./app2/Model/"

    print(src)

    # Check if model exists
    if not os.path.exists(src):
        return jsonify(message="Model not found"), 404
    else:
        shutil.copy2(src, dst)

    # Build Docker image
    image, build_log = cli.images.build(path="./", tag="app2")
    print("Image built")

    # Run Docker container
    container = cli.containers.run("deployment_app", detach=True, ports={'5000/tcp': 8080})
    print("Container running")

    return jsonify(message="Model Deployed"), 200
