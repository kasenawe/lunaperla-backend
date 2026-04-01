const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { MercadoPagoConfig, Preference } = require("mercadopago");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ SUPABASE_URL y SUPABASE_ANON_KEY son requeridos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configurar Mercado Pago con nueva API
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

// Middleware
app.use(cors());
app.use(express.json());

// Funciones helper para Supabase
async function saveOrder(orderData) {
  try {
    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          id: orderData.preferenceId,
          product: orderData.product.name,
          price: orderData.amount,
          status: "pending",
          customer_name: orderData.customerData.name || "",
          customer_phone: orderData.customerData.phone || "",
          customer_email: orderData.customerData.email || "",
          product_description: orderData.product.description || "",
          init_point: orderData.initPoint,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error("Error guardando orden en Supabase:", error);
      throw error;
    }

    console.log("✅ Orden guardada en Supabase:", data[0]);
    return data[0];
  } catch (error) {
    console.error("❌ Error en saveOrder:", error);
    throw error;
  }
}

async function updateOrderStatus(orderId, status, paymentData = null) {
  try {
    const updateData = {
      status: status,
      updated_at: new Date().toISOString(),
    };

    if (paymentData) {
      updateData.payment_data = paymentData;
      updateData.payment_id = paymentData.id;
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select();

    if (error) {
      console.error("Error actualizando orden en Supabase:", error);
      throw error;
    }

    console.log("✅ Orden actualizada en Supabase:", data[0]);
    return data[0];
  } catch (error) {
    console.error("❌ Error en updateOrderStatus:", error);
    throw error;
  }
}

async function getAllOrders() {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error obteniendo órdenes de Supabase:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Error en getAllOrders:", error);
    throw error;
  }
}

async function getOrderById(orderId) {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (error) {
      console.error("Error obteniendo orden de Supabase:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Error en getOrderById:", error);
    throw error;
  }
}

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
            currency_id: "USD", // Moneda uruguaya
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

    // Guardar la orden en Supabase
    const orderData = {
      preferenceId: result.id,
      product,
      customerData,
      amount: product.price,
      currency: "UYU",
      initPoint: result.init_point,
    };

    const savedOrder = await saveOrder(orderData);
    console.log("✅ Orden guardada en Supabase:", savedOrder);

    res.json({
      id: result.id,
      init_point: result.init_point,
      orderId: result.id,
    });
  } catch (error) {
    console.error("Error creando preferencia:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Webhook para confirmación de pagos
app.post("/api/webhook", async (req, res) => {
  try {
    const payment = req.body;

    if (payment.type === "payment") {
      const paymentId = payment.data.id;
      const status = payment.data.status; // approved, pending, rejected, etc.

      console.log("💰 Pago recibido en webhook:", {
        paymentId,
        status,
        amount: payment.data.transaction_amount,
        external_reference: payment.data.external_reference,
      });

      // En producción: buscar la orden por external_reference y actualizar estado
      // Por ahora, solo loggeamos la información completa
      console.log(
        "📋 Datos completos del pago:",
        JSON.stringify(payment, null, 2),
      );

      // TODO: Implementar búsqueda por external_reference
      // const orderId = payment.data.external_reference;
      // if (orderId) {
      //   await updateOrderStatus(orderId, status, payment.data);
      // }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error en webhook:", error);
    res.sendStatus(500);
  }
});

// Endpoint para consultar órdenes (útil para debugging)
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await getAllOrders();
    res.json(orders);
  } catch (error) {
    console.error("Error cargando órdenes:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint para consultar una orden específica
app.get("/api/orders/:orderId", async (req, res) => {
  try {
    const order = await getOrderById(req.params.orderId);
    res.json(order);
  } catch (error) {
    console.error("Error cargando orden:", error);
    res.status(404).json({ error: "Orden no encontrada" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
});
