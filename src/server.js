const app = require("./app");
const { env } = require("./config/env");

const PORT = env.PORT;

async function start() {
  if (typeof app.ensureInitialAdminUser === "function") {
    await app.ensureInitialAdminUser();
  }

  app.listen(PORT, () => {
    console.log("🚀 Backend corriendo en puerto " + PORT);
  });
}

start().catch((error) => {
  console.error("❌ Error iniciando el backend:", error);
  process.exit(1);
});
