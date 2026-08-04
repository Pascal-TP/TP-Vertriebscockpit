"use strict";

const exportCustomerHeaders = [
  ["Kundennummer", "customerNumber"],
  ["Kundengruppe", "type"],
  ["Firma / Kundenname", "name"],
  ["Straße", "street"],
  ["PLZ", "zip"],
  ["Ort", "city"],
  ["Ansprechpartner", "contact"],
  ["E-Mail", "email"],
  ["Telefon", "phone"],
  ["Mobil", "mobile"],
  ["Außendienst", "owner"],
  ["Potenzial", "potential"],
  ["Pipeline", "pipeline"],
  ["Umsatz", "revenue"],
  ["Umsatzstand", "revenueAsOf"],
  ["Gewerke", "trades"],
  ["Kurznotiz", "note"],
  ["Letzter Kontakt", "lastContact"],
  ["Nächster Termin", "nextAppointment"],
  ["Archiviert", "archived"],
  ["Archiviert am", "archivedAt"],
  ["Angelegt am", "createdAt"],
  ["Angelegt durch", "createdByEmail"],
  ["Zuletzt geändert am", "updatedAt"],
  ["Zuletzt geändert durch", "updatedByEmail"],
];

function csvExportCell(value) {
  let text = value;

  if (Array.isArray(value)) {
    text = value.join(", ");
  } else if (value === true) {
    text = "Ja";
  } else if (value === false) {
    text = "Nein";
  } else if (value === null || value === undefined) {
    text = "";
  }

  return `"${String(text).replaceAll('"', '""')}"`;
}

function csvExportDateTime(value) {
  if (!value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function csvExportDate(value) {
  if (!value) return "";
  const date = String(value).includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`);

  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("de-DE").format(date);
}

function downloadCsvFile(filename, headers, rows) {
  const csv = [
    headers.map(csvExportCell).join(";"),
    ...rows.map((row) => row.map(csvExportCell).join(";")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportFileDate() {
  return new Date().toISOString().slice(0, 10);
}

function customerExportRows(customers) {
  return customers.map((customer) =>
    exportCustomerHeaders.map(([, field]) => {
      if (["createdAt", "updatedAt"].includes(field)) {
        return csvExportDateTime(customer[field]);
      }

      if (["lastContact", "nextAppointment", "archivedAt", "revenueAsOf"].includes(field)) {
        return csvExportDate(customer[field]);
      }

      return customer[field] ?? "";
    }),
  );
}

async function exportCustomerGroup(type, options = {}) {
  const archivedOnly = options.archivedOnly === true;

  const customers = data.customers
    .filter((customer) =>
      archivedOnly
        ? customer.archived === true
        : customer.archived !== true && customer.type === type,
    )
    .sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "de"),
    );

  if (!customers.length) {
    toast("Für diesen Export sind keine Kunden vorhanden.");
    return;
  }

  const namePart = archivedOnly
    ? "archivierte-kunden"
    : String(type || "kunden")
        .toLowerCase()
        .replaceAll("ä", "ae")
        .replaceAll("ö", "oe")
        .replaceAll("ü", "ue")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

  downloadCsvFile(
    `${namePart}-${exportFileDate()}.csv`,
    exportCustomerHeaders.map(([label]) => label),
    customerExportRows(customers),
  );

  await logCsvExport(
    archivedOnly ? "Archivierte Kunden" : type,
    customers.length,
    { archivedOnly },
  );

  toast(`${customers.length} Kundendatensätze wurden exportiert.`);
}

function startOfCurrentWeek() {
  const date = new Date();
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfCurrentWeek() {
  const date = startOfCurrentWeek();
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfCurrentMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfCurrentMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function dateWithinRange(dateValue, from, to) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T12:00:00`);
  return (!from || date >= from) && (!to || date <= to);
}

function exportDateRange(kind) {
  const period = $(`#${kind}ExportPeriod`).value;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (period === "future") {
    return { from: now, to: null, label: "ab heute" };
  }

  if (period === "week") {
    return {
      from: startOfCurrentWeek(),
      to: endOfCurrentWeek(),
      label: "aktuelle Woche",
    };
  }

  if (period === "month") {
    return {
      from: startOfCurrentMonth(),
      to: endOfCurrentMonth(),
      label: "aktueller Monat",
    };
  }

  if (period === "custom") {
    const fromValue = $(`#${kind}ExportFrom`).value;
    const toValue = $(`#${kind}ExportTo`).value;

    return {
      from: fromValue ? new Date(`${fromValue}T00:00:00`) : null,
      to: toValue ? new Date(`${toValue}T23:59:59`) : null,
      label: `${fromValue || "offen"} bis ${toValue || "offen"}`,
    };
  }

  return { from: null, to: null, label: "alle" };
}

function filteredAppointmentsForExport() {
  const range = exportDateRange("appointment");
  const owner = $("#appointmentExportOwner").value;

  return data.appointments
    .filter((appointment) => {
      const customer = customerById(appointment.customerId);

      return (
        customer &&
        customer.archived !== true &&
        (owner === "all" || appointment.owner === owner) &&
        dateWithinRange(appointment.date, range.from, range.to)
      );
    })
    .sort((a, b) =>
      `${a.date || ""}${a.time || ""}`.localeCompare(
        `${b.date || ""}${b.time || ""}`,
      ),
    );
}

function filteredActivitiesForExport() {
  const range = exportDateRange("activity");
  const owner = $("#activityExportOwner").value;

  return data.activities
    .filter((activity) => {
      const customer = customerById(activity.customerId);

      return (
        customer &&
        customer.archived !== true &&
        (owner === "all" || activity.owner === owner) &&
        dateWithinRange(activity.date, range.from, range.to)
      );
    })
    .sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || "")),
    );
}

