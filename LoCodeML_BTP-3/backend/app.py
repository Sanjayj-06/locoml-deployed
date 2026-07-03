from flask import Flask
import os
from flask_cors import CORS
from flask_sse import sse
from dotenv import load_dotenv
load_dotenv()
from APIs.getDatasets import getDatasets
from APIs.trainModel import trainModelAPIs
from APIs.preprocess import preprocess
from APIs.getTrainedModels import getTrainedModels
from APIs.storeDataset import storeDataset
from APIs.deployModel import deployModel
from APIs.eda import eda
from APIs.utilities import utilityAPIs
from APIs.updateModel import updateModelAPIs
from APIs.searchDatasets import searchDatasets
from APIs.img_eda import img_eda
from APIs.img_preprocess import img_preprocess
from APIs.apply_preprocessing import apply_preprocess
from APIs.pipelineGenerator import pipelineGenerator
from APIs.processQuery import processQuery
from APIs.stressTest import stressTestAPIs
from APIs.auth import auth_blueprint
from APIs.proxy import proxy_blueprint

app = Flask(__name__)
CORS(app)

app.register_blueprint(sse, url_prefix="/stream")
app.register_blueprint(getDatasets)
app.register_blueprint(trainModelAPIs)
app.register_blueprint(preprocess)
app.register_blueprint(getTrainedModels)
app.register_blueprint(storeDataset)
app.register_blueprint(deployModel)
app.register_blueprint(eda)
app.register_blueprint(utilityAPIs)
app.register_blueprint(updateModelAPIs)
app.register_blueprint(searchDatasets)
app.register_blueprint(img_eda)
app.register_blueprint(img_preprocess)
app.register_blueprint(apply_preprocess)
app.register_blueprint(pipelineGenerator)
app.register_blueprint(processQuery)
app.register_blueprint(stressTestAPIs)
app.register_blueprint(auth_blueprint)
app.register_blueprint(proxy_blueprint)

app.config['REDIS_URL'] = os.getenv('REDIS_URL')

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
