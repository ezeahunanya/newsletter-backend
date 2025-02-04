import fetch from "node-fetch";
import { getSecret } from "../credentials/getSecret.mjs";

export const getSmtpCredentials = async () => {
  const smtpCredentials = await getSecret(process.env.SMTP_SECRET_NAME);
  return smtpCredentials;
};

export const getAccessToken = async () => {
  const secrets = await getSmtpCredentials();
  const { OUTLOOK_CLIENT_SECRET, OUTLOOK_REFRESH_TOKEN } = secrets;
  const { OUTLOOK_CLIENT_ID, OUTLOOK_TENANT_ID } = process.env;

  const response = await fetch(
    `https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: OUTLOOK_CLIENT_ID,
        client_secret: OUTLOOK_CLIENT_SECRET,
        refresh_token: OUTLOOK_REFRESH_TOKEN,
        grant_type: "refresh_token",
        scope: "https://outlook.office365.com/.default",
      }),
    }
  );

  const data = await response.json();
  if (!data.access_token) {
    console.error("Failed to get access token:", data);
    throw new Error("Failed to obtain OAuth2 access token");
  }

  return data.access_token;
};
