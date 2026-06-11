const { createPublicRoutes } = require("./publicRoutes");
const { createAdminRoutes } = require("./adminRoutes");
const { createPaymentRoutes } = require("./paymentRoutes");
const { createDashboardRoutes } = require("./dashboardRoutes");
const { createAuthRoutes } = require("./authRoutes");
const requireAuth = require("../middlewares/requireAuth");

function registerApiRoutes(app, deps) {
  app.use(
    "/api",
    createAuthRoutes({
      supabaseAdmin: deps.supabaseAdmin,
    }),
  );

  app.use(
    "/api",
    createPublicRoutes({
      supabase: deps.supabase,
      isMissingCatalogColumn: deps.isMissingCatalogColumn,
      mapProductResponse: deps.mapProductResponse,
      getCategoriesCatalog: deps.getCategoriesCatalog,
      getCollectionsCatalog: deps.getCollectionsCatalog,
      slugifyValue: deps.slugifyValue,
    }),
  );

  app.use(
    "/api",
    createPaymentRoutes({
      saveOrder: deps.saveOrder,
      updateOrderStatus: deps.updateOrderStatus,
    }),
  );

  app.use(
    "/api",
    requireAuth,
    requireAuth.authorize("admin"),
    createAdminRoutes({
      supabase: deps.supabase,
      slugifyValue: deps.slugifyValue,
      normalizeCategoryRecord: deps.normalizeCategoryRecord,
      normalizeCollectionRecord: deps.normalizeCollectionRecord,
      mapProductResponse: deps.mapProductResponse,
      isMissingCatalogRelation: deps.isMissingCatalogRelation,
      isMissingCatalogColumn: deps.isMissingCatalogColumn,
      findCategoryBySlug: deps.findCategoryBySlug,
      findCollectionBySlug: deps.findCollectionBySlug,
      resolveProductCatalogPayload: deps.resolveProductCatalogPayload,
      removeStorageObject: deps.removeStorageObject,
      upload: deps.upload,
      supabaseAdmin: deps.supabaseAdmin,
      storageBucket: deps.storageBucket,
      buildStoragePath: deps.buildStoragePath,
    }),
  );

  app.use(
    "/api",
    requireAuth,
    requireAuth.authorize("admin"),
    createDashboardRoutes({
      getAllOrders: deps.getAllOrders,
      getOrderById: deps.getOrderById,
      sendConfirmationEmail: deps.sendConfirmationEmail,
    }),
  );
}

module.exports = {
  registerApiRoutes,
};
