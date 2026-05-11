# LoCodeML

Project Guide:

- **Dr. Karthik Vaidhyanathan**

Link to demo video: https://drive.google.com/drive/folders/1TcIyn4QQDKZfMlI27sqQu95duF-Dwxjc?usp=sharing

---

---

# Deployment Instructions

---

## Pre-requisites:

1. Python (python3.11 is preferred, but any python3.x version is fine.)
2. virtualenv (to create a virtual environment for Python).
3. npm (Node Package Manager)
4. mongodb (ensure that this service is running on your system)

---

## Backend

1. Navigate to `/backend/`.
2. Create a `.env` file with the following format:
    ```
    MONGO_URI=<mongo_uri_here>
    PROJECT_PATH="/app/"
    REDIS_URL="redis://localhost:6379"
    HUGGINGFACE_TOKEN=
    KAGGLE_USERNAME=
    KAGGLE_KEY=
    ```

    > [!NOTE]
    > Huggingface token requires "read" permissions for repositories and collections, and permission to make calls to
    > inference providers and endpoints.
    > Kaggle API can be downloaded as `kaggle.json`, and the username and key can be copied over to the .env of the backend folder.

3. Simply build and run the main app and all the microservices using `docker compose up --build`. This command can be
   executed whenever you want to use this application, as it will automatically update and run your backend server
   whenever any changes are made.

---

## Frontend

### Note: You are recommended to start the frontend AFTER starting the backend, since the frontend depends on the backend for all of its views!

1. Navigate to `/frontend/`.
2. Run `npm i` to install all the node packages.
3. Now, run `npm start` to start up the frontend.

---

---

## Backend API Documentation

### `APIs` Folder

All the APIs are present in the `APIs` folder.
Description of all files & APIs in it:

- ##### `deployModel.py`

  consists of a single endpoint which is used to deploy a model on docker. The dockerfile is present in the backend
  folder.

    - `/deployModel`

      `POST` method

      Takes in the model id and version number as input and deploys the model on docker by first building the image and
      then running the container. The docker container is exposed on `port 8080`. Internally, another flask server (
      app2) is running on the docker container which is exposed on `port 5000`. The flask server on the docker container
      is used to make predictions on the deployed model.

      The request body for this API endpoint would be a JSON object. Here's the structure:
        ```
        {
          "model_id": "string or integer",
          "version": "string or integer"
        }
        ```
      It returns a JSON object which contains the status of the deployment.

      Return Object:
        ```
        {
            'status': 'success' or 'failure'
        }
        ```

- ##### `eda.py`

  Consists of endpoint which performs exploratory data analysis on the dataset.

    - `/eda/<dataset_id>`

      `GET` method

      Takes in the dataset ID as a parameter in the URL and performs EDA on the corresponding dataset. The EDA includes
      operations like computing the mean, median, standard deviation, minimum and maximum values for numerical columns,
      and the number of unique values and missing values for all columns. The results of the EDA are returned in the
      response body.

      The response body for this API endpoint is a JSON object. Here's the structure:

        ```
        {
            'message': 'string',
            'data': 'list of dictionaries representing rows of the dataset',
            'columns': 'list of column names',
            'column_details': 'dictionary with details for each column'
        }
        ```

      The column_details dictionary for each column includes the column index, column type (numerical or categorical),
      and various statistics depending on the column type. For numerical columns, it includes the mean, standard
      deviation, median, minimum and maximum values, number of missing values, and range. For categorical columns, it
      includes the number of unique values and number of missing values.

      Example Return Object:

        ```
        {
            'message': 'EDA completed successfully',
            'data': [{'column1': 'value1', 'column2': 'value2', ...}, ...],
            'columns': ['column1', 'column2', ...],
            'column_details': {
                'column1': {
                    'index': 0,
                    'column_type': 'numerical',
                    'mean': 50.0,
                    'std_dev': 10.0,
                    'median': 50.0,
                    'min': 0,
                    'max': 100,
                    'num_missing_values': 0,
                    'range': 100
                },
                'column2': {
                    'index': 1,
                    'column_type': 'categorical',
                    'num_unique_values': 5,
                    'num_missing_values': 0
                },
                ...
            }
        }
        ```

