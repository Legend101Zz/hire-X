# Environment Variables Setup

This document describes the environment variable configuration for the frontend application.

## Overview

The frontend now uses environment variables to configure backend API URLs instead of hardcoded values. This makes it easier to switch between development, staging, and production environments.

## Files Created

### `.env.local` (gitignored)
Local environment configuration file with actual values. This file is gitignored and should never be committed to version control.

### `.env.example` (committed to repo)
Template file showing required environment variables. This file should be committed to help other developers set up their local environment.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | HTTP API base URL (without trailing slash) | `http://localhost:8000` |
| `NEXT_PUBLIC_WS_BASE_URL` | WebSocket base URL (without trailing slash) | `ws://localhost:8000` |

**Note:** The `NEXT_PUBLIC_` prefix is required for Next.js to make these variables accessible in the browser.

## Files Updated

The following files were updated to use environment variables:

1. **`src/utils/api.ts`**
   - Updated `API_BASE_URL` to use `process.env.NEXT_PUBLIC_API_BASE_URL`

2. **`src/contexts/AuthContext.tsx`**
   - Updated login endpoint to use `process.env.NEXT_PUBLIC_API_BASE_URL`

3. **`src/components/ui/sidebar.tsx`**
   - Updated prompt history endpoint to use `process.env.NEXT_PUBLIC_API_BASE_URL`

4. **`src/components/ui/prompt.tsx`**
   - Updated WebSocket connection to use `process.env.NEXT_PUBLIC_WS_BASE_URL`

5. **`src/app/results/[sessionId]/page.tsx`**
   - Updated WebSocket connection to use `process.env.NEXT_PUBLIC_WS_BASE_URL`

6. **`.gitignore`**
   - Added `!.env.example` to allow committing the example file while keeping `.env.local` gitignored

7. **`README.md`**
   - Added environment setup instructions

## Setup Instructions

### For New Developers

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` with the correct backend URLs for your environment:
   ```bash
   # For local development
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
   NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8000
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### For Different Environments

#### Local Development
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8000
```

#### Staging
```bash
NEXT_PUBLIC_API_BASE_URL=https://api-staging.yourapp.com
NEXT_PUBLIC_WS_BASE_URL=wss://api-staging.yourapp.com
```

#### Production
```bash
NEXT_PUBLIC_API_BASE_URL=https://api.yourapp.com
NEXT_PUBLIC_WS_BASE_URL=wss://api.yourapp.com
```

## Deployment

### Vercel
Add environment variables in the Vercel dashboard under Project Settings → Environment Variables.

### Other Platforms
Consult your deployment platform's documentation for setting environment variables.

## Fallback Behavior

All environment variables have fallback values to `localhost:8000` if not set. This ensures the app will work in development even if the `.env.local` file is missing, though it's recommended to always configure it properly.

## Security Notes

- Never commit `.env.local` to version control
- The `NEXT_PUBLIC_` prefix means these variables are exposed to the browser
- Do not put sensitive secrets in `NEXT_PUBLIC_*` variables
- Always use HTTPS (https://) and WSS (wss://) URLs in production

## Troubleshooting

### Environment variables not updating
1. Restart the Next.js development server
2. Clear `.next` build cache: `rm -rf .next`
3. Verify `.env.local` exists and has correct values

### WebSocket connection fails
1. Check that `NEXT_PUBLIC_WS_BASE_URL` uses `ws://` for HTTP and `wss://` for HTTPS
2. Verify the backend WebSocket server is running
3. Check for CORS issues in the browser console
