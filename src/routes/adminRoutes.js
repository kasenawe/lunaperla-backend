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

  // Endpoint para subir imagenes al bucket de productos usando service role
  router.post("/api/upload-image", (req, res) => {
    upload.single("image")(req, res, async (uploadError) => {
      if (uploadError) {
        if (uploadError.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ error: "La imagen debe pesar menos de 5MB" });
        }

        return res.status(400).json({
          error: uploadError.message || "Error validando archivo de imagen",
        });
      }

      try {
        if (!supabaseAdmin) {
          return res.status(500).json({
            error:
              "SUPABASE_SERVICE_ROLE_KEY no configurada en backend. No se puede subir imagen.",
          });
        }

        if (!req.file) {
          return res
            .status(400)
            .json({ error: "No se recibio ningun archivo" });
        }

        const objectPath = buildStoragePath(req.file.originalname || "image");

        const { error: storageError } = await supabaseAdmin.storage
          .from(storageBucket)
          .upload(objectPath, req.file.buffer, {
            cacheControl: "3600",
            upsert: false,
            contentType: req.file.mimetype || "application/octet-stream",
          });

        if (storageError) {
          console.error("Error subiendo imagen a Supabase:", storageError);
          return res.status(400).json({ error: storageError.message });
        }

        const { data } = supabaseAdmin.storage
          .from(storageBucket)
          .getPublicUrl(objectPath);

        if (!data?.publicUrl) {
          return res
            .status(500)
            .json({ error: "No se pudo obtener la URL publica de la imagen" });
        }

        res.status(201).json({
          image_url: objectPath,
          public_url: data.publicUrl,
          path: objectPath,
        });
      } catch (error) {
        console.error("Error en upload-image:", error);
        res.status(500).json({
          error: error?.message || "Error interno al subir imagen",
        });
      }
    });
  });

  return router;
}

module.exports = {
  createAdminRoutes,
};
