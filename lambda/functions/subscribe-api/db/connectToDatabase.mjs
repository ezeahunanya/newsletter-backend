import { getSecret } from "../utils/getSecret.mjs";
import pg from "pg";

const { Client } = pg;

export const getDbCredentials = async () => {
  const dbCredentials = await getSecret(process.env.DB_SECRET_NAME);
  return dbCredentials;
};

export const connectToDatabase = async (dbCredentials) => {
  const { DB_HOST, DB_NAME, DB_PORT } = process.env;

  if (!dbCredentials) {
    console.error("❌ Missing database credentials.");
    throw new Error("Missing database credentials.");
  }

  if (!DB_HOST || !DB_NAME || !DB_PORT) {
    console.error("❌ Missing environment variables for database connection.");
    throw new Error("Missing environment variables for database connection.");
  }

  console.log(
    `Attempting to connect to database ${DB_NAME} at ${DB_HOST}:${DB_PORT}...`
  );

  const client = new Client({
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
    throw new Error("Database connection failed");
  }
};
