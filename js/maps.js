"use strict";

function openMaps(customerId) {
  const c = customerById(customerId);
  if (!c) return;
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.street}, ${c.zip} ${c.city}`)}`,
    "_blank",
    "noopener",
  );
}
