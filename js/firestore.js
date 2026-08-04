import { crmAuth, crmDb } from "./firebase.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  writeBatch,
  where,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const collections = {
  customers: collection(crmDb, "customers"),
  activities: collection(crmDb, "activities"),
  appointments: collection(crmDb, "appointments"),
  followups: collection(crmDb, "followups"),
  employees: collection(crmDb, "employees"),
};

const historyCollection = collection(crmDb, "history");
const unsubscribers = {};
let syncPromise = null;
let unsubscribeHistory = null;

const auditIgnoredFields = new Set([
  "createdAt",
  "createdByUid",
  "createdByEmail",
  "updatedAt",
  "updatedByUid",
  "updatedByEmail",
]);

function actor() {
  const user = crmAuth.currentUser;

  if (!user) {
    throw new Error("Für diese Änderung ist eine Anmeldung erforderlich.");
  }

  return {
    uid: user.uid,
    email: user.email || "",
    name: user.displayName || user.email || "Angemeldeter Benutzer",
  };
}

async function loadCurrentUserProfile(uid) {
  const snapshot = await getDoc(doc(crmDb, "users", uid));

  if (!snapshot.exists()) {
    throw new Error("Für diesen Benutzer wurde kein Rollenprofil in Firestore gefunden.");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function requireAdmin() {
  if (!window.crmCurrentUserProfile || window.crmCurrentUserProfile.role !== "admin") {
    throw new Error("Diese Funktion ist ausschließlich für Administratoren freigegeben.");
  }
}

function timestampToIso(value) {
  if (!value) {
    return "";
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function normalizeSnapshot(snapshot) {
  const value = snapshot.data();

  return {
    ...value,
    id: snapshot.id,
    createdAt: timestampToIso(value.createdAt),
    updatedAt: timestampToIso(value.updatedAt),
  };
}

function normalizeHistory(snapshot) {
  const value = snapshot.data();

  return {
    ...value,
    id: snapshot.id,
    changedAt: timestampToIso(value.changedAt),
  };
}

function comparable(value) {
  if (Array.isArray(value)) {
    return [...value].sort();
  }

  return value === undefined ? "" : value;
}

function buildChanges(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = {};

  keys.forEach((key) => {
    if (auditIgnoredFields.has(key) || key === "id") {
      return;
    }

    const oldValue = comparable(before[key]);
    const newValue = comparable(after[key]);

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = {
        oldValue: before[key] ?? "",
        newValue: after[key] ?? "",
      };
    }
  });

  return changes;
}

function auditData(action) {
  const currentActor = actor();
  const values = {
    updatedAt: serverTimestamp(),
    updatedByUid: currentActor.uid,
    updatedByEmail: currentActor.email,
  };

  if (
    ["created", "created-from-appointment", "imported", "migrated"].includes(
      action,
    )
  ) {
    Object.assign(values, {
      createdAt: serverTimestamp(),
      createdByUid: currentActor.uid,
      createdByEmail: currentActor.email,
    });
  }

  return values;
}

function historyPayload({
  entityType,
  entityId,
  customerId = "",
  action,
  summary,
  changes = {},
  snapshot = {},
}) {
  const currentActor = actor();

  return {
    entityType,
    entityId,
    customerId,
    action,
    summary,
    changes,
    snapshot,
    changedAt: serverTimestamp(),
    changedByUid: currentActor.uid,
    changedByEmail: currentActor.email,
    changedByName: currentActor.name,
  };
}

function addHistory(batch, payload) {
  batch.set(doc(historyCollection), historyPayload(payload));
}

function addEntityWrite(batch, {
  collectionName,
  entityId,
  data,
  action,
  customerId,
  summary,
  changes = {},
  snapshot = {},
  merge = true,
}) {
  batch.set(
    doc(crmDb, collectionName, entityId),
    {
      ...data,
      ...auditData(action),
    },
    { merge },
  );

  addHistory(batch, {
    entityType: collectionName.slice(0, -1),
    entityId,
    customerId,
    action,
    summary,
    changes,
    snapshot,
  });
}

function addEntityDelete(batch, {
  collectionName,
  entity,
  summary,
}) {
  batch.delete(doc(crmDb, collectionName, entity.id));

  addHistory(batch, {
    entityType: collectionName.slice(0, -1),
    entityId: entity.id,
    customerId: entity.customerId || "",
    action: "deleted",
    summary,
    snapshot: entity,
  });
}

function addCustomerSystemUpdate(batch, customer, updates, summary) {
  if (!customer) {
    return;
  }

  const after = { ...customer, ...updates };
  const changes = buildChanges(customer, after);

  if (!Object.keys(changes).length) {
    return;
  }

  batch.set(
    doc(crmDb, "customers", customer.id),
    {
      ...updates,
      ...auditData("system-updated"),
    },
    { merge: true },
  );

  addHistory(batch, {
    entityType: "customer",
    entityId: customer.id,
    customerId: customer.id,
    action: "system-updated",
    summary,
    changes,
    snapshot: after,
  });
}

function latestActivityDate(records, customerId) {
  return records
    .filter((item) => item.customerId === customerId)
    .map((item) => item.date)
    .filter(Boolean)
    .sort()
    .at(-1) || "";
}

function nextAppointmentDate(records, customerId) {
  const today = new Date().toISOString().slice(0, 10);

  return records
    .filter(
      (item) =>
        item.customerId === customerId &&
        item.date &&
        item.date >= today,
    )
    .sort((a, b) =>
      `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`),
    )[0]?.date || "";
}

function pipelineFromActivityResult(result, currentPipeline) {
  const mapping = {
    "Termin vereinbart": "04 Termin vereinbart",
    "Bedarf erkannt": "05 Bedarf qualifiziert",
    "Angebot erstellt": "06 Angebot",
    "Auftrag erhalten": "08 Gewonnen",
    Verloren: "09 Verloren",
  };

  return mapping[result] || currentPipeline || "";
}

async function createCustomer(customer) {
  const batch = writeBatch(crmDb);

  addEntityWrite(batch, {
    collectionName: "customers",
    entityId: customer.id,
    data: customer,
    action: "created",
    customerId: customer.id,
    summary: `Kunde „${customer.name || customer.id}“ angelegt`,
    snapshot: customer,
    merge: false,
  });

  await batch.commit();
}

async function updateCustomer(before, after) {
  const changes = buildChanges(before, after);

  if (!Object.keys(changes).length) {
    return false;
  }

  const batch = writeBatch(crmDb);

  addEntityWrite(batch, {
    collectionName: "customers",
    entityId: after.id,
    data: after,
    action: "updated",
    customerId: after.id,
    summary: `Kunde „${after.name || after.id}“ bearbeitet`,
    changes,
    snapshot: after,
  });

  await batch.commit();
  return true;
}

async function archiveCustomerRecord(customer) {
  const after = {
    ...customer,
    archived: true,
    archivedAt: new Date().toISOString(),
  };
  const batch = writeBatch(crmDb);

  addEntityWrite(batch, {
    collectionName: "customers",
    entityId: customer.id,
    data: {
      archived: true,
      archivedAt: after.archivedAt,
    },
    action: "archived",
    customerId: customer.id,
    summary: `Kunde „${customer.name || customer.id}“ archiviert`,
    changes: buildChanges(customer, after),
    snapshot: after,
  });

  await batch.commit();
}

async function restoreCustomerRecord(customer) {
  const after = {
    ...customer,
    archived: false,
    archivedAt: "",
  };
  const batch = writeBatch(crmDb);

  addEntityWrite(batch, {
    collectionName: "customers",
    entityId: customer.id,
    data: {
      archived: false,
      archivedAt: "",
    },
    action: "restored",
    customerId: customer.id,
    summary: `Kunde „${customer.name || customer.id}“ wiederhergestellt`,
    changes: buildChanges(customer, after),
    snapshot: after,
  });

  await batch.commit();
}

async function createActivity(activity, context) {
  const batch = writeBatch(crmDb);
  const customer = context.customer;
  const futureActivities = [...context.activities, activity];
  const createdFromAppointment = Boolean(activity.sourceAppointmentId);
  const sourceSubject = context.sourceAppointment?.subject || activity.sourceAppointmentId;

  addEntityWrite(batch, {
    collectionName: "activities",
    entityId: activity.id,
    data: activity,
    action: createdFromAppointment ? "created-from-appointment" : "created",
    customerId: activity.customerId,
    summary: createdFromAppointment
      ? `Kontakt aus Termin „${sourceSubject}“ erzeugt`
      : `Aktivität „${activity.type || activity.id}“ angelegt`,
    snapshot: activity,
    merge: false,
  });

  addCustomerSystemUpdate(
    batch,
    customer,
    {
      lastContact: latestActivityDate(futureActivities, activity.customerId),
      pipeline: pipelineFromActivityResult(activity.result, customer?.pipeline),
    },
    "Kundendaten aus einer neuen Aktivität aktualisiert",
  );

  if (context.followup) {
    addEntityWrite(batch, {
      collectionName: "followups",
      entityId: context.followup.id,
      data: context.followup,
      action: "created",
      customerId: context.followup.customerId,
      summary: `Wiedervorlage „${context.followup.task || context.followup.id}“ aus einer Aktivität angelegt`,
      snapshot: context.followup,
      merge: false,
    });
  }

  await batch.commit();
}

async function updateActivity(before, after, context) {
  const changes = buildChanges(before, after);

  if (!Object.keys(changes).length) {
    return false;
  }

  const batch = writeBatch(crmDb);
  const futureActivities = context.activities.map((item) =>
    item.id === after.id ? after : item,
  );

  addEntityWrite(batch, {
    collectionName: "activities",
    entityId: after.id,
    data: after,
    action: "updated",
    customerId: after.customerId,
    summary: `Aktivität „${after.type || after.id}“ bearbeitet`,
    changes,
    snapshot: after,
  });

  const affectedCustomerIds = [...new Set([before.customerId, after.customerId])];

  affectedCustomerIds.forEach((customerId) => {
    const customer = context.customers.find((item) => item.id === customerId);
    const updates = {
      lastContact: latestActivityDate(futureActivities, customerId),
    };

    if (customerId === after.customerId) {
      updates.pipeline = pipelineFromActivityResult(
        after.result,
        customer?.pipeline,
      );
    }

    addCustomerSystemUpdate(
      batch,
      customer,
      updates,
      "Kundendaten aus einer bearbeiteten Aktivität aktualisiert",
    );
  });

  await batch.commit();
  return true;
}

async function deleteActivityRecord(activity, context) {
  const batch = writeBatch(crmDb);
  const futureActivities = context.activities.filter(
    (item) => item.id !== activity.id,
  );
  const customer = context.customers.find(
    (item) => item.id === activity.customerId,
  );

  addEntityDelete(batch, {
    collectionName: "activities",
    entity: activity,
    summary: `Aktivität „${activity.type || activity.id}“ gelöscht`,
  });

  addCustomerSystemUpdate(
    batch,
    customer,
    {
      lastContact: latestActivityDate(futureActivities, activity.customerId),
    },
    "Letzten Kundenkontakt nach gelöschter Aktivität aktualisiert",
  );

  await batch.commit();
}

async function createAppointment(appointment, context) {
  const batch = writeBatch(crmDb);
  const futureAppointments = [...context.appointments, appointment];
  const customer = context.customers.find(
    (item) => item.id === appointment.customerId,
  );

  addEntityWrite(batch, {
    collectionName: "appointments",
    entityId: appointment.id,
    data: appointment,
    action: "created",
    customerId: appointment.customerId,
    summary: `Termin „${appointment.subject || appointment.id}“ angelegt`,
    snapshot: appointment,
    merge: false,
  });

  addCustomerSystemUpdate(
    batch,
    customer,
    {
      nextAppointment: nextAppointmentDate(
        futureAppointments,
        appointment.customerId,
      ),
    },
    "Nächsten Kundentermin automatisch aktualisiert",
  );

  await batch.commit();
}

async function updateAppointment(before, after, context) {
  const changes = buildChanges(before, after);

  if (!Object.keys(changes).length) {
    return false;
  }

  const batch = writeBatch(crmDb);
  const futureAppointments = context.appointments.map((item) =>
    item.id === after.id ? after : item,
  );

  addEntityWrite(batch, {
    collectionName: "appointments",
    entityId: after.id,
    data: after,
    action: "updated",
    customerId: after.customerId,
    summary: `Termin „${after.subject || after.id}“ bearbeitet`,
    changes,
    snapshot: after,
  });

  [...new Set([before.customerId, after.customerId])].forEach((customerId) => {
    const customer = context.customers.find((item) => item.id === customerId);

    addCustomerSystemUpdate(
      batch,
      customer,
      {
        nextAppointment: nextAppointmentDate(futureAppointments, customerId),
      },
      "Nächsten Kundentermin automatisch aktualisiert",
    );
  });

  await batch.commit();
  return true;
}

async function deleteAppointmentRecord(appointment, context) {
  const batch = writeBatch(crmDb);
  const futureAppointments = context.appointments.filter(
    (item) => item.id !== appointment.id,
  );
  const customer = context.customers.find(
    (item) => item.id === appointment.customerId,
  );

  addEntityDelete(batch, {
    collectionName: "appointments",
    entity: appointment,
    summary: `Termin „${appointment.subject || appointment.id}“ gelöscht`,
  });

  addCustomerSystemUpdate(
    batch,
    customer,
    {
      nextAppointment: nextAppointmentDate(
        futureAppointments,
        appointment.customerId,
      ),
    },
    "Nächsten Kundentermin nach gelöschtem Termin aktualisiert",
  );

  await batch.commit();
}

async function createFollowup(followup) {
  const batch = writeBatch(crmDb);

  addEntityWrite(batch, {
    collectionName: "followups",
    entityId: followup.id,
    data: followup,
    action: "created",
    customerId: followup.customerId,
    summary: `Wiedervorlage „${followup.task || followup.id}“ angelegt`,
    snapshot: followup,
    merge: false,
  });

  await batch.commit();
}

async function updateFollowup(before, after, action = "updated") {
  const changes = buildChanges(before, after);

  if (!Object.keys(changes).length) {
    return false;
  }

  const labels = {
    updated: "bearbeitet",
    completed: "erledigt",
    reopened: "wieder geöffnet",
  };

  const batch = writeBatch(crmDb);

  addEntityWrite(batch, {
    collectionName: "followups",
    entityId: after.id,
    data: after,
    action,
    customerId: after.customerId,
    summary: `Wiedervorlage „${after.task || after.id}“ ${labels[action] || "geändert"}`,
    changes,
    snapshot: after,
  });

  await batch.commit();
  return true;
}

async function deleteFollowupRecord(followup) {
  const batch = writeBatch(crmDb);

  addEntityDelete(batch, {
    collectionName: "followups",
    entity: followup,
    summary: `Wiedervorlage „${followup.task || followup.id}“ gelöscht`,
  });

  await batch.commit();
}


async function createEmployee(employee) {
  requireAdmin();
  const batch = writeBatch(crmDb);

  addEntityWrite(batch, {
    collectionName: "employees",
    entityId: employee.id,
    data: employee,
    action: "created",
    customerId: "",
    summary: `Außendienstmitarbeiter „${employee.displayName || employee.id}“ angelegt`,
    snapshot: employee,
    merge: false,
  });

  await batch.commit();
}

async function updateEmployee(before, after) {
  requireAdmin();
  const changes = buildChanges(before, after);
  if (!Object.keys(changes).length) return false;

  const batch = writeBatch(crmDb);
  addEntityWrite(batch, {
    collectionName: "employees",
    entityId: after.id,
    data: after,
    action: after.active === false && before.active !== false ? "deactivated" : "updated",
    customerId: "",
    summary: after.active === false && before.active !== false
      ? `Außendienstmitarbeiter „${after.displayName || after.id}“ deaktiviert`
      : `Außendienstmitarbeiter „${after.displayName || after.id}“ bearbeitet`,
    changes,
    snapshot: after,
  });

  await batch.commit();
  return true;
}

async function permanentlyDeleteCustomer(customer, relatedRecords) {
  requireAdmin();

  const related = [
    ...(relatedRecords.activities || []).filter((record) => record.customerId === customer.id).map((record) => ["activities", record]),
    ...(relatedRecords.appointments || []).filter((record) => record.customerId === customer.id).map((record) => ["appointments", record]),
    ...(relatedRecords.followups || []).filter((record) => record.customerId === customer.id).map((record) => ["followups", record]),
  ];

  if (related.length + 2 > 500) {
    throw new Error("Für diesen Kunden sind zu viele verknüpfte Datensätze vorhanden. Bitte wenden Sie sich an die Administration.");
  }

  const batch = writeBatch(crmDb);

  related.forEach(([collectionName, record]) => {
    batch.delete(doc(crmDb, collectionName, record.id));
  });

  batch.delete(doc(crmDb, "customers", customer.id));

  addHistory(batch, {
    entityType: "customer",
    entityId: customer.id,
    customerId: customer.id,
    action: "permanently-deleted",
    summary: `Kunde „${customer.name || customer.id}“ endgültig gelöscht`,
    changes: {},
    snapshot: {
      ...customer,
      deletedRelatedRecords: related.length,
    },
  });

  await batch.commit();
}

async function importCustomers(customers, action = "imported") {
  await importRecords("customers", customers, action);
}

async function importRecords(collectionName, records, action = "migrated") {
  const chunks = [];

  for (let index = 0; index < records.length; index += 200) {
    chunks.push(records.slice(index, index + 200));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(crmDb);

    chunk.forEach((record) => {
      const entityType = collectionName.slice(0, -1);
      const customerId =
        collectionName === "customers" ? record.id : record.customerId || "";
      const title =
        record.name ||
        record.type ||
        record.subject ||
        record.task ||
        record.id;

      addEntityWrite(batch, {
        collectionName,
        entityId: record.id,
        data: record,
        action,
        customerId,
        summary:
          action === "imported"
            ? `${entityType} „${title}“ importiert`
            : `${entityType} „${title}“ aus dem lokalen Bestand übernommen`,
        snapshot: record,
        merge: false,
      });
    });

    await batch.commit();
  }
}

async function loadCustomerHistory(customerId) {
  const [directSnapshot, linkedSnapshot] = await Promise.all([
    getDocs(query(historyCollection, where("entityId", "==", customerId))),
    getDocs(query(historyCollection, where("customerId", "==", customerId))),
  ]);

  const entries = new Map();

  [...directSnapshot.docs, ...linkedSnapshot.docs].forEach((snapshot) => {
    entries.set(snapshot.id, normalizeHistory(snapshot));
  });

  return [...entries.values()].sort((a, b) =>
    String(b.changedAt).localeCompare(String(a.changedAt)),
  );
}

function sortedRecords(collectionName, records) {
  const copy = [...records];

  if (collectionName === "customers") {
    return copy.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "de"),
    );
  }

  if (collectionName === "employees") {
    return copy.sort((a, b) =>
      String(a.displayName || "").localeCompare(String(b.displayName || ""), "de"),
    );
  }

  if (collectionName === "activities") {
    return copy.sort((a, b) =>
      `${b.date || ""}${b.createdAt || ""}`.localeCompare(
        `${a.date || ""}${a.createdAt || ""}`,
      ),
    );
  }

  if (collectionName === "appointments") {
    return copy.sort((a, b) =>
      `${a.date || ""}${a.time || ""}`.localeCompare(
        `${b.date || ""}${b.time || ""}`,
      ),
    );
  }

  return copy.sort((a, b) =>
    String(a.due || "").localeCompare(String(b.due || "")),
  );
}

