import crypto from "crypto";

/**
 * Generates a unique token and its hash, ensuring it doesn't already exist in the database.
 *
 * @param {Object} client - The database client.
 * @param {number} maxRetries - The maximum number of attempts to generate a unique token.
 * @returns {Object} - An object containing the token and its hash.
 * @throws {Error} - If a unique token cannot be generated after the maximum retries.
 */
export const generateUniqueToken = async (client, maxRetries = 10) => {
  let retries = 0;
  let token, tokenHash, isUnique;

  console.log("Attempting to generate a unique token...");

  do {
    if (retries >= maxRetries) {
      console.error(
        `❌ Failed to generate a unique token after ${retries} attempts.`
      );
      throw new Error(
        "Failed to generate a unique token after multiple attempts."
      );
    }

    token = crypto.randomBytes(32).toString("hex");
    tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    console.log(`Retry ${retries + 1}: Checking if token is unique...`);

    const tokenCheckQuery = `
      SELECT 1 FROM ${process.env.TOKEN_TABLE_NAME} WHERE token_hash = $1;
    `;
    const tokenCheckResult = await client.query(tokenCheckQuery, [tokenHash]);

    isUnique = tokenCheckResult.rows.length === 0;
    retries++;

    if (isUnique) {
      console.log(`✅ Token is unique after ${retries} retries.`);
    }
  } while (!isUnique);

  console.log("✅ Successfully generated a unique token.");
  return { token, tokenHash };
};
