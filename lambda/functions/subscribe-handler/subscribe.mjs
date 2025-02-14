import { generateUniqueToken } from "/opt/shared/generateUniqueToken.mjs";

export const handleSubscription = async (requiredVariables = {}, client) => {
  let email, eventType;
  try {
    ({ email, eventType } = requiredVariables);
  } catch {
    console.error("❌ Invalid JSON payload.");
  }

  return await processSubscription(client, email, eventType);
};

/**
 * Processes the subscription logic, including database transactions.
 * @param {object} client - Database client
 * @param {string} email - Subscriber's email
 * @returns {object} - Lambda HTTP response
 */
const processSubscription = async (client, email, eventType) => {
  if (eventType === "new-subscriber") {
    try {
      await client.query("BEGIN");
      console.log("🔄 Transaction started.");

      const userId = await insertSubscriber(client, email);
      const { token, tokenHash } = await generateUniqueToken(client);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await insertVerificationToken(client, userId, tokenHash, expiresAt);

      await client.query("COMMIT");
      console.log("✅ Transaction committed successfully.");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("❌ Transaction failed, rolling back changes:", error);

      if (error.code === "23505") {
        console.error("❌ Email already subscribed.");
      }
    }
  }
};

/**
 * Inserts a new subscriber into the database.
 * @param {object} client - Database client
 * @param {string} email - Subscriber's email
 * @returns {number} - Subscriber ID
 */
const insertSubscriber = async (client, email) => {
  console.log(`Inserting new subscriber with email: ${email}`);
  const result = await client.query(
    `
    INSERT INTO ${process.env.SUBSCRIBERS_TABLE_NAME} 
    (email, subscribed, subscribed_at, email_verified, preferences)
    VALUES ($1, true, NOW(), false, $2) 
    RETURNING id;
    `,
    [email, JSON.stringify({ updates: true, promotions: true })]
  );
  const userId = result.rows[0].id;
  console.log(`✅ Subscriber added with ID: ${userId}`);
  return userId;
};

/**
 * Inserts a verification token into the database.
 * @param {object} client - Database client
 * @param {number} userId - Subscriber ID
 * @param {string} tokenHash - Hashed token
 * @param {Date} expiresAt - Token expiry date
 */
const insertVerificationToken = async (
  client,
  userId,
  tokenHash,
  expiresAt
) => {
  console.log(`Inserting verification token for user ID: ${userId}`);
  await client.query(
    `
    INSERT INTO ${process.env.TOKEN_TABLE_NAME} 
    (user_id, token_hash, token_type, expires_at, used, created_at, updated_at)
    VALUES ($1, $2, 'email_verification', $3, false, NOW(), NOW());
    `,
    [userId, tokenHash, expiresAt]
  );
  console.log("✅ Token inserted successfully.");
};
