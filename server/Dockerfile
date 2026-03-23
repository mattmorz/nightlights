# Use official Node.js image
FROM node:18-slim

# Set working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Start the server
CMD [ "node", "server.js" ]