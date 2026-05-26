function errorHandler(err, req, res, next) {
  console.error("❌ Unhandled error:", err);

  if (res.headersSent) {
    return next(err);
  }

  const status =
    Number(err?.status || err?.statusCode) > 0
      ? Number(err.status || err.statusCode)
      : 500;

  const message =
    status >= 500
      ? "Error interno del servidor"
      : err?.message || "Error en la solicitud";

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
