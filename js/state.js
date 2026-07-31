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
   * Aktivitäten, Termine und Wiedervorlagen bleiben in diesem Ausbau
   * noch lokal. Die Kundenliste wird zusätzlich als lokaler Cache
   * mitgespeichert, ist aber nicht mehr die führende Datenquelle.
   */
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  renderAll();
}

function replaceCustomersFromFirestore(customers) {
  data.customers = customers;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  if (
    currentCustomerId &&
    !data.customers.some((customer) => customer.id === currentCustomerId)
  ) {
    currentCustomerId = null;
  }

  if (typeof renderAll === "function") {
    renderAll();
  }
}

function getLocalCustomersForMigration() {
  return structuredClone(data.customers || []);
}

window.crmStateBridge = {
  replaceCustomersFromFirestore,
  getLocalCustomersForMigration,
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
