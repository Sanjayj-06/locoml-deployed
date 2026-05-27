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


def _safe_get_models_by_query(query=None):
    try:
        collection = db["Model_zoo"]
        trained_model_list = []
        cursor = collection.find(query) if query is not None else collection.find()
        for model in cursor:
            try:
                if "_id" in model:
                    model.pop("_id")
                trained_model_list.append(json_util.dumps(model))
            except Exception as item_err:
                print(f"[WARNING] Skipping malformed model zoo entry: {item_err}")
        return json_util.dumps({"trained_models": trained_model_list})
    except Exception as e:
        import traceback
        import sys
        print(f"[ERROR] Failed query model list: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return json_util.dumps({
            "trained_models": [],
            "error": "Failed to retrieve trained models registry",
            "details": str(e)
        })

@getTrainedModels.route("/getTrainedModels", methods=["GET"])
def getTrainedModelList():
    return _safe_get_models_by_query()

@getTrainedModels.route("/getTrainedModels/classification", methods=["GET"])
def getTrainedModelListClassification():
    return _safe_get_models_by_query({"objective": "classification"})

@getTrainedModels.route("/getTrainedModels/regression", methods=["GET"])
def getTrainedModelListRegression():
    return _safe_get_models_by_query({"objective": "regression"})

@getTrainedModels.route("/getTrainedModels/sentiment", methods=["GET"])
def getTrainedModelListSentiment():
    return _safe_get_models_by_query({"objective": "sentiment"})

@getTrainedModels.route("/getTrainedModels/imageclassification", methods=["GET"])
def getTrainedModelListImageClassification():
    return _safe_get_models_by_query({"objective": "imageClassification"})

@getTrainedModels.route("/getTrainedModels/machinetranslation", methods=["GET"])
def getTrainedModelListMachineTranslation():
    return _safe_get_models_by_query({"objective": "machineTranslation"})

@getTrainedModels.route("/getTrainedModels/<model_id>", methods=["GET"])
def getTrainedModel(model_id):
    try:
        print(model_id)
        collection = db["Model_zoo"]
        trained_model = collection.find_one({"model_id": model_id})
        if not trained_model:
            return {"error": f"Model '{model_id}' not found"}, 404

        # sort version array according to the date
        if "versions" in trained_model and isinstance(trained_model["versions"], list):
            try:
                trained_model["versions"].sort(key=lambda x: x.get("time", 0), reverse=True)
            except Exception as sort_err:
                print(f"[WARNING] Failed to sort versions: {sort_err}")
        if "_id" in trained_model:
            trained_model.pop("_id")
        return json_util.dumps(trained_model)
    except Exception as e:
        import traceback
        import sys
        print(f"[ERROR] Failed to fetch model {model_id}: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return {"error": f"Failed to retrieve model details: {str(e)}"}, 500


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


@getTrainedModels.route("/deleteModel/<model_id>", methods=["DELETE"])
def deleteModel(model_id):
    try:
        collection = db["Model_zoo"]
        trained_model = collection.find_one({"model_id": model_id})
        if not trained_model:
            return {"error": f"Model '{model_id}' not found"}, 404

        # 1. Collect all model file paths to delete
        file_paths = []
        model_ids_to_clean = [model_id]
        
        main_path = trained_model.get("saved_model_path")
        if main_path:
            file_paths.append(main_path)
            
        # Collect paths and model_ids from versions
        versions = trained_model.get("versions", [])
        if isinstance(versions, list):
            for v in versions:
                v_path = v.get("saved_model_path")
                if v_path:
                    file_paths.append(v_path)
                v_id = v.get("model_id")
                if v_id and v_id not in model_ids_to_clean:
                    model_ids_to_clean.append(v_id)

        # Also add metadata JSON file path
        project_path = os.getenv("PROJECT_PATH", "")
        metadata_json_path = os.path.join(project_path, "Models", f"{model_id}_metadata.json")
        file_paths.append(metadata_json_path)

        # 2. Delete all model files from filesystem
        for p in file_paths:
            if not p:
                continue
            # Resolve path if relative
            resolved_p = p
            if not os.path.isabs(p):
                idx = p.find("Models")
                if idx != -1:
                    resolved_p = os.path.join(project_path, p[idx:])
                else:
                    resolved_p = os.path.join(project_path, p)
            
            resolved_p = resolved_p.replace("\\", "/")
            if os.path.exists(resolved_p):
                try:
                    os.remove(resolved_p)
                except Exception as e:
                    print(f"[DELETE MODEL] Error removing file {resolved_p}: {str(e)}")

        # 3. Clean up DB records
        collection.delete_one({"model_id": model_id})
        db["Stress_reports"].delete_many({"model_id": {"$in": model_ids_to_clean}})

        return {"message": f"Model '{model_id}' and all associated files/artifacts deleted successfully"}, 200

    except Exception as e:
        print(f"[DELETE MODEL ERROR] {str(e)}")
        return {"error": str(e)}, 500