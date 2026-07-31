"use strict";

let crmInitialized = false;

function renderAll() {
  renderDashboard();
  renderCustomers();
  renderAppointments();
  renderActivities();
  renderFollowups();
}

function initializeCRM() {
  if (crmInitialized) {
    return;
  }

  crmInitialized = true;

  if (window.crmCurrentUserProfile) {
    setCurrentUserProfile(window.crmCurrentUserProfile);
  }
  applyRoleToUi();
  fillOwnerSelects();
  bindEvents();
  bindDuplicateEvents();
  bindHistoryEvents();
  initializeGlobalHistory();
  setupCanvas();
  renderAll();
}

/*
 * Erst nach erfolgreicher Anmeldung und geladener Firestore-Grundstruktur
 * initialisieren. Zu diesem Zeitpunkt steht auch window.crmFirestore bereit.
 */
window.addEventListener("crm-auth-ready", initializeCRM);
