import { sendEmailWithTemplate } from "./sendEmailWithTemplate.mjs";

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
