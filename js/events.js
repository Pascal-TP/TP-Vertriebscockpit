"use strict";

function bindEvents() {
  bindNavigationEvents();
  bindDashboardEvents();
  bindCustomerEvents();
  bindGlobalActionEvents();
  bindCreateButtonEvents();
  bindAppointmentEvents();
  bindFormEvents();
  bindDemoEvents();
  bindSearchEvents();
  bindImportEvents();
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

  $("#dynamicForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") {
      return;
    }

    event.preventDefault();

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());

    saveForm(form.dataset.type, values, {
      mode: form.dataset.mode,
      recordId: form.dataset.recordId,
    });

    $("#formDialog").close();
  });
}

function bindDemoEvents() {
  $("#resetDemoButton").onclick = () => {
    data = structuredClone(seedData);
    currentCustomerId = null;

    saveData();
    renderEmptyCustomerDetail();

    toast("Demodaten wurden zurückgesetzt.");
  };
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
  $("#csvFile").onchange = (event) => {
    const file = event.target.files[0];

    $("#fileName").textContent = file ? file.name : "oder hier ablegen";
    $("#importButton").disabled = !file;
  };

  $("#importButton").onclick = () => {
    const file = $("#csvFile").files[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const rawRows = parseCSV(reader.result);

      pendingImport = mapImport(rawRows, $("#importType").value);

      const columns = [
        "name",
        "street",
        "zip",
        "city",
        "contact",
        "phone",
        "email",
      ];

      $("#importPreview thead").innerHTML =
        "<tr>" +
        columns.map((column) => `<th>${column}</th>`).join("") +
        "</tr>";

      $("#importPreview tbody").innerHTML = pendingImport
        .slice(0, 8)
        .map(
          (row) =>
            "<tr>" +
            columns
              .map((column) => `<td>${row[column] || ""}</td>`)
              .join("") +
            "</tr>",
        )
        .join("");

      $("#importSummary").textContent =
        `${pendingImport.length} Datensätze erkannt`;

      $("#confirmImportButton").classList.remove("hidden");
    };

    reader.readAsText(file, "utf-8");
  };

  $("#confirmImportButton").onclick = () => {
    data.customers.push(...pendingImport);
    pendingImport = [];

    saveData();

    toast("CSV-Datensätze wurden übernommen.");
    showView("customers");
  };
}
