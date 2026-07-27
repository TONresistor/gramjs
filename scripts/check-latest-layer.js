"use strict";

const https = require("https");
const lock = require("../telegram-schema.lock.json");

const schemaUrl =
  "https://raw.githubusercontent.com/telegramdesktop/tdesktop/dev/" +
  "Telegram/SourceFiles/mtproto/scheme/api.tl";

function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 3) {
      reject(new Error("Too many redirects"));
      return;
    }
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "TONresistor-gramjs-layer-check",
        },
        timeout: 15000,
      },
      (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          resolve(download(response.headers.location, redirects + 1));
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`HTTP status ${response.statusCode}`));
          return;
        }
        response.setEncoding("utf8");
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => resolve(body));
      }
    );
    request.on("timeout", () => {
      request.destroy(new Error("Request timed out"));
    });
    request.on("error", reject);
  });
}

download(schemaUrl)
  .then((schema) => {
    const markers = [...schema.matchAll(/^\/\/ LAYER (\d+)\s*$/gm)].map(
      (match) => Number(match[1])
    );
    if (markers.length !== 1) {
      throw new Error(`Expected one layer marker, found ${markers.length}`);
    }
    const latest = markers[0];
    if (latest > lock.layer) {
      console.error(
        `Telegram Layer ${latest} is available; fork is locked to ${lock.layer}`
      );
      process.exitCode = 1;
      return;
    }
    if (latest < lock.layer) {
      throw new Error(
        `Telegram dev reports Layer ${latest}, below locked Layer ${lock.layer}`
      );
    }
    console.log(`Telegram layer is current at ${lock.layer}`);
  })
  .catch((error) => {
    console.error(`Unable to check Telegram layer: ${error.message}`);
    process.exitCode = 2;
  });