function startAllDataSync() {
  if (syncPromise) return syncPromise;

  syncPromise = new Promise((resolve, reject) => {
    const collectionNames = Object.keys(collections);
    const firstSnapshots = new Set();
    let settled = false;

    function finishIfReady() {
      if (firstSnapshots.size === collectionNames.length && !settled) {
        settled = true;
        resolve();
      }
    }

    collectionNames.forEach((collectionName) => {
      unsubscribers[collectionName] = onSnapshot(
        collections[collectionName],
        (snapshot) => {
          const records = sortedRecords(
            collectionName,
            snapshot.docs.map(normalizeSnapshot),
          );

          window.crmStateBridge?.replaceCollectionFromFirestore?.(
            collectionName,
            records,
          );

          firstSnapshots.add(collectionName);
          finishIfReady();
        },
        (error) => {
          console.error(`${collectionName} synchronization failed:`, error);
          window.dispatchEvent(
            new CustomEvent("crm-connection-error", { detail: { error } }),
          );

          if (!settled) {
            settled = true;
            reject(error);
          }
        },
      );
    });
  });

  return syncPromise;
}


async function loadAllHistoryForBackup() {
  requireAdmin();

  const snapshot = await getDocs(historyCollection);

  return snapshot.docs
    .map(normalizeHistory)
    .sort((a, b) =>
      String(a.changedAt || "").localeCompare(String(b.changedAt || "")),
    );
}

