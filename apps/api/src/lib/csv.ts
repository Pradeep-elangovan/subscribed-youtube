// Parses the subscriptions.csv file from Google Takeout
// (columns: Channel ID, Channel URL, Channel title).

export interface ImportedChannel {
  id: string;
  title: string;
}

const CHANNEL_ID = /^UC[\w-]{22}$/;

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

export function parseTakeoutCsv(text: string): ImportedChannel[] {
  const rows = parseRows(text.replace(/^﻿/, ''));
  const header = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  const idCol = header.indexOf('channel id');
  const titleCol = header.indexOf('channel title');
  if (idCol === -1) throw new Error('Not a Takeout subscriptions file: missing "Channel ID" column');

  const seen = new Set<string>();
  const channels: ImportedChannel[] = [];
  for (const row of rows) {
    const id = row[idCol]?.trim() ?? '';
    if (!CHANNEL_ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    channels.push({ id, title: (titleCol === -1 ? '' : row[titleCol]?.trim()) || id });
  }
  return channels;
}
