"use strict";

function setupCanvas() {
  const canvas = $("#noteCanvas"),
    ctx = canvas.getContext("2d");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  let drawing = false;
  const point = (e) => {
    const r = canvas.getBoundingClientRect(),
      p = e.touches?.[0] || e;
    return {
      x: ((p.clientX - r.left) * canvas.width) / r.width,
      y: ((p.clientY - r.top) * canvas.height) / r.height,
    };
  };
  const start = (e) => {
    drawing = true;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  };
  const move = (e) => {
    if (!drawing) return;
    const p = point(e);
    ctx.lineWidth = +$("#penWidth").value;
    ctx.strokeStyle = "#12354a";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  };
  const end = () => (drawing = false);
  ["pointerdown"].forEach((x) => canvas.addEventListener(x, start));
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointerleave", end);
  $("#clearCanvasButton").onclick = () =>
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  $("#saveNoteButton").onclick = () => {
    if (activeNoteTarget) {
      activeNoteTarget.value = canvas.toDataURL("image/png");
      activeNoteTarget.parentElement.querySelector(".hand-status").textContent =
        "Notiz vorhanden";
    }
    $("#noteDialog").close();
  };
  $("#cancelNoteButton").onclick = $("#closeNoteButton").onclick = () =>
    $("#noteDialog").close();
}
