"use strict";

const viewMeta = {
  dashboard: [
    "Dashboard",
    "Aktivitäten, Termine und offene Aufgaben im Überblick",
    "Vertriebsaktivitäten im Überblick",
  ],
  customers: [
    "Kunden",
    "Bestandskunden, Interessenten und Kaltakquise zentral verwalten",
    "Kundenstamm und Historie",
  ],
  appointments: [
    "Termine",
    "Besuche planen, vorbereiten und direkt navigieren",
    "Termin- und Tourenübersicht",
  ],
  activities: [
    "Aktivitäten",
    "Kontakt- und Besuchshistorie ohne zusätzliche E-Mail-Berichte",
    "Alle Vertriebsaktivitäten",
  ],
  followups: [
    "Wiedervorlagen",
    "Nächste Schritte zuverlässig verfolgen",
    "Offene Aufgaben und Fristen",
  ],
  history: [
    "Historie",
    "Alle Änderungen im Vertriebscockpit nachvollziehen",
    "Zentrale Änderungs- und Aktivitätshistorie",
  ],
  admin: [
    "Administration",
    "Außendienstmitarbeiter und administrative Funktionen verwalten",
    "Nur für Administratoren",
  ],
  export: [
    "CSV-Export",
    "Kunden, Termine und Kontakte als CSV-Dateien herunterladen",
    "Datenexport für Excel und weitere Auswertungen",
  ],
  import: [
    "CSV-Import",
    "Bestehende Kundenlisten strukturiert übernehmen",
    "Daten aus CSV übernehmen",
  ],
};
function showView(name) {
  $$(".view").forEach((v) =>
    v.classList.toggle("active", v.id === `view-${name}`),
  );
  $$(".nav-button").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name),
  );
  if (name === "admin" && !isAdmin()) {
    toast("Dieser Bereich ist nur für Administratoren verfügbar.");
    return;
  }

  const [title, sub, hint] = viewMeta[name];
  $("#pageTitle").textContent = title;
  $("#pageSubtitle").textContent = sub;
  $("#locationLabel").textContent = title;
  $("#locationHint").textContent = hint;
  $("#sidebar").classList.remove("open");
  if (name === "history" && typeof renderGlobalHistory === "function") renderGlobalHistory();
  if (name === "admin" && typeof renderAdmin === "function") renderAdmin();
  if (name === "export" && typeof renderExportView === "function") renderExportView();
}

function fillOwnerSelects() {
  refreshOwners();

  ["dashboardOwner", "customerOwnerFilter"].forEach((id) => {
    const el = $("#" + id);
    if (!el) return;

    const current = el.value || "all";
    const first = el.options[0]?.outerHTML || '<option value="all">Alle</option>';
    el.innerHTML = first + owners.map((owner) => `<option value="${owner}">${owner}</option>`).join("");

    if ([...el.options].some((option) => option.value === current)) {
      el.value = current;
    }
  });
}
