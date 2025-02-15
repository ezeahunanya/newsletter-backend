import { connectToDatabase } from "../db/connectToDatabase.mjs";

/**
 * Processes SNS messages with optional database connectivity.
 *
 * @param {object} event - The SNS event object.
 * @param {string[]} requiredVariables - List of variable names to extract from each message.
 * @param {function} processFunction - Function that processes each message, accepting extracted variables and optional client.
 * @param {boolean} [useDatabase=false] - Whether to connect to the database and pass the client to the processFunction.
 */
export const processSNSMessages = async (
  event,
  requiredVariables,
  processFunction,
  useDatabase = false
) => {
  if (!event || !event.Records || !Array.isArray(event.Records)) {
    throw new Error("Invalid SNS event: Missing or malformed Records array.");
  }

  let client = null; // Initialize the database client if needed
  const results = []; // To store processing results for all records

  try {
    // Establish database connection if requested
    if (useDatabase) {
      console.log("🔄 Establishing database connection...");
      client = await connectToDatabase();
    }

    // Process each SNS record
    for (const record of event.Records) {
      const result = await processSingleMessage(
        record,
        requiredVariables,
        processFunction,
        client
      );
      results.push(result);
    }

    // Log summary of results after processing
    const successCount = results.filter((r) => r.status === "success").length;
    const failureCount = results.filter((r) => r.status === "failure").length;
    console.log(
      `🔔 Message processing completed: ${successCount} succeeded, ${failureCount} failed.`
    );
  } catch (error) {
    console.error("❌ Error during SNS message processing:", error);
    throw error; // Re-throw to ensure retries for all messages
  } finally {
    // Clean up database connection if it was used
    if (useDatabase && client) {
      client = null; // Reset the local variable only
    }
  }
};

/**
 * Processes a single SNS message.
 *
 * @param {object} record - The SNS record to process.
 * @param {string[]} requiredVariables - List of variables to extract from the message body.
 * @param {function} processFunction - Function to handle message logic.
 * @param {object|null} client - Optional database client for processing.
 * @returns {object} - Result object indicating success or failure.
 */
const processSingleMessage = async (
  record,
  requiredVariables,
  processFunction,
  client
) => {
  try {
    // Parse and validate the SNS message body
    const messageBody = JSON.parse(record.Sns.Message);
    const extractedVariables = extractVariables(messageBody, requiredVariables);

    // Execute the provided processing function
    const result = await processFunction(extractedVariables, client);
    console.log(
      `✅ Message ID ${record.Sns.MessageId} processed successfully.`
    );
    return { recordId: record.Sns.MessageId, status: "success", result };
  } catch (error) {
    console.error(
      `❌ Error processing message ID ${record.Sns.MessageId}:`,
      error
    );
    return {
      recordId: record.Sns.MessageId,
      status: "failure",
      error: error.message,
    };
  }
};

/**
 * Extracts required variables from the message body.
 *
 * @param {object} messageBody - Parsed JSON message body.
 * @param {string[]} requiredVariables - List of variables to extract.
 * @returns {object} - Object containing extracted variables.
 * @throws {Error} - If any required variable is missing.
 */
const extractVariables = (messageBody, requiredVariables) => {
  const extractedVariables = {};
  for (const variable of requiredVariables) {
    if (messageBody[variable] === undefined) {
      throw new Error(`Missing required variable: ${variable}`);
    }
    extractedVariables[variable] = messageBody[variable];
  }
  return extractedVariables;
};
