require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const checkRoutes = require("./routes/check");

function createApp(routes = checkRoutes) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
  app.use(express.json({ limit: "20kb" }));

  app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }));

  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", message: "MailSure API is running" });
  });
  app.use("/api/check", routes);
  app.use("/api", (req, res) => res.status(404).json({ error: "API endpoint not found" }));

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON request body" });
    }
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body is too large" });
    }
    console.error("Request error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  });
  return app;
}

const app = createApp();
if (require.main === module) {
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => console.log(`MailSure API running at http://localhost:${port}`));
}

module.exports = app;
module.exports.createApp = createApp;
