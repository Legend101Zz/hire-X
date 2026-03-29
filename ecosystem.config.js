module.exports = {
  // To run all the project using PM2
  apps: [
    {
      name: "Hire-X-backend",
      cwd: "/root/hire-X/backend-v2",
      script: "uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000 --workers 3",
      interpreter: "/root/hire-X/backend-v2/.venv/bin/python",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "2G",
      env: {
        // Python
        PYTHONPATH: "/root/hire-X/backend-v2",

        // Environment
        ENVIRONMENT: "production",

        // JWT & Security
        JWT_SECRET_KEY: "",

        // AI Configuration
        OPENROUTER_API_KEY: "",
        AI_MODEL_NAME: "anthropic/claude-sonnet-4.5",

        // External APIs
        BRIGHTDATA_API_TOKEN: "",
        HATCH_API_KEY: "",

        //Vapi Configuration
        VAPI_API_KEY: "",
        VAPI_PHONE_NUMBER_ID: "",

        //Webhook URL (server's public URL for vapi)
        WEBHOOK_BASE_URL: "https://Hire-X.shop",

        // Cartesia (used via Vapi, but needed for direct calls)
        CARTESIA_API_KEY: "",

        // Interview Storage
        INTERVIEW_RECORDINGS_PATH: "./interview_recordings",
        WEBHOOK_BASE_URL: "https://Hire-X.shop",

        // Gmail SMTP Configuration
        EMAIL_PROVIDER: "gmail",
        SMTP_HOST: "smtp.gmail.com",
        SMTP_PORT: "587",
        SMTP_USERNAME: "",
        SMTP_PASSWORD: "",
        SMTP_FROM_EMAIL: "",
        SMTP_FROM_NAME: "",
        SMTP_USE_TLS: "true",
        APP_BASE_URL: "https://app.Hire-X.shop",

        // MongoDB - Main Database
        MONGODB_URL:
          "mongodb://profiles_app:Hire-X123@localhost:27017/Hire-X?authSource=profiles_production",
        DATABASE_NAME: "Hire-X",

        // MongoDB - Profiles Database (56M candidates)
        PROFILES_DB_URL:
          "mongodb://profiles_app:Hire-X123@localhost:27017/profiles_production?authSource=profiles_production",
        PROFILES_DB_NAME: "profiles_production",

        // Redis Configuration
        REDIS_HOST: "localhost",
        REDIS_PORT: "6379",
        REDIS_DB: "0",
        REDIS_PASSWORD: "",
        ALLOWED_ORIGINS:
          "https://Hire-X.shop,https://www.Hire-X.shop,http://localhost:3000,https://app.Hire-X.shop",

        // Server Configuration
        HOST: "0.0.0.0",
        SERVER_PORT: "8000",

        // Performance Settings
        MAX_CANDIDATES: "50",
        SEARCH_LIMIT: "500",
        SCORER_WORKERS: "3", // 3 workers for 4-core system
        SCORING_BATCH_SIZE: "50",

        // Logging Configuration
        LOG_LEVEL: "INFO",
        LOG_TO_CONSOLE: "true",
        LOG_TO_FILE: "true",
        LOG_FILE: "logs/app.log",
        LOG_MAX_SIZE_MB: "10",
        LOG_BACKUP_COUNT: "5",
      },
      error_file: "/root/hire-X/backend-v2/logs/pm2-error.log",
      out_file: "/root/hire-X/backend-v2/logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true,
    },
    {
      name: "Hire-X-frontend",
      cwd: "/root/hire-X/frontend-mvp",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        NEXT_PUBLIC_API_BASE_URL: "https://Hire-X.shop",
        NEXT_PUBLIC_WS_BASE_URL: "wss://Hire-X.shop",
      },
      error_file: "/root/hire-X/frontend-mvp/logs/pm2-error.log",
      out_file: "/root/hire-X/frontend-mvp/logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true,
    },
  ],
};
