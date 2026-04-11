const router = require("express").Router();
const {
  viewReportes,
  exportExcel,
  exportExcelGraficas,
  viewDetalle,
} = require("../controllers/reportes.controller");

function requireAuth(req, res, next) {
  if (!req.session || !req.session.rhUser) {
    return res.redirect("/login");
  }
  next();
}

router.get("/", requireAuth, viewReportes);
router.get("/excel", requireAuth, exportExcel);
router.get("/excel-graficas", requireAuth, exportExcelGraficas);
router.get("/detalle/:id", requireAuth, viewDetalle);

module.exports = router;