const { Router } = require("express");

function createViewsRouter({ getAllOrders }) {
  const router = Router();

  router.get("/dashboard", async (_req, res) => {
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
              }, 30000);
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

  return router;
}

module.exports = { createViewsRouter };
