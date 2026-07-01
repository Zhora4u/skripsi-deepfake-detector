FROM python:3.11-slim

# Install Node.js 20 + system deps (OpenCV, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- Python / Flask ---
WORKDIR /app/flask_api
COPY flask_api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY flask_api/xception_final.keras .
COPY flask_api/app.py .

# --- Node / Next.js ---
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_FLASK_API_URL=/api
ENV NEXT_PUBLIC_FLASK_API_URL=$NEXT_PUBLIC_FLASK_API_URL
RUN npm run build
RUN npm prune --production

# Startup script: Flask backend + Next.js frontend
RUN printf '#!/bin/sh\n\
cd /app/flask_api && gunicorn --bind 0.0.0.0:5001 --workers 1 --timeout 120 app:app &\n\
cd /app && npx next start -p 3000\n' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 3000 5001
CMD ["/app/start.sh"]
