import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

async function run() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '1WNBGLClx9Jrxt954C5UY9l8c61fmadCjmZ0Ge25xTc4';
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'TER!A:D',
  });
  const rows = res.data.values || [];
  const rates = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][2] === 'K/2') {
      rates.push(rows[i]);
    }
  }
  console.log("K/2 Rates in sheet:");
  console.log(rates.slice(0, 15));
}
run().catch(console.error);
