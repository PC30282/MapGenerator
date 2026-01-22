const form = document.getElementById("map-form");
const resetButton = document.getElementById("reset");
const downloadButton = document.getElementById("download");
const canvas = document.getElementById("map-canvas");
const status = document.getElementById("status");
const context = canvas.getContext("2d");

const inputs = {
  siteName: document.getElementById("site-name"),
  easting: document.getElementById("site-easting"),
  northing: document.getElementById("site-northing"),
  latitude: document.getElementById("site-lat"),
  longitude: document.getElementById("site-lon"),
  rangeEasting: document.getElementById("range-easting"),
  rangeNorthing: document.getElementById("range-northing"),
  radii: [
    document.getElementById("radius-1"),
    document.getElementById("radius-2"),
    document.getElementById("radius-3"),
  ],
};

const palette = ["#1f6feb", "#f97316", "#22c55e"]; 

const drawGrid = (bounds) => {
  const { width, height, margin } = bounds;
  context.save();
  context.strokeStyle = "#e3e9f2";
  context.lineWidth = 1;

  for (let x = margin; x <= width - margin; x += 60) {
    context.beginPath();
    context.moveTo(x, margin);
    context.lineTo(x, height - margin);
    context.stroke();
  }

  for (let y = margin; y <= height - margin; y += 60) {
    context.beginPath();
    context.moveTo(margin, y);
    context.lineTo(width - margin, y);
    context.stroke();
  }
  context.restore();
};

const drawAxes = (bounds) => {
  const { width, height, margin } = bounds;
  context.save();
  context.strokeStyle = "#cad5e5";
  context.lineWidth = 2;
  context.beginPath();
  context.rect(margin, margin, width - margin * 2, height - margin * 2);
  context.stroke();
  context.restore();
};

const drawCenterPoint = (bounds, label) => {
  const { width, height } = bounds;
  context.save();
  context.fillStyle = "#0f172a";
  context.beginPath();
  context.arc(width / 2, height / 2, 5, 0, Math.PI * 2);
  context.fill();
  context.font = "600 14px Inter, sans-serif";
  context.fillText(label, width / 2 + 12, height / 2 - 10);
  context.restore();
};

const drawRings = (bounds, radii, maxRadius) => {
  const { width, height } = bounds;
  const scale = (width * 0.4) / maxRadius;

  radii.forEach((radius, index) => {
    if (!radius || radius <= 0) {
      return;
    }
    context.save();
    context.strokeStyle = palette[index % palette.length];
    context.lineWidth = 2;
    context.setLineDash([6, 6]);
    context.beginPath();
    context.arc(width / 2, height / 2, radius * scale, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = palette[index % palette.length];
    context.font = "500 13px Inter, sans-serif";
    context.fillText(`${radius}m`, width / 2 + radius * scale + 8, height / 2);
    context.restore();
  });
};

const drawOverlay = (data) => {
  const bounds = {
    width: canvas.width,
    height: canvas.height,
    margin: 50,
  };

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid(bounds);
  drawAxes(bounds);

  const maxRadius = Math.max(...data.radii, 1);
  drawRings(bounds, data.radii, maxRadius);
  drawCenterPoint(bounds, data.siteName || "Site center");

  context.save();
  context.fillStyle = "#334155";
  context.font = "600 16px Inter, sans-serif";
  context.fillText("Site summary", 50, 40);
  context.font = "14px Inter, sans-serif";

  const summaryLines = [
    `Easting: ${data.easting}`,
    `Northing: ${data.northing}`,
    `Latitude: ${data.latitude}`,
    `Longitude: ${data.longitude}`,
    data.rangeEasting ? `Easting range min: ${data.rangeEasting}` : null,
    data.rangeNorthing ? `Northing range min: ${data.rangeNorthing}` : null,
  ].filter(Boolean);

  summaryLines.forEach((line, index) => {
    context.fillText(line, 50, 70 + index * 20);
  });
  context.restore();
};

const parseValue = (input) => {
  const value = Number.parseFloat(input.value);
  return Number.isNaN(value) ? null : value;
};

const buildPayload = () => {
  const radii = inputs.radii
    .map(parseValue)
    .filter((value) => value !== null);

  return {
    siteName: inputs.siteName.value.trim(),
    easting: parseValue(inputs.easting),
    northing: parseValue(inputs.northing),
    latitude: parseValue(inputs.latitude),
    longitude: parseValue(inputs.longitude),
    rangeEasting: parseValue(inputs.rangeEasting),
    rangeNorthing: parseValue(inputs.rangeNorthing),
    radii,
  };
};

const validatePayload = (payload) => {
  const required = ["easting", "northing", "latitude", "longitude"];
  const missing = required.filter((key) => payload[key] === null);
  if (missing.length > 0) {
    return `Please fill in the required fields: ${missing.join(", ")}.`;
  }
  if (payload.radii.length === 0) {
    return "Please provide at least one radius.";
  }
  return null;
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const payload = buildPayload();
  const error = validatePayload(payload);
  if (error) {
    status.textContent = error;
    status.classList.add("error");
    return;
  }

  status.textContent = "Map generated. Ready to download.";
  status.classList.remove("error");
  drawOverlay(payload);
});

resetButton.addEventListener("click", () => {
  form.reset();
  status.textContent = "Canvas cleared.";
  status.classList.remove("error");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
});

downloadButton.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "phone-data-map.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

context.fillStyle = "#ffffff";
context.fillRect(0, 0, canvas.width, canvas.height);
status.textContent = "Enter details and generate your map.";
