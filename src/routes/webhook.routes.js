const router = require("express").Router();
const {
  verifyWebhook,
  receiveWebhook,
  handleWebhookSim,
} = require("../controllers/webhook.controller");

// ✅ Verificación de Meta
router.get("/", verifyWebhook);

// ✅ Recepción real de mensajes de Meta
router.post("/", receiveWebhook);

// ✅ Simulación local con Postman
router.post("/sim", handleWebhookSim);

module.exports = router;