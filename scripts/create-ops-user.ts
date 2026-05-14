import bcrypt from "bcryptjs";

type CliOptions = {
  email: string;
  password: string;
  name: string;
  dryRun: boolean;
  verifyLogin: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const getArg = (key: string): string | undefined => {
    const idx = argv.indexOf(`--${key}`);
    if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1];
    return undefined;
  };

  const email = getArg("email");
  const password = getArg("password");
  const name = getArg("name") ?? "운영 계정";
  const dryRun = argv.includes("--dry-run");
  const verifyLogin = argv.includes("--verify-login");

  if (!email || !email.includes("@")) {
    throw new Error(`Invalid email: ${email}`);
  }

  if (!password) {
    throw new Error("Password is required");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  return { email, password, name, dryRun, verifyLogin };
}

async function upsertUser(options: CliOptions) {
  const { email, password, name, dryRun, verifyLogin } = options;
  const hashedPassword = await bcrypt.hash(password, 10);

  if (dryRun) {
    const verify = verifyLogin ? await bcrypt.compare(password, hashedPassword) : undefined;
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          email,
          name,
          hashGenerated: hashedPassword.length > 0,
          verifyLogin: verify,
          note: "DATABASE_URL 없이도 해시/검증 로직을 확인할 수 있습니다.",
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required unless --dry-run is used.");
  }

  const [{ eq }, schema, dbModule] = await Promise.all([
    import("drizzle-orm"),
    import("../shared/schema"),
    import("../server/db"),
  ]);

  const { db, pool, readonlyPool } = dbModule;

  try {
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    let userId: string;
    let action: "created" | "updated";

    if (existing[0]) {
      const updated = await db
        .update(schema.users)
        .set({
          password: hashedPassword,
          name,
          authProvider: "local",
        })
        .where(eq(schema.users.id, existing[0].id))
        .returning({ id: schema.users.id });

      userId = updated[0].id;
      action = "updated";
    } else {
      const created = await db
        .insert(schema.users)
        .values({
          email,
          password: hashedPassword,
          name,
          authProvider: "local",
        })
        .returning({ id: schema.users.id });

      userId = created[0].id;
      action = "created";
    }

    const settings = await db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .limit(1);

    if (!settings[0]) {
      await db.insert(schema.userSettings).values({
        userId,
        tradingMode: "mock",
        riskLevel: "medium",
        aiModel: "gpt-5.1",
      });
    }

    const verify = verifyLogin ? await bcrypt.compare(password, hashedPassword) : undefined;

    console.log(
      JSON.stringify(
        {
          action,
          email,
          userId,
          verifyLogin: verify,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
    await readonlyPool.end();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await upsertUser(options);
}

main().catch((error) => {
  console.error("[create-ops-user] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
