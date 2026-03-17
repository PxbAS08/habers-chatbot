const db = require("../config/database");

function normalizeJsonValue(v) {
  // Si es null/undefined, déjalo null
  if (v === undefined) return undefined;
  if (v === null) return null;

  // Si es objeto/array, conviértelo a string JSON válido
  if (typeof v === "object") {
    return JSON.stringify(v);
  }

  // Si es string, lo dejamos (puede ser JSON string o texto normal)
  return v;
}

async function updateSession(phone, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return;

  // Armamos SET con soporte especial para JSON
  const sets = [];
  const values = [];

  for (const k of keys) {
    if (k === "respuestas_json") {
      // Guardar JSON correctamente en MySQL
      sets.push(`${k} = CAST(? AS JSON)`);
      const v = patch[k];
      values.push(v == null ? null : (typeof v === "string" ? v : JSON.stringify(v)));
    } else {
      sets.push(`${k} = ?`);
      values.push(patch[k]);
    }
  }

  const sql = `UPDATE bot_sessions SET ${sets.join(", ")} WHERE phone = ?`;
  values.push(phone);

  await db.query(sql, values);
}

async function getOrCreateSession(phone) {
  const [rows] = await db.query("SELECT * FROM bot_sessions WHERE phone = ?", [phone]);
  if (rows.length) return rows[0];

  await db.query("INSERT INTO bot_sessions (phone, estado) VALUES (?, 'LOGIN')", [phone]);
  const [rows2] = await db.query("SELECT * FROM bot_sessions WHERE phone = ?", [phone]);
  return rows2[0];
}

async function resetSession(phone) {
  await db.query(
    `UPDATE bot_sessions
     SET estado='LOGIN',
         evaluador_user=NULL,
         evaluador_noemp=NULL,
         evaluado_noemp=NULL,
         tipo=NULL,
         tipo_eval=NULL,
         pregunta_actual=0,
         respuestas_json=NULL,
         comentario=NULL
     WHERE phone=?`,
    [phone]
  );
}

module.exports = { getOrCreateSession, updateSession, resetSession };