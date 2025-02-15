import { sendEmailWithTemplate } from "./sendEmailWithTemplate.mjs";
import { getSecret } from "/opt/shared/utils/getSecret.mjs";

export const getSmtpCredentials = async () => {
  console.log("Fetching SMTP credentials from secrets manager...");
  const smtpCredentials = await getSecret(process.env.SMTP_SECRET_NAME);
  console.log("✅ SMTP credentials fetched successfully.");
  return smtpCredentials;
};

// Verification email
export const sendVerificationEmail = async (extractedVariables = {}) => {
  const { email, verificationUrl } = extractedVariables;
  await sendEmailWithTemplate(
    email,
    "verify-email", // Template name
    { verificationUrl }, // Dynamic data for the template
    "Verify your email" // Subject line
  );
};

// Welcome email
export const sendWelcomeEmail = async (extractedVariables = {}) => {
  const { email, accountCompletionUrl, preferencesUrl } = extractedVariables;
  await sendEmailWithTemplate(
    email,
    "welcome-email", // Template name
    { accountCompletionUrl, preferencesUrl }, // Dynamic data for the template
    "Welcome to the Community" // Subject line
  );
};

// Regenerated token email
export const sendRegeneratedTokenEmail = async (extractedVariables = {}) => {
  const { email, link, origin } = extractedVariables;
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
    subject // Subject line based on origin
  );
};
