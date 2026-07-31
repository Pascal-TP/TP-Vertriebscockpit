"use strict";

function renderAll() {
  renderDashboard();
  renderCustomers();
  renderAppointments();
  renderActivities();
  renderFollowups();
}

fillOwnerSelects();
bindEvents();
setupCanvas();
renderAll();
