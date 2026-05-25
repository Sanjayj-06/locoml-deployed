from flask import Blueprint, request
import sys

sys.path.append("../")
from mongoDB import db
import os
import bson.json_util as json_util
from flask import send_file

getTrainedModels = Blueprint("getTrainedModels", __name__)


@getTrainedModels.route("/getTrainedModels/all", methods=["GET"])
def getTrainedModelListAll():
    return getTrainedModelList()


@getTrainedModels.route("/getTrainedModels", methods=["GET"])
def getTrainedModelList():
    collection = db["Model_zoo"]
    trained_model_list = []

    for model in collection.find():
        print(type(model))
        model.pop("_id")
        trained_model_list.append(json_util.dumps(model))

    # return {'trained_models': trained_model_list}
    return json_util.dumps({"trained_models": trained_model_list})


@getTrainedModels.route("/getTrainedModels/classification", methods=["GET"])
def getTrainedModelListClassification():
    collection = db["Model_zoo"]
    trained_model_list = []

    query = {"objective": "classification"}
    results = collection.find(query)

    for model in results:
        model.pop("_id")
        trained_model_list.append(json_util.dumps(model))

    # return {'trained_models': trained_model_list}
    return json_util.dumps({"trained_models": trained_model_list})


@getTrainedModels.route("/getTrainedModels/regression", methods=["GET"])
def getTrainedModelListRegression():
    collection = db["Model_zoo"]
    trained_model_list = []

    query = {"objective": "regression"}
    results = collection.find(query)

    for model in results:
        model.pop("_id")
        trained_model_list.append(json_util.dumps(model))

    # return {'trained_models': trained_model_list}
    return json_util.dumps({"trained_models": trained_model_list})


@getTrainedModels.route("/getTrainedModels/sentiment", methods=["GET"])
def getTrainedModelListSentiment():
    collection = db["Model_zoo"]
    trained_model_list = []

    query = {"objective": "sentiment"}
    results = collection.find(query)

    # distinct_values = collection.distinct('objective')
    # print(distinct_values)

    for model in results:
        model.pop("_id")
        trained_model_list.append(json_util.dumps(model))

    # return {'trained_models': trained_model_list}
    return json_util.dumps({"trained_models": trained_model_list})

@getTrainedModels.route("/getTrainedModels/imageclassification", methods=["GET"])
def getTrainedModelListImageClassification():
    collection = db["Model_zoo"]
    trained_model_list = []

    query = {"objective": "imageClassification"}
    results = collection.find(query)

    for model in results:
        model.pop("_id")
        trained_model_list.append(json_util.dumps(model))

    return json_util.dumps({"trained_models": trained_model_list})

@getTrainedModels.route("/getTrainedModels/machinetranslation", methods=["GET"])
def getTrainedModelListMachineTranslation():
    collection = db["Model_zoo"]
    trained_model_list = []

    query = {"objective": "machineTranslation"}
    results = collection.find(query)

    for model in results:
        model.pop("_id")
        trained_model_list.append(json_util.dumps(model))

    return json_util.dumps({"trained_models": trained_model_list})

@getTrainedModels.route("/getTrainedModels/<model_id>", methods=["GET"])
def getTrainedModel(model_id):
    # get model_id from endpoint
    # model_id = request.view_args['model_id']
    print(model_id)
    collection = db["Model_zoo"]
    trained_model = collection.find_one({"model_id": model_id})
    if not trained_model:
        return {"error": f"Model '{model_id}' not found"}, 404

    # sort version array according to the date
    if "versions" in trained_model and isinstance(trained_model["versions"], list):
        trained_model["versions"].sort(key=lambda x: x["time"], reverse=True)
    return json_util.dumps(trained_model)


@getTrainedModels.route("/getTrainedModelFile/<model_id>/<version>", methods=["GET"])
def getTrainedModelFile(model_id, version):
    version = int(version)
    collection = db["Model_zoo"]
    trained_model = collection.find_one({"model_id": model_id})
    # sort version array according to the date
    model_path = trained_model["versions"][version - 1]["saved_model_path"]
    relative_path = model_path[model_path.find("Models") :].replace("\\", "/")
    cur_path = os.path.join(os.getenv("PROJECT_PATH", "/app/"), relative_path)
    return send_file(cur_path)


@getTrainedModels.route("/getTrainedModels/validate_model", methods=["GET"])
def validate_model():
    model_state_dict = request.args.get('model_state_dict')
    print("TYPE: ", type(model_state_dict))
    required_params = set(
        [
            "estimator_type",
            "objective",
            "parameters",
            "input_schema",
            "output_schema",
            "output_mapping",
        ]
    )
    # "time",
    # "model_id",
    # "model_name",
    # "training_mode",
    # "metric_mode",
    # "metric_type",
    # "saved_model_path",
    # "dataset_id",
    # "evaluation_metrics",
    # "all_models_results",
    # "target_column",
    # "graph_data",
    # "versions",

    for key in model_state_dict.keys():
        if key not in required_params:
            return False
        
    return True