- ##### `getDatasets.py`

  Consists of dataset related queries on the database
    - `/getDatasets`

      `GET` method

      Returns information of all datasets present in the database as a list. Each list is an object whose structure was
      given earlier.

      Return object:
        ```
            {
                'dataset_list' : dataset_list
            }
        ```
      `dataset_list` is a list of objects of type dataset.

    - `/getDatasetInfo/<dataset_id>`

      `GET` method

      Returns information about the dataset having id as `dataset_id`.

      Return Object:
        ```
            dataset
        ```
      It directly returns an object of the type dataset which corresponds to the details of the dataset with dataset id
      `dataset_id`.

    - `/getDatasets/<dataset_id>`

      `GET` method

      Returns the dataset file corressponding to dataset id `dataset_id`.

    - `/getDatasets/columns/<model_name>`

      `GET` method

      Returns the column names of the dataset on which the model corresponding to `model_name` was trained.

      Return Object:
        ```
            {
                'target_column': target_column_name, 
                'non_target_columns': other_column_names_list
            }
        ```
- ##### `getTrainedModels.py`

  Consists of queries related to fetching information about already trained models in the database.
    - `/getTrainedModels`
    -
    `GET` method

    Returns information of all models present in the database as a list. Each list is an object whose structure is of
    type Model.

    Return object:
      ```
          {
              'trained_models': trained_model_list
          }
      ```
    `trained_model_list` is a list of objects of type Model.

    - `/getTrainedModels/<model_id>`

      `GET` method

      Returns information about the model having id as `model_id`.

      Return Object:
        ```
            Model
        ```
      It directly returns an object of the type Model which corresponds to the details of the model with model id
      `model_id`.

    - `/getTrainedModelFile/<model_id>/<version>`

      `GET` method

      Returns the pickle file of the model with model_id `model_id` and version number as `version`

- ##### `inference.py`

  This script provides endpoints for making predictions using trained models. The models are identified by their IDs and
  are expected to be stored in the ``backend/Models/`` directory.

    - `/inference/single`

      `POST` method

      This endpoint takes in a model ID and a list of input values, makes a prediction using the specified model, and
      returns the prediction. The model ID and input values are expected to be provided in the request body as a JSON
      object with the following structure:

        ```
        {
            "model_id": "string or integer",
            "input_values": ["value1", "value2", ...]
        }
        ```

      The endpoint returns a JSON object with the prediction, or an error message if the model is not found or the input
      values are invalid.

    - `/inference/batch`

      `POST` method

      This endpoint takes in a model ID and a CSV file, makes predictions for each row in the CSV file using the
      specified model, and returns a CSV file with the predictions appended as a new column. The model ID is expected to
      be provided in the request body as a JSON object with the following structure:

        ```
        {
        "model_id": "string or integer"
        }
        ```

      The CSV file is expected to be uploaded as a file with the key 'file'. The endpoint returns a CSV file with the
      predictions, or an error message if the model is not found, no file is uploaded, or the file format is invalid.

- ##### `preprocess.py`

  This script provides an endpoint for preprocessing a specified dataset. The dataset is identified by its ID and is
  expected to be in CSV format in the `backend/Datasets/` directory.

    - `/preprocess`

      `POST` method

      This endpoint takes in a dataset ID and a list of preprocessing tasks, performs the specified tasks on the
      dataset, and saves the preprocessed dataset in the ``./processedDatasets/`` directory. The dataset ID and
      preprocessing tasks are expected to be provided in the request body as a JSON object with the following structure:

        ```
        {
            "dataset_id": "string or integer",
            "preprocessing_steps": ["task1", "task2", ...]
        }
        ```

      The available tasks are "Drop Duplicate Rows", "Interpolate Missing Values", and "Normalise Features". If "Drop
      Duplicate Rows" is specified, the endpoint removes all duplicate rows from the dataset. If "Interpolate Missing
      Values" is specified, the endpoint fills in missing values in numerical columns with the column mean and in
      non-numerical columns with the most frequent value. If "Normalise Features" is specified, the endpoint normalizes
      all numerical columns to have a mean of 0 and a standard deviation of 1.

      The endpoint returns a JSON object with a success message and some statistics about the preprocessing operation,
      including the number of duplicate rows dropped, the number of missing values interpolated, and the list of columns
      normalized. The preprocessed dataset is saved as a CSV file in the `./processedDatasets/` directory with the same
      ID as the original dataset.

      Example Return Object:

        ```
        {
            'message': 'Preprocessing completed successfully',
            'num_duplicate': 5,
            'num_interpolate': 10,
            'normalized_columns': ['column1', 'column2', ...]
        }
        ```

