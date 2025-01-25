import crypto from "crypto";

/**
 * Generates a unique token and its hash, ensuring it doesn't already exist in the database.
 *
 * @param {Object} client - The database client.
 * @param {string} tokenTableName - The name of the token table.
 * @param {number} maxRetries - The maximum number of attempts to generate a unique token.
 * @returns {Object} - An object containing the token and its hash.
 * @throws {Error} - If a unique token cannot be generated after the maximum retries.
 */
export const generateUniqueToken = async (
  client,
  tokenTableName,
  maxRetries = 5,
) => {
  let retries = 0;
  let token, tokenHash, isUnique;

  do {
    if (retries >= maxRetries) {
      throw new Error(
        "Failed to generate a unique token after multiple attempts.",
      );
    }

    token = crypto.randomBytes(32).toString("hex");
    tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const tokenCheckQuery = `
      SELECT 1 FROM ${tokenTableName} WHERE token_hash = $1;
    `;
    const tokenCheckResult = await client.query(tokenCheckQuery, [tokenHash]);

    isUnique = tokenCheckResult.rows.length === 0;
    retries++;
  } while (!isUnique);

  return { token, tokenHash };
};
