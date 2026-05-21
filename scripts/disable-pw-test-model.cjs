const { Client } = require("pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const before = await client.query(
      "SELECT id, user_id, model_name, is_active FROM ai_models WHERE model_name = $1 ORDER BY id DESC",
      ["PW Test Model"],
    );
    console.log("[before]");
    console.log(JSON.stringify(before.rows, null, 2));

    const updated = await client.query(
      "UPDATE ai_models SET is_active = false, updated_at = NOW() WHERE model_name = $1 AND is_active = true RETURNING id, user_id, model_name, is_active",
      ["PW Test Model"],
    );
    console.log(`[updated] ${updated.rowCount}`);
    if (updated.rowCount > 0) {
      console.log(JSON.stringify(updated.rows, null, 2));
    }

    const after = await client.query(
      "SELECT id, user_id, model_name, is_active FROM ai_models WHERE model_name = $1 ORDER BY id DESC",
      ["PW Test Model"],
    );
    console.log("[after]");
    console.log(JSON.stringify(after.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

