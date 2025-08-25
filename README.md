# DWG → STL Web Service

Минимальное монорепо:

- **Backend:** Node.js + Express
- **Frontend:** React
- **API:**
  - POST `/api/convert` — принимает `.dwg`
  - GET `/api/status` — проверка сервиса

## Запуск локально

### Backend
```bash
cd backend
npm install
npm start
```
Откроется на `http://localhost:3001`.

### Frontend
```bash
cd frontend
npm install
npm start
```
Откроется на `http://localhost:3000`.
