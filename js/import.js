"use strict";

function parseCSV(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  if (!lines.length) return [];
  const delimiter =
    (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length
      ? ";"
      : ",";
  const parseLine = (line) => {
    const out = [];
    let cur = "",
      quote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quote = !quote;
      } else if (ch === delimiter && !quote) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = parseLine(lines[0]);
  return lines
    .slice(1)
    .map((l) =>
      Object.fromEntries(headers.map((h, i) => [h, parseLine(l)[i] || ""])),
    );
}
function mapImport(rows, type) {
  const find = (r, names) => {
    const key = Object.keys(r).find((k) =>
      names.some((n) => k.toLowerCase().includes(n)),
    );
    return key ? r[key] : "";
  };
  return rows.map((r, i) => ({
    id: `K-IMP-${Date.now()}-${i}`,
    type,
    name:
      find(r, ["firma", "kundenname", "kunde", "name"]) ||
      `Importierter Kunde ${i + 1}`,
    street: find(r, ["straße", "strasse"]),
    zip: find(r, ["plz"]),
    city: find(r, ["ort", "stadt"]),
    contact: find(r, ["ansprechpartner", "kontakt"]),
    phone: find(r, ["telefon", "tel"]),
    mobile: find(r, ["mobil", "handy"]),
    email: find(r, ["mail"]),
    owner: find(r, ["außendienst", "aussendienst", "betreuer"]) || owners[0],
    pipeline: "01 Lead",
    potential: "C – mittel",
    trades: [],
    lastContact: "",
    nextAppointment: "",
    note: "",
  }));
}
