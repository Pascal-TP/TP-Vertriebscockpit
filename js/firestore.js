import { crmAuth, crmDb } from "./firebase.js";

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  writeBatch,
  where,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const customerCollection = collection(crmDb, "customers");
const historyCollection = collection(crmDb, "history");

let unsubscribeCustomers = null;
let migrationHandled = false;

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

function normalizeCustomer(snapshot) {
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

  if (value === undefined) {
    return "";
  }

  return value;
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

function historyPayload({
  customerId,
  action,
  summary,
  changes = {},
  snapshot = {},
}) {
  const currentActor = actor();

  return {
    entityType: "customer",
    entityId: customerId,
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

async function writeCustomerAndHistory({
  customerId,
  customerData,
  action,
  summary,
  changes = {},
  snapshot = {},
  merge = true,
}) {
  const currentActor = actor();
  const batch = writeBatch(crmDb);
  const customerRef = doc(crmDb, "customers", customerId);
  const historyRef = doc(historyCollection);

  const auditData = {
    updatedAt: serverTimestamp(),
    updatedByUid: currentActor.uid,
    updatedByEmail: currentActor.email,
  };

  if (action === "created" || action === "imported" || action === "migrated") {
    Object.assign(auditData, {
      createdAt: serverTimestamp(),
      createdByUid: currentActor.uid,
      createdByEmail: currentActor.email,
    });
  }

  batch.set(
    customerRef,
    {
      ...customerData,
      ...auditData,
    },
    { merge },
  );

  batch.set(
    historyRef,
    historyPayload({
      customerId,
      action,
      summary,
      changes,
      snapshot,
    }),
  );

  await batch.commit();
}

async function createCustomer(customer) {
  await writeCustomerAndHistory({
    customerId: customer.id,
    customerData: customer,
    action: "created",
    summary: `Kunde „${customer.name || customer.id}“ angelegt`,
    snapshot: customer,
    merge: false,
  });
}

async function updateCustomer(before, after) {
  const changes = buildChanges(before, after);

  if (!Object.keys(changes).length) {
    return false;
  }

  await writeCustomerAndHistory({
    customerId: after.id,
    customerData: after,
    action: "updated",
    summary: `Kunde „${after.name || after.id}“ bearbeitet`,
    changes,
    snapshot: after,
  });

  return true;
}

async function archiveCustomerRecord(customer) {
  const after = {
    ...customer,
    archived: true,
    archivedAt: new Date().toISOString(),
  };

  await writeCustomerAndHistory({
    customerId: customer.id,
    customerData: {
      archived: true,
      archivedAt: after.archivedAt,
    },
    action: "archived",
    summary: `Kunde „${customer.name || customer.id}“ archiviert`,
    changes: buildChanges(customer, after),
    snapshot: after,
  });
}

async function restoreCustomerRecord(customer) {
  const after = {
    ...customer,
    archived: false,
    archivedAt: "",
  };

  await writeCustomerAndHistory({
    customerId: customer.id,
    customerData: {
      archived: false,
      archivedAt: "",
    },
    action: "restored",
    summary: `Kunde „${customer.name || customer.id}“ wiederhergestellt`,
    changes: buildChanges(customer, after),
    snapshot: after,
  });
}

async function updateCustomerSystemFields(customer, updates, summary) {
  if (!customer) {
    return;
  }

  const after = { ...customer, ...updates };
  const changes = buildChanges(customer, after);

  if (!Object.keys(changes).length) {
    return;
  }

  await writeCustomerAndHistory({
    customerId: customer.id,
    customerData: updates,
    action: "system-updated",
    summary,
    changes,
    snapshot: after,
  });
}

async function importCustomers(customers, action = "imported") {
  const chunks = [];

  for (let index = 0; index < customers.length; index += 200) {
    chunks.push(customers.slice(index, index + 200));
  }

  for (const chunk of chunks) {
    const currentActor = actor();
    const batch = writeBatch(crmDb);

    chunk.forEach((customer) => {
      const customerRef = doc(crmDb, "customers", customer.id);
      const historyRef = doc(historyCollection);

      batch.set(
        customerRef,
        {
          ...customer,
          createdAt: serverTimestamp(),
          createdByUid: currentActor.uid,
          createdByEmail: currentActor.email,
          updatedAt: serverTimestamp(),
          updatedByUid: currentActor.uid,
          updatedByEmail: currentActor.email,
        },
        { merge: false },
      );

      batch.set(
        historyRef,
        historyPayload({
          customerId: customer.id,
          action,
          summary:
            action === "migrated"
              ? `Kunde „${customer.name || customer.id}“ aus dem lokalen Bestand übernommen`
              : `Kunde „${customer.name || customer.id}“ per CSV importiert`,
          snapshot: customer,
        }),
      );
    });

    await batch.commit();
  }
}

async function loadCustomerHistory(customerId) {
  const historyQuery = query(
    historyCollection,
    where("entityId", "==", customerId),
  );

  const snapshot = await getDocs(historyQuery);

  return snapshot.docs
    .map(normalizeHistory)
    .filter((entry) => entry.entityType === "customer")
    .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt)));
}

async function offerInitialMigration() {
  if (migrationHandled) {
    return;
  }

  migrationHandled = true;

  const localCustomers =
    window.crmStateBridge?.getLocalCustomersForMigration?.() || [];

  if (!localCustomers.length) {
    return;
  }

  const confirmed = window.confirm(
    `Die zentrale Kundendatenbank ist noch leer.\n\n` +
      `Es wurden ${localCustomers.length} lokale Kundendatensätze gefunden.\n\n` +
      `Sollen diese jetzt einmalig nach Firestore übernommen werden?`,
  );

  if (!confirmed) {
    return;
  }

  await importCustomers(localCustomers, "migrated");
}

function startCustomerSync() {
  if (unsubscribeCustomers) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let firstSnapshot = true;

    unsubscribeCustomers = onSnapshot(
      customerCollection,
      async (snapshot) => {
        const customers = snapshot.docs
          .map(normalizeCustomer)
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || ""), "de"),
          );

        window.crmStateBridge?.replaceCustomersFromFirestore?.(customers);

        if (firstSnapshot) {
          firstSnapshot = false;

          try {
            if (snapshot.empty) {
              await offerInitialMigration();
            }

            resolve();
          } catch (error) {
            reject(error);
          }
        }
      },
      (error) => {
        console.error("Customer synchronization failed:", error);
        reject(error);
      },
    );
  });
}

window.crmFirestore = {
  createCustomer,
  updateCustomer,
  archiveCustomerRecord,
  restoreCustomerRecord,
  updateCustomerSystemFields,
  importCustomers,
  loadCustomerHistory,
};

export { startCustomerSync };
