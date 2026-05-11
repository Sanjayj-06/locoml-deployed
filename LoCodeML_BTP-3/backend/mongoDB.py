from pymongo import MongoClient
import os
uri = os.getenv('MONGO_URI')
client = MongoClient(uri)
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print("Exception occured")
    print(e)


db = client['AutoML_Project']