module.exports = {
  apps: [
    {
      name: "neuraleap-backend",
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
        JWT_SECRET_KEY:
          "5035de59e0a6124ae6055c18d5d32044142c5f66758588a275ea24bf8d75de73",

        // AI Configuration
        OPENROUTER_API_KEY:
          "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",
        AI_MODEL_NAME: "anthropic/claude-sonnet-4.5",

        // External APIs
        BRIGHTDATA_API_TOKEN:
          "10df4c06094433d9ca565f3042b0b5a89f250bdb5b8800f846f79a29b302a88d",
        HATCH_API_KEY:
          "U2FsdGVkX1_FkKFPqEPvJAIAoPR2GG16d2SrzUzYd_csurd-xQQE6gLQyBsXlQLNgxRa697052l6S9roDb4g6A",

        // MongoDB - Main Database
        MONGODB_URL:
          "mongodb://profiles_app:Neuraleap123@localhost:27017/neuraleap?authSource=profiles_production",
        DATABASE_NAME: "neuraleap",

        // MongoDB - Profiles Database (56M candidates)
        PROFILES_DB_URL:
          "mongodb://profiles_app:Neuraleap123@localhost:27017/profiles_production?authSource=profiles_production",
        PROFILES_DB_NAME: "profiles_production",

        // Redis Configuration
        REDIS_HOST: "localhost",
        REDIS_PORT: "6379",
        REDIS_DB: "0",
        REDIS_PASSWORD: "",
        ALLOWED_ORIGINS:
          "https://neuraleap.shop,https://www.neuraleap.shop,http://localhost:3000",

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
      name: "neuraleap-frontend",
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
        NEXT_PUBLIC_API_BASE_URL: "https://neuraleap.shop",
        NEXT_PUBLIC_WS_BASE_URL: "wss://neuraleap.shop",
      },
      error_file: "/root/hire-X/frontend-mvp/logs/pm2-error.log",
      out_file: "/root/hire-X/frontend-mvp/logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true,
    },
  ],
};
