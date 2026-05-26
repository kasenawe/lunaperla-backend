const { Resend } = require("resend");
const { env } = require("../config/env");

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

module.exports = {
  resend,
};
