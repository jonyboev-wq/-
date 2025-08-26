const svg = document.getElementById('canvas');
const ns = 'http://www.w3.org/2000/svg';
const gridGroup = document.createElementNS(ns, 'g');
const lineGroup = document.createElementNS(ns, 'g');
const pointGroup = document.createElementNS(ns, 'g');
svg.appendChild(gridGroup);
svg.appendChild(lineGroup);
svg.appendChild(pointGroup);

let width = window.innerWidth;
let height = window.innerHeight;
svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

const gridSize = 50;
drawGrid();

window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  drawGrid();
});

// Набор точек, полученный из таблицы
const defaultPoints = [
  { x: 248.33, y: 1037.16, h: 220.84 },
  { x: 248.44, y: 1036.95, h: 220.815 },
  { x: 252.37, y: 1036.25, h: 220.842 },
  { x: 261.16, y: 1034.19, h: 220.956 },
  { x: 266.47, y: 1032.11, h: 221.21 },
  { x: 268.87, y: 1024.21, h: 221.284 },
  { x: 273.21, y: 1023.33, h: 220.977 },
  { x: 267.08, y: 1023.77, h: 220.867 },
  { x: 261.11, y: 1023.71, h: 220.822 },
  { x: 254.82, y: 1024.07, h: 220.862 },
  { x: 253.24, y: 1024.5, h: 221.312 },
  { x: 253.15, y: 1021.11, h: 221.032 },
  { x: 253.63, y: 1014.08, h: 221.25 },
  { x: 253.88, y: 1009.31, h: 221.45 },
  { x: 254.0, y: 1008.54, h: 221.43 },
  { x: 257.39, y: 1008.3, h: 221.586 },
  { x: 257.32, y: 1009.83, h: 221.148 },
  { x: 253.23, y: 1009.85, h: 221.086 },
  { x: 253.21, y: 1010.83, h: 220.91 },
  { x: 253.28, y: 1013.29, h: 220.942 },
  { x: 253.71, y: 1017.67, h: 221.102 },
  { x: 258.62, y: 1017.67, h: 221.094 },
  { x: 259.52, y: 1011.83, h: 221.108 },
  { x: 259.81, y: 1006.6, h: 221.062 },
  { x: 258.39, y: 1005.91, h: 221.066 },
  { x: 273.79, y: 1009.67, h: 221.042 },
  { x: 268.96, y: 1004.5, h: 221.098 },
  { x: 260.39, y: 1004.44, h: 221.052 },
  { x: 244.31, y: 1028.7, h: 221.016 },
  { x: 229.39, y: 1044.38, h: 221.132 }
];

const tbody = document.querySelector('#point-table tbody');

function createRow(x = '', y = '', h = '') {
  const row = document.createElement('tr');
  [x, y, h].forEach(val => {
    const cell = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    if (val !== '') input.value = val;
    cell.appendChild(input);
    row.appendChild(cell);
  });
  tbody.appendChild(row);
}

function populateTable(data) {
  tbody.innerHTML = '';
  data.forEach(p => createRow(p.x, p.y, p.h));
}

let selected = null;

function plotFromTable() {
  pointGroup.innerHTML = '';
  lineGroup.innerHTML = '';
  selected = null;
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const x = parseFloat(inputs[0].value);
    const y = parseFloat(inputs[1].value);
    const h = inputs[2].value;
    if (!isNaN(x) && !isNaN(y)) {
      addPoint(x, y, h);
    }
  });
}

populateTable(defaultPoints);
for (let i = 0; i < 5; i++) createRow();
plotFromTable();

document.getElementById('plot').addEventListener('click', plotFromTable);

svg.addEventListener('click', e => {
  if (e.target !== svg) return;
  const rect = svg.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  addPoint(x, y);
});

function addPoint(x, y, h) {
  const circle = document.createElementNS(ns, 'circle');
  circle.setAttribute('cx', x);
  circle.setAttribute('cy', y);
  circle.setAttribute('r', 6);
  circle.classList.add('point');
  circle.addEventListener('click', e => {
    e.stopPropagation();
    handlePointClick(circle);
  });
  pointGroup.appendChild(circle);
  if (h !== undefined && h !== '') {
    circle.dataset.height = h;
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', x + 8);
    text.setAttribute('y', y - 8);
    text.textContent = h;
    text.classList.add('label');
    pointGroup.appendChild(text);
  }
}

function handlePointClick(circle) {
  if (selected && selected !== circle) {
    drawLine(selected, circle);
    selected.classList.remove('selected');
    selected = null;
  } else if (selected === circle) {
    circle.classList.remove('selected');
    selected = null;
  } else {
    if (selected) selected.classList.remove('selected');
    selected = circle;
    circle.classList.add('selected');
  }
}

function drawLine(p1, p2) {
  const line = document.createElementNS(ns, 'line');
  line.setAttribute('x1', p1.getAttribute('cx'));
  line.setAttribute('y1', p1.getAttribute('cy'));
  line.setAttribute('x2', p2.getAttribute('cx'));
  line.setAttribute('y2', p2.getAttribute('cy'));
  line.classList.add('line');
  line.addEventListener('click', e => {
    e.stopPropagation();
    lineGroup.removeChild(line);
  });
  lineGroup.appendChild(line);
}

function drawGrid() {
  gridGroup.innerHTML = '';
  for (let x = 0; x <= width; x += gridSize) {
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', 0);
    line.setAttribute('x2', x);
    line.setAttribute('y2', height);
    line.classList.add('grid');
    gridGroup.appendChild(line);
  }
  for (let y = 0; y <= height; y += gridSize) {
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', 0);
    line.setAttribute('y1', y);
    line.setAttribute('x2', width);
    line.setAttribute('y2', y);
    line.classList.add('grid');
    gridGroup.appendChild(line);
  }
}
