# Use official Bun image
FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy the rest of the project
COPY . .

# Build Vite project (optimized production build)
RUN bun run build

# Expose a custom port (change 5173 if you want)
EXPOSE 5173

# Start Vite preview server for production
CMD ["bun", "run", "preview", "--port", "5173", "--host"]
