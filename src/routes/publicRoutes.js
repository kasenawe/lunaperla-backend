const express = require("express");

function normalizeProductVariant(record = {}) {
  const metadata =
    record.metadata && typeof record.metadata === "object"
      ? record.metadata
      : {};

  return {
    id: record.id,
    product_id: record.product_id,
    sku: record.sku,
    label: record.label,
    karat: record.karat ?? null,
    width_mm:
      record.width_mm === null || record.width_mm === undefined
        ? null
        : Number(record.width_mm),
    profile: record.profile ?? null,
    closure_type: record.closure_type ?? null,
    price: Number(record.price),
    active: record.active ?? true,
    sort_order: record.sort_order ?? 0,
    metadata,
  };
}

function createPublicRoutes({
  supabase,
  isMissingCatalogColumn,
  mapProductResponse,
  getCategoriesCatalog,
  getCollectionsCatalog,
  slugifyValue,
}) {
  const router = express.Router();

  router.get("/products", async (req, res) => {
    try {
      const includeAll = String(req.query.all || "").toLowerCase() === "true";

      let query = supabase
        .from("products")
        .select(
          "id, name, price, image_url, description, product_code, active, category, category_slug, collection, collection_slug",
        )
        .order("category_slug", { ascending: true })
        .order("collection_slug", { ascending: true })
        .order("name", { ascending: true });

      if (!includeAll) {
        query = query.eq("active", true);
      }

      let { data, error } = await query;

      if (error && isMissingCatalogColumn(error)) {
        let fallbackQuery = supabase
          .from("products")
          .select(
            "id, name, price, image_url, description, product_code, active, category, category_slug",
          )
          .order("category_slug", { ascending: true })
          .order("name", { ascending: true });

        if (!includeAll) {
          fallbackQuery = fallbackQuery.eq("active", true);
        }

        const fallbackResult = await fallbackQuery;
        data = (fallbackResult.data || []).map((item) => ({
          ...item,
          collection: null,
          collection_slug: null,
        }));
        error = fallbackResult.error;
      }

      if (error) {
        throw error;
      }

      const productIds = (data || []).map((item) => item.id).filter(Boolean);
      let variantsByProductId = new Map();

      if (productIds.length > 0) {
        const { data: variantRows, error: variantError } = await supabase
          .from("product_variants")
          .select(
            "id, product_id, sku, label, karat, width_mm, profile, closure_type, price, active, sort_order, metadata",
          )
          .in("product_id", productIds)
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true });

        if (variantError) {
          if (isMissingCatalogColumn(variantError)) {
            console.warn(
              "⚠️ product_variants no está disponible aún; devolviendo productos sin variantes.",
            );
          } else {
            throw variantError;
          }
        }

        variantsByProductId = new Map();
        for (const variant of variantRows || []) {
          const normalizedVariant = normalizeProductVariant(variant);
          const list = variantsByProductId.get(normalizedVariant.product_id) || [];
          list.push(normalizedVariant);
          variantsByProductId.set(normalizedVariant.product_id, list);
        }
      }

      res.json(
        (data || []).map((item) => ({
          ...mapProductResponse(item),
          variants: variantsByProductId.get(item.id) || [],
        })),
      );
    } catch (error) {
      console.error("Error cargando productos:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.get("/categories", async (req, res) => {
    try {
      const includeAll = String(req.query.all || "").toLowerCase() === "true";
      const categories = await getCategoriesCatalog({ includeAll });
      res.json(categories);
    } catch (error) {
      console.error("Error cargando categorias:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.get("/collections", async (req, res) => {
    try {
      const includeAll = String(req.query.all || "").toLowerCase() === "true";
      const categorySlug =
        typeof req.query.category_slug === "string"
          ? slugifyValue(req.query.category_slug)
          : null;

      const collections = await getCollectionsCatalog({
        includeAll,
        categorySlug,
      });

      res.json(collections);
    } catch (error) {
      console.error("Error cargando colecciones:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  return router;
}

module.exports = {
  createPublicRoutes,
};
