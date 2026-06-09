import os
from itsdangerous import URLSafeTimedSerializer
from flask import request

SECRET_KEY = os.getenv("SECRET_KEY", "locoml-auth-super-secret-key-998877")
serializer = URLSafeTimedSerializer(SECRET_KEY)

def generate_token(username):
    """
    Generates a signed, timed token containing the user's username.
    """
    return serializer.dumps({"username": username})

def verify_token(token):
    """
    Verifies the timed token. Returns username if valid, otherwise None.
    """
    try:
        # Valid for 24 hours (86400 seconds)
        data = serializer.loads(token, max_age=86400)
        return data.get("username")
    except Exception:
        return None

def get_user_from_request():
    """
    Attempts to authenticate the user from standard request locations:
    1. Authorization Header: Bearer <token>
    2. Custom Header: X-User-Id
    3. Query Parameter: ?username=...
    4. JSON Body: {"username": ...}
    Returns username if authenticated, else None.
    """
    # 1. Check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        username = verify_token(token)
        if username:
            return username

    # 2. Check X-User-Id header
    x_user = request.headers.get("X-User-Id")
    if x_user:
        return x_user

    # 3. Check query param
    q_user = request.args.get("username")
    if q_user:
        return q_user

    # 4. Check JSON body
    if request.is_json:
        try:
            body_user = request.json.get("username")
            if body_user:
                return body_user
        except Exception:
            pass

    return None
