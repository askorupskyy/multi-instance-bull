FROM node:20-alpine3.19

WORKDIR /app

COPY . .

RUN npm install
RUN npm run build

CMD ["node", "dist/app-worker/main.js"]
