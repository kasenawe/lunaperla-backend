const express = require("express");

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

      res.json((data || []).map((item) => mapProductResponse(item)));
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
