# Stage 1: Build the Vite production bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root & frontend package files to support npm workspaces
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install only production/build dependencies
RUN npm ci --workspace=frontend --legacy-peer-deps || npm install --workspace=frontend

COPY frontend/ ./frontend/

WORKDIR /app/frontend
RUN npm run build

# Stage 2: Serve with ultra-lightweight Nginx (< 25MB RAM usage)
FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O - http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
