const db = require("../config/database");

const PROM_EXPR = `
  ROUND((
    re1+re2+re3+re4+re5+re6+re7+re8+re9+
    re10+re11+re12+re13+re14+re15+re16+re17+re18
  ) / 18, 2)
`;

async function getEvaluaciones(params = {}) {
  const { periodo, anio, tipo_eval, busqueda, evaluador, area, puesto } = params;

  const where = [];
  const values = [];

  if (periodo) {
    where.push("r.periodo = ?");
    values.push(periodo);
  }

  if (anio) {
    where.push("r.anio = ?");
    values.push(Number(anio));
  }

  if (tipo_eval) {
    where.push("r.tipo_eval = ?");
    values.push(tipo_eval);
  }

  if (busqueda) {
    where.push(`(
      COALESCE(r.evaluado, '') LIKE ?
      OR COALESCE(ue.Nombre, ev.nombre, '') LIKE ?
    )`);
    values.push(`%${busqueda}%`, `%${busqueda}%`);
  }

  if (evaluador) {
    where.push(`(
      COALESCE(uu.Nombre, r.user, '') LIKE ?
      OR COALESCE(r.user, '') LIKE ?
    )`);
    values.push(`%${evaluador}%`, `%${evaluador}%`);
  }

  if (area) {
    where.push(`COALESCE(ue.Area, ev.area, '') LIKE ?`);
    values.push(`%${area}%`);
  }

  if (puesto) {
    where.push(`COALESCE(ue.Puesto, ev.puesto, '') LIKE ?`);
    values.push(`%${puesto}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      r.id,
      r.fecha,
      r.periodo,
      r.anio,
      r.tipo_eval,
      r.evaluado,
      r.user AS evaluador_user,
      
      r.re1, r.re2, r.re3, r.re4, r.re5, r.re6, 
      r.re7, r.re8, r.re9, r.re10, r.re11, r.re12, 
      r.re13, r.re14, r.re15, r.re16, r.re17, r.re18,
      
      ${PROM_EXPR} AS promedio,
      r.re19 AS comentario,

      COALESCE(ue.Nombre, ev.nombre) AS evaluado_nombre,
      COALESCE(ue.Puesto, ev.puesto) AS evaluado_puesto,
      COALESCE(ue.Area, ev.area, '') AS evaluado_area,

      uu.Nombre AS evaluador_nombre,
      uu.Puesto AS evaluador_puesto,
      uu.Area AS evaluador_area

    FROM resultadosdesempeno r
    LEFT JOIN users ue
      ON CAST(ue.Noemp AS CHAR) = r.evaluado
    LEFT JOIN evaluados ev
      ON ev.evaluado = r.evaluado AND ev.user = r.user
    LEFT JOIN users uu
      ON uu.user = r.user

    ${whereSql}
    ORDER BY r.id DESC
  `;

  const [rows] = await db.query(sql, values);
  return rows;
}

async function getEvaluacionDetalle(id) {
  const sql = `
    SELECT
        r.*,

        COALESCE(ue.Nombre, ev.nombre) AS evaluado_nombre,
      COALESCE(ue.Puesto, ev.puesto) AS evaluado_puesto,
      COALESCE(ue.Area, ev.area, '') AS evaluado_area,

        uu.Nombre AS evaluador_nombre,
        uu.Puesto AS evaluador_puesto,
        uu.Area AS evaluador_area

    FROM resultadosdesempeno r
    LEFT JOIN users ue
        ON CAST(ue.Noemp AS CHAR) = r.evaluado
    LEFT JOIN evaluados ev
        ON ev.evaluado = r.evaluado AND ev.user = r.user
    LEFT JOIN users uu
        ON uu.user = r.user
    WHERE r.id = ?
    LIMIT 1
    `;

  const [rows] = await db.query(sql, [Number(id)]);
  return rows[0] || null;
}

module.exports = {
  getEvaluaciones,
  getEvaluacionDetalle,
};
