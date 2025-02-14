import { connectToDatabase } from "/opt/shared/connectToDatabase.mjs";

/**
 * Processes SQS messages.
 *
 * @param {object} event - The SQS event object.
 * @param {string[]} requiredVariables - List of variable names to extract from each record.
 * @param {function} processFunction - Function that processes each message, accepting extracted variables and optional client.
 * @param {boolean} [useDatabase=false] - Whether to connect to the database and pass the client to the processFunction.
 */
export const processSQSMessages = async (
  event,
  requiredVariables,
  processFunction,
  useDatabase = false
) => {
  if (!event || !event.Records || !Array.isArray(event.Records)) {
    throw new Error("Invalid SQS event: Missing or malformed Records array.");
  }

  let client = null; // Initialize the database client (if needed)
  const results = []; // Keep track of processing results for logging or debugging.

  try {
    // Connect to the database if useDatabase is true
    if (useDatabase) {
      console.log("🔄 Establishing database connection...");
      client = await connectToDatabase();
    }

    for (const record of event.Records) {
      try {
        // Parse the SQS message body
        const messageBody = JSON.parse(record.body);
        console.log("🔄 Processing SQS message:", messageBody);

        // Extract required variables from the message body
        const extractedVariables = {};
        for (const variable of requiredVariables) {
          if (messageBody[variable] === undefined) {
            throw new Error(`Missing required variable: ${variable}`);
          }
          extractedVariables[variable] = messageBody[variable];
        }

        // Call the provided processing function with extracted variables and optional client
        const result = await processFunction(extractedVariables, client);
        results.push({ recordId: record.messageId, status: "success", result });

        console.log(
          `✅ Successfully processed message with ID: ${record.messageId}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to process message with ID: ${record.messageId}`,
          error
        );
        results.push({
          recordId: record.messageId,
          status: "failure",
          error: error.message,
        });

        // Decide whether to rethrow the error to trigger retries or log and skip
        // Uncomment below if you want SQS to retry failed messages:
        // throw error;
      }
    }

    console.log("🔔 All messages processed. Results:", results);
  } catch (error) {
    console.error("❌ Error during SQS message processing:", error);
    throw error; // Re-throw to let SQS retry all messages
  } finally {
    // Reset the database connection if it was used
    if (useDatabase && client) {
      client = null; // Reset the local variable only
    }
  }
};
