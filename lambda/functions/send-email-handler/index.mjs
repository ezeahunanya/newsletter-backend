import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendRegeneratedTokenEmail,
} from "./email.mjs";
import { processSingleMessage } from "/opt/shared/sqs/processSQSMessages.mjs";

export const handler = async (event) => {
  if (!event || !event.Records || !Array.isArray(event.Records)) {
    throw new Error("Invalid SQS event: Missing or malformed Records array.");
  }

  try {
    for (const record of event.Records) {
      const { eventType } = JSON.parse(record.body);

      if (eventType === "verify-email") {
        const requiredVariables = ["email", "verificationUrl"];
        await processSingleMessage(
          record,
          requiredVariables,
          sendVerificationEmail
        );
      } else if (eventType === "welcome-email") {
        const requiredVariables = [
          "email",
          "accountCompletionUrl",
          "preferencesUrl",
        ];
        await processSingleMessage(record, requiredVariables, sendWelcomeEmail);
      } else if (eventType === "regenerate-token") {
        const requiredVariables = ["email", "linkUrl", "origin"];
        await processSingleMessage(
          record,
          requiredVariables,
          sendRegeneratedTokenEmail
        );
      } else {
        console.error("❌ Invalid event type:", eventType);
        throw new Error("Invalid event type");
      }
    }
  } catch (error) {
    console.error(`❌ Failed to process SQS message for ${email}`, error);
    throw error; // Lambda retries on failure
  }

  console.log("Finished processing SQS messages.");
};