async function exportAppointments() {
  const appointments = filteredAppointmentsForExport();

  if (!appointments.length) {
    toast("Für den gewählten Filter sind keine Termine vorhanden.");
    return;
  }

  const headers = [
    "Termin-ID",
    "Datum",
    "Uhrzeit",
    "Kundennummer",
    "Kunde",
    "Straße",
    "PLZ",
    "Ort",
    "Ansprechpartner",
    "E-Mail",
    "Telefon",
    "Mobil",
    "Außendienst",
    "Betreff",
    "Notiz",
    "Angelegt am",
    "Angelegt durch",
    "Zuletzt geändert am",
    "Zuletzt geändert durch",
  ];

  const rows = appointments.map((appointment) => {
    const customer = customerById(appointment.customerId) || {};

    return [
      appointment.id,
      csvExportDate(appointment.date),
      appointment.time || "",
      customer.customerNumber || "",
      customer.name || "",
      customer.street || "",
      customer.zip || "",
      customer.city || "",
      customer.contact || "",
      customer.email || "",
      customer.phone || "",
      customer.mobile || "",
      appointment.owner || "",
      appointment.subject || "",
      appointment.note || "",
      csvExportDateTime(appointment.createdAt),
      appointment.createdByEmail || "",
      csvExportDateTime(appointment.updatedAt),
      appointment.updatedByEmail || "",
    ];
  });

  downloadCsvFile(
    `termine-${exportFileDate()}.csv`,
    headers,
    rows,
  );

  await logCsvExport("Terminliste", appointments.length, {
    period: $("#appointmentExportPeriod").value,
    owner: $("#appointmentExportOwner").value,
  });

  toast(`${appointments.length} Termine wurden exportiert.`);
}

async function exportActivities() {
  const activities = filteredActivitiesForExport();

  if (!activities.length) {
    toast("Für den gewählten Filter sind keine Kontakte vorhanden.");
    return;
  }

  const headers = [
    "Aktivitäts-ID",
    "Datum",
    "Kundennummer",
    "Kunde",
    "Straße",
    "PLZ",
    "Ort",
    "Ansprechpartner",
    "E-Mail",
    "Telefon",
    "Mobil",
    "Außendienst",
    "Kontaktart",
    "Besuchsziel",
    "Ergebnis",
    "Nächster Schritt",
    "Fällig am",
    "Kurznotiz",
    "Handschriftliche Notiz vorhanden",
    "Angelegt am",
    "Angelegt durch",
    "Zuletzt geändert am",
    "Zuletzt geändert durch",
  ];

  const rows = activities.map((activity) => {
    const customer = customerById(activity.customerId) || {};

    return [
      activity.id,
      csvExportDate(activity.date),
      customer.customerNumber || "",
      customer.name || "",
      customer.street || "",
      customer.zip || "",
      customer.city || "",
      customer.contact || "",
      customer.email || "",
      customer.phone || "",
      customer.mobile || "",
      activity.owner || "",
      activity.type || "",
      activity.goal || "",
      activity.result || "",
      activity.next || "",
      csvExportDate(activity.due),
      activity.note || "",
      activity.handNote ? "Ja" : "Nein",
      csvExportDateTime(activity.createdAt),
      activity.createdByEmail || "",
      csvExportDateTime(activity.updatedAt),
      activity.updatedByEmail || "",
    ];
  });

  downloadCsvFile(
    `kontakte-und-aktivitaeten-${exportFileDate()}.csv`,
    headers,
    rows,
  );

  await logCsvExport("Kontakt- und Aktivitätenliste", activities.length, {
    period: $("#activityExportPeriod").value,
    owner: $("#activityExportOwner").value,
  });

  toast(`${activities.length} Kontakte wurden exportiert.`);
}

