# Authentication Setup Guide

This guide explains how to set up and use the authentication system for the Neuraleap API.

## Overview

The authentication system includes:
- JWT token-based authentication
- Password hashing using bcrypt
- MongoDB integration for user storage
- Incident logging for security monitoring
- Login endpoint at `/login`

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```bash
# JWT Configuration
JWT_SECRET_KEY=your-very-secure-secret-key-change-this-in-production

# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017/
DATABASE_NAME=mydatabase
```

## Installation

1. Install the required dependencies:
```bash
pip install -r requirements.txt
```

2. Make sure MongoDB is running on your system.

## Database Collections

The system uses two MongoDB collections:

### `users` Collection
Stores user account information:
```json
{
  "_id": ObjectId("..."),
  "username": "testuser",
  "email": "test@example.com",
  "hashed_password": "$2b$12$...",
  "created_at": "2024-01-01T00:00:00.000Z",
  "last_login": "2024-01-01T12:00:00.000Z"
}
```

### `incident-logs` Collection
Stores security incidents:
```json
{
  "_id": ObjectId("..."),
  "username": "testuser",
  "ip_address": "127.0.0.1",
  "user_agent": "Mozilla/5.0...",
  "incident_type": "failed_login",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "details": "Invalid username or password"
}
```

## API Endpoints

### POST /login

Authenticate a user and return a JWT token.

**Request Body:**
```json
{
  "username": "testuser",
  "password": "testpassword123"
}
```

**Success Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user_id": "testuser",
  "username": "testuser"
}
```

**Error Response (401):**
```json
{
  "detail": "Invalid username or password"
}
```

## Testing

### 1. Create a Test User

Run the test user creation script:
```bash
python create_test_user.py
```

This will create a user with:
- Username: `testuser`
- Password: `testpassword123`
- Email: `test@example.com`

### 2. Test the Login API

Start your FastAPI server:
```bash
uvicorn main:app --reload
```

Then run the test script:
```bash
python test_login_api.py
```

### 3. Manual Testing with curl

Test successful login:
```bash
curl -X POST "http://localhost:8000/login" \
     -H "Content-Type: application/json" \
     -d '{"username": "testuser", "password": "testpassword123"}'
```

Test failed login:
```bash
curl -X POST "http://localhost:8000/login" \
     -H "Content-Type: application/json" \
     -d '{"username": "testuser", "password": "wrongpassword"}'
```

## Security Features

1. **Password Hashing**: All passwords are hashed using bcrypt before storage
2. **JWT Tokens**: Secure token-based authentication with configurable expiration
3. **Incident Logging**: All failed login attempts are logged with IP address and user agent
4. **Input Validation**: All inputs are validated using Pydantic models
5. **Error Handling**: Comprehensive error handling with appropriate HTTP status codes

## JWT Token Usage

Once you receive a JWT token, include it in the Authorization header for protected endpoints:

```bash
curl -X GET "http://localhost:8000/protected-endpoint" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Incident Monitoring

Monitor security incidents by querying the `incident-logs` collection:

```javascript
// Find all failed login attempts
db.getCollection('incident-logs').find({"incident_type": "failed_login"})

// Find incidents for a specific user
db.getCollection('incident-logs').find({"username": "testuser"})

// Find recent incidents
db.getCollection('incident-logs').find().sort({"timestamp": -1}).limit(10)
```

## Production Considerations

1. **Change JWT Secret**: Use a strong, randomly generated secret key
2. **Use HTTPS**: Always use HTTPS in production
3. **Rate Limiting**: Implement rate limiting for login attempts
4. **Database Security**: Secure your MongoDB instance
5. **Environment Variables**: Never commit secrets to version control
6. **Token Expiration**: Consider shorter token expiration times for production
7. **Monitoring**: Set up alerts for unusual login patterns

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**: Ensure MongoDB is running and accessible
2. **JWT Secret Error**: Make sure JWT_SECRET_KEY is set in environment variables
3. **Import Errors**: Ensure all dependencies are installed with `pip install -r requirements.txt`
4. **Port Conflicts**: Make sure port 8000 is available for the FastAPI server

### Debug Mode

Enable debug logging by setting the log level in your FastAPI application.
