const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { env } = require("./config/env");
const {
  supabase,
  supabaseAdmin,
  storageBucket,
} = require("./clients/supabaseClient");
const { resend } = require("./clients/resendClient");
const {
  slugifyValue,
  slugifyCategoryName,
  formatCategoryNameFromSlug,
} = require("./utils/slug");
const {
  DEFAULT_CATEGORY_SLUG,
  DEFAULT_CATEGORIES,
  normalizeProductCategoryPayload,
  normalizeProductCollectionPayload,
  normalizeCategoryRecord,
  normalizeCollectionRecord,
  mapProductResponse,
} = require("./utils/catalog");
const {
  buildStoragePath,
  extractStorageObjectPath,
} = require("./utils/storage");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");
const { registerApiRoutes } = require("./routes");
const { createViewsRouter } = require("./views");

const app = express();
const PORT = env.PORT;

if (!resend) {
  console.warn("⚠️ RESEND_API_KEY no configurada - emails no se enviarán");
}

// Middleware
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Solo se permiten archivos de imagen"));
      return;
    }
    cb(null, true);
  },
});

const DEFAULT_COLLECTIONS = [];

function isMissingCatalogRelation(error) {
  return (
    error?.code === "42P01" ||
    String(error?.message || "")
      .toLowerCase()
      .includes("does not exist")
  );
}

function isMissingCatalogColumn(error) {
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    String(error?.message || "")
      .toLowerCase()
      .includes("collection")
  );
}

async function getAvailableCategoriesFallback() {
  const { data, error } = await supabase
    .from("products")
    .select("category, category_slug")
    .order("category", { ascending: true });

  if (error) {
    throw error;
  }

  const categoryMap = new Map(
    DEFAULT_CATEGORIES.map((item) => [item.slug, { ...item }]),
  );

  for (const item of data || []) {
    const normalized = normalizeProductCategoryPayload(item);
    const existing = categoryMap.get(normalized.category_slug);

    categoryMap.set(normalized.category_slug, {
      slug: normalized.category_slug,
      name: normalized.category,
      description:
        existing?.description ||
        `Joyas seleccionadas dentro de ${normalized.category.toLowerCase()}.`,
    });
  }

  return Array.from(categoryMap.values()).sort((left, right) => {
    const leftIndex = DEFAULT_CATEGORIES.findIndex(
      (item) => item.slug === left.slug,
    );
    const rightIndex = DEFAULT_CATEGORIES.findIndex(
      (item) => item.slug === right.slug,
    );

    if (leftIndex !== -1 && rightIndex !== -1) {
      return leftIndex - rightIndex;
    }

    if (leftIndex !== -1) {
      return -1;
    }

    if (rightIndex !== -1) {
      return 1;
    }

    return left.name.localeCompare(right.name, "es");
  });
}

async function getCategoriesCatalog({ includeAll = false } = {}) {
  const { data, error } = await supabase
    .from("categories")
    .select("slug, name, description, active, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    if (isMissingCatalogRelation(error)) {
      const fallback = await getAvailableCategoriesFallback();
      return fallback.map((item, index) => ({
        ...item,
        active: true,
        sort_order: index,
      }));
    }

    throw error;
  }

  const categories = (data || []).map((item, index) =>
    normalizeCategoryRecord(item, index),
  );

  if (includeAll) {
    return categories;
  }

  return categories.filter((item) => item.active);
}

async function getCollectionsCatalog({
  includeAll = false,
  categorySlug = null,
} = {}) {
  let query = supabase
    .from("collections")
    .select("slug, name, description, category_slug, active, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (categorySlug) {
    query = query.eq("category_slug", categorySlug);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingCatalogRelation(error)) {
      return DEFAULT_COLLECTIONS;
    }

    throw error;
  }

  const collections = (data || [])
    .map((item, index) => normalizeCollectionRecord(item, index))
    .filter((item) => item.slug && item.name && item.category_slug);

  if (includeAll) {
    return collections;
  }

  return collections.filter((item) => item.active);
}

