FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite build vaqtida env o'qiydi, shuning uchun ular ARG sifatida keladi.
ARG VITE_API_URL=/api
ARG VITE_BOT_USERNAME=elistening_bot
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BOT_USERNAME=$VITE_BOT_USERNAME

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
