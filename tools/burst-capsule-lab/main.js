const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const state = {
  capsules: [],
  controls: {
    spawnCount: 36,
    spawnJitter: 0.1,
    speedMin: 15,
    speedMax: 40,
    friction: 0.92,
    decayMin: 0.03,
    decayMax: 0.06,
    lengthMin: 60,
    lengthMax: 140,
    thicknessMin: 4,
    thicknessMax: 7,
    outlineWidth: 3,
    trailAlpha: 1,
    decayVisualMode: 'fade',
    shrinkPower: 1.6,
    colorMode: 'random',
    singleMainColor: '#00f0ff',
    singleStrokeColor: '#ffffff'
  },
  colorPairs: [
    { main: '#00f0ff', stroke: '#ffffff' },
    { main: '#ff0055', stroke: '#111111' },
    { main: '#ffea00', stroke: '#111111' },
    { main: '#00ff66', stroke: '#ffffff' },
    { main: '#ffffff', stroke: '#ff0055' }
  ]
};

const bindings = [
  ['spawnCount', 0],
  ['spawnJitter', 2],
  ['speedMin', 1],
  ['speedMax', 1],
  ['friction', 3],
  ['decayMin', 3],
  ['decayMax', 3],
  ['lengthMin', 0],
  ['lengthMax', 0],
  ['thicknessMin', 1],
  ['thicknessMax', 1],
  ['outlineWidth', 1],
  ['trailAlpha', 2],
  ['shrinkPower', 2]
];

