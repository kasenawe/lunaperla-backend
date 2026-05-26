const {
  slugifyValue,
  slugifyCategoryName,
  formatCategoryNameFromSlug,
} = require("./slug");

const DEFAULT_CATEGORY_SLUG = "bebe";
const DEFAULT_CATEGORIES = [
  {
    slug: "bebe",
    name: "Coleccion Bebe",
    description: "Caravanas y joyas delicadas para bebe.",
  },
  {
    slug: "alianzas",
    name: "Alianzas",
    description: "Anillos y alianzas para compromiso, boda o regalo.",
  },
  {
    slug: "anillos",
    name: "Anillos",
    description: "Piezas clasicas y contemporaneas para uso diario o especial.",
  },
  {
    slug: "collares",
    name: "Collares",
    description: "Diseños para sumar brillo y elegancia a cada look.",
  },
  {
    slug: "pulseras",
    name: "Pulseras",
    description: "Detalles finos para regalar o completar un conjunto.",
  },
];

function normalizeProductCategoryPayload(payload = {}) {
  const rawName =
    typeof payload.category === "string" ? payload.category.trim() : "";
  const rawSlug =
    typeof payload.category_slug === "string"
      ? slugifyCategoryName(payload.category_slug)
      : "";

  const matchedDefault = DEFAULT_CATEGORIES.find(
    (item) =>
      item.slug === rawSlug ||
      item.name.toLowerCase() === rawName.toLowerCase(),
  );

  const categorySlug =
    rawSlug || slugifyCategoryName(rawName) || DEFAULT_CATEGORY_SLUG;
  const categoryName =
    rawName || matchedDefault?.name || formatCategoryNameFromSlug(categorySlug);

  return {
    category: categoryName,
    category_slug: categorySlug,
  };
}

function normalizeProductCollectionPayload(payload = {}) {
  const rawName =
    typeof payload.collection === "string" ? payload.collection.trim() : "";
  const rawSlug =
    typeof payload.collection_slug === "string"
      ? slugifyValue(payload.collection_slug)
      : "";

  if (!rawName && !rawSlug) {
    return {
      collection: null,
      collection_slug: null,
    };
  }

  const collectionSlug = rawSlug || slugifyValue(rawName);
  const collectionName = rawName || formatCategoryNameFromSlug(collectionSlug);

  return {
    collection: collectionName,
    collection_slug: collectionSlug || null,
  };
}

function normalizeCategoryRecord(record = {}, fallbackSortOrder = 0) {
  const slug = typeof record.slug === "string" ? record.slug.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";

  return {
    slug: slug || DEFAULT_CATEGORY_SLUG,
    name: name || formatCategoryNameFromSlug(slug) || "Coleccion Bebe",
    description:
      typeof record.description === "string" ? record.description : "",
    active: record.active ?? true,
    sort_order:
      typeof record.sort_order === "number"
        ? record.sort_order
        : fallbackSortOrder,
  };
}

function normalizeCollectionRecord(record = {}, fallbackSortOrder = 0) {
  const slug = typeof record.slug === "string" ? record.slug.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const categorySlug =
    typeof record.category_slug === "string"
      ? record.category_slug.trim()
      : DEFAULT_CATEGORY_SLUG;

  return {
    slug: slug || slugifyValue(name),
    name: name || formatCategoryNameFromSlug(slug),
    description:
      typeof record.description === "string" ? record.description : "",
    category_slug: categorySlug || DEFAULT_CATEGORY_SLUG,
    active: record.active ?? true,
    sort_order:
      typeof record.sort_order === "number"
        ? record.sort_order
        : fallbackSortOrder,
  };
}

function mapProductResponse(item) {
  return {
    ...item,
    ...normalizeProductCategoryPayload(item),
    ...normalizeProductCollectionPayload(item),
  };
}

module.exports = {
  DEFAULT_CATEGORY_SLUG,
  DEFAULT_CATEGORIES,
  normalizeProductCategoryPayload,
  normalizeProductCollectionPayload,
  normalizeCategoryRecord,
  normalizeCollectionRecord,
  mapProductResponse,
};
