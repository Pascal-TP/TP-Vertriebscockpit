"use strict";

const IMPORT_COLUMN_LABELS = {
  selected: "Übernehmen",
  customerNumber: "Kundennummer",
  name: "Firma / Kundenname",
  street: "Straße",
  zip: "PLZ",
  city: "Ort",
  contact: "Ansprechpartner",
  email: "E-Mail",
  phone: "Festnetz",
  mobile: "Mobil",
  importStatus: "Prüfung",
};

function parseCSV(text) {
  const normalizedText = String(text || "").replace(/^\uFEFF/, "");
  const lines = normalizedText.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (!lines.length) return [];

  const firstLine = lines[0];
  const delimiter =
    (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length
      ? ";"
      : ",";

  const parseLine = (line) => {
    const values = [];
    let current = "";
    let quoted = false;

    for (let index = 0; index < line.length; index++) {
      const character = line[index];

      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"';
          index++;
        } else {
          quoted = !quoted;
        }
      } else if (character === delimiter && !quoted) {
        values.push(current.trim());
        current = "";
      } else {
        current += character;
      }
    }

    values.push(current.trim());
    return values;
  };

  const headers = parseLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function decodeCSVFile(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  // Exporte aus Warenwirtschaftssystemen liegen häufig in Windows-1252 vor.
  // Das Ersetzungszeichen zeigt, dass UTF-8 nicht passend war.
  if (text.includes("\uFFFD")) {
    text = new TextDecoder("windows-1252").decode(bytes);
  }

  return text;
}

function normalizedHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function importValue(row, exactNames, containsNames = []) {
  const entries = Object.entries(row);
  const exact = exactNames.map(normalizedHeader);
  const contains = containsNames.map(normalizedHeader);

  const exactEntry = entries.find(([key]) => exact.includes(normalizedHeader(key)));
  if (exactEntry) return String(exactEntry[1] || "").trim();

  const containsEntry = entries.find(([key]) =>
    contains.some((name) => normalizedHeader(key).includes(name)),
  );

  return containsEntry ? String(containsEntry[1] || "").trim() : "";
}

function splitPostalCity(value, separateZip = "", separateCity = "") {
  const combined = String(value || "").trim();
  let zip = String(separateZip || "").trim();
  let city = String(separateCity || "").trim();

  if (combined) {
    const match = combined.match(/^([0-9]{5})\s+(.+)$/);
    if (match) {
      zip = zip || match[1];
      city = city || match[2].trim();
    } else if (!city) {
      city = combined;
    }
  }

  return { zip, city };
}

function defaultPipelineForImportType(type) {
  if (type === "Bestandskunde") return "08 Gewonnen";
  return "01 Lead";
}

function createImportId() {
  if (globalThis.crypto?.randomUUID) {
    return `K-IMP-${crypto.randomUUID()}`;
  }

  return `K-IMP-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapImport(rows, type) {
  return rows
    .map((row, index) => {
      const location = splitPostalCity(
        importValue(row, ["Ort"]),
        importValue(row, ["PLZ", "Postleitzahl"]),
        importValue(row, ["Stadt"]),
      );

      return {
        id: createImportId(),
        sourceRow: index + 2,
        customerNumber: importValue(row, ["Kundennummer", "Kunden-Nr", "Kunden-Nr.", "Kdnr"]),
        type,
        name:
          importValue(row, ["Person", "Firma", "Kundenname", "Kunde", "Name"]) ||
          `Importierter Kunde ${index + 1}`,
        street: importValue(row, ["Straße", "Strasse"]),
        zip: location.zip,
        city: location.city,
        contact: importValue(row, ["Ansprechpartner bei Name", "Ansprechpartner", "Kontakt"]),
        email: importValue(row, ["E-Mail", "Email", "Mail"]),
        phone: importValue(row, ["Festnetz", "Telefon", "Tel"]),
        mobile: importValue(row, ["Mobil", "Mobiltelefon", "Handy"]),
        owner: "",
        pipeline: defaultPipelineForImportType(type),
        potential: "",
        trades: [],
        lastContact: "",
        nextAppointment: "",
        note: "",
        archived: false,
        archivedAt: "",
      };
    })
    .filter((customer) =>
      [customer.customerNumber, customer.name, customer.street, customer.email, customer.phone, customer.mobile]
        .some((value) => String(value || "").trim()),
    );
}

function normalizeCustomerNumber(value) {
  return String(value || "").trim().toLowerCase();
}

function classifyImportRows(rows) {
  const seenCustomerNumbers = new Map();
  const seenSignatures = new Map();

  return rows.map((row) => {
    const reasons = [];
    let status = "Neu";
    let existingCustomerId = "";

    const number = normalizeCustomerNumber(row.customerNumber);
    const signature = [
      normalizeDuplicateText(row.name),
      normalizeDuplicateText(row.street),
      String(row.zip || "").trim(),
    ].join("|");

    const exactNumberMatch = number
      ? data.customers.find(
          (customer) => normalizeCustomerNumber(customer.customerNumber) === number,
        )
      : null;

    if (exactNumberMatch) {
      status = "Bereits vorhanden";
      existingCustomerId = exactNumberMatch.id;
      reasons.push("Kundennummer bereits vorhanden");
    } else if (number && seenCustomerNumbers.has(number)) {
      status = "Exakte Dublette";
      reasons.push(`Kundennummer bereits in CSV-Zeile ${seenCustomerNumbers.get(number)}`);
    } else {
      const duplicateMatches = findCustomerDuplicates(row, "", { includeArchived: true });

      if (duplicateMatches.length) {
        status = "Mögliche Dublette";
        existingCustomerId = duplicateMatches[0].customer.id;
        reasons.push(...duplicateMatches[0].reasons);
      } else if (signature !== "||" && seenSignatures.has(signature)) {
        status = "Exakte Dublette";
        reasons.push(`gleicher Name und gleiche Anschrift wie CSV-Zeile ${seenSignatures.get(signature)}`);
      }
    }

    if (!String(row.name || "").trim()) {
      status = "Fehlerhaft";
      reasons.push("Firma / Kundenname fehlt");
    }

    if (number && !seenCustomerNumbers.has(number)) {
      seenCustomerNumbers.set(number, row.sourceRow);
    }
    if (signature !== "||" && !seenSignatures.has(signature)) {
      seenSignatures.set(signature, row.sourceRow);
    }

    return {
      ...row,
      importStatus: status,
      importReasons: [...new Set(reasons)],
      existingCustomerId,
      importable: status === "Neu",
      selected: row.selected ?? status === "Neu",
    };
  });
}

function importStatusClass(status) {
  return String(status || "").toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-");
}
