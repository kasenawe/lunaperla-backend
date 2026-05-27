const express = require("express");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function createAuthRoutes() {
  const router = express.Router();

  router.post("/auth/login", (req, res) => {
    const { username, password } = req.body || {};

    if (!env.JWT_SECRET || !env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
      return res.status(500).json({
        error: "Faltan variables de entorno para autenticación",
      });
    }

    if (!username || !password) {
      return res.status(400).json({
        error: "username y password son obligatorios",
      });
    }

    const isValidCredentials =
      username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD;

    if (!isValidCredentials) {
      return res.status(401).json({
        error: "Credenciales inválidas",
      });
    }

    const token = jwt.sign(
      {
        sub: env.ADMIN_USERNAME,
        role: "admin",
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN,
      },
    );

    res.status(200).json({
      accessToken: token,
      tokenType: "Bearer",
      expiresIn: env.JWT_EXPIRES_IN,
    });
  });

  return router;
}

module.exports = {
  createAuthRoutes,
};
