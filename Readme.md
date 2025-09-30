# Neuraleap API - README

## Project Overview

Neuraleap is a full-stack application with a FastAPI backend and Next.js frontend that provides JWT-authenticated API endpoints with WebSocket support, session management, and AI-powered hiring prompt analysis.

## Project Structure

```
neuraleap/
├── backend-mvp/          # FastAPI backend
│   ├── main.py          # Main entry point
│   ├── api.py           # API routes and endpoints
│   ├── auth.py          # JWT authentication
│   ├── models.py        # Pydantic models
│   ├── workflow.py      # Business logic
│   ├── redis_manager.py # Redis session management
│   ├── ai_model.py      # AI model integration
│   ├── websocket_manager.py
│   └── requirements.txt
├── frontend-mvp/        # Next.js frontend
│   ├── app/
│   ├── package.json
│   └── README.md
└── run_server.py        # Server launcher script
```

---

## Backend Setup Guide

### Prerequisites

- **Python 3.8+**
- **Redis** (running on localhost:6379)
- **MongoDB** (running on localhost:27017)

### 1. Install Dependencies

```bash
cd backend-mvp
pip install -r requirements.txt
```

**Key Dependencies:**

- fastapi==0.104.1
- uvicorn[standard]==0.24.0
- redis==5.0.1
- pymongo==4.15.1
- python-jose[cryptography]==3.3.0
- passlib[bcrypt]==1.7.4
- websockets==12.0

### 2. Configure Environment Variables

Create a `.env` file in the `backend-mvp` directory:

```bash
# JWT Configuration
JWT_SECRET_KEY=your-very-secure-secret-key-change-this-in-production

# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017/
DATABASE_NAME=mydatabase
```

### 3. Start Required Services

**Start Redis:**

```bash
# On macOS with Homebrew
brew services start redis

# On Ubuntu/Debian
sudo systemctl start redis

# Or run directly
redis-server
```

**Start MongoDB:**

```bash
# On macOS with Homebrew
brew services start mongodb-community

# On Ubuntu/Debian
sudo systemctl start mongod

# Or run directly
mongod --dbpath /path/to/data
```

### 4. Create Test User

```bash
cd backend-mvp
python create_test_user.py
```

This creates a user with:

- Username: `testuser`
- Password: `testpassword123`
- Email: `test@example.com`

### 5. Start the Backend Server

**Option 1: From project root**

```bash
python run_server.py
```

**Option 2: From backend directory**

```bash
cd backend-mvp
python main.py
```

**Option 3: Using uvicorn directly**

```bash
cd backend-mvp
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: **http://localhost:8000**

### Backend Endpoints

- `POST /login` - Authenticate and get JWT token
- `POST /parse-prompt` - Parse hiring prompts (protected)
- `GET /session/{session_id}/status` - Get session status
- `GET /health` - Health check
- `WS /session/{session_id}` - WebSocket connection for real-time updates

---

## Frontend Setup Guide

### Prerequisites

- **Node.js 18+**
- **npm, yarn, pnpm, or bun**

### 1. Install Dependencies

```bash
cd frontend-mvp
npm install
# or
yarn install
# or
pnpm install
```

**Key Dependencies:**

- next 15.5.3
- react 19.1.0
- next-auth 4.24.11
- prisma 6.16.2

### 2. Start Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

The frontend will be available at: **http://localhost:3000**

### 3. Build for Production

```bash
npm run build
npm start
```

---

## Testing

### Test Backend API

```bash
cd backend-mvp

# Run full test suite (includes WebSocket)
python test_api.py

# Run synchronous tests only (no WebSocket)
python test_api.py --sync
```

### Test Authentication

```bash
# Test login endpoint
python test_login_api.py

# Or with curl
curl -X POST "http://localhost:8000/login" \
     -H "Content-Type: application/json" \
     -d '{"username": "testuser", "password": "testpassword123"}'
```

### Test Protected Endpoints

```bash
# First, get a token
TOKEN=$(curl -X POST "http://localhost:8000/login" \
     -H "Content-Type: application/json" \
     -d '{"username": "testuser", "password": "testpassword123"}' | jq -r '.access_token')

# Then use it to access protected endpoints
curl -X GET "http://localhost:8000/protected-endpoint" \
     -H "Authorization: Bearer $TOKEN"
```

---

## MongoDB Collections

### `users` Collection

Stores user accounts:

```json
{
  "username": "testuser",
  "email": "test@example.com",
  "hashed_password": "$2b$12$...",
  "created_at": "2024-01-01T00:00:00.000Z",
  "last_login": "2024-01-01T12:00:00.000Z"
}
```

### `incident-logs` Collection

Logs security incidents:

```json
{
  "username": "testuser",
  "ip_address": "127.0.0.1",
  "user_agent": "Mozilla/5.0...",
  "incident_type": "failed_login",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### `profiles` Collection

Stores user profiles for hiring workflow

---

## Security Features

- **JWT Authentication** with configurable expiration
- **Password Hashing** using bcrypt
- **Incident Logging** for failed login attempts
- **CORS Configuration** for frontend access
- **WebSocket Authentication** with JWT tokens

---

## Troubleshooting

### Common Issues

**1. Redis Connection Error**

```
❌ Failed to connect to Redis
```

**Solution:** Ensure Redis is running on localhost:6379

```bash
redis-cli ping  # Should return PONG
```

**2. MongoDB Connection Error**
**Solution:** Ensure MongoDB is running on localhost:27017

```bash
mongosh  # Should connect successfully
```

**3. Port Already in Use**
**Solution:** Kill the process using port 8000 or 3000

```bash
# Find and kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or change the port
uvicorn main:app --port 8001
```

**4. Module Import Errors**
**Solution:** Ensure all dependencies are installed

```bash
pip install -r requirements.txt
```

---

## Production Considerations

1. **Change JWT Secret** - Use a strong, randomly generated key
2. **Enable HTTPS** - Always use HTTPS in production
3. **Rate Limiting** - Implement rate limiting for API endpoints
4. **Database Security** - Secure MongoDB with authentication
5. **Environment Variables** - Never commit secrets to version control
6. **Monitoring** - Set up logging and monitoring for incidents
7. **Token Expiration** - Configure appropriate token expiration times

---

## Development Workflow

1. Start Redis and MongoDB
2. Start backend server: `python run_server.py`
3. In a new terminal, start frontend: `cd frontend-mvp && npm run dev`
4. Access the application at http://localhost:3000
5. API documentation at http://localhost:8000/docs

---

## Additional Resources

- **Backend Documentation:** See `backend-mvp/AUTH_SETUP.md`
- **JWT Implementation:** See `backend-mvp/JWT_IMPLEMENTATION_SUMMARY.md`
- **API Testing:** Use `backend-mvp/test_api.py`

For more information, check the individual README files in each directory.
