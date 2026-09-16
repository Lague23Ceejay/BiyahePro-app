# File path in project: biyahepro-customer-mobile/Dockerfile
# Runs the Expo/Metro dev server in a container. The source directory is
# bind-mounted in docker-compose.yml (not baked in), so this image only
# needs node_modules installed — live edits on the host are picked up the
# same way they would running `npx expo start` natively.
FROM node:20-bullseye
WORKDIR /app

RUN apt-get update && apt-get install -y \
    libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

EXPOSE 8081

CMD ["npx", "expo", "start", "--host", "lan"]