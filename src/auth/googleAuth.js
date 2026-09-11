const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const { app, shell } = require('electron');
const { google } = require('googleapis');

// Scopes: read/write calendar events (readonly is not enough to patch events;
// calendar.events alone would not cover calendarList.list(), which is used
// to merge events across all of the user's calendars, so we need the full
// calendar scope), and read/write tasks (needed for checkbox completion).
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks',
];

// Bump this whenever SCOPES changes so previously saved tokens (granted
// under the old, narrower scopes) are treated as invalid and re-auth is
// forced instead of failing later with "Insufficient Permission".
const SCOPE_VERSION = 2;

function getUserDataPath(fileName) {
  return path.join(app.getPath('userData'), fileName);
}

// In dev, allow a credentials.json placed at the project root as a fallback.
function resolveCredentialsPath() {
  const userDataPath = getUserDataPath('credentials.json');
  if (fs.existsSync(userDataPath)) return userDataPath;

  const projectRootPath = path.join(app.getAppPath(), 'credentials.json');
  if (fs.existsSync(projectRootPath)) return projectRootPath;

  return null;
}

function loadCredentials() {
  const credentialsPath = resolveCredentialsPath();
  if (!credentialsPath) {
    throw new Error(
      'credentials.json not found. Place your Google OAuth "Desktop app" client credentials at ' +
        `${getUserDataPath('credentials.json')} (or the project root during development).`
    );
  }
  const raw = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
  return raw.installed || raw.web;
}

function loadSavedToken() {
  const tokenPath = getUserDataPath('token.json');
  if (!fs.existsSync(tokenPath)) return null;
  try {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    if (token.scopeVersion !== SCOPE_VERSION) {
      // Granted under an older, narrower scope set (e.g. calendar.readonly) -
      // discard it so getAuthorizedClient() re-runs the OAuth flow and the
      // user re-consents to the current SCOPES instead of hitting
      // "Insufficient Permission" on write calls.
      clearSavedToken();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function saveToken(tokens) {
  fs.writeFileSync(
    getUserDataPath('token.json'),
    JSON.stringify({ ...tokens, scopeVersion: SCOPE_VERSION }, null, 2)
  );
}

function clearSavedToken() {
  const tokenPath = getUserDataPath('token.json');
  if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
}

// Runs the loopback OAuth flow (RFC 8252): opens the system browser and
// captures the redirect on a locally-bound ephemeral HTTP server.
function runOAuthFlow(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const requestUrl = new URL(req.url, 'http://127.0.0.1');
        if (requestUrl.pathname !== '/oauth2callback') {
          res.writeHead(404).end();
          return;
        }
        const code = requestUrl.searchParams.get('code');
        const error = requestUrl.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h2>인증이 취소되었습니다. 이 창을 닫아주세요.</h2>');
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2>Hermann Planner 인증이 완료되었습니다. 이 창을 닫아주세요.</h2>');
        server.close();

        const { tokens } = await oAuth2Client.getToken(code);
        resolve(tokens);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
      oAuth2Client.redirectUri = redirectUri;

      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
        redirect_uri: redirectUri,
      });

      shell.openExternal(authUrl);
    });

    server.on('error', reject);
  });
}

async function getAuthorizedClient() {
  const credentials = loadCredentials();
  const { client_id, client_secret } = credentials;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret);

  const savedToken = loadSavedToken();
  if (savedToken) {
    oAuth2Client.setCredentials(savedToken);
    oAuth2Client.on('tokens', (tokens) => {
      saveToken({ ...savedToken, ...tokens });
    });
    return oAuth2Client;
  }

  const tokens = await runOAuthFlow(oAuth2Client);
  oAuth2Client.setCredentials(tokens);
  saveToken(tokens);
  oAuth2Client.on('tokens', (newTokens) => {
    saveToken({ ...tokens, ...newTokens });
  });
  return oAuth2Client;
}

function isLoggedIn() {
  return loadSavedToken() !== null;
}

function logout() {
  clearSavedToken();
}

module.exports = {
  getAuthorizedClient,
  isLoggedIn,
  logout,
  resolveCredentialsPath,
};
