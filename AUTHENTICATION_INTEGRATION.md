# JWT Authentication Integration

This document describes the JWT authentication integration between the frontend and backend of the NeuralLeap MVP application.

## Overview

The application now uses JWT (JSON Web Token) authentication to secure API endpoints and WebSocket connections. Users must log in to receive a JWT token, which is then used for all subsequent API calls.

## Backend Authentication

### Login Endpoint
- **URL**: `POST /login`
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "access_token": "string",
    "token_type": "bearer",
    "user_id": "string",
    "username": "string"
  }
  ```

### Protected Endpoints
All API endpoints (except `/login`, `/health`, and `/`) now require authentication via the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

### WebSocket Authentication
WebSocket connections are authenticated using query parameters:
```
ws://localhost:8000/session/{session_id}?token=<jwt_token>
```

## Frontend Authentication

### AuthContext
The `AuthContext` provides authentication state management:

```typescript
interface AuthContextType {
  isAuthenticated: boolean;
  user: { username: string } | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}
```

### Token Storage
- JWT tokens are stored in `localStorage`
- Tokens are automatically included in API requests
- Expired tokens trigger automatic logout and redirect to login page

### API Utility Functions
The `src/utils/api.ts` file provides utility functions for making authenticated API calls:

- `apiGet(endpoint, token)` - GET requests
- `apiPost(endpoint, data, token)` - POST requests
- `apiPut(endpoint, data, token)` - PUT requests
- `apiDelete(endpoint, token)` - DELETE requests
- `handleApiResponse(response, onAuthError)` - Handle responses and auth errors

## Security Features

### Token Validation
- JWT tokens are validated on every request
- Expired or invalid tokens return 401 Unauthorized
- Automatic logout on authentication failure

### Session Ownership
- Users can only access their own sessions
- WebSocket connections verify session ownership
- API endpoints check user permissions

### Error Handling
- Graceful handling of authentication errors
- Automatic redirect to login on token expiration
- Clear error messages for users

## Testing

Run the authentication integration test:

```bash
python test_auth_integration.py
```

This test verifies:
1. Login endpoint functionality
2. Authenticated API requests
3. Rejection of unauthenticated requests
4. Rejection of requests with invalid tokens

## Usage Examples

### Frontend Login
```typescript
const { login } = useAuth();

const handleLogin = async () => {
  const success = await login(username, password);
  if (success) {
    // User is now authenticated
    // Token is stored and will be used for API calls
  }
};
```

### Making API Calls
```typescript
import { apiPost, handleApiResponse } from '@/utils/api';

const { token, logout } = useAuth();

const makeApiCall = async () => {
  try {
    const response = await apiPost('/parse-prompt', { prompt }, token);
    const data = await handleApiResponse(response, () => {
      logout(); // Handle auth error
    });
    // Use data...
  } catch (error) {
    console.error('API call failed:', error);
  }
};
```

### WebSocket Connection
```typescript
const ws = new WebSocket(
  `ws://localhost:8000/session/${sessionId}?token=${encodeURIComponent(token)}`
);
```

## Configuration

### Backend
- JWT secret key: Set via `JWT_SECRET_KEY` environment variable
- Token expiration: 30 minutes (configurable in `auth.py`)
- Algorithm: HS256

### Frontend
- API base URL: `http://localhost:8000` (configurable in `src/utils/api.ts`)
- Token storage: localStorage
- Auto-logout on auth failure: enabled

## Security Considerations

1. **Token Storage**: Tokens are stored in localStorage. For production, consider using httpOnly cookies.
2. **HTTPS**: Use HTTPS in production to protect tokens in transit.
3. **Token Refresh**: Consider implementing token refresh for better UX.
4. **Rate Limiting**: Implement rate limiting on authentication endpoints.
5. **Session Management**: Consider implementing server-side session management.

## Troubleshooting

### Common Issues

1. **"No authentication token available"**
   - User is not logged in
   - Token was not stored properly
   - Solution: Check login flow and localStorage

2. **"Authentication expired"**
   - JWT token has expired (30 minutes)
   - Solution: User needs to log in again

3. **"Invalid or expired token"**
   - Token is malformed or expired
   - Solution: Clear localStorage and log in again

4. **WebSocket connection fails**
   - Token not included in query parameter
   - Solution: Ensure token is properly encoded in WebSocket URL

### Debug Mode
Enable debug logging in browser console to see authentication flow:
```javascript
localStorage.setItem('debug', 'true');
```

## Future Enhancements

1. **Token Refresh**: Implement automatic token refresh
2. **Remember Me**: Add "remember me" functionality with longer-lived tokens
3. **Multi-factor Authentication**: Add 2FA support
4. **Role-based Access**: Implement user roles and permissions
5. **Audit Logging**: Add authentication event logging
