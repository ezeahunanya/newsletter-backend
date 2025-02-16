import { createResponse } from "./createResponse";

// Utility function for handling errors
export const handleError = async (error, client) => {
  console.error("❌ Error occurred:", error);

  if (client) {
    try {
      await client.query("ROLLBACK");
      console.log("🔄 Rolled back transaction.");
    } catch (rollbackError) {
      console.error("❌ Failed to rollback transaction:", rollbackError);
    }
  }

  const message = error.message.toLowerCase();
  if (
    message.includes("expired") ||
    message.includes("used") ||
    message.includes("not found")
  ) {
    return createResponse(400, { error: error.message });
  }

  return createResponse(500, { error: "Internal Server Error" });
};
