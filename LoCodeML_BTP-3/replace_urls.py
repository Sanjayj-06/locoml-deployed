import os
import re

dir_path = r'c:\Users\Sanjay Jayakumar\OneDrive\Desktop\LoCoML_Deploy\LoCodeML_BTP-3\frontend\src'

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Replace specific REACT_APP environment variables with proxy fallbacks
    content = re.sub(
        r'process\.env\.REACT_APP_MASTER_SERVER_URL\s*\|\|\s*[\'"`]http://localhost:5001[\'"`]',
        r'(process.env.REACT_APP_MASTER_SERVER_URL || ((process.env.REACT_APP_API_BASE_URL || "http://localhost:5000") + "/proxy/master-server"))',
        content
    )
    
    content = re.sub(
        r'process\.env\.REACT_APP_INFERENCE_PIPELINE_ZOO_GET_PIPELINES\s*\|\|\s*[\'"`]http://localhost:5005/getPipelinesList[\'"`]',
        r'(process.env.REACT_APP_INFERENCE_PIPELINE_ZOO_GET_PIPELINES || ((process.env.REACT_APP_API_BASE_URL || "http://localhost:5000") + "/proxy/pipeline-router/getPipelinesList"))',
        content
    )
    
    content = re.sub(
        r'process\.env\.REACT_APP_INFERENCE_PIPELINE_RETRIEVE_PIPELINE_DETAILS\s*\|\|\s*[\'"`]http://localhost:5005/retrievePipelineDetails[\'"`]',
        r'(process.env.REACT_APP_INFERENCE_PIPELINE_RETRIEVE_PIPELINE_DETAILS || ((process.env.REACT_APP_API_BASE_URL || "http://localhost:5000") + "/proxy/pipeline-router/retrievePipelineDetails"))',
        content
    )
    
    # Replace hardcoded localhost without REACT_APP
    content = re.sub(
        r'[\'"`]http://localhost:5005/savePipeline[\'"`]',
        r'`${process.env.REACT_APP_API_BASE_URL || "http://localhost:5000"}/proxy/pipeline-router/savePipeline`',
        content
    )
    
    content = re.sub(
        r'http://localhost:5005/getCSVInput',
        r'http://localhost:5000/proxy/pipeline-router/getCSVInput',
        content
    )

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk(dir_path):
    for file in files:
        if file.endswith('.js') or file.endswith('.jsx'):
            process_file(os.path.join(root, file))

print('Replacement complete.')
