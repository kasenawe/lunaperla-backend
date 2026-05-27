const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function requireAuth(req, res, next) {
  if (!env.JWT_SECRET) {
    return res.status(500).json({
      error: "JWT_SECRET no configurado en el backend",
    });
  }

  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      error: "Token requerido. Usa Authorization: Bearer <token>",
    });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (_error) {
    return res.status(401).json({
      error: "Token inválido o expirado",
    });
  }
}

module.exports = requireAuth;
