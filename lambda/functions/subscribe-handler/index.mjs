import { handleSubscription } from "./subscribe.mjs";
import { processSQSMessages } from "/opt/shared/processSQSMessages.mjs";

export const handler = async (event) => {
  if (event.source === "aws.events") {
    console.log("Lambda warm-up request. Returning early.");
    return;
  }

  const requiredVariables = ["email", "eventType"];

  try {
    await processSQSMessages(
      event,
      requiredVariables,
      handleSubscription,
      useDatabase
    );
    console.log("✅ Lambda completed successfully.");
  } catch (error) {
    console.error("❌ Error handling subscription:", error);
  }
};
