const svg = d3.select("#canvas");
const textarea = document.getElementById("data");
const gridStepInput = document.getElementById("gridStep");
const contourStepInput = document.getElementById("contourStep");
const showGridInput = document.getElementById("showGrid");
const showPointsInput = document.getElementById("showPoints");

document.getElementById("draw").addEventListener("click", draw);
document.getElementById("clear").addEventListener("click", () => {
  textarea.value = "";
  svg.selectAll("*").remove();
});
document.getElementById("fileInput").addEventListener("change", handleFile);

const defaultPoints = [
  { x: 248.33, y: 1037.16, h: 220.840 },
  { x: 248.44, y: 1036.95, h: 220.815 },
  { x: 252.37, y: 1036.25, h: 220.842 },
  { x: 261.16, y: 1034.19, h: 220.956 },
  { x: 266.47, y: 1032.11, h: 221.210 },
  { x: 268.87, y: 1024.21, h: 221.284 },
  { x: 273.21, y: 1023.33, h: 220.977 },
  { x: 267.08, y: 1023.77, h: 220.867 },
  { x: 261.11, y: 1023.71, h: 220.822 },
  { x: 254.82, y: 1024.07, h: 220.862 },
  { x: 253.24, y: 1024.50, h: 221.312 },
  { x: 253.15, y: 1021.11, h: 221.032 },
  { x: 253.63, y: 1014.08, h: 221.250 },
  { x: 253.88, y: 1009.31, h: 221.450 },
  { x: 254.00, y: 1008.54, h: 221.430 },
  { x: 257.39, y: 1008.30, h: 221.586 },
  { x: 257.32, y: 1009.83, h: 221.148 },
  { x: 253.23, y: 1009.85, h: 221.086 },
  { x: 253.21, y: 1010.83, h: 220.910 },
  { x: 253.28, y: 1013.29, h: 220.942 },
  { x: 253.71, y: 1017.67, h: 221.102 },
  { x: 258.62, y: 1017.67, h: 221.094 },
  { x: 259.52, y: 1011.83, h: 221.108 },
  { x: 259.81, y: 1006.60, h: 221.062 },
  { x: 258.39, y: 1005.91, h: 221.066 },
  { x: 273.79, y: 1009.67, h: 221.042 },
  { x: 268.96, y: 1004.50, h: 221.098 },
  { x: 260.39, y: 1004.44, h: 221.052 },
  { x: 244.31, y: 1028.70, h: 221.016 },
  { x: 229.39, y: 1044.38, h: 221.132 }
];

textarea.value = defaultPoints.map(p => `${p.x},${p.y},${p.h}`).join("\n");
draw();

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = event => {
    textarea.value = event.target.result.trim();
    draw();
  };
  reader.readAsText(file);
}

function parseData(str) {
  return str.split(/\n/).map(line => {
    const [x, y, h] = line.split(',').map(v => parseFloat(v.trim()));
    if (isNaN(x) || isNaN(y) || isNaN(h)) return null;
    return { x, y, h };
  }).filter(Boolean);
}

function draw() {
  const points = parseData(textarea.value);
  if (!points.length) return;

  const margin = 10;
  const minX = d3.min(points, d => d.x) - margin;
  const maxX = d3.max(points, d => d.x) + margin;
  const minY = d3.min(points, d => d.y) - margin;
  const maxY = d3.max(points, d => d.y) + margin;

  const width = maxX - minX;
  const height = maxY - minY;

  svg.attr("viewBox", `${minX} ${minY} ${width} ${height}`);
  svg.selectAll("*").remove();

  if (showGridInput.checked) drawGrid(minX, maxX, minY, maxY, parseFloat(gridStepInput.value));
  if (showPointsInput.checked) drawPoints(points);
  drawContours(points, minX, maxX, minY, maxY, parseFloat(contourStepInput.value));
}

function drawGrid(minX, maxX, minY, maxY, step) {
  const g = svg.append("g").attr("class","grid");
  for (let x = Math.ceil(minX/step)*step; x <= maxX; x += step) {
    g.append("line").attr("x1", x).attr("y1", minY).attr("x2", x).attr("y2", maxY);
  }
  for (let y = Math.ceil(minY/step)*step; y <= maxY; y += step) {
    g.append("line").attr("x1", minX).attr("y1", y).attr("x2", maxX).attr("y2", y);
  }
}

function drawPoints(points) {
  const g = svg.append("g").attr("class","points");
  g.selectAll("circle").data(points)
    .enter().append("circle")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", 1.5);
  g.selectAll("text").data(points)
    .enter().append("text")
    .attr("x", d => d.x + 1)
    .attr("y", d => d.y - 1)
    .text(d => d.h.toFixed(3));
}

function drawContours(points, minX, maxX, minY, maxY, step) {
  const xCount = 80;
  const yCount = 80;
  const dx = (maxX - minX) / (xCount - 1);
  const dy = (maxY - minY) / (yCount - 1);
  const values = [];
  for (let yIdx = 0; yIdx < yCount; yIdx++) {
    const y = minY + yIdx * dy;
    for (let xIdx = 0; xIdx < xCount; xIdx++) {
      const x = minX + xIdx * dx;
      let num = 0, den = 0;
      points.forEach(p => {
        const dist = Math.hypot(x - p.x, y - p.y) || 0.0001;
        const w = 1 / (dist * dist);
        num += w * p.h;
        den += w;
      });
      values.push(num / den);
    }
  }
  const minH = d3.min(points, d => d.h);
  const maxH = d3.max(points, d => d.h);
  const thresholds = d3.range(Math.floor(minH/step)*step, maxH, step);

  const contours = d3.contours()
    .size([xCount, yCount])
    .thresholds(thresholds)
    (values);

  const projection = d3.geoTransform({
    point: function(x, y) {
      this.stream.point(minX + x * dx, minY + y * dy);
    }
  });
  const path = d3.geoPath(projection);

  svg.append("g").attr("class","contours")
    .selectAll("path").data(contours)
    .enter().append("path")
    .attr("d", path);
}
