import { getSecret } from "../credentials/getSecret.mjs";
import pg from "pg";

const { Client } = pg;

export const getDbCredentials = async () => {
  const dbCredentials = await getSecret(process.env.DB_SECRET_NAME);
  return dbCredentials;
};

export const connectToDatabase = async (dbCredentials) => {
  const { DB_HOST, DB_NAME, DB_PORT } = process.env;

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
    return client;
  } catch (error) {
    console.error("Database connection failed:", error);
    throw new Error("Database connection failed");
  }
};
