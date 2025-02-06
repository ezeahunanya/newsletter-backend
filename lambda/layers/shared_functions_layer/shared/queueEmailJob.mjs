import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

let sqsClient = null;

const getSQSClient = () => {
  if (!sqsClient) {
    console.log("Initializing new SQS client...");
    sqsClient = new SQSClient({ region: process.env.AWS_REGION });
  }
  return sqsClient;
};

// 🔹 Define queue URLs based on event types
const queueUrlMap = {
  "verify-email": process.env.VERIFY_EMAIL_QUEUE_URL,
  "welcome-email": process.env.WELCOME_EMAIL_QUEUE_URL,
  "regenerate-token": process.env.VERIFY_EMAIL_QUEUE_URL,
  "newsletter": process.env.PROCESS_EMAIL_QUEUE_URL,
};

/**
 * Queues an email job in SQS
 * @param {string} eventType - The type of email event
 * @param {string} email - Recipient email
 * @param {object} data - Email data (subject, template, links, etc.)
 */

export const queueEmailJob = async (eventType, email, data = {}) => {
  const queueUrl = queueUrlMap[eventType];

  if (!email) {
    console.error("❌ No email provided for email job.");
    throw new Error("No email provided");
  }

  console.log(`Queuing email job for ${email} to ${queueUrl}...`);

  const sqsClient = getSQSClient();
  const messageBody = JSON.stringify({
    email,
    data,
  });

  try {
    await sqsClient.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: messageBody })
    );
    console.log(`✅ Successfully queued email job for ${email} to ${queueUrl}`);
  } catch (error) {
    console.error(`❌ Failed to queue email job for ${email}:`, error);
    throw new Error("Failed to queue email job");
  }
};
