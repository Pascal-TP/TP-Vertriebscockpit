"use strict";

function bindEvents() {
  bindNavigationEvents();
  bindDashboardEvents();
  bindCustomerEvents();
  bindGlobalActionEvents();
  bindCreateButtonEvents();
  bindAppointmentEvents();
  bindFormEvents();
  bindSearchEvents();
  bindImportEvents();
  bindAdminEvents();
}

function bindNavigationEvents() {
  $$(".nav-button").forEach(
    (button) => (button.onclick = () => showView(button.dataset.view)),
  );

  $$("[data-go]").forEach(
    (button) => (button.onclick = () => showView(button.dataset.go)),
  );

  $("#menuButton").onclick = () => $("#sidebar").classList.toggle("open");
}

function bindDashboardEvents() {
  $("#dashboardOwner").onchange = renderDashboard;
  $("#dashboardPeriod").onchange = renderDashboard;
}

function bindCustomerEvents() {
  $("#customerOwnerFilter").onchange = renderCustomers;
  $("#customerSearch").oninput = renderCustomers;

  $("#customerTypeFilter").onclick = (event) => {
    if (event.target.tagName !== "BUTTON") {
      return;
    }

    $$("#customerTypeFilter button").forEach((button) =>
      button.classList.remove("active"),
    );

    event.target.classList.add("active");
    renderCustomers();
  };

  $("#customerList").onclick = (event) => {
    const row = event.target.closest(".customer-row");

    if (!row) {
      return;
    }

    currentCustomerId = row.dataset.id;
    renderCustomerDetail(currentCustomerId);
  };
}

function bindGlobalActionEvents() {
  document.addEventListener("click", (event) => {
    const mapButton = event.target.closest(".map-link");

    if (mapButton) {
      openMaps(mapButton.dataset.customer);
      return;
    }

    const actionButton = event.target.closest("[data-action]");

    if (actionButton) {
      handleActionButton(actionButton);
      return;
    }

  });
}

function handleActionButton(button) {
  const action = button.dataset.action;
  const recordId = button.dataset.id;

  if (action === "edit-customer") {
    openCustomerEditForm(recordId);
    return;
  }

  if (action === "archive-customer") {
    archiveCustomer(recordId);
    return;
  }

  if (action === "permanently-delete-customer") {
    permanentlyDeleteCustomer(recordId);
    return;
  }

  if (action === "restore-customer") {
    restoreCustomer(recordId);
    return;
  }

  if (action === "refresh-customer-history") {
    renderCustomerAuditHistory(recordId);
    return;
  }

  if (action === "edit-appointment") {
    openAppointmentEditForm(recordId);
    return;
  }

  if (action === "delete-appointment") {
    deleteAppointment(recordId);
    return;
  }

  if (action === "edit-followup") {
    openFollowupEditForm(recordId);
    return;
  }

  if (action === "complete-followup") {
    completeFollowup(recordId);
    return;
  }

  if (action === "reopen-followup") {
    reopenFollowup(recordId);
    return;
  }

  if (action === "delete-followup") {
    deleteFollowup(recordId);
    return;
  }

  if (action === "edit-activity") {
    openActivityEditForm(recordId);
    return;
  }

  if (action === "delete-activity") {
    deleteActivity(recordId);
    return;
  }

  openForm(action, {
    customerId: recordId,
  });
}

function bindCreateButtonEvents() {
  $("#quickActivityButton").onclick = $("#newActivityButton").onclick = () =>
    openForm("activity");

  $("#newCustomerButton").onclick = () => openForm("customer");
  $("#newAppointmentButton").onclick = () => openForm("appointment");
  $("#newFollowupButton").onclick = () => openForm("followup");
}

function bindAppointmentEvents() {
  $("#prevWeek").onclick = () => {
    calendarOffset--;
    renderAppointments();
  };

  $("#nextWeek").onclick = () => {
    calendarOffset++;
    renderAppointments();
  };
}

function bindFormEvents() {
  $("#dynamicForm").addEventListener("click", (event) => {
    if (!event.target.classList.contains("open-note")) {
      return;
    }

    activeNoteTarget =
      event.target.parentElement.querySelector("input[type=hidden]");

    const canvas = $("#noteCanvas");
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (activeNoteTarget.value) {
      const image = new Image();

      image.onload = () => context.drawImage(image, 0, 0);
      image.src = activeNoteTarget.value;
    }

    $("#noteDialog").showModal();
  });

  $("#dynamicForm").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") {
      return;
    }

    event.preventDefault();

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());

    const saveButton = $("#dialogSaveButton");
    saveButton.disabled = true;

    const saved = await saveForm(form.dataset.type, values, {
      mode: form.dataset.mode,
      recordId: form.dataset.recordId,
    });

    saveButton.disabled = false;

    if (saved) {
      $("#formDialog").close();
    }
  });
}


function bindSearchEvents() {
  $("#globalSearch").onkeydown = (event) => {
    if (event.key !== "Enter") {
      return;
    }

    showView("customers");
    $("#customerSearch").value = event.target.value;
    renderCustomers();
  };
}

