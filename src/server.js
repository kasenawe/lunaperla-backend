const { app, PORT } = require("./app");

app.listen(PORT, () => {
  console.log("🚀 Backend corriendo en puerto " + PORT);
});
