import { handleSubscription } from "./subscribe.mjs";
import { processSQSMessages } from "/opt/shared/processSQSMessages.mjs";

export const handler = async (event) => {
  if (event.source === "aws.events") {
    console.log("🔄 Lambda warm-up request detected. Exiting early.");
    return;
  }

  const requiredVariables = ["email", "eventType"];
  const useDatabase = true; // Explicitly define if the database is used.

  try {
    await processSQSMessages(
      event,
      requiredVariables,
      handleSubscription,
      useDatabase
    );
    console.log("✅ All SQS messages processed successfully.");
  } catch (error) {
    console.error("❌ Error during SQS message processing:", error);
  }
};
