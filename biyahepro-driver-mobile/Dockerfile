# Runs the Expo/Metro development server in Docker. Source files are bind
# mounted by docker-compose.yml so edits on the host are picked up directly.
FROM node:20-bookworm
WORKDIR /app

RUN apt-get update && apt-get install -y \
    libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8082

CMD ["npx", "expo", "start", "--host", "lan", "--port", "8082"]