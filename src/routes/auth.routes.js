const router = require("express").Router();

router.get("/login", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Login RH</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: linear-gradient(135deg, #0f172a, #1e3a8a);
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        width: 100%;
        max-width: 480px;
        background: #fff;
        border-radius: 16px;
        padding: 40px;
        box-shadow: 0 20px 40px rgba(0,0,0,.2);
      }
      h1 {
        margin: 0 0 8px;
        color: #0f172a;
        font-size: 34px;
      }
      p {
        margin: 0 0 24px;
        color: #64748b;
      }
      label {
        display: block;
        margin-bottom: 6px;
        font-size: 14px;
        color: #334155;
        font-weight: bold;
      }
      input {
        width: 100%;
        padding: 14px 16px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        margin-bottom: 16px;
        font-size: 16px;
      }
      input:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37,99,235,.15);
      }
      button {
        width: 100%;
        padding: 14px;
        border: none;
        border-radius: 10px;
        background: #2563eb;
        color: white;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
      }
      button:hover {
        background: #1d4ed8;
      }
      .brand {
        font-size: 13px;
        color: #94a3b8;
        margin-top: 16px;
        text-align: center;
      }
        .logo-box {
            background: #0f172a;
            border-radius: 12px;
            padding: 14px;
            text-align: center;
            margin-bottom: 22px;
    }
    .logo-box img {
        width: 240px;
        max-width: 100%;
        height: auto;
        display: inline-block;
    }
    </style>
  </head>
  <body>
    <div class="card">
        <div class="logo-box">
            <img src="/public/logo-habers.png" alt="Habers Logo">
        </div>

      <h1>Panel RH</h1>
      <p>Acceso a reportes de evaluaciones</p>

      <form method="POST" action="/login">
        <label>Usuario</label>
        <input name="user" placeholder="Usuario" required />

        <label>Contraseña</label>
        <input name="password" type="password" placeholder="Contraseña" required />

        <button type="submit">Entrar</button>
      </form>

      <div class="brand">Industrias Habers · Recursos Humanos</div>
    </div>
  </body>
  </html>
  `);
});

router.post("/login", (req, res) => {
  const { user, password } = req.body || {};

  if (
    user === process.env.RH_USER &&
    password === process.env.RH_PASSWORD
  ) {
    req.session.rhUser = user;
    return res.redirect("/reportes");
  }

  return res.send(`
    <script>
      alert("Usuario o contraseña incorrectos");
      window.location.href = "/login";
    </script>
  `);
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;