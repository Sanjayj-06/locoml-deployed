from flask import Blueprint, request, Response
import requests
import os

proxy_blueprint = Blueprint('proxy', __name__)

# Map prefixes to internal microservice URLs
MICROSERVICES = {
    "master-server": os.getenv("MASTER_SERVER_URL", "http://locodeml-master-server:5001"),
    "input-router": os.getenv("INPUT_ROUTER_URL", "http://locodeml-input-router:5002"),
    "preprocess-router": os.getenv("PREPROCESS_ROUTER_URL", "http://locodeml-preprocess-router:5003"),
    "model-router": os.getenv("MODEL_ROUTER_URL", "http://locodeml-model-router:5004"),
    "pipeline-router": os.getenv("PIPELINE_ROUTER_URL", "http://locodeml-pipeline-router:5005"),
}

@proxy_blueprint.route('/proxy/<service_name>/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def proxy(service_name, path):
    if service_name not in MICROSERVICES:
        return {"error": "Service not found"}, 404

    base_url = MICROSERVICES[service_name]
    target_url = f"{base_url}/{path}"
    
    # Forward the query string
    if request.query_string:
        target_url = f"{target_url}?{request.query_string.decode('utf-8')}"

    headers = {key: value for (key, value) in request.headers if key != 'Host'}

    try:
        if request.method == 'POST' or request.method == 'PUT' or request.method == 'PATCH':
            # Handle file uploads specifically for multipart/form-data
            if 'multipart/form-data' in request.headers.get('Content-Type', ''):
                files = {name: (file.filename, file.stream, file.mimetype) for name, file in request.files.items()}
                data = dict(request.form)
                resp = requests.request(
                    method=request.method,
                    url=target_url,
                    headers={k: v for k, v in headers.items() if k.lower() != 'content-type'}, # let requests set the boundary
                    data=data,
                    files=files,
                    stream=True,
                    timeout=300
                )
            else:
                resp = requests.request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    data=request.get_data(),
                    cookies=request.cookies,
                    allow_redirects=False,
                    stream=True,
                    timeout=300
                )
        else:
            resp = requests.request(
                method=request.method,
                url=target_url,
                headers=headers,
                cookies=request.cookies,
                allow_redirects=False,
                stream=True,
                timeout=300
            )

        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        response_headers = [(name, value) for (name, value) in resp.raw.headers.items()
                            if name.lower() not in excluded_headers]

        return Response(resp.iter_content(chunk_size=10 * 1024), resp.status_code, response_headers)

    except requests.exceptions.RequestException as e:
        return {"error": f"Proxy request failed: {str(e)}"}, 502
