from flask import Blueprint, request, send_file
import nanoid
import os
import sys
import datetime
sys.path.append(os.getenv('PROJECT_PATH', ''))

storeDataset = Blueprint('storeDataset', __name__)
from mongoDB import db
from auth_helper import get_user_from_request

@storeDataset.route('/storeDataset', methods=['GET', 'POST'])
def storeDatasetFile():

    dataset_file = request.files['file']
    dataset_name = request.form['filename'] 
    dataset_size = request.form['filesize']
    dataset_type = os.path.splitext(dataset_name)[-1].lower()
    
    dataset_id = nanoid.generate(alphabet='0123456789', size=5)
    
    # Checking the dataset type 
    if dataset_type == ".csv":
        dataset_type = "text"
        dataset_path = os.getenv('PROJECT_PATH', '') + 'Datasets/' + dataset_id + '.csv'
    elif dataset_type == ".zip":
        dataset_type = "image"
        dataset_path = os.getenv('PROJECT_PATH', '') + 'Datasets/' + dataset_id + '.zip'


    # print(dataset_path)
    dataset_file.save(dataset_path)

    collection = db['Datasets']
    username = get_user_from_request()

    collection.insert_one({
        'time' : datetime.datetime.now(),
        'dataset_id': dataset_id,
        'dataset_size' : dataset_size,
        'dataset_name': dataset_name,
        'dataset_path': dataset_path,
        'dataset_type': dataset_type,
        'username': username
    })

    return {'status': 'success', 'dataset_id': dataset_id, 'dataset_name': dataset_name}