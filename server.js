const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");
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

// Configurar Resend para emails
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

if (!resend) {
  console.warn("⚠️ RESEND_API_KEY no configurada - emails no se enviarán");
}

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
          id: orderData.orderId, // Usamos el mismo ID que en Mercado Pago para tracking
          preference_id: orderData.preferenceId,
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

async function sendConfirmationEmail(orderData) {
  try {
    if (!resend) {
      console.warn("⚠️ Resend no configurado - saltando envío de email");
      return;
    }

    if (!orderData.customer_email) {
      console.warn("⚠️ No hay email del cliente - saltando envío de email");
      return;
    }

    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmación de Compra - Luna Gold</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            background-color: #f8f8f8;
        }
        .container {
            background-color: white;
            margin: 20px;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #D4AF37;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #D4AF37;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            font-size: 16px;
        }
        .success-icon {
            font-size: 48px;
            color: #28a745;
            margin: 20px 0;
        }
        .order-details {
            background-color: #f9f9f9;
            padding: 25px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #D4AF37;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 5px 0;
        }
        .detail-label {
            font-weight: bold;
            color: #555;
        }
        .detail-value {
            color: #333;
        }
        .price-highlight {
            color: #D4AF37;
            font-weight: bold;
            font-size: 18px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #eee;
            color: #666;
            font-size: 14px;
        }
        .contact-info {
            background-color: #D4AF37;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            text-align: center;
        }
        .contact-info h3 {
            margin-top: 0;
            color: white;
        }
        .highlight {
            background-color: #FFF8DC;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #D4AF37;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">LUNA GOLD</div>
            <div class="subtitle">Joyería Premium & Accesorios Exclusivos</div>
        </div>

        <div style="text-align: center;">
            <div class="success-icon">✨</div>
            <h1 style="color: #28a745; margin: 10px 0;">¡Compra Confirmada!</h1>
            <p style="font-size: 18px; color: #555;">Gracias por elegir Luna Gold</p>
        </div>

        <div class="highlight">
            <strong>¡Felicitaciones ${orderData.customer_name}!</strong><br>
            Tu pago ha sido procesado exitosamente. Tu pedido está siendo preparado con el mayor cuidado y atención al detalle que nos caracteriza.
        </div>

        <div class="order-details">
            <h3 style="color: #D4AF37; margin-top: 0;">Detalles de tu Compra</h3>

            <div class="detail-row">
                <span class="detail-label">Producto:</span>
                <span class="detail-value">${orderData.product}</span>
            </div>

            ${orderData.product_description ? `
            <div class="detail-row">
                <span class="detail-label">Descripción:</span>
                <span class="detail-value">${orderData.product_description}</span>
            </div>
            ` : ''}

            <div class="detail-row">
                <span class="detail-label">Precio:</span>
                <span class="detail-value price-highlight">$${orderData.price}</span>
            </div>

            <div class="detail-row">
                <span class="detail-label">ID de Orden:</span>
                <span class="detail-value">${orderData.id}</span>
            </div>

            <div class="detail-row">
                <span class="detail-label">Fecha:</span>
                <span class="detail-value">${new Date(orderData.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</span>
            </div>
        </div>

        <div class="contact-info">
            <h3>¿Necesitas Ayuda?</h3>
            <p>No dudes en contactarnos si tienes alguna pregunta sobre tu pedido.</p>
            <p>📱 WhatsApp: ${orderData.customer_phone || 'Contactanos'}</p>
            <p>💎 Visítanos en nuestras redes sociales</p>
        </div>

        <div class="footer">
            <p><strong>Luna Gold</strong> - Donde la elegancia encuentra su hogar</p>
            <p>Gracias por confiar en nosotros para tus momentos más especiales ✨</p>
            <p style="font-size: 12px; color: #999; margin-top: 20px;">
                Este es un email automático, por favor no respondas directamente a este mensaje.
            </p>
        </div>
    </div>
</body>
</html>`;

    const { data, error } = await resend.emails.send({
      from: 'Luna Gold <onboarding@resend.dev>',
      to: [orderData.customer_email],
      subject: '✨ ¡Compra Confirmada! - Luna Gold',
      html: emailHtml,
    });

    if (error) {
      console.error("❌ Error enviando email:", error);
      throw error;
    }

    console.log("✅ Email de confirmación enviado:", data);
    return data;
  } catch (error) {
    console.error("❌ Error en sendConfirmationEmail:", error);
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

    // Enviar email de confirmación si el pago fue aprobado
    if (status === "approved" && data[0]) {
      try {
        await sendConfirmationEmail(data[0]);
      } catch (emailError) {
        console.error("⚠️ Error enviando email de confirmación:", emailError);
        // No lanzamos error aquí para no romper el flujo del webhook
      }
    }

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

    const orderId = "LP-" + Date.now();

    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [
          {
            title: product.name,
            description: product.description,
            quantity: 1,
            currency_id: "USD", // Moneda uruguaya
            unit_price: Number(product.price),
          },
        ],
        external_reference: orderId, // Usamos nuestro propio ID de orden para tracking
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
        auto_return: "approved", // Removido temporalmente para debugging
        notification_url: notificationUrl,
      },
    });

    // Guardar la orden en Supabase
    const orderData = {
      preferenceId: result.id,
      orderId: orderId,
      product,
      customerData,
      amount: product.price,
      currency: "USD",
      amount: product.price,
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
    const body = req.body;

    if (body.type === "payment") {
      const paymentId = body.data.id;

      // 🔥 CONSULTAR a Mercado Pago (obligatorio)
      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
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
    <title>Dashboard - Luna Gold</title>
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
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Dashboard - Luna Gold</h1>
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

// Endpoint para probar envío de emails (solo para desarrollo)
app.post("/api/test-email", async (req, res) => {
  try {
    const testOrder = {
      id: "TEST-" + Date.now(),
      product: "Anillo Luna Gold Premium",
      price: 299.99,
      customer_name: "Cliente de Prueba",
      customer_email: req.body.email || "test@example.com",
      customer_phone: "+5491123456789",
      product_description: "Anillo de plata 925 con piedra luna premium",
      created_at: new Date().toISOString()
    };

    console.log("🔍 Probando envío de email a:", testOrder.customer_email);
    console.log("🔑 Resend configurado:", !!resend);

    await sendConfirmationEmail(testOrder);
    res.json({ success: true, message: "Email de prueba enviado" });
  } catch (error) {
    console.error("❌ Error en test email:", error);
    res.status(500).json({ error: "Error enviando email de prueba", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
});