function bindImportEvents() {
  const resetPreview = () => {
    pendingImport = [];
    $("#importPreview thead").innerHTML = "";
    $("#importPreview tbody").innerHTML = "";
    $("#confirmImportButton").classList.add("hidden");
  };

  $("#csvFile").onchange = (event) => {
    const file = event.target.files[0];
    resetPreview();
    $("#fileName").textContent = file ? file.name : "oder hier ablegen";
    $("#importButton").disabled = !file;
    $("#importSummary").textContent = file
      ? "Datei ausgewählt – Vorschau noch nicht geprüft"
      : "Noch keine Datei ausgewählt";
  };

  $("#importButton").onclick = async () => {
    const file = $("#csvFile").files[0];
    if (!file) return;

    const button = $("#importButton");
    button.disabled = true;

    try {
      const text = decodeCSVFile(await file.arrayBuffer());
      const rawRows = parseCSV(text);
      pendingImport = classifyImportRows(mapImport(rawRows, $("#importType").value));

      const columns = [
        "customerNumber",
        "name",
        "street",
        "zip",
        "city",
        "contact",
        "email",
        "phone",
        "mobile",
        "importStatus",
      ];

      $("#importPreview thead").innerHTML =
        "<tr>" + columns.map((column) => `<th>${IMPORT_COLUMN_LABELS[column]}</th>`).join("") + "</tr>";

      $("#importPreview tbody").innerHTML = pendingImport
        .map((row) => {
          const reason = row.importReasons.length ? ` title="${row.importReasons.join("; ").replace(/\"/g, "&quot;")}"` : "";
          return `<tr class="import-row ${row.importable ? "importable" : "skipped"}">` +
            columns.map((column) => {
              if (column === "importStatus") {
                return `<td${reason}><span class="import-status ${importStatusClass(row[column])}">${row[column]}</span></td>`;
              }
              return `<td>${String(row[column] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`;
            }).join("") +
            "</tr>";
        })
        .join("");

      const counts = pendingImport.reduce((result, row) => {
        result[row.importStatus] = (result[row.importStatus] || 0) + 1;
        return result;
      }, {});
      const importableCount = pendingImport.filter((row) => row.importable).length;
      const skippedCount = pendingImport.length - importableCount;

      $("#importSummary").innerHTML =
        `<strong>${pendingImport.length}</strong> Datensätze geprüft · ` +
        `<strong>${importableCount}</strong> neu · ` +
        `<strong>${skippedCount}</strong> werden nicht übernommen` +
        (Object.keys(counts).length
          ? `<br><small>${Object.entries(counts).map(([status, count]) => `${status}: ${count}`).join(" · ")}</small>`
          : "");

      $("#confirmImportButton").textContent = `${importableCount} neue Datensätze übernehmen`;
      $("#confirmImportButton").disabled = importableCount === 0;
      $("#confirmImportButton").classList.remove("hidden");
    } catch (error) {
      console.error("CSV preview failed:", error);
      resetPreview();
      $("#importSummary").textContent = "Die Datei konnte nicht gelesen werden.";
      toast("Die CSV-Datei konnte nicht verarbeitet werden.");
    } finally {
      button.disabled = false;
    }
  };

  $("#confirmImportButton").onclick = async () => {
    const newCustomers = pendingImport
      .filter((row) => row.importable)
      .map(({ sourceRow, importStatus, importReasons, existingCustomerId, importable, ...customer }) => customer);

    if (!newCustomers.length) return;

    const button = $("#confirmImportButton");
    button.disabled = true;

    try {
      // Unmittelbar vor dem Schreiben erneut prüfen. Damit werden auch Datensätze
      // berücksichtigt, die seit Erstellung der Vorschau neu angelegt wurden.
      const finalRows = classifyImportRows(newCustomers.map((customer, index) => ({
        ...customer,
        sourceRow: index + 2,
      })));
      const finalCustomers = finalRows
        .filter((row) => row.importable)
        .map(({ sourceRow, importStatus, importReasons, existingCustomerId, importable, ...customer }) => customer);

      if (!finalCustomers.length) {
        $("#importSummary").textContent = "Keine neuen Datensätze mehr vorhanden. Bestehende Kunden wurden nicht verändert.";
        toast("Es wurden keine bestehenden Kunden überschrieben.");
        return;
      }

      await window.crmFirestore.importCustomers(finalCustomers, "imported");
      const skippedAtCommit = newCustomers.length - finalCustomers.length;
      pendingImport = [];

      $("#confirmImportButton").classList.add("hidden");
      $("#importSummary").textContent =
        `${finalCustomers.length} neue Kunden importiert` +
        (skippedAtCommit ? ` · ${skippedAtCommit} zwischenzeitlich erkannte Dublette(n) ausgelassen` : "");

      toast(`${finalCustomers.length} neue Kundendatensätze wurden ergänzt.`);
      showView("customers");
    } catch (error) {
      console.error("CSV import failed:", error);
      toast("Der CSV-Import konnte nicht abgeschlossen werden.");
    } finally {
      button.disabled = false;
    }
  };
}
