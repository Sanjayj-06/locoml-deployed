import pickle
import pprint
import json

def decode_model(model_path):
    model = pickle.load(open(model_path, 'rb'))
    del model['time']
    del model['versions']
    del model['graph_data']
    print(model.keys())
    with open('model_details.json', 'w') as json_file:
        json.dump(model, json_file, indent=4)

decode_model('./details.pkl')
# pprint.pprint(decode_model('./details.pkl'))