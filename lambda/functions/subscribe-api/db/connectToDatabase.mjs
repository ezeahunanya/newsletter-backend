import { getSecret } from "../utils/getSecret.mjs";
import pg from "pg";

const { Client } = pg;

let client; // Shared variable

export const getDbCredentials = async () => {
  return await getSecret(process.env.DB_SECRET_NAME);
};

export const connectToDatabase = async (dbCredentials) => {
  if (client) {
    console.log("✅ Reusing existing database connection.");
    return client;
  }

  const { DB_HOST, DB_NAME, DB_PORT } = process.env;

  if (!dbCredentials) {
    console.error("❌ Missing database credentials.");
    throw new Error("Missing database credentials.");
  }

  console.log(
    `🔄 Creating new database connection to ${DB_HOST}:${DB_PORT}...`
  );

  client = new Client({
    host: DB_HOST,
    database: DB_NAME,
    port: parseInt(DB_PORT, 10),
    user: dbCredentials.username,
    password: dbCredentials.password,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Successfully connected to the database.");
    return client;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    client = null; // Reset on failure
    throw new Error("Database connection failed");
  }
};
