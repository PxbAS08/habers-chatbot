// src/app.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");

const app = express();                // primero creas app
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static("src/public"));
app.use(session({
  secret: "habers_panel_secret_2026",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // en local false; en producción con https lo cambiamos
    maxAge: 1000 * 60 * 60 * 8 // 8 horas
  }
}));

const reportesRoutes = require("./routes/reportes.routes");
const webhookRoutes = require("./routes/webhook.routes");
const evaluationRoutes = require("./routes/evaluation.routes");
const authRoutes = require("./routes/auth.routes");

// Health
app.get("/health", (req, res) =>
  res.json({ ok: true, service: "habers-chatbot" })
);

// Routes
app.use("/webhook", webhookRoutes);   // ahora sí se usa app
app.use("/api/evaluation", evaluationRoutes);
app.use("/reportes", reportesRoutes);
app.use("/", authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));