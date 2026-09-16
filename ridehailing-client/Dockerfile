# File path in project: ridehailing-client/Dockerfile
# Dev-mode container: runs the Vite dev server with hot reload, matching
# the local `npm run dev` workflow rather than a production nginx build —
# useful while you're actively iterating on the admin panel.
FROM node:20-alpine
WORKDIR /app

# Installed first, separately, so `docker compose build` only re-runs
# npm install when package.json actually changes, not on every source edit
# (source itself is bind-mounted in docker-compose.yml, not baked into
# the image, so edits on the host are picked up live without a rebuild).
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# --host 0.0.0.0 is required — Vite's dev server binds to localhost only
# by default, which would be unreachable from outside the container even
# with the port published.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]