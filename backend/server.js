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
const authRoutes = require("./src/routes/auth.routes");
const smartImporterRoutes = require("./src/routes/smart-importer.routes");
const errorHandler = require("./src/middleware/error.middleware");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4200";
const uploadsPath = path.resolve("uploads");

fs.mkdirSync(path.join(uploadsPath, "books"), { recursive: true });
fs.mkdirSync(path.join(uploadsPath, "covers"), { recursive: true });
fs.mkdirSync(path.join(uploadsPath, "avatars"), { recursive: true });

app.use(cors({
  origin: frontendUrl,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Viewer-Id"],
  credentials: true
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, crossOriginEmbedderPolicy: false }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("dev"));

app.use("/uploads", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", frontendUrl);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Viewer-Id");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
}, express.static(uploadsPath, { setHeaders: (res, filePath) => {
  if (filePath.toLowerCase().endsWith(".pdf")) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
} }));

app.get("/", (req, res) => res.json({ name: "Electronic Library API", version: "1.0.0", status: "online" }));
app.get("/api/health", (req, res) => res.json({ status: "ok", service: "Electronic Library Backend", timestamp: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/authors", authorRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/smart-importer", smartImporterRoutes);

app.use((req, res) => res.status(404).json({ message: "API endpoint not found." }));
app.use(errorHandler);

async function startServer() {
  await connectDatabase();
  app.listen(PORT, () => {
    console.log("==================================================");
    console.log(" ELECTRONIC LIBRARY BACKEND");
    console.log(` Server: http://localhost:${PORT}`);
    console.log(` API: http://localhost:${PORT}/api`);
    console.log("==================================================");
  });
}

startServer();
