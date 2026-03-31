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

    const preference = new Preference(client);
    const result = await preference.create({
      items: [
        {
          title: product.name,
          description: product.description,
          quantity: 1,
          currency_id: "UYU",
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
        success: `${process.env.FRONTEND_URL?.trim()}/success`,
        failure: `${process.env.FRONTEND_URL?.trim()}/failure`,
        pending: `${process.env.FRONTEND_URL?.trim()}/pending`,
      },
      auto_return: "approved",
      notification_url: `${process.env.BACKEND_URL}/api/webhook`,
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
