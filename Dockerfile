# Multi-stage build for production deployment
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Frontend build-time env vars (passed via build args)
ARG REACT_APP_API_URL
ARG REACT_APP_SOCKET_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_SOCKET_URL=${REACT_APP_SOCKET_URL}

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm run install-all

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/

# Install only production dependencies
WORKDIR /app/backend
RUN npm install --production

# Copy backend source code
COPY backend/ ./

# Copy frontend build from builder stage (relative to backend directory)
COPY --from=builder /app/frontend/build ../frontend/build

# Expose port
EXPOSE 5001

# Set environment to production
ENV NODE_ENV=production

# Start server
CMD ["node", "server.js"]
