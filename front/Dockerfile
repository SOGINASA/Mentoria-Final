# --- Этап сборки: CRA -> статика ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Адрес публичного HTTPS API бэка. CRA читает REACT_APP_* в build-time и
# вшивает значение в бандл. Бэк и фронт стоят на разных хостах, поэтому это
# полный внешний URL (напр. https://api.example.com), а не localhost.
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# --- Этап раздачи: лёгкий статик-сервер (без nginx) ---
FROM node:20-alpine AS runtime

WORKDIR /app
RUN npm install -g serve

COPY --from=build /app/build ./build

EXPOSE 3000

# -s: SPA-режим (любой путь -> index.html для BrowserRouter)
CMD ["serve", "-s", "build", "-l", "3000"]