async function logBackupHistory({
  action,
  summary,
  snapshot = {},
}) {
  requireAdmin();

  const batch = writeBatch(crmDb);

  addHistory(batch, {
    entityType: "backup",
    entityId: `BACKUP-${Date.now()}`,
    action,
    summary,
    snapshot,
  });

  await batch.commit();
}

function cleanBackupRecord(record) {
  const clean = { ...record };
  delete clean.id;
  return clean;
}

async function commitBackupOperations(operations, progressCallback) {
  const chunkSize = 350;
  const total = operations.length;
  let completed = 0;

  for (let start = 0; start < operations.length; start += chunkSize) {
    const chunk = operations.slice(start, start + chunkSize);
    const batch = writeBatch(crmDb);

    chunk.forEach((operation) => {
      const ref = doc(crmDb, operation.collectionName, operation.id);

      if (operation.type === "delete") {
        batch.delete(ref);
      } else {
        batch.set(ref, operation.data, { merge: false });
      }
    });

    await batch.commit();
    completed += chunk.length;

    progressCallback?.({
      completed,
      total,
    });
  }
}

async function restoreOperationalBackup(backupData, progressCallback) {
  requireAdmin();

  const collectionNames = [
    "customers",
    "activities",
    "appointments",
    "followups",
    "employees",
  ];

  const currentSnapshots = {};

  progressCallback?.({
    stage: "Aktuelle Daten werden geprüft",
    completed: 0,
    total: collectionNames.length,
    percent: 2,
  });

  for (let index = 0; index < collectionNames.length; index += 1) {
    const collectionName = collectionNames[index];
    currentSnapshots[collectionName] = await getDocs(
      collection(crmDb, collectionName),
    );

    progressCallback?.({
      stage: "Aktuelle Daten werden geprüft",
      completed: index + 1,
      total: collectionNames.length,
      percent: 2 + ((index + 1) / collectionNames.length) * 8,
    });
  }

  const deleteOperations = collectionNames.flatMap((collectionName) =>
    currentSnapshots[collectionName].docs.map((snapshot) => ({
      type: "delete",
      collectionName,
      id: snapshot.id,
    })),
  );

  const writeOperations = collectionNames.flatMap((collectionName) =>
    (backupData[collectionName] || []).map((record) => ({
      type: "set",
      collectionName,
      id: String(record.id),
      data: cleanBackupRecord(record),
    })),
  );

  const totalOperations =
    deleteOperations.length + writeOperations.length || 1;

  await commitBackupOperations(
    deleteOperations,
    ({ completed }) => {
      progressCallback?.({
        stage: "Bestehende CRM-Daten werden entfernt",
        completed,
        total: deleteOperations.length || 1,
        percent: 10 + (completed / totalOperations) * 40,
      });
    },
  );

  await commitBackupOperations(
    writeOperations,
    ({ completed }) => {
      progressCallback?.({
        stage: "Sicherungsdaten werden eingespielt",
        completed,
        total: writeOperations.length || 1,
        percent:
          50 +
          (completed / Math.max(writeOperations.length, 1)) * 45,
      });
    },
  );

  await logBackupHistory({
    action: "backup-restored",
    summary:
      `JSON-Backup wiederhergestellt: ` +
      `${backupData.customers?.length || 0} Kunden, ` +
      `${backupData.activities?.length || 0} Aktivitäten, ` +
      `${backupData.appointments?.length || 0} Termine, ` +
      `${backupData.followups?.length || 0} Wiedervorlagen und ` +
      `${backupData.employees?.length || 0} Außendienstmitarbeiter`,
    snapshot: {
      counts: {
        customers: backupData.customers?.length || 0,
        activities: backupData.activities?.length || 0,
        appointments: backupData.appointments?.length || 0,
        followups: backupData.followups?.length || 0,
        employees: backupData.employees?.length || 0,
        historyContainedInFile: backupData.history?.length || 0,
      },
      historyRestored: false,
      note:
        "Die bestehende Historie wurde nicht gelöscht. Die im Backup enthaltene Historie bleibt in der Sicherungsdatei erhalten.",
    },
  });

  progressCallback?.({
    stage: "Wiederherstellung wird abgeschlossen",
    completed: totalOperations,
    total: totalOperations,
    percent: 100,
  });
}

