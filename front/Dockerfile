# --- Этап сборки: CRA -> статика ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# REACT_APP_API_URL берётся из front/.env (CRA читает .env при сборке и вшивает
# значение в бандл). Бэк и фронт на разных хостах, поэтому там полный внешний
# URL API (напр. https://api.example.com). Меняется в front/.env -> пересборка.
RUN npm run build

# --- Этап раздачи: лёгкий статик-сервер (без nginx) ---
FROM node:20-alpine AS runtime

WORKDIR /app
RUN npm install -g serve

COPY --from=build /app/build ./build

EXPOSE 3000

# -s: SPA-режим (любой путь -> index.html для BrowserRouter)
CMD ["serve", "-s", "build", "-l", "3000"]
