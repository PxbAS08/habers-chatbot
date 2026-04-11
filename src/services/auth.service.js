const db = require("../config/database");

async function loginByNoemp(noemp) {
  const [rows] = await db.query(
    "SELECT user, Noemp, Nombre, Puesto, Area FROM users WHERE user = ? LIMIT 1",
    [noemp]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

module.exports = {
  loginByNoemp
};