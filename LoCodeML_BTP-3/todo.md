# Things to do

# General things

1. Train -> Dataset (only the first chosen one generates the rest of the options, fix this.)
2. Check if you can give models a valid name instead of a randomly generated sequence of 6 chars.
3. Download model (right now it is downloading from local?!?!?!) -> Also, storage of models (possibly on an inexpensive cloud storage server? firebase maybe?)
4. Training failure returns previously succeeded training results when "Finish" is clicked.

---

---

# Inference Pipeline (and other hindrances)

# New Goal: Endpoints, REST API to take input. Parallelization of pipeline. Progress bar.

## High priority

1. Make the endpoints REST API based, so that users can use something like a curl request to send and receive data. Think about how an IoT device would communicate.
2. Progress bar for the above, so that the user knows the current stage of the pipeline being run.
3. Fix the inputs between blocks, and work on running things in parallel.
4. [FOR INFERENCE ZOO] Remake Model Card Component for Pipelines -> perhaps, provide a preview of what the pipeline does? maybe show the nodes?
5. Remove the "review" column hardcoding in training and inference for sentiment analysis - let user select which column contains the text in the provided dataset for both, apart from just selecting the sentiment labels column.
6. UI/UX of the actual pipeline page -> tqdm progress bar for each of the nodes, run button ("running" when clicked isn't really visible) - Apache Airflow, Node Red, Thingsboard etc etc look into them
7. Define a way by which the user can train their own model on our system.
8. Force user to name the input blocks.
9. Perform pipeline validation before saving.
10. Come up with some metamodel of pipeline
11. Adding a trained model

---

## Low priority (finish the API thing first)

1. Normalize values preprocessing step for inference. (NaN, possible divide by 0?)
2. Remove ALL the console.log() and print() statements.
3. Versions of a model -> iterate through them in order to determine which model to use/being used (model zoo, inference etc).
4. Pipeline checks (ordering of nodes, and their validity) & error handling in the pipeline (includes checking if the dataset provided is valid for the selected model)
5. Display of inference results to be in a proper (completely visible, i.e., no truncation, and visually appealing) format.
6. Maybe define a validation step for the model name -> if two or more models have the same name, how is the admin (the person who creates the pipelines) supposed to know which model is which?
7. Resolve the "TODO" comments in Sentiment_new.py (sentiment analysis training).
8. Fix all the React warnings on ALL the webpages.
9. Generalize inputs (any format, not necessarily CSV) -> **LEAST PRIORITY!**

---

---
