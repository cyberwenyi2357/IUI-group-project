FROM node:20.18-alpine

WORKDIR /usr/src/app

COPY . .

RUN npm install

EXPOSE 5001

ENTRYPOINT ["npm", "run", "dep"]
