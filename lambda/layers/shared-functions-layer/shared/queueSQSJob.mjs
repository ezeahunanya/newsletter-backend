import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

let sqsClient = null;

const getSQSClient = () => {
  if (!sqsClient) {
    console.log("Initializing new SQS client...");
    sqsClient = new SQSClient({ region: process.env.AWS_REGION });
    console.log("✅ Successfully initialized SQS client.");
  }
  return sqsClient;
};

// 🔹 Define queue URLs based on event types
const queueUrlMap = {
  "verify-email": process.env.VERIFY_EMAIL_QUEUE_URL,
  "welcome-email": process.env.WELCOME_EMAIL_QUEUE_URL,
  "regenerate-token": process.env.VERIFY_EMAIL_QUEUE_URL,
  newsletter: process.env.PROCESS_EMAIL_QUEUE_URL,
  "new-subscriber": process.env.NEW_SUBSCRIBER_QUEUE_URL,
};

/**
 * Queues an email job in SQS
 * @param {string} eventType - The type of email event
 * @param {string} email - Recipient email
 * @param {object} data - Email data (subject, template, links, etc.)
 */

export const queueSQSJob = async (eventType, data = {}) => {
  const queueUrl = queueUrlMap[eventType];

  const sqsClient = getSQSClient();
  const messageBody = JSON.stringify({
    eventType,
    email,
    data,
  });

  try {
    await sqsClient.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: messageBody })
    );
    console.log(`✅ Successfully queued SQS job to ${queueUrl}`);
  } catch (error) {
    console.error(`❌ Failed to queue SQS job:`, error);
    throw new Error("Failed to queue SQS job");
  }
};
