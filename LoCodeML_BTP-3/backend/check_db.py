from mongoDB import db
for m in db['Model_zoo'].find():
    print(m.get('model_name'), ":", m.get('saved_model_path'))
