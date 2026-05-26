const { MercadoPagoConfig, Preference } = require("mercadopago");
const { env } = require("../config/env");

const mercadoPagoClient = new MercadoPagoConfig({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
});

module.exports = {
  mercadoPagoClient,
  Preference,
};
