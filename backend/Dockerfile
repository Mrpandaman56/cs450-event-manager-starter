
FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Copy dependency files first for Docker layer caching
COPY package*.json ./

# Install the exact dependency versions
RUN npm ci

# Copy backend source code
COPY . .

# Generate Prisma Client and compile TypeScript
RUN npx prisma generate && npm run build

EXPOSE 4001 4002 4003

# Start the API gateway
CMD ["npm", "run", "start"]
