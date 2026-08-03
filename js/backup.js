"use strict";

const BACKUP_FORMAT = "tp-vertriebscockpit-backup";
const BACKUP_VERSION = "2.5";
const RESTORE_CONFIRMATION = "WIEDERHERSTELLEN";

let pendingBackupRestore = null;
let backupEventsBound = false;

function cloneBackupValue(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function backupTimestampForFilename() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now
    .toTimeString()
    .slice(0, 8)
    .replaceAll(":", "-");

  return `${date}_${time}`;
}

function setBackupProgress(isVisible, title = "", text = "", progress = 0) {
  const overlay = $("#backupProgressOverlay");

  if (!overlay) return;

  overlay.classList.toggle("hidden", !isVisible);
  document.body.classList.toggle("backup-busy", isVisible);

  $("#backupProgressTitle").textContent =
    title || "Datensicherung wird verarbeitet …";
  $("#backupProgressText").textContent = text || "Bitte warten.";
  $("#backupProgressBar").value = Math.max(0, Math.min(100, progress));
}

function downloadJsonBackup(filename, payload) {
  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json;charset=utf-8" },
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderBackupCounts() {
  if (!isAdmin()) return;

  $("#backupCustomerCount").textContent = data.customers.length;
  $("#backupActivityCount").textContent = data.activities.length;
  $("#backupAppointmentCount").textContent = data.appointments.length;
  $("#backupFollowupCount").textContent = data.followups.length;
  $("#backupEmployeeCount").textContent = data.employees.length;
}

async function createJsonBackup() {
  if (!isAdmin()) {
    toast("Diese Funktion ist nur für Administratoren verfügbar.");
    return;
  }

  const button = $("#createBackupButton");
  button.disabled = true;

  try {
    setBackupProgress(
      true,
      "JSON-Backup wird erstellt …",
      "CRM-Historie wird geladen.",
      15,
    );

    const history = await window.crmFirestore.loadAllHistoryForBackup();

    $("#backupHistoryCount").textContent = history.length;

    setBackupProgress(
      true,
      "JSON-Backup wird erstellt …",
      "Sicherungsdatei wird zusammengestellt.",
      65,
    );

    const now = new Date();
    const profile = window.crmCurrentUserProfile || {};

    const payload = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: now.toISOString(),
      createdBy: {
        uid: profile.id || "",
        email: profile.email || "",
        displayName: profile.displayName || "",
        role: profile.role || "",
      },
      source: {
        project: "TP-Vertriebscockpit",
        storage: "local-download",
      },
      counts: {
        customers: data.customers.length,
        activities: data.activities.length,
        appointments: data.appointments.length,
        followups: data.followups.length,
        employees: data.employees.length,
        history: history.length,
      },
      data: {
        customers: cloneBackupValue(data.customers),
        activities: cloneBackupValue(data.activities),
        appointments: cloneBackupValue(data.appointments),
        followups: cloneBackupValue(data.followups),
        employees: cloneBackupValue(data.employees),
        history: cloneBackupValue(history),
      },
    };

    setBackupProgress(
      true,
      "JSON-Backup wird erstellt …",
      "Download wird vorbereitet.",
      90,
    );

    downloadJsonBackup(
      `TP_Vertriebscockpit_Backup_${backupTimestampForFilename()}.json`,
      payload,
    );

    await window.crmFirestore.logBackupHistory({
      action: "backup-created",
      summary: `JSON-Backup mit ${Object.values(payload.counts).reduce(
        (sum, value) => sum + Number(value || 0),
        0,
      )} Datensätzen erstellt`,
      snapshot: {
        version: payload.version,
        counts: payload.counts,
        createdAt: payload.createdAt,
      },
    });

    setBackupProgress(
      true,
      "Backup erstellt",
      "Die JSON-Datei wurde zum Download bereitgestellt.",
      100,
    );

    await new Promise((resolve) => setTimeout(resolve, 500));
    toast("Das JSON-Backup wurde erstellt.");
  } catch (error) {
    console.error("Backup creation failed:", error);
    window.alert(
      error?.message ||
        "Das JSON-Backup konnte nicht erstellt werden.",
    );
  } finally {
    setBackupProgress(false);
    button.disabled = false;
  }
}

function validateBackupArray(payload, name) {
  if (!Array.isArray(payload?.data?.[name])) {
    throw new Error(`Die Sicherung enthält keine gültige Liste „${name}“.`);
  }

  return payload.data[name];
}

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Die ausgewählte Datei enthält kein gültiges JSON-Backup.");
  }

  if (payload.format !== BACKUP_FORMAT) {
    throw new Error(
      "Die Datei wurde nicht als Backup des TP Vertriebscockpits erkannt.",
    );
  }

  const backupData = {
    customers: validateBackupArray(payload, "customers"),
    activities: validateBackupArray(payload, "activities"),
    appointments: validateBackupArray(payload, "appointments"),
    followups: validateBackupArray(payload, "followups"),
    employees: validateBackupArray(payload, "employees"),
    history: Array.isArray(payload?.data?.history)
      ? payload.data.history
      : [],
  };

  ["customers", "activities", "appointments", "followups", "employees"]
    .forEach((collectionName) => {
      const invalidRecord = backupData[collectionName].find(
        (record) =>
          !record ||
          typeof record !== "object" ||
          !String(record.id || "").trim(),
      );

      if (invalidRecord) {
        throw new Error(
          `Die Sicherung enthält in „${collectionName}“ einen Datensatz ohne gültige ID.`,
        );
      }

      const ids = backupData[collectionName].map((record) => String(record.id));
      if (new Set(ids).size !== ids.length) {
        throw new Error(
          `Die Sicherung enthält in „${collectionName}“ doppelte IDs.`,
        );
      }
    });

  return {
    metadata: {
      version: String(payload.version || "unbekannt"),
      createdAt: String(payload.createdAt || ""),
      createdBy: payload.createdBy || {},
      counts: payload.counts || {},
    },
    data: backupData,
  };
}

