const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Preference } = require("mercadopago");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar Mercado Pago con nueva API
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint para crear preferencia de pago
app.post("/api/create-payment", async (req, res) => {
  try {
    const { product, customerData } = req.body;
    console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
    console.log("BACKEND_URL:", process.env.BACKEND_URL);
    console.log(
      "MERCADO_PAGO_ACCESS_TOKEN exists:",
      !!process.env.MERCADO_PAGO_ACCESS_TOKEN,
    );

    // Validar URLs antes de enviar a Mercado Pago
    const successUrl = `${process.env.FRONTEND_URL}/success`;
    const failureUrl = `${process.env.FRONTEND_URL}/failure`;
    const pendingUrl = `${process.env.FRONTEND_URL}/pending`;
    const notificationUrl = `${process.env.BACKEND_URL}/api/webhook`;

    console.log("Constructed URLs:", {
      successUrl,
      failureUrl,
      pendingUrl,
      notificationUrl,
    });

    // Validar que las URLs sean válidas
    if (!process.env.FRONTEND_URL || !process.env.BACKEND_URL) {
      throw new Error(
        "FRONTEND_URL y BACKEND_URL deben estar definidas en las variables de entorno",
      );
    }

    if (!successUrl.startsWith("http")) {
      throw new Error(`URL de success inválida: ${successUrl}`);
    }

    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [
          {
            title: product.name,
            description: product.description,
            quantity: 1,
            currency_id: "UYU", // Moneda uruguaya
            unit_price: product.price,
          },
        ],
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
        // auto_return: "approved", // Removido temporalmente para debugging
        notification_url: notificationUrl,
      },
    });

    res.json({
      id: result.id,
      init_point: result.init_point,
    });
  } catch (error) {
    console.error("Error creando preferencia:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Webhook para confirmación de pagos
app.post("/api/webhook", (req, res) => {
  const payment = req.body;

  if (payment.type === "payment") {
    const paymentId = payment.data.id;

    // Aquí procesarías el pago confirmado
    // - Actualizar base de datos
    // - Enviar confirmación por WhatsApp/email
    // - etc.

    console.log("Pago confirmado:", paymentId);
  }

  res.sendStatus(200);
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
});
