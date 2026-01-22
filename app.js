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
  backgroundType: document.getElementById("background-type"),
  backgroundZoom: document.getElementById("background-zoom"),
  backgroundAuto: document.getElementById("background-auto"),
  backgroundProvider: document.getElementById("background-provider"),
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
  context.strokeStyle = "rgba(227, 233, 242, 0.8)";
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
  context.strokeStyle = "rgba(202, 213, 229, 0.9)";
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
  context.lineWidth = 4;
  context.strokeStyle = "#ffffff";
  context.strokeText(label, width / 2 + 12, height / 2 - 10);
  context.fillStyle = "#0f172a";
  context.fillText(label, width / 2 + 12, height / 2 - 10);
  context.restore();
};

const loadImage = (source) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Unable to load background imagery."));
    image.src = source;
  });


const latLonToTile = (latitude, longitude, zoom) => {
  const latRad = (latitude * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = ((longitude + 180) / 360) * n;
  const y =
    (1 -
      Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
    2 *
    n;
  return { x, y };
};

const getSatelliteTileUrl = (provider, zoom, tileY, tileX) => {
  if (provider === "esri") {
    return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tileY}/${tileX}`;
  }
  return `https://mt1.google.com/vt/lyrs=s&x=${tileX}&y=${tileY}&z=${zoom}`;
};

const drawSatelliteBackground = async (
  latitude,
  longitude,
  zoom,
  provider,
  bounds
) => {
  const tileSize = 256;
  const { width, height } = bounds;
  const { x, y } = latLonToTile(latitude, longitude, zoom);
  const centerPixelX = x * tileSize;
  const centerPixelY = y * tileSize;
  const startX = Math.floor((centerPixelX - width / 2) / tileSize);
  const endX = Math.floor((centerPixelX + width / 2) / tileSize);
  const startY = Math.floor((centerPixelY - height / 2) / tileSize);
  const endY = Math.floor((centerPixelY + height / 2) / tileSize);
  const maxIndex = 2 ** zoom;

  const tiles = [];

  for (let tileX = startX; tileX <= endX; tileX += 1) {
    for (let tileY = startY; tileY <= endY; tileY += 1) {
      if (tileY < 0 || tileY >= maxIndex) {
        continue;
      }
      const wrappedX = ((tileX % maxIndex) + maxIndex) % maxIndex;
      const src = getSatelliteTileUrl(provider, zoom, tileY, wrappedX);
      tiles.push(
        loadImage(src).then((image) => ({
          image,
          tileX,
          tileY,
        }))
      );
    }
  }

  const loadedTiles = await Promise.all(tiles);

  loadedTiles.forEach(({ image, tileX, tileY }) => {
    const dx = tileX * tileSize - (centerPixelX - width / 2);
    const dy = tileY * tileSize - (centerPixelY - height / 2);
    context.drawImage(image, dx, dy, tileSize, tileSize);
  });
};

const metersPerPixel = (latitude, zoom) => {
  const latitudeRadians = (latitude * Math.PI) / 180;
  return (156543.03392 * Math.cos(latitudeRadians)) / 2 ** zoom;
};

const getFitScale = (bounds, maxRadius) => {
  const availableRadius = Math.min(bounds.width, bounds.height) / 2 - bounds.margin;
  return availableRadius / maxRadius;
};

const getAutoZoom = (latitude, maxRadius, bounds) => {
  const availableRadius = Math.min(bounds.width, bounds.height) / 2 - bounds.margin;
  const desiredMetersPerPixel = maxRadius / availableRadius;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const zoom = Math.log2(
    (156543.03392 * Math.cos(latitudeRadians)) / desiredMetersPerPixel
  );
  return Math.max(2, Math.min(18, Math.round(zoom)));
};

const drawRings = (bounds, radii, scale) => {
  const { width, height } = bounds;

  radii.forEach((radius, index) => {
    if (!radius || radius <= 0) {
      return;
    }
    context.save();
    context.strokeStyle = palette[index % palette.length];
    context.lineWidth = 2;
    context.setLineDash([6, 6]);
    context.beginPath();
    const pixelRadius = radius * scale;
    context.arc(width / 2, height / 2, pixelRadius, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = palette[index % palette.length];
    context.font = "500 13px Inter, sans-serif";
    context.fillText(`${radius}m`, width / 2 + pixelRadius + 8, height / 2);
    context.restore();
  });
};

const drawOverlay = async (data) => {
  const bounds = {
    width: canvas.width,
    height: canvas.height,
    margin: 50,
  };

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  let satelliteZoom = data.backgroundZoom;
  if (data.backgroundType === "satellite" && data.backgroundAuto) {
    const maxRadius = Math.max(...data.radii, 1);
    satelliteZoom = getAutoZoom(data.latitude, maxRadius, bounds);
  }

  if (data.backgroundType === "satellite") {
    await drawSatelliteBackground(
      data.latitude,
      data.longitude,
      satelliteZoom,
      data.backgroundProvider,
      bounds
    );
  }

  if (data.backgroundType === "none") {
    drawGrid(bounds);
    drawAxes(bounds);
  }

  const maxRadius = Math.max(...data.radii, 1);
  const scale =
    data.backgroundType === "satellite"
      ? 1 / metersPerPixel(data.latitude, satelliteZoom)
      : getFitScale(bounds, maxRadius);
  drawRings(bounds, data.radii, scale);
  drawCenterPoint(bounds, data.siteName || "Site center");

  context.save();
  context.font = "600 16px Inter, sans-serif";
  context.lineWidth = 4;
  context.strokeStyle = "#ffffff";
  context.strokeText("Site summary", 50, 40);
  context.fillStyle = "#0f172a";
  context.fillText("Site summary", 50, 40);
  context.font = "14px Inter, sans-serif";
  context.lineWidth = 3;

  const summaryLines = [
    `Easting: ${data.easting}`,
    `Northing: ${data.northing}`,
    `Latitude: ${data.latitude}`,
    `Longitude: ${data.longitude}`,
    data.rangeEasting ? `Easting range min: ${data.rangeEasting}` : null,
    data.rangeNorthing ? `Northing range min: ${data.rangeNorthing}` : null,
  ].filter(Boolean);

  summaryLines.forEach((line, index) => {
    const y = 70 + index * 20;
    context.strokeText(line, 50, y);
    context.fillText(line, 50, y);
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
    backgroundType: inputs.backgroundType.value,
    backgroundZoom: Number.parseInt(inputs.backgroundZoom.value, 10) || 15,
    backgroundAuto: inputs.backgroundAuto.checked,
    backgroundProvider: inputs.backgroundProvider.value,
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

inputs.backgroundAuto.addEventListener("change", () => {
  inputs.backgroundZoom.disabled = inputs.backgroundAuto.checked;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = buildPayload();
  const error = validatePayload(payload);
  if (error) {
    status.textContent = error;
    status.classList.add("error");
    return;
  }

  status.textContent = "Generating map with overlay…";
  status.classList.remove("error");
  try {
    await drawOverlay(payload);
    status.textContent = "Map generated. Ready to download.";
  } catch (drawError) {
    status.textContent =
      drawError?.message ||
      "Unable to load background imagery. Try a different source.";
    status.classList.add("error");
  }
});

resetButton.addEventListener("click", () => {
  form.reset();
  inputs.backgroundZoom.disabled = inputs.backgroundAuto.checked;
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
inputs.backgroundZoom.disabled = inputs.backgroundAuto.checked;