async function logCsvExport(exportType, count, filters = {}) {
  try {
    await window.crmFirestore?.logExportHistory?.({
      exportType,
      count,
      filters,
    });
  } catch (error) {
    /*
     * Der Download selbst darf nicht scheitern, falls ausschließlich die
     * Historienprotokollierung vorübergehend nicht möglich ist.
     */
    console.error("CSV export history failed:", error);
  }
}

function fillExportOwnerSelects() {
  refreshOwners();

  ["appointmentExportOwner", "activityExportOwner"].forEach((id) => {
    const select = $("#" + id);
    if (!select) return;

    const current = select.value || "all";

    select.innerHTML =
      '<option value="all">Alle Außendienstmitarbeiter</option>' +
      owners
        .map((owner) => `<option value="${owner}">${owner}</option>`)
        .join("");

    if ([...select.options].some((option) => option.value === current)) {
      select.value = current;
    }
  });
}

function toggleExportCustomDates(kind) {
  const isCustom = $(`#${kind}ExportPeriod`).value === "custom";

  $$(`[data-export-dates="${kind === "appointment" ? "appointments" : "activities"}"]`)
    .forEach((element) => element.classList.toggle("hidden", !isCustom));
}

function renderExportView() {
  if (!$("#view-export")) return;

  fillExportOwnerSelects();
  fillRevenueOwnerSelect();

  $("#exportCountExisting").textContent = data.customers.filter(
    (customer) =>
      customer.archived !== true && customer.type === "Bestandskunde",
  ).length;

  $("#exportCountProspects").textContent = data.customers.filter(
    (customer) =>
      customer.archived !== true && customer.type === "Interessent",
  ).length;

  $("#exportCountCold").textContent = data.customers.filter(
    (customer) =>
      customer.archived !== true && customer.type === "Kaltakquise",
  ).length;

  $("#exportCountArchived").textContent = data.customers.filter(
    (customer) => customer.archived === true,
  ).length;

  toggleExportCustomDates("appointment");
  toggleExportCustomDates("activity");

  const appointmentCount = filteredAppointmentsForExport().length;
  const activityCount = filteredActivitiesForExport().length;

  $("#appointmentExportCount").textContent =
    `${appointmentCount} Termin${appointmentCount === 1 ? "" : "e"} entsprechen dem Filter`;

  renderRevenueRankingCount();

  $("#activityExportCount").textContent =
    `${activityCount} Kontakt${activityCount === 1 ? "" : "e"} entsprechen dem Filter`;

  $("#exportAppointmentsButton").disabled = appointmentCount === 0;
  $("#exportActivitiesButton").disabled = activityCount === 0;
}

function bindExportEvents() {
  $("#exportExistingCustomers").onclick = () =>
    exportCustomerGroup("Bestandskunde");

  $("#exportProspectCustomers").onclick = () =>
    exportCustomerGroup("Interessent");

  $("#exportColdCustomers").onclick = () =>
    exportCustomerGroup("Kaltakquise");

  $("#exportArchivedCustomers").onclick = () =>
    exportCustomerGroup("", { archivedOnly: true });

  $("#exportAppointmentsButton").onclick = exportAppointments;
  $("#exportActivitiesButton").onclick = exportActivities;
  $("#exportRevenueRankingButton").onclick = exportRevenueRanking;

  [
    "appointmentExportPeriod",
    "appointmentExportOwner",
    "appointmentExportFrom",
    "appointmentExportTo",
    "activityExportPeriod",
    "activityExportOwner",
    "activityExportFrom",
    "activityExportTo",
    "revenueExportOwner",
  ].forEach((id) => {
    const element = $("#" + id);

    if (!element) return;

    element.addEventListener(
      element.tagName === "SELECT" ? "change" : "input",
      renderExportView,
    );
  });

  window.addEventListener("crm-data-updated", renderExportView);
}
