export interface CsvRow {
  name: string;
  price: number;
  category: string;
  description?: string;
  chopBar?: boolean;
}

function truthy(v: string): boolean {
  return /^(yes|y|true|1|chop)/i.test(v.trim());
}

export const MENU_CSV_TEMPLATE =
  'name,price,category,description\nJollof Rice,45,Main Dishes,Smoky party jollof\nSobolo,10,Drinks,Chilled hibiscus drink\n';

// Parse a single CSV line into fields, honouring double-quoted values.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseMenuCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const first = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = first.includes('name') || first.includes('price');
  const idx = {
    name: hasHeader ? first.indexOf('name') : 0,
    price: hasHeader ? first.indexOf('price') : 1,
    category: hasHeader ? first.indexOf('category') : 2,
    description: hasHeader ? first.indexOf('description') : 3,
    chopBar: hasHeader ? first.indexOf('chop_bar') : -1,
  };

  const rows: CsvRow[] = [];
  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cols = splitCsvLine(line);
    const name = (cols[idx.name] ?? '').trim();
    const price = parseFloat((cols[idx.price] ?? '').replace(/[^\d.]/g, ''));
    if (!name || !Number.isFinite(price)) continue;
    const category = idx.category >= 0 ? (cols[idx.category] ?? '').trim() : '';
    const description = idx.description >= 0 ? (cols[idx.description] ?? '').trim() : '';
    const chopBar = idx.chopBar >= 0 && truthy(cols[idx.chopBar] ?? '');
    const row: CsvRow = { name, price, category };
    if (description) row.description = description;
    if (chopBar) row.chopBar = true;
    rows.push(row);
  }
  return rows;
}