async function findCategoryBySlug(slug) {
  if (!slug) {
    return null;
  }

  const { data, error } = await supabase
    .from("categories")
    .select("slug, name, description, active, sort_order")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    if (isMissingCatalogRelation(error)) {
      return null;
    }

    throw error;
  }

  return data ? normalizeCategoryRecord(data) : null;
}

async function findCollectionBySlug(slug) {
  if (!slug) {
    return null;
  }

  const { data, error } = await supabase
    .from("collections")
    .select("slug, name, description, category_slug, active, sort_order")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    if (isMissingCatalogRelation(error)) {
      return null;
    }

    throw error;
  }

  return data ? normalizeCollectionRecord(data) : null;
}

async function resolveProductCatalogPayload(payload = {}) {
  let categoryData = normalizeProductCategoryPayload(payload);
  const collectionData = normalizeProductCollectionPayload(payload);

  const resolvedCategory = await findCategoryBySlug(categoryData.category_slug);
  if (resolvedCategory) {
    categoryData = {
      category: resolvedCategory.name,
      category_slug: resolvedCategory.slug,
    };
  }

  let collectionPayload = {
    collection: null,
    collection_slug: null,
  };

  if (collectionData.collection_slug) {
    const resolvedCollection = await findCollectionBySlug(
      collectionData.collection_slug,
    );

    if (resolvedCollection) {
      collectionPayload = {
        collection: resolvedCollection.name,
        collection_slug: resolvedCollection.slug,
      };

      if (
        resolvedCollection.category_slug &&
        resolvedCollection.category_slug !== categoryData.category_slug
      ) {
        const linkedCategory = await findCategoryBySlug(
          resolvedCollection.category_slug,
        );

        categoryData = linkedCategory
          ? {
              category: linkedCategory.name,
              category_slug: linkedCategory.slug,
            }
          : {
              category: formatCategoryNameFromSlug(
                resolvedCollection.category_slug,
              ),
              category_slug: resolvedCollection.category_slug,
            };
      }
    } else {
      collectionPayload = collectionData;
    }
  }

  return {
    ...categoryData,
    ...collectionPayload,
  };
}

async function removeStorageObject(imageValue) {
  const objectPath = extractStorageObjectPath(imageValue, storageBucket);

  if (!supabaseAdmin || !objectPath) {
    return;
  }

  const { error } = await supabaseAdmin.storage
    .from(storageBucket)
    .remove([objectPath]);

  if (error) {
    throw error;
  }
}

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

            ${
              orderData.product_description
                ? `
            <div class="detail-row">
                <span class="detail-label">Descripción:</span>
                <span class="detail-value">${orderData.product_description}</span>
            </div>
            `
                : ""
            }

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
                <span class="detail-value">${new Date(
                  orderData.created_at,
                ).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}</span>
            </div>
        </div>

        <div class="contact-info">
            <h3>¿Necesitas Ayuda?</h3>
            <p>No dudes en contactarnos si tienes alguna pregunta sobre tu pedido.</p>
            <p>📱 WhatsApp: ${orderData.customer_phone || "Contactanos"}</p>
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
      from: "Luna Gold <onboarding@resend.dev>",
      to: [orderData.customer_email],
      subject: "✨ ¡Compra Confirmada! - Luna Gold",
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

registerApiRoutes(app, {
  supabase,
  slugifyValue,
  normalizeCategoryRecord,
  normalizeCollectionRecord,
  mapProductResponse,
  isMissingCatalogRelation,
  isMissingCatalogColumn,
  findCategoryBySlug,
  findCollectionBySlug,
  resolveProductCatalogPayload,
  removeStorageObject,
  getCategoriesCatalog,
  getCollectionsCatalog,
  saveOrder,
  updateOrderStatus,
  getAllOrders,
  getOrderById,
  sendConfirmationEmail,
  upload,
  supabaseAdmin,
  storageBucket,
  buildStoragePath,
});

app.use(createViewsRouter({ getAllOrders }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "lunaperla-backend",
    timestamp: new Date().toISOString(),
  });
});

app.use(notFound);
app.use(errorHandler);
module.exports = { app, PORT };
