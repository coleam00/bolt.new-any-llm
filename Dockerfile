# Use an official Node.js runtime as the base image
FROM node:20.15.1

# Set the working directory in the container
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.4.0

# Copy package.json and pnpm-lock.yaml (if available)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN pnpm run build

# Make sure bindings.sh is executable
RUN chmod +x bindings.sh

# Expose the port the app runs on (adjust if you specified a different port)
EXPOSE 3000

# Start the application
CMD ["pnpm", "run", "start"]