- ##### `storeDataset.py`

  Consists of queries related to storing new dataset in the database.

    - `/storeDataset`

      `POST` method

      Takes in a request form object in body and saves the dataset info like name, size etc. in the database and the
      actual dataset file on local disk.

      The request body for this API endpoint would be a form-data type. Here's the structure:

        ```
        {
          "file": (binary),
          "filename": (string),
          "filesize": (string)
        }
        ```
        - `file`: This is the file that you want to upload. It should be sent as binary data.
        - `filename`: This is the name of the file. It should be sent as a string.
        - `filesize`: This is the size of the file. It should also be sent as a string.

      Return Object:
        ```
        {
            'status': 'success', 
            'dataset_id': dataset_id, 
            'dataset_name': dataset_name
        }
        ```

- ##### `trainModel.py`

  Consists of endpoint which trains a new model.

    - `/trainModel`

      `POST` method

      Takes in all the fields necessary for training a model and trains a new model accordingly. After training, it
      stores the model info in database and model pickle file on local disk system.

      The request body for the API-endpoint is a JSON object:
        ```
            {
              "dataset_id": "string",
              "model_name": "string",
              "target_column": "string",
              "objective": "string",
              "metric_mode": "string",
              "metric_type": "string",
              "training_mode": "string",
              "model_type": "string",
              "isUpdate": "string",
              "hyperparameters": "object",
              "model_id": "string or integer"
            }
        ```
      It calls the appropriate subprocess depending on the fields and returns an object of the type Model containing all
      the details of the model trained.

- ##### `updateModel.py`

  Consists of endpoints related to updating a model. We can update model in 3 ways: Training on additional data,
  changing the hyperparameters, or changing the type of the estimator. The newly trained model is stored as a new
  version of the existing model.

    - `/trainOnMoreData`

      `POST` method

      This method takes the new dataset file and the model details to train a new model on the concatenated data (
      concatenation of original data and the new data).

      The request body for this endpoint would be a form-data type.
        ```
            {
              "original_dataset_id": "string",
              "file": (binary),
              "model_name": "string",
              "target_column": "string",
              "objective": "string",
              "metric_mode": "string",
              "metric_type": "string",
              "model_type": "string",
              "model_id": "string or integer"
            }
        ```
      It internally calls the `/trainModel` API with appropriate parameters.
      It returns a object which contains information about the new version of the model.

    - `/changeHyperparameters`

      `POST` method

      It takes in the new hyperparameters selected for the model and trains it on the same dataset with the new
      hyperparameters.

      The request body for the API-endpoint is a JSON object:
        ```
        {
          "model_details": {
            "dataset_id": "string or integer",
            "model_id": "string or integer",
            "model_name": "string",
            "target_column": "string",
            "objective": "string",
            "metric_mode": "string",
            "metric_type": "string",
            "estimator_type": "string"
          },
          "new_hyperparameters": "object"
        }
        ```
      It internally calls the `/trainModel` API with appropriate parameters.

      It returns a object which contains information about the new version of the model.

    - `/changeEstimatorType`

      `POST` method

      It takes in the new estimator type for current model and trains it on the same dataset with the changed estimator.
      It also takes the modified hyperparameters (if modified by the user).

      The request body for the API-endpoint is a JSON object:
        ```
        {
          "model_details": {
            "dataset_id": "string or integer",
            "model_id": "string or integer",
            "model_name": "string",
            "target_column": "string",
            "objective": "string",
            "metric_mode": "string",
            "metric_type": "string"
          },
          "new_hyperparameters": "object",
          "estimator_type": "string"
        }
        ```
      It internally calls the `/trainModel` API with appropriate parameters.

      It returns a object which contains information about the new version of the model.

- ##### `utilities.py`
  Contains endpoints that provide utility information such as Classifiers, regressors, parameters for a classifier etc.

    - `/getAllClassifiers`

      `GET` method

      Returns the list of classifiers available to train.

    - `/getAllRegressors`

      `GET` method

      Returns the list of regressors available to train.

    - `/getClassifierMap`

      `GET` method

      Returns the classifier map object which maps a classifier's name to its corressponding sklearn classifier's name.

    - `/getRegressorMap`

      `GET` method

      Returns the regressor map object which maps a regressor's name to its corressponding sklearn regressor's name.

    - `/getHyperparameters`

      `POST` method

      The request body would be a JSON object:
        ```
        {
          "estimator_name": "string"
        }
        ```
      Returns the object which contains hyperparameters for the given estimator.

