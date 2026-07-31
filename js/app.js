"use strict";

let crmInitialized = false;

function renderAll() {
  renderDashboard();
  renderCustomers();
  renderAppointments();
  renderActivities();
  renderFollowups();
}

function initializeCrm() {
  if (crmInitialized) {
    renderAll();
    return;
  }

  crmInitialized = true;

  fillOwnerSelects();
  bindEvents();
  setupCanvas();
  renderAll();
}

window.addEventListener("crm-auth-ready", initializeCrm);
