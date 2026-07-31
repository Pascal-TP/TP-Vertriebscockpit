"use strict";

let data = loadData();
let currentCustomerId = null;
let calendarOffset = 0;
let pendingImport = [];
let activeNoteTarget = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const customerById = (id) => data.customers.find((c) => c.id === id);

const formatDate = (value) => {
  if (!value) {
    return "–";
  }

  const date = String(value).includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`);

  return Number.isNaN(date.getTime())
    ? "–"
    : new Intl.DateTimeFormat("de-DE").format(date);
};

const formatDateTime = (value) => {
  if (!value) {
    return "–";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "–"
    : new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

const daysBetween = (value) =>
  value
    ? Math.floor((new Date() - new Date(`${value}T12:00:00`)) / 86400000)
    : 9999;

const initials = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function loadData() {
  try {
    return (
      JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(seedData)
    );
  } catch {
    return structuredClone(seedData);
  }
}

function saveData() {
  /*
   * Firestore ist die führende Datenquelle.
   * localStorage dient nur noch als lokaler Cache und als Quelle für die
   * einmalige Übernahme alter Bestände.
   */
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  renderAll();
}

function replaceCollectionFromFirestore(collectionName, records) {
  if (!["customers", "activities", "appointments", "followups"].includes(collectionName)) {
    return;
  }

  data[collectionName] = records;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  if (
    collectionName === "customers" &&
    currentCustomerId &&
    !data.customers.some((customer) => customer.id === currentCustomerId)
  ) {
    currentCustomerId = null;
  }

  if (typeof renderAll === "function") {
    renderAll();
  }

  if (
    collectionName !== "customers" &&
    currentCustomerId &&
    typeof renderCustomerDetail === "function"
  ) {
    renderCustomerDetail(currentCustomerId);
  }
}

function getLocalDataForMigration() {
  return structuredClone({
    customers: data.customers || [],
    activities: data.activities || [],
    appointments: data.appointments || [],
    followups: data.followups || [],
  });
}

window.crmStateBridge = {
  replaceCollectionFromFirestore,
  getLocalDataForMigration,
};

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

function getWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}
