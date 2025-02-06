import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

let sqsClient = null;

const getSQSClient = () => {
  if (!sqsClient) {
    sqsClient = new SQSClient({ region: process.env.AWS_REGION });
  }
  return sqsClient;
};

// 🔹 Define queue URLs based on event types
export const queueUrlMap = {
  "verify-email": process.env.VERIFY_EMAIL_QUEUE_URL,
  "welcome-email": process.env.WELCOME_EMAIL_QUEUE_URL,
  "regenerate-token": process.env.VERIFY_EMAIL_QUEUE_URL,
};

/**
 * Queues an email job in SQS
 * @param {string} queueUrl - The URL of the SQS queue
 * @param {string} email - Recipient email
 * @param {object} data - Email data (subject, template, links, etc.)
 */

export const queueEmailJob = async (queueUrl, email, data = {}) => {
  if (!queueUrl) {
    throw new Error(`❌ No queue URL provided`);
  }

  const sqsClient = getSQSClient();
  const messageBody = JSON.stringify({
    email,
    data,
  });

  await sqsClient.send(
    new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: messageBody })
  );
  console.log(`✅ Queued email job for ${email} to ${queueUrl}`);
};