function resizeCanvas() {
  canvas.width = window.innerWidth - 320;
  canvas.height = window.innerHeight;
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function normalizeRanges() {
  const c = state.controls;
  if (c.speedMin > c.speedMax) c.speedMax = c.speedMin;
  if (c.decayMin > c.decayMax) c.decayMax = c.decayMin;
  if (c.lengthMin > c.lengthMax) c.lengthMax = c.lengthMin;
  if (c.thicknessMin > c.thicknessMax) c.thicknessMax = c.thicknessMin;
}

function createCapsule(x, y, angle, pair) {
  const c = state.controls;
  return {
    x,
    y,
    angle,
    speed: randRange(c.speedMin, c.speedMax),
    baseSpeed: c.speedMax,
    friction: c.friction,
    length: randRange(c.lengthMin, c.lengthMax),
    thickness: randRange(c.thicknessMin, c.thicknessMax),
    life: 1,
    decay: randRange(c.decayMin, c.decayMax),
    mainColor: pair.main,
    strokeColor: pair.stroke
  };
}

function choosePair() {
  if (state.controls.colorMode === 'single') {
    return {
      main: state.controls.singleMainColor,
      stroke: state.controls.singleStrokeColor
    };
  }
  return state.colorPairs[Math.floor(Math.random() * state.colorPairs.length)];
}

function spawnBurst(x, y) {
  normalizeRanges();
  const c = state.controls;
  for (let i = 0; i < c.spawnCount; i++) {
    const base = (Math.PI * 2 / c.spawnCount) * i;
    const jitter = randRange(-c.spawnJitter * 0.5, c.spawnJitter * 0.5);
    const angle = base + jitter;
    const pair = choosePair();
    state.capsules.push(createCapsule(x, y, angle, pair));
  }
}

function updateCapsule(capsule) {
  capsule.x += Math.cos(capsule.angle) * capsule.speed;
  capsule.y += Math.sin(capsule.angle) * capsule.speed;
  capsule.speed *= capsule.friction;
  capsule.life -= capsule.decay;
}

function drawCapsule(capsule) {
  if (capsule.life <= 0) return;
  const life = Math.max(0, capsule.life);
  const speedRatio = capsule.speed / Math.max(0.0001, capsule.baseSpeed);
  const baseLen = capsule.length * (speedRatio + 0.45);
  const shrinkRatio = Math.pow(life, state.controls.shrinkPower);
  const len = state.controls.decayVisualMode === 'shrink' ? baseLen * shrinkRatio : baseLen;
  const alpha = state.controls.decayVisualMode === 'shrink' ? 1 : life;

  ctx.save();
  ctx.translate(capsule.x, capsule.y);
  ctx.rotate(capsule.angle);
  ctx.globalAlpha = alpha;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.strokeStyle = capsule.strokeColor;
  ctx.lineWidth = capsule.thickness + state.controls.outlineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.strokeStyle = capsule.mainColor;
  ctx.lineWidth = capsule.thickness;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.restore();
}

function clearFrame() {
  const alpha = state.controls.trailAlpha;
  if (alpha >= 1) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.fillStyle = `rgba(5, 5, 8, ${alpha.toFixed(3)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function tick() {
  clearFrame();
  for (let i = state.capsules.length - 1; i >= 0; i--) {
    const capsule = state.capsules[i];
    updateCapsule(capsule);
    drawCapsule(capsule);
    if (capsule.life <= 0) {
      state.capsules.splice(i, 1);
    }
  }
  requestAnimationFrame(tick);
}

function updateLabel(key, decimals) {
  const label = document.getElementById(`${key}Value`);
  if (!label) return;
  const value = state.controls[key];
  label.textContent = Number(value).toFixed(decimals);
}

function bindRangeControl(key, decimals) {
  const input = document.getElementById(key);
  if (!input) return;
  input.value = String(state.controls[key]);
  updateLabel(key, decimals);
  input.addEventListener('input', (event) => {
    const target = event.target;
    state.controls[key] = Number(target.value);
    normalizeRanges();
    for (const [name, dec] of bindings) {
      updateLabel(name, dec);
      const range = document.getElementById(name);
      if (range && range !== target) {
        range.value = String(state.controls[name]);
      }
    }
  });
}

function randomizeControls() {
  const c = state.controls;
  c.spawnCount = Math.round(randRange(18, 86));
  c.spawnJitter = randRange(0.02, 0.32);
  c.speedMin = randRange(8, 22);
  c.speedMax = randRange(Math.max(c.speedMin + 1, 18), 46);
  c.friction = randRange(0.885, 0.965);
  c.decayMin = randRange(0.01, 0.04);
  c.decayMax = randRange(Math.max(c.decayMin + 0.002, 0.02), 0.09);
  c.lengthMin = randRange(30, 90);
  c.lengthMax = randRange(Math.max(c.lengthMin + 8, 70), 190);
  c.thicknessMin = randRange(2, 6);
  c.thicknessMax = randRange(Math.max(c.thicknessMin + 0.2, 4), 12);
  c.outlineWidth = randRange(1, 5);
  c.trailAlpha = randRange(0.1, 1);
  c.shrinkPower = randRange(0.7, 3.3);
  normalizeRanges();
  for (const [name, dec] of bindings) {
    const range = document.getElementById(name);
    if (range) range.value = String(state.controls[name]);
    updateLabel(name, dec);
  }
}

function setupUi() {
  for (const [key, decimals] of bindings) {
    bindRangeControl(key, decimals);
  }

  const colorMode = document.getElementById('colorMode');
  colorMode.value = state.controls.colorMode;
  colorMode.addEventListener('change', (event) => {
    state.controls.colorMode = event.target.value;
  });

  const decayVisualMode = document.getElementById('decayVisualMode');
  decayVisualMode.value = state.controls.decayVisualMode;
  decayVisualMode.addEventListener('change', (event) => {
    state.controls.decayVisualMode = event.target.value;
  });

  const singleMainColor = document.getElementById('singleMainColor');
  singleMainColor.value = state.controls.singleMainColor;
  singleMainColor.addEventListener('input', (event) => {
    state.controls.singleMainColor = event.target.value;
  });

  const singleStrokeColor = document.getElementById('singleStrokeColor');
  singleStrokeColor.value = state.controls.singleStrokeColor;
  singleStrokeColor.addEventListener('input', (event) => {
    state.controls.singleStrokeColor = event.target.value;
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    state.capsules.length = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  document.getElementById('burstCenterBtn').addEventListener('click', () => {
    spawnBurst(canvas.width * 0.5, canvas.height * 0.5);
  });

  document.getElementById('burstRingBtn').addEventListener('click', () => {
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    const r = Math.min(canvas.width, canvas.height) * 0.24;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      spawnBurst(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  });

  document.getElementById('randomizeBtn').addEventListener('click', randomizeControls);
}

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  spawnBurst(event.clientX - rect.left, event.clientY - rect.top);
});

window.addEventListener('resize', resizeCanvas);

resizeCanvas();
setupUi();
tick();
