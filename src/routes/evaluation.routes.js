const router = require("express").Router();
const { loginByNoemp } = require("../services/auth.service");
const { getEvaluadosByUser } = require("../services/evaluados.service");
const { saveEvaluacionDesempeno } = require("../services/evaluation.save.service");

// Test route
router.get("/ping", (req, res) => {
  res.json({ ok: true, message: "evaluation routes alive" });
});

// Login por número de empleado
router.post("/login", async (req, res) => {
  try {
    const { noemp } = req.body;

    if (!noemp) {
      return res.status(400).json({ error: "Noemp es requerido" });
    }

    const user = await loginByNoemp(noemp);

    if (!user) {
      return res.status(404).json({ error: "Empleado no encontrado" });
    }

    res.json({ ok: true, user });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Listar evaluados de un evaluador
router.get("/evaluados/:user", async (req, res) => {
  try {
    const { user } = req.params;
    const extraoficial =
      req.query.extraoficial === "1"
        ? true
        : req.query.extraoficial === "0"
          ? false
          : null;

    const evaluados = await getEvaluadosByUser(user, { extraoficial });

    res.json({ ok: true, count: evaluados.length, evaluados });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Guardar evaluación (ya completa)
router.post("/guardar", async (req, res) => {
  try {
    const {
      evaluador_user,
      evaluado_noemp,
      tipo,
      tipo_eval,
      respuestas,
      comentario
    } = req.body;

    const saved = await saveEvaluacionDesempeno({
      evaluador_user,
      evaluado_noemp,
      tipo,
      tipo_eval,
      respuestas,
      comentario
    });

    res.json({ ok: true, saved });
  } catch (error) {
    console.error(error);
    res.status(400).json({ ok: false, error: error.message });
  }
});

module.exports = router;
