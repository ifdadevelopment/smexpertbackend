import { GoogleAuth } from "google-auth-library";
import fs from "fs";
import fetch from "node-fetch";

const KEY_FILE = process.env.SERVICE_ACCOUNT_KEY_PATH;
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
});

export async function getAccessToken() {
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  if (!res || !res.token) throw new Error("Failed to get access token");
  return res.token;
}

export async function sendToToken(
  token,
  { title, body, data = {}, badge = 0 }
) {
  const accessToken = await getAccessToken();
  const message = {
    message: {
      token,
      notification: { title, body },
      android: {
        priority: "HIGH",
        notification: {
          channel_id: "default",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            badge,
            sound: "default",
          },
        },
      },
      data,
    },
  };

  const res = await fetch(FCM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  const json = await res.json();
  return json;
}
