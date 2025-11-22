# --- Base image with Bun ---
FROM oven/bun:1 AS base

WORKDIR /app

# Copy package files first for better caching
COPY bun.lockb package*.json ./

# Install dependencies using Bun
RUN bun install

# Copy the rest of your project
COPY . .

# Vite default port
EXPOSE 5173

# Run Vite with bun dev
CMD ["bun", "dev", "--host"]
