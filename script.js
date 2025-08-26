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

const tbody = document.querySelector('#point-table tbody');
for (let i = 0; i < 25; i++) {
  const row = document.createElement('tr');
  for (let j = 0; j < 3; j++) {
    const cell = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    cell.appendChild(input);
    row.appendChild(cell);
  }
  tbody.appendChild(row);
}

document.getElementById('plot').addEventListener('click', () => {
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
});

let selected = null;

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
