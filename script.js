const canvas = document.getElementById("producer-canvas");
const ctx = canvas?.getContext("2d");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let width = 0;
let height = 0;
let pointerX = 0.54;
let pointerY = 0.46;

const rails = Array.from({ length: 9 }, (_, index) => ({
  y: 0.18 + index * 0.075,
  speed: 0.18 + index * 0.035,
  phase: index * 0.13,
}));

const capsules = [
  { label: "PROOF", x: 0.16, y: 0.26, w: 148, hue: "gold" },
  { label: "GROWTH", x: 0.58, y: 0.18, w: 168, hue: "moss" },
  { label: "LAUNCH", x: 0.42, y: 0.48, w: 162, hue: "signal" },
  { label: "VAULTS", x: 0.72, y: 0.58, w: 152, hue: "gold" },
  { label: "x402", x: 0.24, y: 0.68, w: 124, hue: "signal" },
  { label: "DISTRO", x: 0.82, y: 0.32, w: 146, hue: "moss" },
];

function resize() {
  if (!canvas || !ctx) return;

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function color(role, alpha) {
  const values = {
    paper: `oklch(94% 0.018 80 / ${alpha})`,
    gold: `oklch(68% 0.1 82 / ${alpha})`,
    signal: `oklch(58% 0.16 38 / ${alpha})`,
    moss: `oklch(45% 0.06 145 / ${alpha})`,
    ink: `oklch(16% 0.01 70 / ${alpha})`,
  };

  return values[role];
}

function drawCapsule(item, time, index) {
  const drift = reducedMotion ? 0 : Math.sin(time * 0.00045 + index) * 12;
  const parallaxX = (pointerX - 0.5) * (index + 1) * 10;
  const parallaxY = (pointerY - 0.5) * (index + 1) * 6;
  const x = item.x * width + parallaxX;
  const y = item.y * height + drift + parallaxY;
  const h = 48;

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color("ink", 0.44);
  ctx.strokeStyle = color(item.hue, 0.58);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0, 0, item.w, h, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color("paper", 0.72);
  ctx.font = "600 12px IBM Plex Mono, monospace";
  ctx.fillText(item.label, 16, 29);

  ctx.fillStyle = color(item.hue, 0.82);
  ctx.beginPath();
  ctx.arc(item.w - 20, h / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawScene(time = 0) {
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "oklch(16% 0.01 70)";
  ctx.fillRect(0, 0, width, height);

  const originX = width * (0.72 + (pointerX - 0.5) * 0.025);
  const originY = height * (0.18 + (pointerY - 0.5) * 0.025);

  rails.forEach((rail, index) => {
    const y = height * rail.y;
    const travel = reducedMotion ? 0 : ((time * rail.speed * 0.018 + rail.phase * width) % width);

    ctx.strokeStyle = index % 3 === 0 ? color("signal", 0.2) : color("paper", 0.1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width * 0.04, y);
    ctx.bezierCurveTo(width * 0.34, y + 28, width * 0.58, y - 64, originX, originY);
    ctx.stroke();

    ctx.fillStyle = index % 3 === 0 ? color("gold", 0.8) : color("paper", 0.34);
    ctx.beginPath();
    ctx.arc((travel + index * 130) % width, y, index % 3 === 0 ? 3.5 : 2.4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = color("gold", 0.24);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(originX, originY, 62, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color("signal", 0.88);
  ctx.beginPath();
  ctx.arc(originX, originY, 5, 0, Math.PI * 2);
  ctx.fill();

  capsules.forEach((item, index) => drawCapsule(item, time, index));

  ctx.fillStyle = color("paper", 0.44);
  ctx.font = "600 12px IBM Plex Mono, monospace";
  ctx.fillText("SUEDE CREATIVE RAILS / OWNERSHIP TO INCOME", width * 0.54, height * 0.78);

  if (!reducedMotion) {
    requestAnimationFrame(drawScene);
  }
}

if (canvas && ctx) {
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (event) => {
    pointerX = event.clientX / Math.max(window.innerWidth, 1);
    pointerY = event.clientY / Math.max(window.innerHeight, 1);
  });

  resize();
  requestAnimationFrame(drawScene);
}
