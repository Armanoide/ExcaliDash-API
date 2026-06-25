FROM node:20.19-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Install TypeScript for build
RUN npm install -D typescript ts-node

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Clean up dev dependencies (keep src for tests)
RUN npm install --omit=dev

EXPOSE 3000

CMD ["node", "dist/index.js"]
