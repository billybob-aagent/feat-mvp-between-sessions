FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 4000
# Run DB migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
