import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import pg from "pg";

const { Client } = pg;
let cachedDbCredentials = null;

export const getDbCredentials = async () => {
  if (cachedDbCredentials) return cachedDbCredentials;

  const secretsClient = new SecretsManagerClient({
    region: process.env.AWS_REGION,
  });
  const command = new GetSecretValueCommand({
    SecretId: process.env.DB_SECRET_ARN,
  });

  try {
    const secret = await secretsClient.send(command);
    cachedDbCredentials = JSON.parse(secret.SecretString);
    return cachedDbCredentials;
  } catch (error) {
    console.error("Failed to retrieve credentials:", error);
    throw new Error("Failed to retrieve database credentials");
  }
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