function backupFileSummaryHtml(backup) {
  const createdAt = backup.metadata.createdAt
    ? formatDateTime(backup.metadata.createdAt)
    : "Unbekannt";

  const createdBy =
    backup.metadata.createdBy.displayName ||
    backup.metadata.createdBy.email ||
    "Unbekannt";

  return `
    <div class="backup-summary-head">
      <div>
        <small>Backup-Version</small>
        <strong>${backup.metadata.version}</strong>
      </div>
      <div>
        <small>Erstellt am</small>
        <strong>${createdAt}</strong>
      </div>
      <div>
        <small>Erstellt durch</small>
        <strong>${createdBy}</strong>
      </div>
    </div>

    <div class="backup-summary-grid restore-summary-grid">
      <div><small>Kunden</small><strong>${backup.data.customers.length}</strong></div>
      <div><small>Aktivitäten</small><strong>${backup.data.activities.length}</strong></div>
      <div><small>Termine</small><strong>${backup.data.appointments.length}</strong></div>
      <div><small>Wiedervorlagen</small><strong>${backup.data.followups.length}</strong></div>
      <div><small>Außendienst</small><strong>${backup.data.employees.length}</strong></div>
      <div><small>Historie im Backup</small><strong>${backup.data.history.length}</strong></div>
    </div>
  `;
}

async function loadBackupFile(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const validated = validateBackupPayload(payload);

    pendingBackupRestore = validated;
    $("#backupFileSummary").innerHTML = backupFileSummaryHtml(validated);
    $("#restoreConfirmation").value = "";
    $("#confirmRestoreBackupButton").disabled = true;
    $("#restoreBackupDialog").showModal();
  } catch (error) {
    console.error("Backup validation failed:", error);
    window.alert(
      error?.message ||
        "Die Sicherungsdatei konnte nicht gelesen oder geprüft werden.",
    );
  } finally {
    $("#restoreBackupFile").value = "";
  }
}

async function restoreJsonBackup() {
  if (!isAdmin() || !pendingBackupRestore) return;

  if ($("#restoreConfirmation").value.trim() !== RESTORE_CONFIRMATION) {
    window.alert(
      `Bitte geben Sie zur Bestätigung ${RESTORE_CONFIRMATION} ein.`,
    );
    return;
  }

  const button = $("#confirmRestoreBackupButton");
  button.disabled = true;

  try {
    $("#restoreBackupDialog").close();

    await window.crmFirestore.restoreOperationalBackup(
      pendingBackupRestore.data,
      ({ stage, completed, total, percent }) => {
        setBackupProgress(
          true,
          "JSON-Backup wird wiederhergestellt …",
          `${stage}: ${completed.toLocaleString("de-DE")} von ${total.toLocaleString("de-DE")} Datensätzen`,
          percent,
        );
      },
    );

    setBackupProgress(
      true,
      "Wiederherstellung abgeschlossen",
      "Die Echtzeitansichten werden aktualisiert.",
      100,
    );

    await new Promise((resolve) => setTimeout(resolve, 800));

    pendingBackupRestore = null;
    toast("Das JSON-Backup wurde wiederhergestellt.");
  } catch (error) {
    console.error("Backup restoration failed:", error);
    window.alert(
      error?.message ||
        "Das Backup konnte nicht vollständig wiederhergestellt werden.",
    );
  } finally {
    setBackupProgress(false);
    button.disabled = false;
  }
}

function bindBackupEvents() {
  if (backupEventsBound) return;
  backupEventsBound = true;

  $("#createBackupButton")?.addEventListener("click", createJsonBackup);

  $("#chooseRestoreFileButton")?.addEventListener("click", () => {
    if (!isAdmin()) return;
    $("#restoreBackupFile").click();
  });

  $("#restoreBackupFile")?.addEventListener("change", (event) => {
    loadBackupFile(event.target.files?.[0]);
  });

  $("#closeRestoreBackupDialog")?.addEventListener("click", () => {
    $("#restoreBackupDialog").close();
    pendingBackupRestore = null;
  });

  $("#cancelRestoreBackupButton")?.addEventListener("click", () => {
    $("#restoreBackupDialog").close();
    pendingBackupRestore = null;
  });

  $("#restoreConfirmation")?.addEventListener("input", (event) => {
    $("#confirmRestoreBackupButton").disabled =
      event.target.value.trim() !== RESTORE_CONFIRMATION;
  });

  $("#confirmRestoreBackupButton")?.addEventListener(
    "click",
    restoreJsonBackup,
  );

  window.addEventListener("crm-data-updated", renderBackupCounts);
}

function renderBackupAdmin() {
  renderBackupCounts();
}
