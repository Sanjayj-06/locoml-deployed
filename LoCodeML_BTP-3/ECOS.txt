ECOS - Evolutionary Cognitive Orchestration System
Implementing new features to LoCoML
Internship Project

================================================================================
QUICK START COMMANDS
================================================================================

## BACKEND SETUP & RUN

### Option 1: Using Docker Compose (RECOMMENDED)
-----------
From: LoCodeML_BTP-3/backend/

Commands:
  cd backend
  docker compose up --build              # First time - builds & starts all services
  docker compose up -d                   # Subsequent runs - starts in background
  docker compose down                    # Stop all services
  docker compose logs main --tail 100    # View backend logs
  docker compose logs master_server --tail 100  # View master server logs
  docker compose restart                 # Restart services

Services started by docker-compose:
  - main (Flask app on port 5000) - Primary API server
  - master_server (port 5001) - Inference microservice
  - input_router (router service)
  - model_router (router service)
  - pipeline_router (router service)
  - preprocess_router (router service)
  - mongo (MongoDB on port 27017)
  - redis (Redis cache)

### Option 2: Direct Python Run
-----------
From: LoCodeML_BTP-3/backend/

Commands:
  cd backend
  python app.py                          # Runs Flask server on port 5000
  
Requirements:
  - Python 3.11+ installed
  - .env file configured with:
    * MONGO_URI
    * REDIS_URL
    * HUGGINGFACE_TOKEN
    * KAGGLE_USERNAME & KAGGLE_KEY

### Prerequisites for Backend
-----------
Before running, ensure .env exists in backend/ folder:
  
  MONGO_URI=<your_mongo_uri>
  PROJECT_PATH="/app/"
  REDIS_URL="redis://localhost:6379"
  HUGGINGFACE_TOKEN=<your_token>
  KAGGLE_USERNAME=<your_username>
  KAGGLE_KEY=<your_key>

MongoDB must be running (either locally or via Docker)
Redis must be running (either locally or via Docker)


## FRONTEND SETUP & RUN

### Initial Setup (First Time Only)
-----------
From: LoCodeML_BTP-3/frontend/

Commands:
  cd frontend
  npm i                                  # Install all node dependencies
  npm start                              # Start frontend on http://localhost:3000

### Subsequent Runs
-----------
From: LoCodeML_BTP-3/frontend/

Commands:
  npm start                              # Start dev server on http://localhost:3000
  npm run dev                            # Alternative: Start dev server
  npm run build                          # Build for production

### Frontend Config
-----------
Proxy settings in package.json:
  "proxy": "http://127.0.0.1:5000"
  
This allows frontend to make API calls to backend without CORS issues.

IMPORTANT: Start backend BEFORE frontend!
           Frontend depends on backend API running on port 5000


================================================================================
RUNNING BOTH BACKEND & FRONTEND
================================================================================

FULL STARTUP SEQUENCE:
-----------
1. Terminal 1 - Backend:
   cd backend
   docker compose up --build              # OR: python app.py

2. Wait for backend to fully start (~30 seconds with Docker)
   Look for: "Running on http://0.0.0.0:5000"

3. Terminal 2 - Frontend:
   cd frontend
   npm start                              # Starts on http://localhost:3000

4. Browser:
   Open: http://localhost:3000
   You should see LoCoML dashboard


CHECKING IF SERVICES ARE RUNNING:
-----------
Backend:
  curl http://localhost:5000/           # Should return API response
  
Frontend:
  http://localhost:3000                 # Should load in browser

Master Server:
  http://localhost:5001                 # Inference microservice


================================================================================
TROUBLESHOOTING
================================================================================

Backend won't start:
  ✓ Check .env file exists and has all required variables
  ✓ Check MongoDB is running
  ✓ Check Redis is running
  ✓ Check ports 5000, 5001 are not in use
  ✓ Try: docker compose restart

Frontend won't start:
  ✓ Check npm dependencies installed: npm i
  ✓ Check backend is running on port 5000
  ✓ Check port 3000 is available
  ✓ Delete node_modules and reinstall: rm -r node_modules && npm i

Connection refused error:
  ✓ Ensure backend is running BEFORE frontend
  ✓ Check proxy setting in frontend/package.json points to http://127.0.0.1:5000

Port already in use:
  ✓ Backend (5000, 5001): Check if running; kill process or use different port
  ✓ Frontend (3000): Check if running; kill process or use different port
  ✓ MongoDB (27017): Check if running
  ✓ Redis (6379): Check if running


================================================================================
PROJECT STRUCTURE
================================================================================

LoCodeML_BTP-3/
├── backend/                    # Python Flask API + Microservices
│   ├── app.py                 # Main Flask application
│   ├── docker-compose.yml     # Docker services config
│   ├── Dockerfile             # Container setup
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Environment variables (create this)
│   ├── APIs/                  # All API endpoints
│   ├── functions/             # ML training functions
│   ├── Enums/                 # Enum definitions
│   └── Models/                # Trained model storage
│
├── frontend/                   # React.js Dashboard
│   ├── package.json           # Node dependencies + scripts
│   ├── public/                # Static files
│   └── src/                   # React components & views
│
├── README.md                   # Main documentation
├── UPGRADE_CHANGELOG.md        # v1.0 → v1.1 changes
├── IMPLEMENTATION_GUIDE.md     # Code change references
└── ECOS.txt                    # This file


================================================================================
MONITORING & LOGS
================================================================================

Docker Container Logs:
  docker compose logs main                # Main Flask server
  docker compose logs main --tail 50      # Last 50 lines
  docker compose logs master_server       # Master inference server
  docker compose logs -f main             # Follow/stream logs

Browser Console Logs:
  Frontend: Open browser → F12 → Console
  Check for API errors and network requests

Python/Backend Errors:
  Check terminal where docker compose or python app.py was running
  Or: docker compose logs main --tail 300


================================================================================
USEFUL COMMANDS REFERENCE
================================================================================

Docker:
  docker ps                              # List running containers
  docker ps -a                           # List all containers
  docker logs <container_id>             # View container logs
  docker exec -it <container_id> bash    # Enter container shell
  docker compose up --build -d           # Build and start detached
  docker compose stop                    # Stop containers
  docker compose rm                      # Remove containers

NPM:
  npm install                            # Install dependencies
  npm start                              # Start dev server
  npm run build                          # Build for production
  npm audit                              # Check for vulnerabilities
  npm update                             # Update packages

Python:
  python --version                       # Check Python version
  pip install -r requirements.txt        # Install Python packages
  python app.py                          # Run Flask server


================================================================================
NOTES
================================================================================

- Always start BACKEND first, then FRONTEND
- For development, use docker compose (easier debugging)
- Add JWT tokens to API calls if authentication is enabled
- Check .env file before running backend
- Frontend proxy to backend is configured in package.json
- All ML models are trained and stored in backend/Models/
- Dataset files are stored in backend/Datasets/
- Logs are stored in backend/log.txt