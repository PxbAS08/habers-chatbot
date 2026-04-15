const router = require("express").Router();
const {
  viewReportes,
  exportExcel,
  exportExcelGraficas,
  viewDetalle,
} = require("../controllers/reportes.controller");
const {
  changeEvaluadoStatus,
  changeEvaluadorStatus,
  saveEvaluado,
  saveEvaluador,
  viewEvaluados,
  viewEvaluadores,
} = require("../controllers/panel.controller");

function requireAuth(req, res, next) {
  if (!req.session || !req.session.rhUser) {
    return res.redirect("/login");
  }
  next();
}

router.get("/", requireAuth, viewReportes);
router.get("/evaluadores", requireAuth, viewEvaluadores);
router.post("/evaluadores/guardar", requireAuth, saveEvaluador);
router.post("/evaluadores/estado", requireAuth, changeEvaluadorStatus);
router.get("/evaluados", requireAuth, viewEvaluados);
router.post("/evaluados/guardar", requireAuth, saveEvaluado);
router.post("/evaluados/estado", requireAuth, changeEvaluadoStatus);
router.get("/excel", requireAuth, exportExcel);
router.get("/excel-graficas", requireAuth, exportExcelGraficas);
router.get("/detalle/:id", requireAuth, viewDetalle);

module.exports = router;
