require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const connectDatabase = require("./src/config/database");
const bookRoutes = require("./src/routes/book.routes");
const authorRoutes = require("./src/routes/author.routes");
const categoryRoutes = require("./src/routes/category.routes");
const errorHandler = require("./src/middleware/error.middleware");

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4200";

const uploadsPath = path.resolve("uploads");

fs.mkdirSync(path.join(uploadsPath, "books"), { recursive: true });
fs.mkdirSync(path.join(uploadsPath, "covers"), { recursive: true });

// ============================================================
// SECURITY & CORS
// ============================================================

// 1. إعداد CORS العام للـ API
app.use(
  cors({
    origin: frontendUrl,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

// 2. إعداد Helmet مع السماح بالروابط المتقاطعة للموارد (Resource Policy)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// ============================================================
// BODY
// ============================================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============================================================
// LOGGING
// ============================================================

app.use(morgan("dev"));

// ============================================================
// STATIC FILES WITH CORS HEADERS
// ============================================================

// إضافة Middleware مخصص لتمرير ترويسات CORS قبل خدمة مجلد المرفقات
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", frontendUrl);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  },
  express.static(uploadsPath, {
    setHeaders: (res, filePath) => {
      if (filePath.toLowerCase().endsWith(".pdf")) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
        res.setHeader("X-Content-Type-Options", "nosniff");
      }
    }
  })
);

// ============================================================
// HEALTH
// ============================================================

app.get("/", (req, res) => {
  res.json({
    name: "Electronic Library API",
    version: "1.0.0",
    status: "online"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Electronic Library Backend",
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// API
// ============================================================

app.use("/api/books", bookRoutes);
app.use("/api/authors", authorRoutes);
app.use("/api/categories", categoryRoutes);

// ============================================================
// 404
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    message: "API endpoint not found."
  });
});

// ============================================================
// ERROR
// ============================================================

app.use(errorHandler);

// ============================================================
// START
// ============================================================

async function startServer() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log("");
    console.log("==================================================");
    console.log(" ELECTRONIC LIBRARY BACKEND");
    console.log("==================================================");
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
    console.log(`Uploads: http://localhost:${PORT}/uploads`);
    console.log("==================================================");
    console.log("");
  });
}

startServer();