import { normalizeEgyptianPhone, toAsciiDigits } from "../auth/security";

function csvDelimiter(text: string): string {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (const char of text.split(/\r?\n/, 1)[0] || "") {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") commas += 1;
    else if (!quoted && char === ";") semicolons += 1;
  }
  return semicolons > commas ? ";" : ",";
}

export function parseCrmCsv(text: string): string[][] {
  const content = text.replace(/^\uFEFF/, "");
  const delimiter = csvDelimiter(content);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (char === '"' && quoted && content[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && content[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error("ملف CSV يحتوي على علامة اقتباس غير مكتملة");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function normalizeCrmPhone(phone: string): string {
  const digits = toAsciiDigits(phone).replace(/\D/g, "");
  if (/^1[0125]\d{8}$/.test(digits)) return `+20${digits}`;
  const normalized = normalizeEgyptianPhone(phone);
  return /^\+201[0125]\d{8}$/.test(normalized) ? normalized : "";
}
