FROM node:20-alpine

RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate && npm run build

EXPOSE 4001 4002 4003

CMD ["npm", "run", "start"]
