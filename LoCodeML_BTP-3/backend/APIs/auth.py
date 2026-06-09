from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import sys
import os
import datetime

sys.path.append(os.getenv('PROJECT_PATH', ''))
from mongoDB import db
from auth_helper import generate_token, get_user_from_request

auth_blueprint = Blueprint('auth', __name__)

@auth_blueprint.route('/api/auth/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json() or {}
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if not username or not email or not password:
            return jsonify({'success': False, 'error': 'Missing username, email, or password'}), 400

        users_coll = db['Users']

        # Check existing user
        if users_coll.find_one({'username': username}):
            return jsonify({'success': False, 'error': 'Username already exists'}), 400
        if users_coll.find_one({'email': email}):
            return jsonify({'success': False, 'error': 'Email already exists'}), 400

        password_hash = generate_password_hash(password)

        user_doc = {
            'username': username,
            'email': email,
            'password': password_hash,
            'name': data.get('name', ''),
            'company': data.get('company', ''),
            'address': data.get('address', ''),
            'city': data.get('city', ''),
            'country': data.get('country', ''),
            'postal_code': data.get('postal_code', ''),
            'about_me': data.get('about_me', ''),
            'created_at': datetime.datetime.utcnow()
        }

        users_coll.insert_one(user_doc)

        token = generate_token(username)

        # Remove sensitive information before returning
        user_doc.pop('_id', None)
        user_doc.pop('password', None)
        user_doc.pop('created_at', None)

        return jsonify({
            'success': True,
            'token': token,
            'user': user_doc
        }), 201

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@auth_blueprint.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json() or {}
        login_id = data.get('username')  # can be username or email
        password = data.get('password')

        if not login_id or not password:
            return jsonify({'success': False, 'error': 'Missing login ID or password'}), 400

        users_coll = db['Users']

        # Find user by username or email
        user_doc = users_coll.find_one({
            '$or': [
                {'username': login_id},
                {'email': login_id}
            ]
        })

        if not user_doc or not check_password_hash(user_doc['password'], password):
            return jsonify({'success': False, 'error': 'Invalid username/email or password'}), 401

        token = generate_token(user_doc['username'])

        user_info = {
            'username': user_doc.get('username'),
            'email': user_doc.get('email'),
            'name': user_doc.get('name', ''),
            'company': user_doc.get('company', ''),
            'address': user_doc.get('address', ''),
            'city': user_doc.get('city', ''),
            'country': user_doc.get('country', ''),
            'postal_code': user_doc.get('postal_code', ''),
            'about_me': user_doc.get('about_me', '')
        }

        return jsonify({
            'success': True,
            'token': token,
            'user': user_info
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@auth_blueprint.route('/api/auth/profile', methods=['GET', 'PUT'])
def profile():
    try:
        username = get_user_from_request()
        if not username:
            return jsonify({'success': False, 'error': 'Unauthorized access'}), 401

        users_coll = db['Users']
        user_doc = users_coll.find_one({'username': username})

        if not user_doc:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        if request.method == 'GET':
            user_info = {
                'username': user_doc.get('username'),
                'email': user_doc.get('email'),
                'name': user_doc.get('name', ''),
                'company': user_doc.get('company', ''),
                'address': user_doc.get('address', ''),
                'city': user_doc.get('city', ''),
                'country': user_doc.get('country', ''),
                'postal_code': user_doc.get('postal_code', ''),
                'about_me': user_doc.get('about_me', '')
            }
            return jsonify({'success': True, 'user': user_info}), 200

        elif request.method == 'PUT':
            data = request.get_json() or {}
            
            update_fields = {}
            for field in ['name', 'company', 'address', 'city', 'country', 'postal_code', 'about_me']:
                if field in data:
                    update_fields[field] = data[field]

            if update_fields:
                users_coll.update_one({'username': username}, {'$set': update_fields})

            updated_user = users_coll.find_one({'username': username})

            user_info = {
                'username': updated_user.get('username'),
                'email': updated_user.get('email'),
                'name': updated_user.get('name', ''),
                'company': updated_user.get('company', ''),
                'address': updated_user.get('address', ''),
                'city': updated_user.get('city', ''),
                'country': updated_user.get('country', ''),
                'postal_code': updated_user.get('postal_code', ''),
                'about_me': updated_user.get('about_me', '')
            }
            return jsonify({'success': True, 'user': user_info, 'message': 'Profile updated successfully'}), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
