const db = require("../config/database");

function cleanLoginValue(value) {
  return String(value || "").trim();
}

async function loginByNoemp(noemp) {
  const login = cleanLoginValue(noemp);

  if (!login) {
    return null;
  }

  const [rows] = await db.query(
    `SELECT user, Noemp, Nombre, Puesto, Area, COALESCE(activo, 1) AS activo
     FROM users
     WHERE COALESCE(activo, 1) = 1
       AND (
         LOWER(user) = LOWER(?)
         OR CAST(Noemp AS CHAR) = ?
       )
     LIMIT 1`,
    [login, login]
  );

  return rows[0] || null;
}

module.exports = {
  loginByNoemp,
};
