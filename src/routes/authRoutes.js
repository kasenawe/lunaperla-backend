const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const authenticate = require("../middlewares/requireAuth");

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function mapUserResponse(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    phone: user.phone || null,
    role: user.role,
    active: user.active ?? true,
    created_at: user.created_at || null,
    updated_at: user.updated_at || null,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );
}

function createAuthRoutes({ supabaseAdmin }) {
  const router = express.Router();

  function hasSupabaseAdmin() {
    return Boolean(supabaseAdmin);
  }

  async function findUserByEmail(email) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        "id, email, password_hash, first_name, last_name, phone, role, active, created_at, updated_at",
      )
      .eq("email", email)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data || null;
  }

  async function findUserById(userId) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        "id, email, first_name, last_name, phone, role, active, created_at, updated_at",
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data || null;
  }

  router.post("/auth/register", async (req, res) => {
    try {
      if (!env.JWT_SECRET || !hasSupabaseAdmin()) {
        return res.status(500).json({
          error: "Falta configuración para autenticación",
        });
      }

      const email = normalizeEmail(req.body?.email);
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";
      const firstName =
        typeof req.body?.first_name === "string"
          ? req.body.first_name.trim()
          : "";
      const lastName =
        typeof req.body?.last_name === "string"
          ? req.body.last_name.trim()
          : "";
      const phone =
        typeof req.body?.phone === "string" ? req.body.phone.trim() : "";

      if (!email || !password) {
        return res.status(400).json({
          error: "email y password son obligatorios",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error: "La contraseña debe tener al menos 8 caracteres",
        });
      }

      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: "Ya existe un usuario con ese email",
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const { data, error } = await supabaseAdmin
        .from("users")
        .insert([
          {
            email,
            password_hash: passwordHash,
            first_name: firstName || null,
            last_name: lastName || null,
            phone: phone || null,
            role: "customer",
            active: true,
          },
        ])
        .select(
          "id, email, first_name, last_name, phone, role, active, created_at, updated_at",
        )
        .single();

      if (error) {
        throw error;
      }

      const user = mapUserResponse(data);

      return res.status(201).json({
        accessToken: signAccessToken(user),
        tokenType: "Bearer",
        expiresIn: env.JWT_EXPIRES_IN,
        user,
      });
    } catch (error) {
      if (String(error?.code) === "23505") {
        return res.status(409).json({
          error: "Ya existe un usuario con ese email",
        });
      }

      console.error("Error registrando usuario:", error);
      return res.status(500).json({
        error: "Error interno del servidor",
      });
    }
  });

  router.post("/auth/login", async (req, res) => {
    try {
      if (!env.JWT_SECRET || !hasSupabaseAdmin()) {
        return res.status(500).json({
          error: "Falta configuración para autenticación",
        });
      }

      const email = normalizeEmail(req.body?.email);
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";

      if (!email || !password) {
        return res.status(400).json({
          error: "email y password son obligatorios",
        });
      }

      const user = await findUserByEmail(email);

      if (!user || !user.active) {
        return res.status(401).json({
          error: "Credenciales inválidas",
        });
      }

      const passwordMatches = await bcrypt.compare(
        password,
        user.password_hash,
      );
      if (!passwordMatches) {
        return res.status(401).json({
          error: "Credenciales inválidas",
        });
      }

      return res.status(200).json({
        accessToken: signAccessToken(user),
        tokenType: "Bearer",
        expiresIn: env.JWT_EXPIRES_IN,
        user: mapUserResponse(user),
      });
    } catch (error) {
      console.error("Error iniciando sesión:", error);
      return res.status(500).json({
        error: "Error interno del servidor",
      });
    }
  });

  router.get("/auth/me", authenticate, async (req, res) => {
    try {
      if (!hasSupabaseAdmin()) {
        return res.status(500).json({
          error: "Supabase admin client no configurado",
        });
      }

      const userId = req.user?.id || req.user?.sub;
      if (!userId) {
        return res.status(401).json({
          error: "Token inválido o incompleto",
        });
      }

      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({
          error: "Usuario no encontrado",
        });
      }

      return res.json({ user: mapUserResponse(user) });
    } catch (error) {
      console.error("Error consultando perfil:", error);
      return res.status(500).json({
        error: "Error interno del servidor",
      });
    }
  });

  router.put("/auth/profile", authenticate, async (req, res) => {
    try {
      if (!hasSupabaseAdmin()) {
        return res.status(500).json({
          error: "Supabase admin client no configurado",
        });
      }

      const userId = req.user?.id || req.user?.sub;
      if (!userId) {
        return res.status(401).json({
          error: "Token inválido o incompleto",
        });
      }

      const currentUser = await findUserById(userId);
      if (!currentUser) {
        return res.status(404).json({
          error: "Usuario no encontrado",
        });
      }

      const email = normalizeEmail(req.body?.email) || currentUser.email;
      const firstName =
        typeof req.body?.first_name === "string"
          ? req.body.first_name.trim()
          : currentUser.first_name || null;
      const lastName =
        typeof req.body?.last_name === "string"
          ? req.body.last_name.trim()
          : currentUser.last_name || null;
      const phone =
        typeof req.body?.phone === "string"
          ? req.body.phone.trim()
          : currentUser.phone || null;

      if (email !== currentUser.email) {
        const existingUser = await findUserByEmail(email);
        if (existingUser && existingUser.id !== currentUser.id) {
          return res.status(409).json({
            error: "Ya existe un usuario con ese email",
          });
        }
      }

      const { data, error } = await supabaseAdmin
        .from("users")
        .update({
          email,
          first_name: firstName,
          last_name: lastName,
          phone,
        })
        .eq("id", currentUser.id)
        .select(
          "id, email, first_name, last_name, phone, role, active, created_at, updated_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return res.json({ user: mapUserResponse(data) });
    } catch (error) {
      console.error("Error actualizando perfil:", error);
      return res.status(500).json({
        error: "Error interno del servidor",
      });
    }
  });

  return router;
}

module.exports = {
  createAuthRoutes,
};
