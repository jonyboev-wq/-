# Упрощенный пример
FROM node:18

WORKDIR /app

# backend
COPY backend ./backend
WORKDIR /app/backend
RUN npm install

EXPOSE 3001
CMD ["npm", "start"]
