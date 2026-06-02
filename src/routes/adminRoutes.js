const express = require("express");

function createAdminRoutes({
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
  parseErrorMessage,
  removeStorageObject,
  upload,
  supabaseAdmin,
  storageBucket,
  buildStoragePath,
}) {
  const router = express.Router();

  function isProductCodeUniqueViolation(error) {
    if (!error || error.code !== "23505") {
      return false;
    }

    const errorMessage = String(error.message || "");
    const errorDetail = String(error.details || "");

    return (
      errorMessage.includes("uq_products_product_code") ||
      errorDetail.includes("product_code")
    );
  }

  function isVariantUniqueViolation(error) {
    if (!error || error.code !== "23505") {
      return false;
    }

    const errorMessage = String(error.message || "").toLowerCase();
    const errorDetail = String(error.details || "").toLowerCase();

    return (
      errorMessage.includes("product_variants") ||
      errorMessage.includes("sku") ||
      errorDetail.includes("sku") ||
      errorDetail.includes("label")
    );
  }

  function normalizeVariantPayload(payload = {}) {
    const sku =
      typeof payload.sku === "string" ? payload.sku.trim().toUpperCase() : "";
    const label = typeof payload.label === "string" ? payload.label.trim() : "";
    const karat =
      typeof payload.karat === "string" && payload.karat.trim()
        ? payload.karat.trim().toUpperCase()
        : null;
    const profile =
      typeof payload.profile === "string" && payload.profile.trim()
        ? payload.profile.trim().toLowerCase()
        : null;
    const closureType =
      typeof payload.closure_type === "string" && payload.closure_type.trim()
        ? payload.closure_type.trim().toLowerCase()
        : null;

    const parsedPrice = Number(payload.price);
    const parsedWidthMm =
      payload.width_mm === "" ||
      payload.width_mm === null ||
      payload.width_mm === undefined
        ? null
        : Number(payload.width_mm);
    const parsedSortOrder = Number(payload.sort_order);

    if (!sku) {
      throw new Error("El SKU es obligatorio");
    }

    if (!label) {
      throw new Error("La etiqueta de la variante es obligatoria");
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      throw new Error("El precio de la variante debe ser mayor a 0");
    }

    if (
      parsedWidthMm !== null &&
      (!Number.isFinite(parsedWidthMm) || parsedWidthMm <= 0)
    ) {
      throw new Error("El ancho en mm debe ser mayor a 0");
    }

    let metadata = {};
    if (payload.metadata && typeof payload.metadata === "object") {
      metadata = payload.metadata;
    }

    return {
      sku,
      label,
      karat,
      width_mm: parsedWidthMm,
      profile,
      closure_type: closureType,
      price: Number(parsedPrice.toFixed(2)),
      active: payload.active ?? true,
      sort_order: Number.isFinite(parsedSortOrder)
        ? Math.trunc(parsedSortOrder)
        : 0,
      metadata,
    };
  }

  router.post("/categories", async (req, res) => {
    try {
      const payload = normalizeCategoryRecord(req.body);

      if (!payload.name || !payload.slug) {
        return res
          .status(400)
          .json({ error: "Nombre y slug son obligatorios" });
      }

      const existingCategory = await findCategoryBySlug(payload.slug);
      if (existingCategory) {
        return res
          .status(409)
          .json({ error: "Ya existe una categoria con ese slug" });
      }

      const { data, error } = await supabase
        .from("categories")
        .insert([payload])
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json(normalizeCategoryRecord(data));
    } catch (error) {
      console.error("Error creando categoria:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.put("/categories/:slug", async (req, res) => {
    try {
      const currentSlug = slugifyValue(req.params.slug);
      const payload = normalizeCategoryRecord(req.body);

      if (!payload.name || !payload.slug) {
        return res
          .status(400)
          .json({ error: "Nombre y slug son obligatorios" });
      }

      const existingCategory = await findCategoryBySlug(currentSlug);
      if (!existingCategory) {
        return res.status(404).json({ error: "Categoria no encontrada" });
      }

      if (payload.slug !== currentSlug) {
        const categoryWithNewSlug = await findCategoryBySlug(payload.slug);
        if (categoryWithNewSlug) {
          return res
            .status(409)
            .json({ error: "Ya existe una categoria con ese slug" });
        }
      }

      const { data, error } = await supabase
        .from("categories")
        .update(payload)
        .eq("slug", currentSlug)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const productsUpdate = await supabase
        .from("products")
        .update({
          category: payload.name,
          category_slug: payload.slug,
        })
        .eq("category_slug", currentSlug);

      if (
        productsUpdate.error &&
        !isMissingCatalogColumn(productsUpdate.error)
      ) {
        throw productsUpdate.error;
      }

      const collectionsUpdate = await supabase
        .from("collections")
        .update({ category_slug: payload.slug })
        .eq("category_slug", currentSlug);

      if (
        collectionsUpdate.error &&
        !isMissingCatalogRelation(collectionsUpdate.error)
      ) {
        throw collectionsUpdate.error;
      }

      res.json(normalizeCategoryRecord(data));
    } catch (error) {
      console.error("Error actualizando categoria:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.delete("/categories/:slug", async (req, res) => {
    try {
      const slug = slugifyValue(req.params.slug);
      const existingCategory = await findCategoryBySlug(slug);

      if (!existingCategory) {
        return res.status(404).json({ error: "Categoria no encontrada" });
      }

      const { count: productCount, error: productCountError } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("category_slug", slug);

      if (productCountError) {
        throw productCountError;
      }

      if ((productCount || 0) > 0) {
        return res.status(400).json({
          error:
            "No puedes eliminar una categoria que todavia tiene productos asociados",
        });
      }

      const { count: collectionCount, error: collectionCountError } =
        await supabase
          .from("collections")
          .select("slug", { count: "exact", head: true })
          .eq("category_slug", slug);

      if (
        collectionCountError &&
        !isMissingCatalogRelation(collectionCountError)
      ) {
        throw collectionCountError;
      }

      if ((collectionCount || 0) > 0) {
        return res.status(400).json({
          error:
            "No puedes eliminar una categoria que todavia tiene colecciones asociadas",
        });
      }

      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("slug", slug);

      if (error) {
        throw error;
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error eliminando categoria:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.post("/collections", async (req, res) => {
    try {
      const payload = normalizeCollectionRecord(req.body);

      if (!payload.name || !payload.slug || !payload.category_slug) {
        return res.status(400).json({
          error: "Nombre, slug y categoria son obligatorios",
        });
      }

      const linkedCategory = await findCategoryBySlug(payload.category_slug);
      if (!linkedCategory) {
        return res
          .status(400)
          .json({ error: "La categoria seleccionada no existe" });
      }

      const existingCollection = await findCollectionBySlug(payload.slug);
      if (existingCollection) {
        return res
          .status(409)
          .json({ error: "Ya existe una coleccion con ese slug" });
      }

      const { data, error } = await supabase
        .from("collections")
        .insert([payload])
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json(normalizeCollectionRecord(data));
    } catch (error) {
      console.error("Error creando coleccion:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.put("/collections/:slug", async (req, res) => {
    try {
      const currentSlug = slugifyValue(req.params.slug);
      const payload = normalizeCollectionRecord(req.body);

      if (!payload.name || !payload.slug || !payload.category_slug) {
        return res.status(400).json({
          error: "Nombre, slug y categoria son obligatorios",
        });
      }

      const existingCollection = await findCollectionBySlug(currentSlug);
      if (!existingCollection) {
        return res.status(404).json({ error: "Coleccion no encontrada" });
      }

      const linkedCategory = await findCategoryBySlug(payload.category_slug);
      if (!linkedCategory) {
        return res
          .status(400)
          .json({ error: "La categoria seleccionada no existe" });
      }

      if (payload.slug !== currentSlug) {
        const collectionWithNewSlug = await findCollectionBySlug(payload.slug);
        if (collectionWithNewSlug) {
          return res
            .status(409)
            .json({ error: "Ya existe una coleccion con ese slug" });
        }
      }

      const { data, error } = await supabase
        .from("collections")
        .update(payload)
        .eq("slug", currentSlug)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const productsUpdate = await supabase
        .from("products")
        .update({
          collection: payload.name,
          collection_slug: payload.slug,
          category: linkedCategory.name,
          category_slug: linkedCategory.slug,
        })
        .eq("collection_slug", currentSlug);

      if (
        productsUpdate.error &&
        !isMissingCatalogColumn(productsUpdate.error)
      ) {
        throw productsUpdate.error;
      }

      res.json(normalizeCollectionRecord(data));
    } catch (error) {
      console.error("Error actualizando coleccion:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.delete("/collections/:slug", async (req, res) => {
    try {
      const slug = slugifyValue(req.params.slug);
      const existingCollection = await findCollectionBySlug(slug);

      if (!existingCollection) {
        return res.status(404).json({ error: "Coleccion no encontrada" });
      }

      const { count: productCount, error: productCountError } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("collection_slug", slug);

      if (productCountError && !isMissingCatalogColumn(productCountError)) {
        throw productCountError;
      }

      if ((productCount || 0) > 0) {
        return res.status(400).json({
          error:
            "No puedes eliminar una coleccion que todavia tiene productos asociados",
        });
      }

      const { error } = await supabase
        .from("collections")
        .delete()
        .eq("slug", slug);

      if (error) {
        throw error;
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error eliminando coleccion:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.post("/products", async (req, res) => {
    try {
      const { name, price, image_url, description, active, product_code } =
        req.body;
      const catalogData = await resolveProductCatalogPayload(req.body);

      if (!name || price === undefined || !image_url || !description) {
        return res.status(400).json({ error: "Faltan campos obligatorios" });
      }

      const { data, error } = await supabase
        .from("products")
        .insert([
          {
            name,
            product_code:
              typeof product_code === "string" && product_code.trim()
                ? product_code.trim()
                : null,
            price,
            image_url,
            description,
            category: catalogData.category,
            category_slug: catalogData.category_slug,
            collection: catalogData.collection,
            collection_slug: catalogData.collection_slug,
            active: active ?? true,
          },
        ])
        .select()
        .single();

      if (error) {
        if (isProductCodeUniqueViolation(error)) {
          return res.status(409).json({
            error: "Ya existe un producto con ese código de producto",
          });
        }

        if (isMissingCatalogColumn(error) || isMissingCatalogRelation(error)) {
          return res.status(400).json({
            error:
              "Faltan columnas o tablas del catalogo. Ejecuta la migracion de fase 2 en Supabase.",
          });
        }

        throw error;
      }

      res.status(201).json(mapProductResponse(data));
    } catch (error) {
      try {
        await removeStorageObject(req.body?.image_url);
      } catch (cleanupError) {
        console.error(
          "Error eliminando imagen huérfana al crear producto:",
          cleanupError,
        );
      }

      console.error("Error creando producto:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.put("/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, price, image_url, description, active, product_code } =
        req.body;
      const catalogData = await resolveProductCatalogPayload(req.body);

      if (!name || price === undefined || !image_url || !description) {
        return res.status(400).json({ error: "Faltan campos obligatorios" });
      }

      const { data: existingProduct, error: existingError } = await supabase
        .from("products")
        .select("id, image_url")
        .eq("id", id)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (!existingProduct) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }

      const { data, error } = await supabase
        .from("products")
        .update({
          name,
          product_code:
            typeof product_code === "string" && product_code.trim()
              ? product_code.trim()
              : null,
          price,
          image_url,
          description,
          category: catalogData.category,
          category_slug: catalogData.category_slug,
          collection: catalogData.collection,
          collection_slug: catalogData.collection_slug,
          active: active ?? true,
        })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) {
        if (isProductCodeUniqueViolation(error)) {
          return res.status(409).json({
            error: "Ya existe un producto con ese código de producto",
          });
        }

        if (isMissingCatalogColumn(error) || isMissingCatalogRelation(error)) {
          return res.status(400).json({
            error:
              "Faltan columnas o tablas del catalogo. Ejecuta la migracion de fase 2 en Supabase.",
          });
        }

        throw error;
      }

      if (!data) {
        if (image_url && image_url !== existingProduct.image_url) {
          try {
            await removeStorageObject(image_url);
          } catch (cleanupError) {
            console.error(
              "Error eliminando imagen nueva tras fallo de update:",
              cleanupError,
            );
          }
        }

        return res.status(403).json({
          error:
            "Sin permisos para actualizar producto. Configura SUPABASE_SERVICE_ROLE_KEY en backend o agrega policy UPDATE",
        });
      }

      if (image_url && image_url !== existingProduct.image_url) {
        try {
          await removeStorageObject(existingProduct.image_url);
        } catch (cleanupError) {
          console.error(
            "Error eliminando imagen anterior del producto:",
            cleanupError,
          );
        }
      }

      res.json(mapProductResponse(data));
    } catch (error) {
      try {
        const newImagePath = req.body?.image_url;
        const currentProductId = req.params?.id;

        if (newImagePath && currentProductId) {
          const { data: existingProduct } = await supabase
            .from("products")
            .select("image_url")
            .eq("id", currentProductId)
            .maybeSingle();

          if (!existingProduct || newImagePath !== existingProduct.image_url) {
            await removeStorageObject(newImagePath);
          }
        }
      } catch (cleanupError) {
        console.error(
          "Error eliminando imagen nueva tras excepción de update:",
          cleanupError,
        );
      }

      console.error("Error actualizando producto:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.delete("/products/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const { data: existingProduct, error: existingError } = await supabase
        .from("products")
        .select("id, image_url")
        .eq("id", id)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (!existingProduct) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }

      const { error } = await supabase.from("products").delete().eq("id", id);

      if (error) {
        throw error;
      }

      try {
        await removeStorageObject(existingProduct.image_url);
      } catch (cleanupError) {
        console.error(
          "Error eliminando imagen del producto borrado:",
          cleanupError,
        );
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error eliminando producto:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.get("/products/:id/variants", async (req, res) => {
    try {
      const { id } = req.params;

      const { data: productExists, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("id", id)
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      if (!productExists) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }

      const { data, error } = await supabase
        .from("product_variants")
        .select(
          "id, product_id, sku, label, karat, width_mm, profile, closure_type, price, active, sort_order, metadata",
        )
        .eq("product_id", id)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true });

      if (error) {
        if (isMissingCatalogColumn(error) || isMissingCatalogRelation(error)) {
          return res.status(400).json({
            error:
              "Falta la tabla product_variants. Ejecuta supabase-product-variants.sql en Supabase.",
          });
        }

        throw error;
      }

      res.json(data || []);
    } catch (error) {
      console.error("Error cargando variantes de producto:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.post("/products/:id/variants", async (req, res) => {
    try {
      const { id } = req.params;

      const { data: productExists, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("id", id)
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      if (!productExists) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }

      let payload;
      try {
        payload = normalizeVariantPayload(req.body);
      } catch (validationError) {
        return res.status(400).json({ error: validationError.message });
      }

      const { data, error } = await supabase
        .from("product_variants")
        .insert([
          {
            ...payload,
            product_id: id,
          },
        ])
        .select(
          "id, product_id, sku, label, karat, width_mm, profile, closure_type, price, active, sort_order, metadata",
        )
        .single();

      if (error) {
        if (isVariantUniqueViolation(error)) {
          return res.status(409).json({
            error: "Ya existe una variante con ese SKU o etiqueta",
          });
        }

        if (isMissingCatalogColumn(error) || isMissingCatalogRelation(error)) {
          return res.status(400).json({
            error:
              "Falta la tabla product_variants. Ejecuta supabase-product-variants.sql en Supabase.",
          });
        }

        throw error;
      }

      res.status(201).json(data);
    } catch (error) {
      console.error("Error creando variante de producto:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.put("/products/:id/variants/:variantId", async (req, res) => {
    try {
      const { id, variantId } = req.params;

      const { data: existingVariant, error: existingError } = await supabase
        .from("product_variants")
        .select("id, product_id")
        .eq("id", variantId)
        .eq("product_id", id)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (!existingVariant) {
        return res.status(404).json({ error: "Variante no encontrada" });
      }

      let payload;
      try {
        payload = normalizeVariantPayload(req.body);
      } catch (validationError) {
        return res.status(400).json({ error: validationError.message });
      }

      const { data, error } = await supabase
        .from("product_variants")
        .update(payload)
        .eq("id", variantId)
        .eq("product_id", id)
        .select(
          "id, product_id, sku, label, karat, width_mm, profile, closure_type, price, active, sort_order, metadata",
        )
        .maybeSingle();

      if (error) {
        if (isVariantUniqueViolation(error)) {
          return res.status(409).json({
            error: "Ya existe una variante con ese SKU o etiqueta",
          });
        }

        if (isMissingCatalogColumn(error) || isMissingCatalogRelation(error)) {
          return res.status(400).json({
            error:
              "Falta la tabla product_variants. Ejecuta supabase-product-variants.sql en Supabase.",
          });
        }

        throw error;
      }

      res.json(data);
    } catch (error) {
      console.error("Error actualizando variante de producto:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  router.delete("/products/:id/variants/:variantId", async (req, res) => {
    try {
      const { id, variantId } = req.params;

      const { data: existingVariant, error: existingError } = await supabase
        .from("product_variants")
        .select("id")
        .eq("id", variantId)
        .eq("product_id", id)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (!existingVariant) {
        return res.status(404).json({ error: "Variante no encontrada" });
      }

      const { error } = await supabase
        .from("product_variants")
        .delete()
        .eq("id", variantId)
        .eq("product_id", id);

      if (error) {
        if (isMissingCatalogColumn(error) || isMissingCatalogRelation(error)) {
          return res.status(400).json({
            error:
              "Falta la tabla product_variants. Ejecuta supabase-product-variants.sql en Supabase.",
          });
        }

        throw error;
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error eliminando variante de producto:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // Genera una URL firmada para que el cliente suba la imagen directamente a
  // Supabase Storage. El binario nunca pasa por esta funcion de Vercel, por lo
  // que no aplica el limite de 4.5 MB de payload de Vercel.
  router.post("/upload-image-token", async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({
          error:
            "SUPABASE_SERVICE_ROLE_KEY no configurada en backend. No se puede subir imagen.",
        });
      }

      const { filename, content_type } = req.body;

      if (!content_type || !String(content_type).startsWith("image/")) {
        return res
          .status(400)
          .json({ error: "Solo se permiten archivos de imagen" });
      }

      if (!filename || typeof filename !== "string") {
        return res.status(400).json({ error: "Nombre de archivo requerido" });
      }

      const objectPath = buildStoragePath(filename);

      const { data, error: signedUrlError } = await supabaseAdmin.storage
        .from(storageBucket)
        .createSignedUploadUrl(objectPath);

      if (signedUrlError) {
        console.error("Error generando signed URL:", signedUrlError);
        return res.status(500).json({ error: signedUrlError.message });
      }

      const { data: publicData } = supabaseAdmin.storage
        .from(storageBucket)
        .getPublicUrl(objectPath);

      res.json({
        signed_url: data.signedUrl,
        path: objectPath,
        public_url: publicData?.publicUrl || null,
      });
    } catch (error) {
      console.error("Error en upload-image-token:", error);
      res.status(500).json({
        error: error?.message || "Error interno al generar URL de subida",
      });
    }
  });

  return router;
}

module.exports = {
  createAdminRoutes,
};
