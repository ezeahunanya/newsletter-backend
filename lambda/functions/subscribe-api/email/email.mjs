import { sendEmailWithTemplate } from "./sendEmailWithTemplate.mjs";
import { getSecret } from "../utils/getSecret.mjs";

export const getSmtpCredentials = async () => {
  console.log("Fetching SMTP credentials from secrets manager...");
  const smtpCredentials = await getSecret(process.env.SMTP_SECRET_NAME);
  console.log("✅ SMTP credentials fetched successfully.");
  return smtpCredentials;
};

// Verification email
export const sendVerificationEmail = async (email, verificationUrl) => {
  await sendEmailWithTemplate(
    email,
    "verify-email", // Template name
    { verificationUrl }, // Dynamic data for the template
    "Verify your email" // Subject line
  );
};

// Welcome email
export const sendWelcomeEmail = async (
  email,
  accountCompletionUrl,
  preferencesUrl
) => {
  await sendEmailWithTemplate(
    email,
    "welcome-email", // Template name
    { accountCompletionUrl, preferencesUrl }, // Dynamic data for the template
    "Welcome to the Community" // Subject line
  );
};

// Regenerated token email
export const sendRegeneratedTokenEmail = async (email, link, origin) => {
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
