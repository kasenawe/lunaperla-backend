const express = require("express");
const { env } = require("../config/env");
const {
  mercadoPagoClient,
  Preference,
} = require("../clients/mercadoPagoClient");

function createPaymentRoutes({ saveOrder, updateOrderStatus }) {
  const router = express.Router();

  router.post("/create-payment", async (req, res) => {
    try {
      const { product, customerData } = req.body;
      console.log("FRONTEND_URL:", env.FRONTEND_URL);
      console.log("BACKEND_URL:", env.BACKEND_URL);
      console.log(
        "MERCADO_PAGO_ACCESS_TOKEN exists:",
        !!env.MERCADO_PAGO_ACCESS_TOKEN,
      );

      const successUrl = `${env.FRONTEND_URL}/success`;
      const failureUrl = `${env.FRONTEND_URL}/failure`;
      const pendingUrl = `${env.FRONTEND_URL}/pending`;
      const notificationUrl = `${env.BACKEND_URL}/api/webhook`;

      console.log("Constructed URLs:", {
        successUrl,
        failureUrl,
        pendingUrl,
        notificationUrl,
      });

      if (!env.FRONTEND_URL || !env.BACKEND_URL) {
        throw new Error(
          "FRONTEND_URL y BACKEND_URL deben estar definidas en las variables de entorno",
        );
      }

      if (!successUrl.startsWith("http")) {
        throw new Error(`URL de success inválida: ${successUrl}`);
      }

      const orderId = "LP-" + Date.now();

      const preference = new Preference(mercadoPagoClient);
      const result = await preference.create({
        body: {
          items: [
            {
              title: product.name,
              description: product.description,
              quantity: 1,
              currency_id: "USD",
              unit_price: Number(product.price),
            },
          ],
          external_reference: orderId,
          payer: {
            name: customerData?.name || "",
            email: customerData?.email || "",
            phone: {
              number: customerData?.phone || "",
            },
          },
          back_urls: {
            success: successUrl,
            failure: failureUrl,
            pending: pendingUrl,
          },
          auto_return: "approved",
          notification_url: notificationUrl,
        },
      });

      const orderData = {
        preferenceId: result.id,
        orderId,
        product,
        customerData,
        amount: product.price,
        currency: "USD",
        initPoint: result.init_point,
      };

      const savedOrder = await saveOrder(orderData);
      console.log("✅ Orden guardada en Supabase:", savedOrder);

      res.json({
        id: result.id,
        init_point: result.init_point,
        orderId,
      });
    } catch (error) {
      console.error("Error creando preferencia:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.post("/webhook", async (req, res) => {
    try {
      const body = req.body;

      if (body.type === "payment") {
        const paymentId = body.data.id;

        const response = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
            },
          },
        );

        const paymentData = await response.json();

        const status = paymentData.status;
        const externalReference = paymentData.external_reference;

        console.log("💰 Pago confirmado:", {
          paymentId,
          status,
          externalReference,
        });

        if (externalReference) {
          await updateOrderStatus(externalReference, status, paymentData);
        } else {
          console.warn("⚠️ No hay external_reference");
        }
      }

      res.sendStatus(200);
    } catch (error) {
      console.error("❌ Error en webhook:", error);
      res.sendStatus(500);
    }
  });

  return router;
}

module.exports = {
  createPaymentRoutes,
};