### `functions` Folder

It consists of functions that are used by API files in `APIs` folder.
Description of all files in it:

- ##### `ClassificationUtility.py`
  Contains the class `ClassificationUtility` which is used to train models by `trainModelAutoML.py` and
  `trainModelCustom.py`.

    It is designed to facilitate the process of training and evaluating various classification models on a given dataset. It includes methods for data preprocessing, model training, evaluation, and saving the trained model.

    Key features of this class include:
    
    - It supports both AutoML (automated machine learning) and custom training modes. In AutoML mode, it trains multiple classifiers and selects the best one based on a specified metric. - In custom mode, it trains a specified model with given hyperparameters.
    
    - It handles categorical and numerical features separately during preprocessing. Categorical features with high cardinality are target encoded, while others are one-hot encoded. Numerical features are scaled.
    
    - It calculates various evaluation metrics such as accuracy, precision, recall, F1 score, and AUC (Area Under the ROC Curve) for the trained models.
    
    - It provides methods to get feature importance, precision-recall data, and AUC data.
    
    - It allows saving the best model to a specified path.

- ##### `RegressionUtility.py`
  Contains the class `RegressionUtility` which is used to train models by `trainModelAutoML.py` and
  `trainModelCustom.py`.

    It is designed to facilitate the process of training and evaluating various regression models on a given dataset. It includes methods for data preprocessing, model training, evaluation, and saving the trained model.

    Key features of this class include:

    - It supports both AutoML (automated machine learning) and custom training modes. In AutoML mode, it trains multiple regressors and selects the best one based on a specified metric. In custom mode, it trains a specified model with given hyperparameters.
    
    - It handles categorical and numerical features separately during preprocessing. Categorical features with high cardinality are target encoded, while others are one-hot encoded. Numerical features are scaled.
    
    - It calculates various evaluation metrics such as R2 score, Mean Absolute Error (MAE), Mean Squared Error (MSE), and Root Mean Squared Error (RMSE) for the trained models.
    
    - It provides methods to get feature importance, scatter plot data, and residual plot data.
    
    - It allows saving the best model to a specified path.

- ##### `trainModelAutoML.py`
  Contains the function which trains a model for classification/regression in AutoML mode i.e. it trains all the
  available classifiers on the dataset and stores the results/metrics in the database.

  Brief outline of working of the function:
    - It reads the dataset from a CSV file.
    - If the metric_mode is set to 'autoselect', it automatically selects an appropriate evaluation metric based on the
      task (classification or regression) and the balance of the target classes (for classification).
    - It initializes a ClassificationUtility or RegressionUtility object based on the task.
    - It trains the model using AutoML.
    - It retrieves the best model and its parameters based on the specified or auto-selected metric.
    - It prepares a list of evaluation metrics and model parameters.
    - It saves the best model to a file.
    - It generates various visualization data such as confusion matrix, feature importance, precision-recall curve, ROC
      curve, scatter plot, and residual plot.
    - It saves the model metadata including training time, model ID, model name, training mode, estimator type, metric
      mode, metric type, saved model path, dataset ID, objective, target column, parameters, evaluation metrics, all
      models' results, input schema, output schema, output mapping, and graph data to a MongoDB collection named '
      Model_zoo'.
    - It returns the model metadata as a dictionary.
      The function is designed to be run from the command line with arguments for dataset ID, model name, model type,
      hyperparameters, target column, metric mode, metric type, objective, model ID, and update status.

- ##### `trainModelCustom.py`
  It provides a similar functionality as `trainModelAutoML.py` with the only difference being it trains a given model
  instead of training all available models.

### `Enums` Folder

The enums folder contains `enums.py` file which contains enumerations for metrics, classifiers and regressors.

### `Datasets` folder

It is used to store the `.csv` files of the dataset on the local disk system.

### `Models` folder

It is used to store the `.pkl` files of trained models on the local disk system.

---

# Important Datasets

## Training:

**Sentiment**: 11243.csv  
**Classification**:   
**Regression**:

---

# cURL command to send CSV file as input:

```curl -X POST -F "file=@Datasets/<input_dataset_name>.csv" http://localhost:5005/getCSVInput/<Pipeline_ID> --output <output_file_name>.csv```