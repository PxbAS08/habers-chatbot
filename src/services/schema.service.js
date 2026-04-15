const db = require("../config/database");

async function getColumn(table, column) {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  return rows[0] || null;
}

async function ensureColumn(table, column, definition) {
  const current = await getColumn(table, column);
  if (current) return;

  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

async function setTableCollation(table) {
  await db.query(
    `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
}

async function ensureDatabaseSchema() {
  await setTableCollation("users");
  await setTableCollation("evaluados");
  await setTableCollation("resultadosdesempeno");
  await setTableCollation("bot_sessions");

  await db.query(
    "ALTER TABLE users MODIFY user VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"
  );
  await ensureColumn("users", "activo", "TINYINT(1) NOT NULL DEFAULT 1");
  await db.query("UPDATE users SET activo = 1 WHERE activo IS NULL");

  await db.query(
    "ALTER TABLE evaluados MODIFY user VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"
  );
  await db.query(
    "ALTER TABLE evaluados MODIFY evaluado VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"
  );
  await ensureColumn("evaluados", "area", "TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL");
  await ensureColumn("evaluados", "es_extraoficial", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("evaluados", "activo", "TINYINT(1) NOT NULL DEFAULT 1");
  await db.query("UPDATE evaluados SET es_extraoficial = 0 WHERE es_extraoficial IS NULL");
  await db.query("UPDATE evaluados SET activo = 1 WHERE activo IS NULL");

  await db.query(
    "ALTER TABLE resultadosdesempeno MODIFY user VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"
  );
  await db.query(
    "ALTER TABLE resultadosdesempeno MODIFY evaluado VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"
  );

  await db.query(
    "ALTER TABLE bot_sessions MODIFY evaluador_user VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL"
  );
  await db.query(
    "ALTER TABLE bot_sessions MODIFY evaluado_noemp VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL"
  );
}

module.exports = {
  ensureDatabaseSchema,
};
