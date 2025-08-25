const svg = document.getElementById('canvas');
let width = window.innerWidth;
let height = window.innerHeight;
svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
});

let selected = null;

svg.addEventListener('click', e => {
  if (e.target !== svg) return;
  const rect = svg.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  addPoint(x, y);
});

function addPoint(x, y) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', x);
  circle.setAttribute('cy', y);
  circle.setAttribute('r', 6);
  circle.classList.add('point');
  circle.addEventListener('click', e => {
    e.stopPropagation();
    handlePointClick(circle);
  });
  svg.appendChild(circle);
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
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', p1.getAttribute('cx'));
  line.setAttribute('y1', p1.getAttribute('cy'));
  line.setAttribute('x2', p2.getAttribute('cx'));
  line.setAttribute('y2', p2.getAttribute('cy'));
  line.classList.add('line');
  line.addEventListener('click', e => {
    e.stopPropagation();
    svg.removeChild(line);
  });
  svg.insertBefore(line, svg.firstChild);
}
