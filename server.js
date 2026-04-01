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
        external_reference: result.id, // Importante: ID de la orden para el webhook
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
    console.log(
      "🔥 WEBHOOK RECIBIDO - Headers:",
      JSON.stringify(req.headers, null, 2),
    );
    console.log(
      "🔥 WEBHOOK RECIBIDO - Body:",
      JSON.stringify(req.body, null, 2),
    );

    const payment = req.body;

    if (payment.type === "payment") {
      const paymentId = payment.data.id;
      const status = payment.data.status;
      const externalReference = payment.data.external_reference;

      console.log("💰 WEBHOOK - Procesando pago:", {
        paymentId,
        status,
        externalReference,
        hasExternalRef: !!externalReference,
        amount: payment.data.transaction_amount,
      });

      // Actualizar el status de la orden usando el external_reference
      if (externalReference) {
        try {
          console.log(
            `🔄 Intentando actualizar orden ${externalReference} a status ${status}`,
          );
          const updatedOrder = await updateOrderStatus(
            externalReference,
            status,
            payment.data,
          );
          console.log(
            `✅ Orden ${externalReference} actualizada exitosamente:`,
            updatedOrder,
          );
        } catch (updateError) {
          console.error(
            `❌ Error actualizando orden ${externalReference}:`,
            updateError,
          );
        }
      } else {
        console.error(
          "❌ Webhook recibido SIN external_reference - No se puede actualizar orden",
        );
        console.error("Datos del pago:", JSON.stringify(payment, null, 2));
      }
    } else {
      console.log("ℹ️ Webhook recibido con type diferente:", payment.type);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error en webhook:", error);
    res.sendStatus(500);
  }
});

// Endpoint de TEST para webhook (para debugging)
app.post("/api/webhook-test", async (req, res) => {
  try {
    console.log("🧪 WEBHOOK TEST - Body:", JSON.stringify(req.body, null, 2));

    // Simular un webhook de Mercado Pago
    const testWebhook = {
      type: "payment",
      data: {
        id: "test_payment_123",
        status: "approved",
        external_reference: req.body.orderId || "test-order-id",
        transaction_amount: 299,
      },
    };

    console.log(
      "🧪 Enviando webhook de prueba:",
      JSON.stringify(testWebhook, null, 2),
    );

    // Enviar el webhook a nuestro propio endpoint
    const axios = require("axios");
    await axios.post(
      `${process.env.BACKEND_URL || "http://localhost:3001"}/api/webhook`,
      testWebhook,
    );

    res.json({ message: "Webhook de prueba enviado", testData: testWebhook });
  } catch (error) {
    console.error("❌ Error en webhook test:", error);
    res.status(500).json({ error: error.message });
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

// Endpoint para estadísticas del dashboard
app.get("/api/dashboard/stats", async (req, res) => {
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

// Endpoint para verificar configuración
app.get("/api/config-check", (req, res) => {
  const config = {
    supabase: {
      url: !!process.env.SUPABASE_URL,
      key: !!process.env.SUPABASE_ANON_KEY,
    },
    mercadopago: {
      token: !!process.env.MERCADO_PAGO_ACCESS_TOKEN,
      tokenType: process.env.MERCADO_PAGO_ACCESS_TOKEN?.split("-")[0],
    },
    urls: {
      frontend: process.env.FRONTEND_URL,
      backend: process.env.BACKEND_URL,
      notification: `${process.env.BACKEND_URL}/api/webhook`,
    },
    timestamp: new Date().toISOString(),
  };

  res.json(config);
});

// Dashboard HTML simple
app.get("/dashboard", async (req, res) => {
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
    };

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Luna Perla</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .status-pending { background: #fef3c7; color: #d97706; }
        .status-approved { background: #d1fae5; color: #059669; }
        .status-rejected { background: #fee2e2; color: #dc2626; }
    </style>
</head>
<body class="bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Dashboard - Luna Perla</h1>
            <p class="text-gray-600">Gestión de pedidos y pagos</p>
        </div>

        <!-- Estadísticas -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-900">Total Pedidos</h3>
                <p class="text-3xl font-bold text-blue-600">${stats.total}</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-900">Pendientes</h3>
                <p class="text-3xl font-bold text-yellow-600">${stats.pending}</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-900">Aprobados</h3>
                <p class="text-3xl font-bold text-green-600">${stats.approved}</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-900">Ingresos Totales</h3>
                <p class="text-3xl font-bold text-green-600">USD ${stats.totalRevenue}</p>
            </div>
        </div>

        <!-- Tabla de pedidos -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200">
                <h2 class="text-xl font-semibold text-gray-900">Últimos Pedidos</h2>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${orders
                          .slice(0, 20)
                          .map(
                            (order) => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">${order.id.substring(0, 12)}...</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${order.product}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${order.customer_name}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">USD ${order.price}</td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full status-${order.status}">
                                        ${order.status}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ${new Date(order.created_at).toLocaleDateString("es-ES")}
                                </td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Auto refresh -->
        <script>
            setInterval(() => {
                location.reload();
            }, 30000); // Refresh every 30 seconds
        </script>
    </div>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error("Error generando dashboard:", error);
    res.status(500).send("Error interno del servidor");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
});
