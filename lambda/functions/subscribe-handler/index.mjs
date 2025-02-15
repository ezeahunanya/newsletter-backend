import { handleSubscription } from "./subscribe.mjs";
import { processSNSMessages } from "/opt/shared/sns/processSNSMessages.mjs";

export const handler = async (event) => {
  if (event.source === "aws.events") {
    console.log("🔄 Lambda warm-up request detected. Exiting early.");
    return;
  }

  const requiredVariables = ["email", "eventType"];
  const useDatabase = true; // Explicitly define if the database is used.

  try {
    await processSNSMessages(
      event,
      requiredVariables,
      handleSubscription,
      useDatabase
    );
    console.log("✅ All SNS messages processed successfully.");
  } catch (error) {
    console.error("❌ Error during SNS message processing:", error);
  }
};
