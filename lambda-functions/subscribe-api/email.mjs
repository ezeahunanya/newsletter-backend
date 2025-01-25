import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

let sesClient = null;

const getSESClient = () => {
  if (!sesClient) {
    sesClient = new SESClient({ region: process.env.AWS_REGION });
  }
  return sesClient;
};

export const sendVerificationEmail = async (
  email,
  verificationUrl,
  configurationSet,
) => {
  const sesClient = getSESClient();

  const emailParams = {
    Destination: { ToAddresses: [email] },
    Message: {
      Body: {
        Html: {
          Data: `
            <html>
              <body>
                <p>Hey,</p>
                <p>Thank you for subscribing! Please verify your email address by clicking the <a href="${verificationUrl}">link</a>.</p>
                <p>Please note that if you do not verify your email, you will not receive any further communications from me.</p>
                <p>Thanks,</p>
                <p>Eze</p>
              </body>
            </html>
          `,
        },
      },
      Subject: { Data: "Verify your email" },
    },
    Source: process.env.SES_SOURCE_EMAIL,
    ConfigurationSetName: configurationSet,
  };

  await sesClient.send(new SendEmailCommand(emailParams));
};

export const sendWelcomeEmail = async (
  email,
  accountCompletionUrl,
  configurationSet,
  preferencesUrl,
) => {
  const sesClient = getSESClient();

  const emailParams = {
    Destination: { ToAddresses: [email] },
    Message: {
      Body: {
        Html: {
          Data: `
            <html>
              <body>
                <p>Hey,</p>
                <p>Thank you for verifying your email and joining me on this incredible journey!</p>
                <p>My goal with this newsletter is simple: to help you discover and align with God’s plans for your life. These plans were established long before the foundations of the earth—plans that reflect His perfect will and purpose for you.
                Whether you're just starting to ask questions or actively seeking direction, you're in the right place. Together, we’ll explore practical steps and biblical wisdom for you to step with confindence in the direction of your purpose.</p>
                <p>As Proverbs 19:21 reminds us: “Many are the plans in a person’s heart, but it is the Lord’s purpose that prevails.”
                Through this newsletter, I’ll share insights, resources, and encouragement to help you align your life with God’s purpose. I’d also love to hear from you—your story, questions, and struggles are all welcome. You can reach me at <strong><a href="mailto:contact@ezeahunanya.com">contact@ezeahunanya.com</a></strong>.</p>
                <p>Also feel free to let me know your name with this link <a href="${accountCompletionUrl}">here</a>.</p>
                <p>Let’s walk this journey together!</p>
                <p>With faith and purpose,</p>
                <p>Eze</p>
                <p>To manage your preferences or unsubscribe, click <a href="${preferencesUrl}">here</a>.</p>
              </body>
            </html>
          `,
        },
      },
      Subject: { Data: "Welcome to the Community" },
    },
    Source: process.env.SES_SOURCE_EMAIL,
    ConfigurationSetName: configurationSet,
  };

  await sesClient.send(new SendEmailCommand(emailParams));
};

export const sendRegeneratedTokenEmail = async (
  email,
  link,
  configurationSet,
  origin,
) => {
  const sesClient = getSESClient();

  // Dynamic text based on the origin
  const subject =
    origin === "verify-email"
      ? "Here's your new email verification link"
      : "Here's your new account completion link";

  const body =
    origin === "verify-email"
      ? `
      <p>Hey,</p>
      <p>It seems like your previous email verification link has expired. Click the link below to verify your email address:</p>
      <p><a href="${link}">Verify Email</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <p>Thanks,</p>
      <p>Eze</p>
    `
      : `
      <p>Hey,</p>
      <p>It seems like your previous account completion link has expired. Click the link below to complete your account setup:</p>
      <p><a href="${link}">Complete Account</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <p>Thanks,</p>
      <p>Eze</p>
    `;

  const emailParams = {
    Destination: { ToAddresses: [email] },
    Message: {
      Body: { Html: { Data: `<html><body>${body}</body></html>` } },
      Subject: { Data: subject },
    },
    Source: process.env.SES_SOURCE_EMAIL,
    ConfigurationSetName: configurationSet,
  };

  await sesClient.send(new SendEmailCommand(emailParams));
};
