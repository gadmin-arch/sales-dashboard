const { google } = require('googleapis');
const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const env = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }

  const creds = JSON.parse(env['GOOGLE_SERVICE_ACCOUNT_CREDENTIALS']);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '1sQuIgCAtdLr8D6jLAj2qoZDzIv04B33QtArRYt-TOSc';

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  console.log('Sheet names:', meta.data.sheets?.map(s => s.properties?.title));

  for (const sheet of meta.data.sheets || []) {
    const name = sheet.properties?.title || 'Sheet1';
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: name + '!A1:Z10',
    });
    console.log('\n=== ' + name + ' ===');
    data.data.values?.forEach((row, i) => {
      console.log('Row ' + (i + 1) + ':', JSON.stringify(row));
    });
  }
}
main().catch(console.error);
