import { generateUniqueToken } from "/opt/shared/utils/generateUniqueToken.mjs";
import { queueSQSJob } from "/opt/shared/sqs/queueSQSJob.mjs";

/**
 * Handles subscription logic based on the SQS message payload.
 *
 * @param {object} extractedVariables - Extracted variables from the message body.
 * @param {object|null} client - Database client, if applicable.
 */
export const handleSubscription = async (extractedVariables = {}, client) => {
  const { email, eventType } = extractedVariables;

  if (!email || !eventType) {
    console.error(
      "❌ Missing required variables in message payload:",
      extractedVariables
    );
    throw new Error("Invalid payload: Missing email or eventType.");
  }

  await processSubscription(client, email, eventType);
};

/**
 * Processes the subscription logic, including database transactions.
 *
 * @param {object} client - Database client.
 * @param {string} email - Subscriber's email.
 * @param {string} eventType - Type of event.
 */
const processSubscription = async (client, email, eventType) => {
  if (eventType !== "new-subscriber") {
    console.warn(`⚠️ Unsupported event type: ${eventType}`);
    throw new Error("Unsupported event type.");
  }

  try {
    await client.query("BEGIN");
    console.log("🔄 Database transaction started.");

    const userId = await insertSubscriber(client, email);
    const { token, tokenHash } = await generateUniqueToken(client);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Token expiration in 24 hours.

    await insertVerificationToken(client, userId, tokenHash, expiresAt);

    // ✅ Email queueing (inside the transaction)
    const verificationUrl = `${process.env.FRONTEND_DOMAIN_URL}/verify-email?token=${token}`;

    await queueSQSJob("verify-email", { email, verificationUrl });

    await client.query("COMMIT");
    console.log("✅ Subscription transaction committed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Transaction failed, rolling back changes:", error);

    if (error.code === "23505") {
      console.warn("⚠️ Duplicate email detected: Email already subscribed.");
      return; // Skip further processing for duplicate emails.
    }
    throw error; // Ensure error bubbles up for proper handling.
  }
};

/**
 * Inserts a new subscriber into the database.
 *
 * @param {object} client - Database client.
 * @param {string} email - Subscriber's email.
 * @returns {number} - Subscriber ID.
 */
const insertSubscriber = async (client, email) => {
  if (!process.env.SUBSCRIBERS_TABLE_NAME) {
    throw new Error("Environment variable SUBSCRIBERS_TABLE_NAME is not set.");
  }

  console.log(`🔄 Adding new subscriber with email: ${email}`);
  const result = await client.query(
    `
    INSERT INTO ${process.env.SUBSCRIBERS_TABLE_NAME} 
    (email, subscribed, subscribed_at, email_verified, preferences)
    VALUES ($1, true, NOW(), false, $2) 
    RETURNING id;
    `,
    [email, JSON.stringify({ updates: true, promotions: true })]
  );

  const userId = result.rows[0]?.id;
  if (!userId) {
    throw new Error("Failed to retrieve subscriber ID after insertion.");
  }

  console.log(`✅ Subscriber added successfully with ID: ${userId}`);
  return userId;
};

/**
 * Inserts a verification token into the database.
 *
 * @param {object} client - Database client.
 * @param {number} userId - Subscriber ID.
 * @param {string} tokenHash - Hashed token.
 * @param {Date} expiresAt - Token expiration date.
 */
const insertVerificationToken = async (
  client,
  userId,
  tokenHash,
  expiresAt
) => {
  if (!process.env.TOKEN_TABLE_NAME) {
    throw new Error("Environment variable TOKEN_TABLE_NAME is not set.");
  }

  console.log(`🔄 Adding verification token for user ID: ${userId}`);
  await client.query(
    `
    INSERT INTO ${process.env.TOKEN_TABLE_NAME} 
    (user_id, token_hash, token_type, expires_at, used, created_at, updated_at)
    VALUES ($1, $2, 'email_verification', $3, false, NOW(), NOW());
    `,
    [userId, tokenHash, expiresAt]
  );
  console.log("✅ Verification token added successfully.");
};
