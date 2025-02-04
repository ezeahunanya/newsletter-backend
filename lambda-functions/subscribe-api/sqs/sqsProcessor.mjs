import { sendVerificationEmail, sendWelcomeEmail } from "../email/email.mjs";

export const processSQSMessage = async (event) => {
  for (const record of event.Records) {
    const { email, eventType, data } = JSON.parse(record.body);

    try {
      if (eventType === "verify-email") {
        await sendVerificationEmail(email, data.verificationUrl);
      } else if (eventType === "welcome-email") {
        await sendWelcomeEmail(
          email,
          data.accountCompletionUrl,
          data.preferencesUrl
        );
      } else {
        throw new Error("Invalid event type");
      }
    } catch (error) {
      console.error("Failed to process SQS message", error);
      throw error; // Lambda retries on failure
    }
  }
};
