"use strict";

let editingEmployeeId = null;

function employeeById(id) {
  return data.employees.find((employee) => employee.id === id);
}

function applyRoleToUi() {
  const admin = isAdmin();
  document.body.classList.toggle("crm-admin", admin);

  const adminNav = $("#adminNavButton");
  if (adminNav) adminNav.classList.toggle("hidden", !admin);

  const roleBadge = $("#currentUserRole");
  if (roleBadge) {
    roleBadge.textContent = admin ? "Administrator" : "Benutzer";
    roleBadge.dataset.role = admin ? "admin" : "user";
  }

  if (!admin && document.querySelector("#view-admin.active")) {
    showView("dashboard");
  }
}

function renderAdmin() {
  if (!isAdmin()) return;

  const list = $("#employeeAdminList");
  const count = $("#employeeCount");
  if (!list || !count) return;

  const employees = [...data.employees].sort((a, b) =>
    String(a.displayName || "").localeCompare(String(b.displayName || ""), "de"),
  );

  count.textContent = `${employees.length} Außendienstmitarbeiter`;

  list.innerHTML = employees.length
    ? employees.map((employee) => `
        <div class="admin-employee-row ${employee.active === false ? "inactive" : ""}">
          <div>
            <strong>${employee.displayName || "Ohne Namen"}</strong>
            <span>${employee.email || "Keine E-Mail-Adresse"}</span>
          </div>
          <span class="status-pill ${employee.active === false ? "archived" : "green"}">
            ${employee.active === false ? "Inaktiv" : "Aktiv"}
          </span>
          <button class="secondary-button" type="button" data-admin-action="edit-employee" data-id="${employee.id}">
            Bearbeiten
          </button>
        </div>
      `).join("")
    : '<div class="empty-state"><p>Noch keine Außendienstmitarbeiter angelegt.</p></div>';
}

function openEmployeeDialog(employee = null) {
  if (!isAdmin()) return;

  editingEmployeeId = employee?.id || null;
  $("#employeeDialogTitle").textContent = employee ? "Außendienstmitarbeiter bearbeiten" : "Außendienstmitarbeiter anlegen";
  $("#employeeName").value = employee?.displayName || "";
  $("#employeeEmail").value = employee?.email || "";
  $("#employeeActive").checked = employee?.active !== false;
  $("#employeeDialog").showModal();
  $("#employeeName").focus();
}

async function saveEmployee(event) {
  event.preventDefault();
  if (!isAdmin()) return;

  const displayName = $("#employeeName").value.trim();
  const email = $("#employeeEmail").value.trim();
  const active = $("#employeeActive").checked;

  if (!displayName) {
    window.alert("Bitte geben Sie den Namen des Außendienstmitarbeiters ein.");
    return;
  }

  const duplicate = data.employees.find((employee) =>
    employee.id !== editingEmployeeId &&
    String(employee.displayName || "").trim().toLowerCase() === displayName.toLowerCase()
  );

  if (duplicate) {
    window.alert("Ein Außendienstmitarbeiter mit diesem Namen ist bereits vorhanden.");
    return;
  }

  const saveButton = $("#saveEmployeeButton");
  saveButton.disabled = true;

  try {
    if (editingEmployeeId) {
      const before = employeeById(editingEmployeeId);
      const after = { ...before, displayName, email, active };
      await window.crmFirestore.updateEmployee(before, after);
      toast("Außendienstmitarbeiter wurde aktualisiert.");
    } else {
      await window.crmFirestore.createEmployee({
        id: crypto.randomUUID(),
        displayName,
        email,
        active,
      });
      toast("Außendienstmitarbeiter wurde angelegt.");
    }

    $("#employeeDialog").close();
  } catch (error) {
    console.error("Employee save failed:", error);
    window.alert(error?.message || "Der Außendienstmitarbeiter konnte nicht gespeichert werden.");
  } finally {
    saveButton.disabled = false;
  }
}

function bindAdminEvents() {
  $("#newEmployeeButton")?.addEventListener("click", () => openEmployeeDialog());
  $("#closeEmployeeDialog")?.addEventListener("click", () => $("#employeeDialog").close());
  $("#cancelEmployeeButton")?.addEventListener("click", () => $("#employeeDialog").close());
  $("#employeeForm")?.addEventListener("submit", saveEmployee);

  $("#employeeAdminList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-action='edit-employee']");
    if (!button) return;
    openEmployeeDialog(employeeById(button.dataset.id));
  });

  window.addEventListener("crm-data-updated", (event) => {
    if (event.detail?.collectionName === "employees") renderAdmin();
  });
}

window.addEventListener("crm-role-ready", (event) => {
  setCurrentUserProfile(event.detail.profile);
  applyRoleToUi();
});
