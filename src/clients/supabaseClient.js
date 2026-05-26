const { createClient } = require("@supabase/supabase-js");
const { env } = require("../config/env");

const supabaseUrl = env.SUPABASE_URL;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseKey = supabaseServiceRoleKey || env.SUPABASE_ANON_KEY;
const storageBucket = env.SUPABASE_STORAGE_BUCKET || "products";

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ SUPABASE_URL y una key de Supabase (SERVICE_ROLE o ANON) son requeridos",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

module.exports = {
  supabase,
  supabaseAdmin,
  storageBucket,
};
