const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function authenticate(req, res, next) {
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
    req.user = {
      id: payload.id || payload.sub,
      email: payload.email || null,
      role: payload.role || null,
      sub: payload.sub || null,
    };
    next();
  } catch (_error) {
    return res.status(401).json({
      error: "Token inválido o expirado",
    });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Debes iniciar sesión",
      });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "No tienes permisos para realizar esta acción",
      });
    }

    return next();
  };
}

authenticate.authenticate = authenticate;
authenticate.authorize = authorize;

module.exports = authenticate;
