
FROM node:25-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

CMD [ "node", "index.js" ]