import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendRegeneratedTokenEmail,
} from "./email.mjs";
import { processSingleMessage } from "/opt/shared/sqs/processSQSMessages.mjs";

const EVENT_HANDLERS = {
  "verify-email": {
    requiredVariables: ["email", "verificationUrl"],
    handler: sendVerificationEmail,
  },
  "welcome-email": {
    requiredVariables: ["email", "accountCompletionUrl", "preferencesUrl"],
    handler: sendWelcomeEmail,
  },
  "regenerate-token": {
    requiredVariables: ["email", "linkUrl", "origin"],
    handler: sendRegeneratedTokenEmail,
  },
};

export const handler = async (event) => {
  if (!event || !event.Records || !Array.isArray(event.Records)) {
    console.error("❌ Invalid SQS event: Missing or malformed Records array.");
    throw new Error("Invalid SQS event: Missing or malformed Records array.");
  }

  const processRecord = async (record) => {
    try {
      const messageBody = JSON.parse(record.body);
      const { eventType } = messageBody;

      if (!EVENT_HANDLERS[eventType]) {
        console.error(`❌ Invalid event type: ${eventType}`);
        throw new Error(`Invalid event type: ${eventType}`);
      }

      const { requiredVariables, handler: emailHandler } =
        EVENT_HANDLERS[eventType];
      await processSingleMessage(record, requiredVariables, emailHandler);
    } catch (error) {
      console.error(
        `❌ Failed to process record: ${JSON.stringify(record)}`,
        error
      );
      throw error; // Ensure the message is retried if processing fails
    }
  };

  try {
    // Process all records in parallel for better performance
    await Promise.all(event.Records.map(processRecord));
    console.log("✅ Finished processing all SQS messages.");
  } catch (error) {
    console.error("❌ One or more messages failed to process.", error);
    throw error; // Trigger retry for the entire batch
  }
};
