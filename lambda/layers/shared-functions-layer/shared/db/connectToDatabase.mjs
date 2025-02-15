import { getSecret } from "../utils/getSecret.mjs";
import pg from "pg";

const { Client } = pg;

let dbClient; // Shared database connection
let dbCredentials; // Cached credentials

/**
 * Establishes or reuses a database connection.
 * @returns {Promise<pg.Client>} - A connected database client.
 */
export const connectToDatabase = async () => {
  if (dbClient) {
    try {
      // Verify if the connection is still active
      await dbClient.query("SELECT 1");
      console.log("✅ Reusing existing database connection.");
      return dbClient;
    } catch (error) {
      console.error("❌ Stale connection detected. Reconnecting...");
      dbClient = null; // Reset the client
    }
  }

  // Retrieve database credentials if not cached
  if (!dbCredentials) {
    console.log("🔄 Fetching database credentials...");
    try {
      dbCredentials = await getSecret(process.env.DB_SECRET_NAME);
    } catch (error) {
      console.error("❌ Failed to retrieve database credentials:", error);
      throw new Error("Failed to retrieve database credentials");
    }
  }

  // Validate required environment variables
  const { DB_HOST, DB_NAME, DB_PORT } = process.env;
  if (!DB_HOST || !DB_NAME || !DB_PORT) {
    console.error(
      "❌ Missing required environment variables for database connection."
    );
    throw new Error(
      "Missing required environment variables for database connection"
    );
  }

  console.log(
    `🔄 Creating new database connection to ${DB_HOST}:${DB_PORT}...`
  );

  dbClient = new Client({
    host: DB_HOST,
    database: DB_NAME,
    port: parseInt(DB_PORT, 10),
    user: dbCredentials.username,
    password: dbCredentials.password,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await dbClient.connect();
    console.log("✅ Successfully connected to the database.");
    return dbClient;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    dbClient = null; // Reset the client in case of failure
    throw new Error("Database connection failed");
  }
};
