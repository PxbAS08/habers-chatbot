const db = require("../config/database");

async function getEvaluadosByUser(evaluadorUser) {
  const [rows] = await db.query(
    `SELECT evaluado, tipo, nombre, puesto
     FROM evaluados
     WHERE user = ?
     ORDER BY nombre ASC`,
    [evaluadorUser]
  );

  return rows;
}

module.exports = { getEvaluadosByUser };