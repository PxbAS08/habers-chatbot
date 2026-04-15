// src/services/detalle.service.js
const db = require("../config/database");

async function getDetalleById(id) {
  const sql = `
    SELECT
      r.id,
      r.fecha,
      r.tipo_eval,
      r.periodo,
      r.anio,
      r.user AS evaluador_user,
      r.evaluado AS evaluado_noemp,
      r.tipo,
      r.re1, r.re2, r.re3, r.re4, r.re5, r.re6, r.re7, r.re8, r.re9,
      r.re10, r.re11, r.re12, r.re13, r.re14, r.re15, r.re16, r.re17, r.re18,
      r.re19 AS comentario,
      COALESCE(ue.Nombre, ev.nombre) AS evaluado_nombre,
      COALESCE(ue.Puesto, ev.puesto) AS evaluado_puesto,
      COALESCE(ue.Area, ev.area, '') AS evaluado_area,
      uu.Nombre AS evaluador_nombre,
      uu.Puesto AS evaluador_puesto,
      uu.Area   AS evaluador_area
    FROM resultadosdesempeno r
    LEFT JOIN users ue ON CAST(ue.Noemp AS CHAR) = r.evaluado
    LEFT JOIN evaluados ev ON ev.evaluado = r.evaluado AND ev.user = r.user
    LEFT JOIN users uu ON uu.user = r.user
    WHERE r.id = ?
    LIMIT 1
  `;

  const [rows] = await db.query(sql, [Number(id)]);
  return rows[0] || null;
}

module.exports = { getDetalleById };
