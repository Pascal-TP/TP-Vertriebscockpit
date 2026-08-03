"use strict";

let globalHistoryEntries = [];
let historySubscribed = false;

const historyEntityLabels = {
  customer: "Kunde",
  activity: "Aktivität",
  appointment: "Termin",
  followup: "Wiedervorlage",
  employee: "Außendienstmitarbeiter",
  export: "CSV-Export",
};

const historyActionLabels = {
  created: "Angelegt",
  updated: "Bearbeitet",
  deleted: "Gelöscht",
  archived: "Archiviert",
  restored: "Wiederhergestellt",
  completed: "Erledigt",
  reopened: "Wieder geöffnet",
  imported: "Importiert",
  migrated: "Übernommen",
  "system-updated": "Automatisch aktualisiert",
  deactivated: "Deaktiviert",
  "permanently-deleted": "Endgültig gelöscht",
  exported: "Exportiert",
};

function customerNameForHistory(entry) {
  const id =
    entry.customerId ||
    (entry.entityType === "customer" ? entry.entityId : "");

  if (entry.entityType === "export") {
    return entry.snapshot?.exportType || "CSV-Export";
  }

  return customerById(id)?.name ||
    entry.snapshot?.name ||
    (id ? `Kunde ${id}` : "Ohne Kundenzuordnung");
}

function historySearchText(entry) {
  return [
    entry.summary,
    entry.changedByName,
    entry.changedByEmail,
    customerNameForHistory(entry),
    historyEntityLabels[entry.entityType],
    historyActionLabels[entry.action],
    JSON.stringify(entry.changes || {}),
    JSON.stringify(entry.snapshot || {}),
  ].join(" ").toLowerCase();
}

function filteredGlobalHistory() {
  const from = $("#historyDateFrom")?.value || "";
  const to = $("#historyDateTo")?.value || "";
  const user = $("#historyUserFilter")?.value || "all";
  const customer = $("#historyCustomerFilter")?.value || "all";
  const entity = $("#historyEntityFilter")?.value || "all";
  const action = $("#historyActionFilter")?.value || "all";
  const search = ($("#historySearch")?.value || "").trim().toLowerCase();

  return globalHistoryEntries.filter((entry) => {
    const date = String(entry.changedAt || "").slice(0, 10);
    const entryCustomerId =
      entry.customerId ||
      (entry.entityType === "customer" ? entry.entityId : "");

    return (!from || date >= from) &&
      (!to || date <= to) &&
      (user === "all" || entry.changedByEmail === user) &&
      (customer === "all" || entryCustomerId === customer) &&
      (entity === "all" || entry.entityType === entity) &&
      (action === "all" || entry.action === action) &&
      (!search || historySearchText(entry).includes(search));
  });
}

function renderGlobalHistory() {
  const container = $("#globalHistoryList");
  if (!container) return;

  const entries = filteredGlobalHistory();
  $("#historyCount").textContent =
    `${entries.length} Eintrag${entries.length === 1 ? "" : "e"}`;

  container.innerHTML = entries.length
    ? entries.map((entry) => {
        const changes = Object.entries(entry.changes || {});
        const customerId =
          entry.customerId ||
          (entry.entityType === "customer" ? entry.entityId : "");

        return `
          <article class="card global-history-entry">
            <div class="global-history-head">
              <div>
                <span class="history-type-badge">${historyEntityLabels[entry.entityType] || "Eintrag"}</span>
                <strong>${historyActionLabels[entry.action] || entry.action || "Geändert"}</strong>
              </div>
              <time>${formatDateTime(entry.changedAt)}</time>
            </div>
            <h3>${customerNameForHistory(entry)}</h3>
            <p>${entry.summary || "CRM-Daten geändert"}</p>
            <small>${entry.changedByName || entry.changedByEmail || "Unbekannt"}${entry.changedByEmail && entry.changedByName !== entry.changedByEmail ? ` · ${entry.changedByEmail}` : ""}</small>
            ${
              changes.length
                ? `<details class="audit-changes">
                    <summary>${changes.length} Änderung${changes.length === 1 ? "" : "en"}</summary>
                    <div>${changes.map(([field, value]) => `
                      <p><strong>${field}</strong><span>${formatHistoryValue(value.oldValue)}</span><span>→</span><span>${formatHistoryValue(value.newValue)}</span></p>
                    `).join("")}</div>
                  </details>`
                : ""
            }
            ${
              customerId && customerById(customerId)
                ? `<button class="text-button history-open-customer" data-customer-id="${customerId}" type="button">Kunde öffnen</button>`
                : ""
            }
          </article>
        `;
      }).join("")
    : '<article class="card empty-state"><p>Für die gewählten Filter wurden keine Einträge gefunden.</p></article>';

  $$(".history-open-customer").forEach((button) => {
    button.onclick = () => {
      showView("customers");
      renderCustomerDetail(button.dataset.customerId);
    };
  });
}

function fillHistoryFilters() {
  const userSelect = $("#historyUserFilter");
  const customerSelect = $("#historyCustomerFilter");
  if (!userSelect || !customerSelect) return;

  const selectedUser = userSelect.value;
  const selectedCustomer = customerSelect.value;

  const users = [...new Set(globalHistoryEntries.map((entry) => entry.changedByEmail).filter(Boolean))].sort();
  userSelect.innerHTML = '<option value="all">Alle Benutzer</option>' +
    users.map((email) => `<option value="${email}">${email}</option>`).join("");

  customerSelect.innerHTML = '<option value="all">Alle Kunden</option>' +
    data.customers
      .filter((customer) => customer.archived !== true)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "de"))
      .map((customer) => `<option value="${customer.id}">${customer.name}</option>`)
      .join("");

  if ([...userSelect.options].some((option) => option.value === selectedUser)) userSelect.value = selectedUser;
  if ([...customerSelect.options].some((option) => option.value === selectedCustomer)) customerSelect.value = selectedCustomer;
}

function initializeGlobalHistory() {
  if (historySubscribed) return;
  historySubscribed = true;

  window.crmFirestore.subscribeGlobalHistory(
    (entries) => {
      globalHistoryEntries = entries;
      fillHistoryFilters();
      renderGlobalHistory();
    },
    () => {
      $("#globalHistoryList").innerHTML =
        '<article class="card audit-error">Die globale Historie konnte nicht geladen werden.</article>';
    },
  );
}

function bindHistoryEvents() {
  [
    "historyDateFrom",
    "historyDateTo",
    "historyUserFilter",
    "historyCustomerFilter",
    "historyEntityFilter",
    "historyActionFilter",
    "historySearch",
  ].forEach((id) => {
    const element = $("#" + id);
    if (!element) return;
    element.addEventListener(
      element.tagName === "INPUT" ? "input" : "change",
      renderGlobalHistory,
    );
  });

  $("#resetHistoryFilters").onclick = () => {
    $("#historyDateFrom").value = "";
    $("#historyDateTo").value = "";
    $("#historyUserFilter").value = "all";
    $("#historyCustomerFilter").value = "all";
    $("#historyEntityFilter").value = "all";
    $("#historyActionFilter").value = "all";
    $("#historySearch").value = "";
    renderGlobalHistory();
  };

  $("#refreshHistoryButton").onclick = renderGlobalHistory;
  window.addEventListener("crm-data-updated", () => {
    fillHistoryFilters();
    renderGlobalHistory();
  });
}
