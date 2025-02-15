import fetch from "node-fetch";
import { getSecret } from "/opt/shared/utils/getSecret.mjs";

let accessToken = null;
let lastTokenFetchTime = 0;
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes buffer

export const getSmtpCredentials = async () => {
  const smtpCredentials = await getSecret(process.env.SMTP_SECRET_NAME);
  return smtpCredentials;
};

export const getAccessToken = async (forceRefresh = false) => {
  const now = Date.now();
  console.log(
    `Checking if a new access token is needed. Force refresh: ${forceRefresh}`
  );

  // If we already have a token and it's still valid, return it
  if (
    !forceRefresh &&
    accessToken &&
    now - lastTokenFetchTime < 3600 * 1000 - TOKEN_EXPIRY_BUFFER
  ) {
    console.log("✅ Using cached access token.");
    return accessToken;
  }

  console.log("Fetching new access token from Microsoft OAuth2...");

  const smtpSecrets = await getSmtpCredentials();
  const {
    OUTLOOK_CLIENT_SECRET,
    OUTLOOK_REFRESH_TOKEN,
    OUTLOOK_CLIENT_ID,
    OUTLOOK_TENANT_ID,
  } = smtpSecrets;

  try {
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
      console.error("❌ Failed to get access token:", data);
      throw new Error("Failed to obtain OAuth2 access token");
    }

    accessToken = data.access_token;
    lastTokenFetchTime = Date.now();
    console.log("✅ New access token successfully fetched.");
    return accessToken;
  } catch (error) {
    console.error("❌ Error while fetching access token:", error);
    throw new Error("Failed to fetch access token from Outlook.");
  }
};
