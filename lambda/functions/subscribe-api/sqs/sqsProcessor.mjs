import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendRegeneratedTokenEmail,
} from "../email/email.mjs";

export const processSQSMessage = async (event) => {
  console.log("Processing SQS messages...");

  for (const record of event.Records) {
    const { email, eventType, data } = JSON.parse(record.body);

    console.log(
      `Processing message for email: ${email} with event type: ${eventType}`
    );

    try {
      if (eventType === "verify-email") {
        await sendVerificationEmail(email, data.verificationUrl);
      } else if (eventType === "welcome-email") {
        await sendWelcomeEmail(
          email,
          data.accountCompletionUrl,
          data.preferencesUrl
        );
      } else if (eventType === "regenerate-token") {
        await sendRegeneratedTokenEmail(email, data.linkUrl, data.origin);
      } else {
        console.error("❌ Invalid event type:", eventType);
        throw new Error("Invalid event type");
      }
    } catch (error) {
      console.error(`❌ Failed to process SQS message for ${email}`, error);
      throw error; // Lambda retries on failure
    }
  }

  console.log("Finished processing SQS messages.");
};
