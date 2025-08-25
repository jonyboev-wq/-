const express = require("express");
const multer = require("multer");

const app = express();
const port = 3001;

const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } }); // 100 MB limit

// POST /api/convert
app.post("/api/convert", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Файл не загружен" });
  }

  if (!req.file.originalname.endsWith(".dwg")) {
    return res.status(400).json({ error: "Допустимы только .dwg файлы" });
  }

  // заглушка — вместо реальной конвертации
  return res.json({ status: "ok", message: "Файл принят, конвертация в STL не реализована" });
});

// GET /api/status
app.get("/api/status", (req, res) => {
  res.json({ status: "running" });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
