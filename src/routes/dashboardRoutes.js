const express = require("express");

function createDashboardRoutes({
  getAllOrders,
  getOrderById,
  sendConfirmationEmail,
}) {
  const router = express.Router();

  // Endpoint para consultar órdenes (útil para debugging)
  router.get("/orders", async (req, res) => {
    try {
      const orders = await getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error cargando órdenes:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // Endpoint para consultar una orden específica
  router.get("/orders/:orderId", async (req, res) => {
    try {
      const order = await getOrderById(req.params.orderId);
      res.json(order);
    } catch (error) {
      console.error("Error cargando orden:", error);
      res.status(404).json({ error: "Orden no encontrada" });
    }
  });

  // Endpoint para estadísticas del dashboard
  router.get("/dashboard/stats", async (req, res) => {
    try {
      const orders = await getAllOrders();

      const stats = {
        total: orders.length,
        pending: orders.filter((o) => o.status === "pending").length,
        approved: orders.filter((o) => o.status === "approved").length,
        rejected: orders.filter((o) => o.status === "rejected").length,
        totalRevenue: orders
          .filter((o) => o.status === "approved")
          .reduce((sum, o) => sum + (o.price || 0), 0),
        recentOrders: orders.slice(0, 5), // Últimas 5 órdenes
      };

      res.json(stats);
    } catch (error) {
      console.error("Error obteniendo estadísticas:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // Endpoint para probar envío de emails (solo para desarrollo)
  router.post("/test-email", async (req, res) => {
    try {
      const testOrder = {
        id: "TEST-" + Date.now(),
        product: "Anillo Luna Gold Premium",
        price: 299.99,
        customer_name: "Cliente de Prueba",
        customer_email: req.body.email || "test@example.com",
        customer_phone: "+5491123456789",
        product_description: "Anillo de plata 925 con piedra luna premium",
        created_at: new Date().toISOString(),
      };

      console.log("🔍 Probando envío de email a:", testOrder.customer_email);
      console.log("🔑 Resend configurado:", !!resend);

      await sendConfirmationEmail(testOrder);
      res.json({ success: true, message: "Email de prueba enviado" });
    } catch (error) {
      console.error("❌ Error en test email:", error);
      res.status(500).json({
        error: "Error enviando email de prueba",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = {
  createDashboardRoutes,
};
