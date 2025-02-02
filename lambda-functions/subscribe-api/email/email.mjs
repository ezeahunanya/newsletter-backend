import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import nunjucks from "nunjucks";
import path from "path";
import { fileURLToPath } from "url";

let sesClient = null;

const getSESClient = () => {
  if (!sesClient) {
    sesClient = new SESClient({ region: process.env.AWS_REGION });
  }
  return sesClient;
};

// Define __dirname manually for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Nunjucks for rendering templates
const configureNunjucks = () => {
  const templatesPath = path.resolve(__dirname, "emailTemplates");
  nunjucks.configure(templatesPath, {
    autoescape: true,
  });
};

// Generic function to send emails using a Maizzle template
export const sendEmailWithTemplate = async (
  email,
  templateName,
  context,
  subject,
  configurationSet
) => {
  configureNunjucks();

  // Render email HTML using Nunjucks
  const emailHtml = nunjucks.render(`${templateName}.html`, context);

  const sesClient = getSESClient();

  const emailParams = {
    Destination: { ToAddresses: [email] },
    Message: {
      Body: { Html: { Data: emailHtml } },
      Subject: { Data: subject },
    },
    Source: process.env.SES_SOURCE_EMAIL,
    ConfigurationSetName: configurationSet,
  };

  await sesClient.send(new SendEmailCommand(emailParams));
};

// Verification email
export const sendVerificationEmail = async (
  email,
  verificationUrl,
  configurationSet
) => {
  await sendEmailWithTemplate(
    email,
    "verify-email", // Template name
    { verificationUrl }, // Dynamic data for the template
    "Verify your email", // Subject line
    configurationSet
  );
};

// Welcome email
export const sendWelcomeEmail = async (
  email,
  accountCompletionUrl,
  configurationSet,
  preferencesUrl
) => {
  await sendEmailWithTemplate(
    email,
    "welcome-email", // Template name
    { accountCompletionUrl, preferencesUrl }, // Dynamic data for the template
    "Welcome to the Community", // Subject line
    configurationSet
  );
};

// Regenerated token email
export const sendRegeneratedTokenEmail = async (
  email,
  link,
  configurationSet,
  origin
) => {
  // Define template name and subject dynamically based on the origin
  const templateName =
    origin === "verify-email"
      ? "regenerate-verify-email-token"
      : "regenerate-complete-account-token";

  const subject =
    origin === "verify-email"
      ? "Here's your new email verification link"
      : "Here's your new account completion link";

  await sendEmailWithTemplate(
    email,
    templateName, // Template name based on origin
    { link }, // Dynamic data for the template
    subject, // Subject line based on origin
    configurationSet
  );
};