function subscribeGlobalHistory(callback, errorCallback) {
  if (unsubscribeHistory) {
    unsubscribeHistory();
  }

  unsubscribeHistory = onSnapshot(
    historyCollection,
    (snapshot) => {
      const entries = snapshot.docs
        .map(normalizeHistory)
        .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt)));

      callback(entries);
    },
    (error) => {
      console.error("Global history synchronization failed:", error);
      errorCallback?.(error);
    },
  );

  return unsubscribeHistory;
}


async function logExportHistory({ exportType, count, filters = {} }) {
  const batch = writeBatch(crmDb);

  addHistory(batch, {
    entityType: "export",
    entityId: `EXPORT-${Date.now()}`,
    action: "exported",
    summary: `${exportType} mit ${count} Datensätzen als CSV exportiert`,
    snapshot: {
      exportType,
      count,
      filters,
    },
  });

  await batch.commit();
}

window.crmFirestore = {
  createCustomer,
  updateCustomer,
  archiveCustomerRecord,
  restoreCustomerRecord,
  createActivity,
  updateActivity,
  deleteActivityRecord,
  createAppointment,
  updateAppointment,
  deleteAppointmentRecord,
  createFollowup,
  updateFollowup,
  deleteFollowupRecord,
  importCustomers,
  loadCustomerHistory,
  subscribeGlobalHistory,
  loadCurrentUserProfile,
  createEmployee,
  updateEmployee,
  permanentlyDeleteCustomer,
  logExportHistory,
  loadAllHistoryForBackup,
  logBackupHistory,
  restoreOperationalBackup,
};

export { startAllDataSync, loadCurrentUserProfile };
