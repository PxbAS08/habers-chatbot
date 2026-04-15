// src/app.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static("src/public"));
app.use(session({
  secret: "habers_panel_secret_2026",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

const reportesRoutes = require("./routes/reportes.routes");
const webhookRoutes = require("./routes/webhook.routes");
const evaluationRoutes = require("./routes/evaluation.routes");
const authRoutes = require("./routes/auth.routes");
const { ensureDatabaseSchema } = require("./services/schema.service");

app.get("/health", (req, res) =>
  res.json({ ok: true, service: "habers-chatbot" })
);

app.use("/webhook", webhookRoutes);
app.use("/api/evaluation", evaluationRoutes);
app.use("/reportes", reportesRoutes);
app.use("/", authRoutes);

const PORT = process.env.PORT || 3000;

async function startServer() {
  await ensureDatabaseSchema();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer().catch((error) => {
  console.error("No se pudo iniciar la aplicacion:", error);
  process.exit(1);
});
