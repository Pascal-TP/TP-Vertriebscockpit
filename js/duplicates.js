"use strict";

let duplicateDecisionResolver = null;
let pendingDuplicateCustomerId = null;

function normalizeDuplicateText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " und ")
    .replace(/\b(gmbh|mbh|kg|ohg|ag|ug|e\.?k\.?|gesellschaft|co)\b/g, " ")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D+/g, "").replace(/^0049/, "0");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function similarity(a, b) {
  const left = normalizeDuplicateText(a);
  const right = normalizeDuplicateText(b);

  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftWords = new Set(left.split(" "));
  const rightWords = new Set(right.split(" "));
  const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;

  return union ? intersection / union : 0;
}

function findCustomerDuplicates(candidate, excludedId = "", options = {}) {
  const includeArchived = options.includeArchived === true;

  return data.customers
    .filter((customer) =>
      customer.id !== excludedId && (includeArchived || customer.archived !== true),
    )
    .map((customer) => {
      const reasons = [];

      if (
        String(candidate.customerNumber || "").trim() &&
        String(candidate.customerNumber || "").trim().toLowerCase() ===
          String(customer.customerNumber || "").trim().toLowerCase()
      ) {
        reasons.push("identische Kundennummer");
      }

      if (
        normalizeEmail(candidate.email) &&
        normalizeEmail(candidate.email) === normalizeEmail(customer.email)
      ) {
        reasons.push("identische E-Mail-Adresse");
      }

      const candidatePhones = [candidate.phone, candidate.mobile]
        .map(normalizePhone)
        .filter((value) => value.length >= 6);
      const customerPhones = [customer.phone, customer.mobile]
        .map(normalizePhone)
        .filter((value) => value.length >= 6);

      if (candidatePhones.some((phone) => customerPhones.includes(phone))) {
        reasons.push("identische Telefonnummer");
      }

      const exactAddress =
        normalizeDuplicateText(candidate.street) &&
        normalizeDuplicateText(candidate.street) === normalizeDuplicateText(customer.street) &&
        String(candidate.zip || "").trim() === String(customer.zip || "").trim();

      if (exactAddress) reasons.push("gleiche Anschrift");

      const nameSimilarity = similarity(candidate.name, customer.name);
      if (
        nameSimilarity >= 0.8 ||
        (
          nameSimilarity >= 0.55 &&
          String(candidate.zip || "").trim() &&
          String(candidate.zip || "").trim() === String(customer.zip || "").trim()
        )
      ) {
        reasons.push("sehr ähnliche Firmenbezeichnung");
      }

      return { customer, reasons, score: reasons.length + nameSimilarity };
    })
    .filter((match) => match.reasons.length)
    .sort((a, b) => b.score - a.score);
}

function requestDuplicateDecision(matches) {
  if (!matches.length) return Promise.resolve({ action: "save" });

  const best = matches[0];
  pendingDuplicateCustomerId = best.customer.id;

  $("#duplicateDetails").innerHTML = `
    <article class="duplicate-match">
      <strong>${best.customer.name}</strong>
      <span>${best.customer.street || "–"}</span>
      <span>${best.customer.zip || ""} ${best.customer.city || ""}</span>
      <span>${best.customer.email || best.customer.phone || "Keine Kontaktdaten"}</span>
      <h3>Übereinstimmungen</h3>
      <ul>${best.reasons.map((reason) => `<li>${reason}</li>`).join("")}</ul>
      ${
        matches.length > 1
          ? `<small>Zusätzlich wurden ${matches.length - 1} weitere mögliche Dublette(n) erkannt.</small>`
          : ""
      }
    </article>
  `;

  $("#duplicateDialog").showModal();

  return new Promise((resolve) => {
    duplicateDecisionResolver = resolve;
  });
}

function closeDuplicateDecision(action) {
  $("#duplicateDialog").close();
  duplicateDecisionResolver?.({
    action,
    customerId: pendingDuplicateCustomerId,
  });
  duplicateDecisionResolver = null;
  pendingDuplicateCustomerId = null;
}

function bindDuplicateEvents() {
  $("#closeDuplicateDialog").onclick = () => closeDuplicateDecision("cancel");
  $("#cancelDuplicateButton").onclick = () => closeDuplicateDecision("cancel");
  $("#saveDuplicateAnywayButton").onclick = () => closeDuplicateDecision("save");
  $("#openDuplicateButton").onclick = () => closeDuplicateDecision("open");
}
