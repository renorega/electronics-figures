import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../shared/kit/iso-kit.mjs";
import * as G from "../shared/kit/lathe.mjs";
import { kitScript } from "../shared/scripts/inline-kit.mjs";
import * as W from "./world.mjs";
import * as M from "./model.mjs";
import { panelHtml, PANEL_CSS } from "./panel.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "inductor-light.html" : "inductor.html";

// ── camera ─────────────────────────────────────────────────────────────────────
const P = k.fitProjection(
  [...k.boxCorners(W.PLATE, -W.PLATE_H - W.FOOT_H, 0), ...k.boxCorners(W.BACK, 0, W.BACK_H), [W.COIL.xc, 20, 52], [0, 130, 40]],
  W.WIDTH,
  W.HEIGHT,
  { pad: 22, azimuth: W.VIEW_AZIMUTH },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = ([x, y]) => k.depthOf([x, y, 0], P);
const farFirst = (items) => [...items].sort((a, b) => depth(a.at) - depth(b.at)).map((item) => item.svg).join("");
const TAU = Math.PI * 2;
const X = W.LOOP_X;

// ── helpers for vertical faces ─────────────────────────────────────────────────
// In a face matrix, local x runs to the viewer's right (toward -y) and local y runs down (toward -z).
const faceAt = (x, y0 = W.FACE_Y0) => k.sideMatrix([x, y0], 0, P, "right");
const fr = (n) => Math.round(n * 100) / 100;
const fRect = (u0, z0, u1, z1, r = 0) => {
  const a = u0, b = u1, c = -z1, d = -z0;
  if (!r) return `M${a} ${c}H${b}V${d}H${a}Z`;
  return `M${a + r} ${c}H${b - r}A${r} ${r} 0 0 1 ${b} ${c + r}V${d - r}A${r} ${r} 0 0 1 ${b - r} ${d}H${a + r}A${r} ${r} 0 0 1 ${a} ${d - r}V${c + r}A${r} ${r} 0 0 1 ${a + r} ${c}Z`;
};
const fCircle = (u, z, r) => `M${fr(u + r)} ${-z}A${r} ${r} 0 1 0 ${fr(u - r)} ${-z}A${r} ${r} 0 1 0 ${fr(u + r)} ${-z}Z`;
const faceLine = (d, tone = "lo", extra = "") => `<path class="iso-line" data-tone="${tone}" d="${d}"${extra}/>`;
const faceDots = (points, size = 0.45, tone = "mid") => `<g class="iso-dots" data-tone="${tone}">${points.map(([u, z]) => `<circle cx="${fr(u)}" cy="${fr(-z)}" r="${size}"/>`).join("")}</g>`;
const screwsAt = (points, z, ring = 1.9) => L(points.map(([x, y]) => k.ring(x, y, ring, z, P, 14)).join(""), { tone: "lo" }) + D(points.map(([x, y]) => at([x, y, z])), { size: 0.45 });

// ── the board ──────────────────────────────────────────────────────────────────
function board() {
  const { PLATE, PLATE_H, FOOT_H } = W;
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = k.corners(PLATE, 22).map(([x, y]) => ({ at: [x, y], svg: S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }) }));
  out.push(farFirst(feet));
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  out.push(screwsAt(k.corners(PLATE, 10), 0, 2.2));
  // a ruler along the near edge, and a label plate
  const strip = { x: 67, y: -150, w: 7, d: 232, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.y + 4, strip.y + strip.d - 4, 4, 5, strip.x + 0.8, 0.6, [2, 3.6], P, "y");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 3.5, strip.y + 2, 0.6]), at([strip.x + 3.5, strip.y + strip.d - 2, 0.6])], { size: 0.45 }));
  const plate = { x: 64, y: 96, w: 12, d: 36, r: 1.6 };
  out.push(S(k.slabOf(plate, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.4), 0.8, P, 4), { tone: "faint" }));
  [[plate.y + 6, plate.y + 29], [plate.y + 6, plate.y + 22], [plate.y + 6, plate.y + 26]].forEach(([a, b], index) => {
    out.push(L(k.lineOnTop([plate.x + 3.4 + index * 2.6, a], [plate.x + 3.4 + index * 2.6, b], 0.8, P), { tone: "lo", free: true }));
  });
  out.push(D([at([plate.x + 3, plate.y + 3, 0.8]), at([plate.x + 3, plate.y + plate.d - 3, 0.8])], { size: 0.4 }));
  return out.join("");
}

// A copper track: an orthogonal polyline thickened into a flat ribbon.
function ribbon(points, width) {
  const half = width / 2;
  const dirs = points.slice(1).map((p, i) => {
    const q = points[i];
    const dx = p[0] - q[0], dy = p[1] - q[1];
    const n = Math.hypot(dx, dy);
    return [dx / n, dy / n];
  });
  const left = [], right = [];
  points.forEach((p, i) => {
    const before = dirs[i - 1], after = dirs[i];
    let nx, ny;
    if (!before || !after) {
      const d = before || after;
      nx = -d[1]; ny = d[0];
    } else {
      const a = [-before[1], before[0]], b = [-after[1], after[0]];
      nx = a[0] + b[0]; ny = a[1] + b[1];
      const dot = a[0] * b[0] + a[1] * b[1];
      nx /= 1 + dot; ny /= 1 + dot;
    }
    left.push([p[0] + nx * half, p[1] + ny * half]);
    right.push([p[0] - nx * half, p[1] - ny * half]);
  });
  return [...left, ...right.reverse()];
}
function traces() {
  const out = W.TRACES.map((path) => S(k.extrude(ribbon(path, W.TRACE_W), 0, W.TRACE_H, P, { convex: false }), { tone: "mid", crease: "none" }));
  // a solder blob where the bypass wire meets the return line
  const [jx, jy] = W.JUNCTION;
  out.push(S(k.cylinder(jx, jy, 2.9, W.TRACE_H, 0.8, P, 24, 0.3), { tone: "hi" }));
  return out.join("");
}

// ── the backboard: scope and two meters ────────────────────────────────────────
function backboard() {
  const { BACK, BACK_H, FACE_X, SCOPE, METER } = W;
  const out = [];
  out.push(S(k.slabOf(BACK, 0, BACK_H, P, 4, 1.2), { tone: "mid" }));
  const frame = [];
  frame.push(faceLine(fRect(6, 5, 290, BACK_H - 6, 3), "faint"));
  const corners = [[12, 11], [284, 11], [12, BACK_H - 12], [284, BACK_H - 12]];
  frame.push(`<g class="iso-ring">${corners.map(([u, z]) => faceLine(fCircle(u, z, 2.2), "lo")).join("")}</g>`);
  frame.push(faceDots(corners, 0.5, "mid"));
  const slots = [];
  for (const [u0, u1] of [[22, 66], [230, 274]]) {
    for (let z = 10; z <= 22; z += 4) slots.push(faceLine(fRect(u0, z, u1, z + 1.6, 0.8), "faint"));
  }
  frame.push(slots.join(""));
  out.push(`<g transform="${faceAt(FACE_X)}">${frame.join("")}</g>`);

  // the plaques that carry the gauges: low blocks sitting on the face
  const plaque = (u0, u1, z0, z1) => ({ x: FACE_X, y: W.FACE_Y0 - u1, w: 3, d: u1 - u0, r: 1.2, z0, h: z1 - z0 });
  const scope = plaque(SCOPE.u0 - 4, SCOPE.u1 + 4, SCOPE.z0 - 6, SCOPE.z1 + 6);
  const meters = [METER.ammeter, METER.voltmeter].map((u) => plaque(u - 26, u + 26, METER.z - 26, METER.z + 26));
  for (const p of [scope, ...meters]) out.push(S(k.slabOf(p, p.z0, p.h, P, 3, 0.5), { tone: "mid" }));

  // the scope: a recessed screen with a graticule
  const front = faceAt(FACE_X + 3);
  const sc = [];
  sc.push(faceLine(fRect(SCOPE.u0 - 1.6, SCOPE.z0 - 1.6, SCOPE.u1 + 1.6, SCOPE.z1 + 1.6, 3), "lo"));
  sc.push(`<path class="ind-screen" d="${fRect(SCOPE.u0, SCOPE.z0, SCOPE.u1, SCOPE.z1, 2)}"/>`);
  const grid = [];
  const cols = 10, rows = 6;
  for (let c = 1; c < cols; c++) {
    const u = SCOPE.u0 + ((SCOPE.u1 - SCOPE.u0) * c) / cols;
    grid.push(`M${fr(u)} ${-SCOPE.z1}V${-SCOPE.z0}`);
  }
  for (let r = 1; r < rows; r++) {
    const z = SCOPE.z0 + ((SCOPE.z1 - SCOPE.z0) * r) / rows;
    if (r !== rows / 2) grid.push(`M${SCOPE.u0} ${fr(-z)}H${SCOPE.u1}`);
  }
  sc.push(faceLine(grid.join(""), "faint"));
  const zMid = (SCOPE.z0 + SCOPE.z1) / 2;
  sc.push(faceLine(`M${SCOPE.u0} ${-zMid}H${SCOPE.u1}`, "lo"));
  sc.push(faceLine(fRect(SCOPE.u0, SCOPE.z0, SCOPE.u1, SCOPE.z1, 2), "lo"));
  const tickRun = [];
  for (let c = 0; c <= cols * 5; c++) {
    const u = SCOPE.u0 + ((SCOPE.u1 - SCOPE.u0) * c) / (cols * 5);
    if (c % 5 !== 0) tickRun.push(`M${fr(u)} ${fr(-zMid - 1.1)}V${fr(-zMid + 1.1)}`);
  }
  sc.push(faceLine(tickRun.join(""), "lo"));
  out.push(`<g transform="${front}">${sc.join("")}<g data-slot="scope"></g></g>`);
  const sp = [[SCOPE.u0 - 1, SCOPE.z0 - 4], [SCOPE.u1 + 1, SCOPE.z0 - 4], [SCOPE.u0 - 1, SCOPE.z1 + 4], [SCOPE.u1 + 1, SCOPE.z1 + 4]];
  out.push(`<g transform="${front}">${faceDots(sp, 0.5)}</g>`);

  // the meters: a square flange with a round dial. The mA meter reads from the left stop,
  // the coil meter is centre-zero because the coil can push either way.
  for (const [index, u] of [METER.ammeter, METER.voltmeter].entries()) {
    const m = [];
    const z = METER.z;
    m.push(faceLine(fRect(u - 23.4, z - 23.4, u + 23.4, z + 23.4, 3.5), "faint"));
    m.push(`<path class="ind-glass" d="${fCircle(u, z, 21.5)}"/>`);
    m.push(faceLine(fCircle(u, z, 21.5), "lo"));
    m.push(faceLine(fCircle(u, z, 22.8), "faint"));
    const px = u, pz = z - 8;
    const arc = [], minor = [], major = [];
    const sweep = (W.METER_SWEEP * Math.PI) / 180;
    for (let n = 0; n <= 40; n++) {
      const a = -sweep + (2 * sweep * n) / 40;
      arc.push(`${n ? "L" : "M"}${fr(px + 19 * Math.sin(a))} ${fr(-pz - 19 * Math.cos(a))}`);
    }
    const count = index ? 24 : 20;
    const every = index ? 6 : 5;
    for (let n = 0; n <= count; n++) {
      const a = -sweep + (2 * sweep * n) / count;
      const big = n % every === 0;
      const r1 = 19, r2 = 19 + (big ? 3.2 : 1.8);
      (big ? major : minor).push(`M${fr(px + r1 * Math.sin(a))} ${fr(-pz - r1 * Math.cos(a))}L${fr(px + r2 * Math.sin(a))} ${fr(-pz - r2 * Math.cos(a))}`);
    }
    m.push(faceLine(arc.join(""), "mid"), faceLine(minor.join(""), "lo"), faceLine(major.join(""), "mid"));
    if (index) m.push(faceLine(`M${px} ${fr(-pz - 19)}L${px} ${fr(-pz - 22.2)}`, "hi"));
    m.push(`<text class="iso-face-text" data-tone="mid" x="${u}" y="${-(z - 17.2)}" font-size="4.2" text-anchor="middle">${index ? "±V" : "mA"}</text>`);
    m.push(`<g data-slot="needle${index ? "V" : "A"}"></g>`);
    out.push(`<g transform="${front}">${m.join("")}</g>`);
    const sw = [[u - 20, z - 20], [u + 20, z - 20], [u - 20, z + 20], [u + 20, z + 20]];
    out.push(`<g transform="${front}">${faceDots(sw, 0.5)}</g>`);
  }
  return out.join("");
}

// ── the bench supply ───────────────────────────────────────────────────────────
// The scale ticks stay printed on the supply; the knob itself is a touchable part (blue, see .ind-touch).
function knobSvg({ at: [x, y], r, h }, z, count, key) {
  const ticks = k.radialTicks(x, y, r + 4.6, count, 1, z + 1, [1.2, 2.2], P, (-W.KNOB_SWEEP * Math.PI) / 180, (2 * W.KNOB_SWEEP * Math.PI) / 180);
  const knob = [
    S(k.cylinder(x, y, r + 1.6, z, 1, P, 36), { tone: "lo" }),
    S(k.cylinder(x, y, r, z + 1, h, P, 36, 0.4), { tone: "hi" }),
    L(k.knurl(x, y, r, z + 1, z + 1 + h, Math.round(r * 5), P), { tone: "lo" }),
    `<g data-slot="pointer${key}"></g>`,
  ];
  return L(ticks.major, { tone: "mid" }) + `<g class="ind-touch" data-grab="${key}">${knob.join("")}</g>`;
}

function supply() {
  const { SUP, SUP_Z, SUP_TOP } = W;
  const out = [];
  out.push(farFirst(k.corners(SUP, 9).map(([x, y]) => ({ at: [x, y], svg: S(k.cylinder(x, y, 4.4, 0, SUP_Z, P, 20), { tone: "lo" }) }))));
  out.push(S(k.slabOf(SUP, SUP_Z, SUP_TOP - SUP_Z, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(SUP, 17, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(SUP, 3), SUP_TOP, P, 6), { tone: "faint" }));
  out.push(screwsAt(k.corners(SUP, 6.5), SUP_TOP));

  // the +x face: vents and a label plate
  const face = k.sideMatrix([SUP.x + SUP.w, SUP.y + SUP.d], 0, P, "right");
  const f = [];
  for (let z = 8; z <= 19; z += 3) f.push(faceLine(fRect(25, z, 55, z + 1.5, 0.75), "faint"));
  f.push(faceLine(fRect(6, 7, 20, 20, 1.5), "lo"));
  f.push(faceLine(`M9 ${-16.5}H17`, "lo", ' data-free=""'), faceLine(`M9 ${-13.5}H15`, "lo", ' data-free=""'), faceLine(`M9 ${-10.5}H16`, "lo", ' data-free=""'));
  f.push(faceDots([[8, 18], [18, 18], [8, 9], [18, 9]], 0.4));
  out.push(`<g transform="${face}">${f.join("")}</g>`);

  // the display
  const D0 = W.DISPLAY;
  out.push(S(k.slabOf(D0, SUP_TOP, 0.6, P, 3), { tone: "lo", crease: "none" }));
  out.push(`<path class="ind-screen" d="${k.planOutline(k.insetPlan(D0, 1.2), SUP_TOP + 0.6, P, 3)}"/>`);
  out.push(L(k.planOutline(k.insetPlan(D0, 1.2), SUP_TOP + 0.6, P, 3), { tone: "lo" }));
  out.push(`<g data-slot="display" transform="${k.topMatrix([D0.x + 10.5, D0.y + D0.d - 3], SUP_TOP + 0.6, P, "y")}"></g>`);

  // the terminal pads, bent down the +y face to the tracks
  for (const [x, y] of [W.POST_PLUS, W.POST_MINUS]) {
    const pad = { x: x - 5, y: y - 5, w: 10, d: SUP.y + SUP.d - (y - 5), r: 1.4 };
    out.push(S(k.slabOf(pad, SUP_TOP, 0.8, P, 3), { tone: "lo", crease: "none" }));
    out.push(S(k.slabOf({ x: x - 3, y: SUP.y + SUP.d, w: 6, d: 1.4, r: 0.4 }, 1.2, SUP_TOP + 0.8 - 1.2, P, 2), { tone: "lo", crease: "none" }));
  }
  const posts = [W.POST_PLUS, W.POST_MINUS].map(([x, y]) => ({
    at: [x, y],
    svg: S(k.cylinder(x, y, 3.3, SUP_TOP + 0.8, 1.6, P, 24), { tone: "mid" }) + S(k.cylinder(x, y, 2.4, SUP_TOP + 2.4, 2.2, P, 20), { tone: "hi" }) + L(k.knurl(x, y, 2.4, SUP_TOP + 2.4, SUP_TOP + 4.6, 14, P), { tone: "lo" }),
  }));
  out.push(farFirst(posts));
  const mark = (x, y, sign) => {
    let d = k.lineOnTop([x - 1.6, y], [x + 1.6, y], SUP_TOP, P);
    if (sign === "+") d += k.lineOnTop([x, y - 1.6], [x, y + 1.6], SUP_TOP, P);
    return L(d, { tone: "mid", free: true });
  };
  out.push(mark(W.POST_PLUS[0] + 10, W.POST_PLUS[1] + 1, "+"), mark(W.POST_MINUS[0] - 10, W.POST_MINUS[1] + 1, "-"));

  // controls, far to near
  const controls = [];
  controls.push({ at: W.KNOB_V.at, svg: knobSvg(W.KNOB_V, SUP_TOP, 13, "V") });
  controls.push({ at: W.KNOB_I.at, svg: knobSvg(W.KNOB_I, SUP_TOP, 8, "I") });
  controls.push({ at: W.KNOB_F.at, svg: knobSvg(W.KNOB_F, SUP_TOP, 9, "F") });
  for (const b of W.BUTTONS) {
    const [x, y] = b.at;
    const plan = { x: x - 3.6, y: y - 3.6, w: 7.2, d: 7.2, r: 1.2 };
    const icon = {
      dc: k.lineOnTop([x - 0.2, y - 2], [x - 0.2, y + 2], SUP_TOP + 2.6, P),
      square: k.onTop([[x - 1.5, y - 2.1], [x - 1.5, y - 0.7], [x + 1.5, y - 0.7], [x + 1.5, y + 0.7], [x - 1.5, y + 0.7], [x - 1.5, y + 2.1]], SUP_TOP + 2.6, P),
      sine: k.onTop(Array.from({ length: 13 }, (_, n) => [x - 1.8 * Math.sin((n / 12) * TAU), y - 2.2 + (4.4 * n) / 12]), SUP_TOP + 2.6, P),
    }[b.mode];
    controls.push({
      at: b.at,
      svg: `<g data-part="btn-${b.mode}" data-grab="mode-${b.mode}">${S(k.slabOf({ ...plan, x: plan.x - 0.8, y: plan.y - 0.8, w: 9, d: 9, r: 1.6 }, SUP_TOP, 0.6, P, 3), { tone: "lo", crease: "none" })}<g data-key class="ind-touch">${S(k.slabOf(plan, SUP_TOP + 0.6, 2, P, 3, 0.3), { tone: "mid" })}${L(icon, { tone: "hi", free: true, className: "ind-icon" })}</g></g>`,
    });
  }
  for (const [name, [lx, ly]] of Object.entries(W.LAMPS)) {
    controls.push({
      at: [lx, ly],
      svg: S(k.cylinder(lx, ly, W.LAMP_R + 1.6, SUP_TOP, 1.2, P, 24), { tone: "lo" }) + `<g data-part="lamp-${name}">${S(k.cylinder(lx, ly, W.LAMP_R, SUP_TOP + 1.2, 2.2, P, 24, 0.3), { tone: "mid" })}</g>`,
    });
  }
  out.push(farFirst(controls));
  return out.join("");
}

// ── the two-way switch ─────────────────────────────────────────────────────────
const { SW_BASE, SW_BASE_H, PIVOT, BLADE } = W;
const JAW_H = 6; // the jaws stand this far above the base
const jawPlates = ([x, y], along) => {
  // two spring plates either side of the blade's path, plus the block they stand in
  const half = BLADE.width / 2 + 0.25;
  const block = { x: x - 5, y: y - 5, w: 10, d: 10, r: 1.2 };
  const plate = (side) =>
    along === "y"
      ? { x: side < 0 ? x - half - 1.2 : x + half, y: y - 4, w: 1.2, d: 8, r: 0.3 }
      : { x: x - 4, y: side < 0 ? y - half - 1.2 : y + half, w: 8, d: 1.2, r: 0.3 };
  return { block, far: plate(-1), near: plate(1) };
};
const JAWS = { on: jawPlates(W.JAW_ON, "y"), off: jawPlates(W.JAW_OFF, "x") };

function switchBase() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(SW_BASE, 0, SW_BASE_H, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(SW_BASE, 0, SW_BASE_H, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(SW_BASE, 2.2), SW_BASE_H, P, 4), { tone: "faint" }));
  out.push(screwsAt(k.corners(SW_BASE, 4.2), SW_BASE_H, 1.6));
  // the blade's travel, a quarter groove between two detents
  const r = 19;
  const arc = Array.from({ length: 25 }, (_, n) => {
    const a = ((W.ANGLE_ON + ((W.ANGLE_OFF - W.ANGLE_ON) * n) / 24) * Math.PI) / 180;
    return [PIVOT[0] + r * Math.cos(a), PIVOT[1] + r * Math.sin(a)];
  });
  out.push(L(k.onTop(arc, SW_BASE_H, P), { tone: "lo" }));
  out.push(D([at([...arc[0], SW_BASE_H]), at([...arc[24], SW_BASE_H])], { size: 0.75, tone: "mid" }));
  // jaw blocks and their far plates
  for (const jaw of [JAWS.on, JAWS.off]) {
    out.push(S(k.slabOf(jaw.block, SW_BASE_H, 1.4, P, 2, 0.3), { tone: "lo" }));
    out.push(S(k.slabOf(jaw.far, SW_BASE_H + 1.4, JAW_H, P, 2), { tone: "hi" }));
  }
  // the pivot post the blade turns on
  out.push(S(k.cylinder(PIVOT[0], PIVOT[1], 3.6, SW_BASE_H, 0.9, P, 28), { tone: "lo" }));
  out.push(S(k.cylinder(PIVOT[0], PIVOT[1], 2.6, SW_BASE_H + 0.9, BLADE.z - SW_BASE_H - 0.9, P, 24), { tone: "mid" }));
  return out.join("");
}
function switchFront() {
  // the near plate of each pair of jaws, in front of the blade
  return [JAWS.on, JAWS.off].map((jaw) => S(k.slabOf(jaw.near, SW_BASE_H + 1.4, JAW_H, P, 2), { tone: "hi" }) + D([at([jaw.block.x + 1.4, jaw.block.y + 1.4, SW_BASE_H + 1.4])], { size: 0.4 })).join("");
}

// ── the resistor ───────────────────────────────────────────────────────────────
function terminalPost(y) {
  return (
    S(k.cylinder(X, y, 3.4, W.TRACE_H, 1, P, 24), { tone: "lo" }) +
    S(k.cylinder(X, y, 2.4, W.TRACE_H + 1, W.POST_H - W.TRACE_H - 1, P, 20), { tone: "mid" }) +
    S(k.cylinder(X, y, 3, W.POST_H - 2.4, 2.4, P, 6, 0.3), { tone: "hi" }) +
    L(k.lineOnTop([X - 1.6, y], [X + 1.6, y], W.POST_H, P), { tone: "lo" })
  );
}
function resistor() {
  const { RES, RES_POSTS } = W;
  const [y0, y1] = RES_POSTS;
  const leadZ = RES.z + RES.h / 2;
  const lead = (ya, yb) => S(k.slabOf({ x: X - 0.6, y: ya, w: 1.2, d: yb - ya, r: 0.3 }, leadZ - 0.6, 1.2, P, 2), { tone: "hi", crease: "none" });
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(RES, 0, RES.z, P)}" style="filter:blur(4px)"/>`);
  out.push(terminalPost(y0));
  out.push(lead(y0 + 2.4, RES.y));
  // the white ceramic body, with its end seals and a printed value on the side facing us
  const seal = (y) => S(k.slabOf({ x: RES.x + 0.8, y, w: RES.w - 1.6, d: 1.4, r: 0.5 }, RES.z + 0.8, RES.h - 1.6, P, 2), { tone: "lo" });
  out.push(seal(RES.y - 1));
  out.push(S(k.slabOf(RES, RES.z, RES.h, P, 3, 0.6), { tone: "hi", inner: L(k.sideSeam({ ...RES }, RES.z + 1.6, P, 3), { tone: "faint" }) }));
  out.push(seal(RES.y + RES.d - 0.4));
  const side = k.sideMatrix([RES.x + RES.w, RES.y + RES.d], 0, P, "right");
  out.push(`<g transform="${side}"><text class="iso-face-text" data-tone="mid" x="${RES.d / 2}" y="${-(RES.z + RES.h / 2 - 1.3)}" font-size="3.6" text-anchor="middle">220Ω 5W</text></g>`);
  out.push(lead(RES.y + RES.d, y1 - 2.4));
  out.push(terminalPost(y1));
  return out.join("");
}

// ── the coil and its iron core ─────────────────────────────────────────────────
function coilParts() {
  const { COIL } = W;
  const out = [];
  for (const y of [3, 32]) out.push(S(k.slabOf({ x: COIL.xc - 8, y, w: 16, d: 5, r: 1 }, 0, 5.5, P, 3, 0.3), { tone: "mid" }));
  const c = k.coil(COIL.y0, COIL.y1, [COIL.xc, COIL.zc], COIL.r, COIL.turns, "y", P, 18);
  return { back: out.join("") + L(c.back, { tone: "mid" }), front: L(c.front, { tone: "hi" }) };
}
function trough() {
  const { TROUGH } = W;
  return S(k.slabOf(TROUGH, 0, TROUGH.h, P, 3, 0.4), { tone: "mid" }) + L(k.lineOnTop([TROUGH.x + TROUGH.w / 2, TROUGH.y], [TROUGH.x + TROUGH.w / 2, TROUGH.y + TROUGH.d], TROUGH.h, P), { tone: "faint" });
}
function core() {
  // a bundle of iron strips (laminations), so the seams run its whole length
  const { CORE } = W;
  const out = [];
  const plan = { x: CORE.x, y: CORE.y, w: CORE.w, d: CORE.d, r: 1.4 };
  const seams = [2.5, 5, 7.5].map((dx) => k.lineOnTop([CORE.x + dx, CORE.y + 1.2], [CORE.x + dx, CORE.y + CORE.d - 1.2], CORE.z + CORE.h, P)).join("");
  out.push(S(k.slabOf(plan, CORE.z, CORE.h, P, 3, 0.5), { tone: "lo" }));
  out.push(L(seams, { tone: "faint", free: true }));
  const knob = [CORE.x + CORE.w / 2, CORE.y + CORE.d - 6];
  out.push(S(k.cylinder(knob[0], knob[1], 3.6, CORE.z + CORE.h, 5, P, 24, 0.3), { tone: "hi" }));
  out.push(L(k.knurl(knob[0], knob[1], 3.6, CORE.z + CORE.h, CORE.z + CORE.h + 5, 18, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([knob[0], knob[1] - 3.6], [knob[0], knob[1] + 3.6], CORE.z + CORE.h + 5, P), { tone: "hi" }));
  return out.join("");
}
function coilLeads() {
  const { COIL } = W;
  const out = [];
  for (const y of [COIL.y0, COIL.y1]) {
    out.push(S(k.slabOf({ x: COIL.xc + COIL.r - 0.6, y: y - 0.8, w: 1.2, d: 1.6, r: 0.3 }, W.TRACE_H, COIL.zc - W.TRACE_H + 0.8, P, 2), { tone: "lo", crease: "none" }));
  }
  out.push(L([COIL.y0, COIL.y1].map((y) => k.sideRing([COIL.xc, y, COIL.zc], COIL.r, "y", P, 40)).join(""), { tone: "lo" }));
  return out.join("");
}
function compass() {
  const { COMPASS } = W;
  const [x, y] = COMPASS.at;
  const top = COMPASS.h;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.cylinder(x, y, COMPASS.r, 0, COMPASS.h, P, 40).fill}" style="filter:blur(4px)"/>`);
  out.push(S(k.cylinder(x, y, COMPASS.r, 0, COMPASS.h, P, 48, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, COMPASS.r, top - 1.4, top, 72, P, 0.2), { tone: "lo" }));
  out.push(L(k.ring(x, y, COMPASS.r - 1.4, top, P, 48), { tone: "lo" }));
  out.push(L(k.ring(x, y, COMPASS.r - 3.4, top, P, 48), { tone: "faint" }));
  const t = k.radialTicks(x, y, COMPASS.r - 1.4, 36, 9, top, [1.2, 2.6], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(D([at([x - COMPASS.r + 4.4, y, top])], { size: 0.9, tone: "hi" }));
  out.push(`<g data-slot="compass"></g>`);
  return out.join("");
}

// ── the light meter ────────────────────────────────────────────────────────────
function lightMeter() {
  const { LUX, LUX_PIVOT, LUX_R, LUX_SWEEP, CELL } = W;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(LUX, 0, LUX.h, P)}" style="filter:blur(4px)"/>`);
  out.push(S(k.slabOf(LUX, 0, LUX.h, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(LUX, 2.2, P, 4), { tone: "faint" }) }));
  // the window over the scale
  const win = { x: LUX.x + 2.6, y: LUX.y + 2.6, w: LUX.w - 5.2, d: LUX.d - 5.2, r: 1.8 };
  out.push(`<path class="ind-glass" d="${k.planOutline(win, LUX.h, P, 4)}"/>`);
  out.push(L(k.planOutline(win, LUX.h, P, 4), { tone: "lo" }));
  const [px, py] = LUX_PIVOT;
  const dirOf = (deg) => [-Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const arc = Array.from({ length: 31 }, (_, n) => {
    const [dx, dy] = dirOf(LUX_SWEEP - (2 * LUX_SWEEP * n) / 30);
    return [px + dx * LUX_R, py + dy * LUX_R];
  });
  out.push(L(k.onTop(arc, LUX.h, P), { tone: "mid" }));
  const minor = [], major = [];
  for (let n = 0; n <= 10; n++) {
    const [dx, dy] = dirOf(LUX_SWEEP - (2 * LUX_SWEEP * n) / 10);
    const big = n % 5 === 0 || n === 8;
    const len = big ? 2.4 : 1.3;
    (big ? major : minor).push(k.lineOnTop([px + dx * LUX_R, py + dy * LUX_R], [px + dx * (LUX_R + len), py + dy * (LUX_R + len)], LUX.h, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(`<g data-slot="lux"></g>`);
  // the photocell on its stalk, its white diffuser facing the light
  const [cx, cy] = CELL.at;
  const top = CELL.z + CELL.stalk;
  out.push(S(k.cylinder(cx, cy, 2.2, CELL.z, 1, P, 18), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, 1.1, CELL.z + 1, CELL.stalk - 1, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(cx, cy, CELL.r, top, 2.6, P, 32, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, CELL.r - 1, top + 2.6, 0.8, P, 32, 0.3), { tone: "hi" }));
  out.push(`<g data-part="cell-lit" style="opacity:0"><path class="ind-cell-lit" d="${k.cylinder(cx, cy, CELL.r - 1, top + 2.6, 0.8, P, 32).fill}"/></g>`);
  return out.join("");
}

// ── the LED in its socket ──────────────────────────────────────────────────────
const LED_FRAME = G.frameOf([W.LED.at[0], W.LED.at[1], W.LED.z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
function ledProfile() {
  const { flange, r, body, dome } = W.LED;
  const s0 = 1.2 + body;
  const profile = [[0, flange], [1.2, flange], [1.2, r], [s0, r, 1]];
  for (let n = 1; n <= 16; n++) {
    const a = (n / 16) * (Math.PI / 2);
    profile.push([s0 + dome * Math.sin(a), r * Math.cos(a), 1]);
  }
  return profile;
}
const ledPaths = G.solidOf(ledProfile(), LED_FRAME, P);
function socket() {
  const { SOCKET, LED } = W;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(SOCKET, 0, SOCKET.h, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(SOCKET, 0, SOCKET.h, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(SOCKET, 1.8), SOCKET.h, P, 3), { tone: "faint" }));
  out.push(screwsAt(k.corners(SOCKET, 3), SOCKET.h, 1.3));
  // two legs from the socket's holes up into the LED: the anode (+, toward the coil) and the cathode
  const [x, y] = LED.at;
  for (const dy of LED.legs) {
    out.push(S(k.cylinder(x, y + dy, 1.2, SOCKET.h, 0.5, P, 14), { tone: "lo" }));
    out.push(S(k.cylinder(x, y + dy, 0.45, SOCKET.h + 0.5, LED.z - SOCKET.h - 0.5, P, 10), { tone: "hi", crease: "none" }));
  }
  return out.join("");
}
function led() {
  const out = [];
  out.push(`<g data-part="led">${S(ledPaths, { tone: "hi" })}</g>`);
  // the lit epoxy: the same silhouette, filled with light, its opacity set by the current
  out.push(`<g data-part="led-lit" style="opacity:0"><path class="ind-led-lit" d="${ledPaths.fill}"/></g>`);
  return out.join("");
}

// the glow and the pool of light on the board, both centred on the LED's chip
function lightDefs() {
  return `<defs>
<radialGradient id="ind-glow"><stop offset="0" class="ind-g0"/><stop offset=".25" class="ind-g1"/><stop offset="1" class="ind-g2"/></radialGradient>
<radialGradient id="ind-pool"><stop offset="0" class="ind-p0"/><stop offset=".55" class="ind-p1"/><stop offset="1" class="ind-p2"/></radialGradient>
<radialGradient id="ind-epoxy" cx=".5" cy=".45" r=".6"><stop offset="0" class="ind-e0"/><stop offset=".55" class="ind-e1"/><stop offset="1" class="ind-e2"/></radialGradient>
</defs>`;
}
function pool() {
  const [x, y] = W.LED.at;
  return `<g data-part="pool" style="opacity:0"><circle transform="${k.topMatrix([x, y], 0, P, "x")}" r="46" fill="url(#ind-pool)"/></g>`;
}
function glow() {
  const [gx, gy] = at(W.LED_GLOW_AT);
  return `<g data-part="glow" style="opacity:0"><circle cx="${fr(gx)}" cy="${fr(gy)}" r="${fr(24 * P.scale)}" fill="url(#ind-glow)"/></g>`;
}

// ── assembly ───────────────────────────────────────────────────────────────────
const LABEL =
  "A lab bench with a circuit that shows how an inductor works. A bench supply feeds a loop through a two-way knife switch, a white 220 ohm resistor, a coil with a sliding iron core, and a red LED in a socket. Current dots flow around the loop. The LED glows with the current, a compass swings with the coil's magnetic field, and a scope and two meters on the backboard show the voltages and the current.";

const slot = (name) => `<g data-slot="${name}"></g>`;
const layer = (name) => `<g data-layer="${name}"></g>`;
const coilSvg = coilParts();

const body = [
  lightDefs(),
  board(),
  pool(),
  traces(),
  layer("bypass"),
  backboard(),
  supply(),
  layer("supply"),
  switchBase(),
  layer("switch"),
  `<g class="ind-touch" data-slot="blade"></g>`,
  layer("blade"),
  switchFront(),
  `<g class="ind-touch" data-slot="handle"></g>`,
  resistor(),
  layer("resistor"),
  coilSvg.back,
  trough(),
  `<g data-part="core" class="ind-touch">${core()}</g>`,
  coilSvg.front,
  coilLeads(),
  layer("coil"),
  slot("flux"),
  compass(),
  lightMeter(),
  socket(),
  layer("led"),
  led(),
  glow(),
  layer("front"),
];

const svg = k.figureSvg({ width: W.WIDTH, height: W.HEIGHT, label: LABEL, body });

// ── the page ───────────────────────────────────────────────────────────────────
const stripExports = (text) => text.replace(/^export /gm, "");
const live = readFileSync(join(HERE, "live.js"), "utf8");
const DATA = `const P = ${JSON.stringify(P)};\nconst LED_FILL = ${JSON.stringify(ledPaths.fill)};\n`;

const page = k.plateHtml({
  fig: "Fig 1",
  title: "How a coil fights change",
  hint: "Blue parts: click or drag them",
  readout: "",
  keys: [
    { mark: "lit", label: "Current: the dots on the wires, and the bright trace" },
    { mark: "raised", label: "Coil voltage: the coil pushing back (second trace, right meter)" },
    { mark: "dim", label: "Supply voltage: the dashed trace" },
  ],
  caption:
    "A supply pushes current round one loop: switch, resistor, coil, LED. The coil (an inductor) stores energy in its magnetic field, so it fights every change in the current: it slows the current down when the supply switches on, and keeps it going when the supply switches off. The iron core makes that effect about ten times stronger. Real coils do this in thousandths of a second; the figure runs in slow motion.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Inductor circuit on a bench. Press space to flip the switch.">${svg}</div>`,
});

const extraCss = `
.ind-screen{fill:var(--ind-screen);stroke:none}
.ind-glass{fill:var(--anatomy-face);stroke:none}
.iso[data-theme="dark"]{--ind-screen:#060606;--led-core:#fff3ec;--led-hot:#ff5a3c;--led-edge:#d4140a;--glow0:rgba(255,120,90,.85);--glow1:rgba(255,50,30,.38);--pool0:rgba(255,60,40,.34);--pool1:rgba(255,40,20,.1)}
.iso[data-theme="light"]{--ind-screen:#ffffff;--led-core:#fff1ea;--led-hot:#f0402a;--led-edge:#b3120a;--glow0:rgba(255,90,60,.55);--glow1:rgba(240,50,30,.16);--pool0:rgba(235,50,30,.16);--pool1:rgba(235,50,30,.05)}
.ind-g0{stop-color:var(--glow0)}.ind-g1{stop-color:var(--glow1)}.ind-g2{stop-color:rgba(255,40,20,0)}
.ind-p0{stop-color:var(--pool0)}.ind-p1{stop-color:var(--pool1)}.ind-p2{stop-color:rgba(255,40,20,0)}
.ind-e0{stop-color:var(--led-core)}.ind-e1{stop-color:var(--led-hot)}.ind-e2{stop-color:var(--led-edge)}
.ind-cell-lit{fill:var(--led-hot);opacity:.55}
.ind-led-lit{fill:url(#ind-epoxy);stroke:var(--led-edge);stroke-width:.6px}
.iso[data-theme="dark"] [data-part=glow],.iso[data-theme="dark"] [data-part=pool]{mix-blend-mode:screen}
[data-part=glow],[data-part=pool],[data-part=led-lit],[data-part=cell-lit]{pointer-events:none}
.ind-hub{fill:var(--anatomy-hi);stroke:var(--anatomy-paper);stroke-width:.5px;paint-order:stroke}
.ind-lcd{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-weight:600;letter-spacing:.02em}
[data-part^=btn-][data-on] .ind-icon{stroke:var(--anatomy-lit);stroke-width:1.1px}
[data-part^=lamp] .iso-solid[data-lit]>.iso-top{fill:var(--anatomy-lit)}
[data-part^=lamp] .iso-solid[data-lit]>.iso-shade{fill:var(--anatomy-hi)}
.ind-carrier{fill:var(--anatomy-lit);stroke:var(--anatomy-paper);stroke-width:.7px;paint-order:stroke}
[data-grab]{cursor:grab;touch-action:none}
/* Touchable parts: the same shading, redrawn in blue, so "blue = you can click or drag it" */
.iso[data-theme="light"] .ind-touch{--anatomy-shade-0:#c4d2fa;--anatomy-shade-1:#d0dbfb;--anatomy-shade-2:#dce5fd;--anatomy-shade-3:#e7eefe;--anatomy-top:#f1f5ff;--anatomy-hi:#3e63dd;--anatomy-mid:#5a7be4;--anatomy-lo:#7f99ea;--anatomy-faint:#b8c8f6;--anatomy-lit-top:#f1f5ff;--anatomy-lit-shade:#dce5fd}
.iso[data-theme="dark"] .ind-touch{--anatomy-shade-0:#0d1730;--anatomy-shade-1:#101d3d;--anatomy-shade-2:#132349;--anatomy-shade-3:#162854;--anatomy-top:#1a2f63;--anatomy-hi:#6b9bff;--anatomy-mid:#5583e6;--anatomy-lo:#3f63b8;--anatomy-faint:#284482;--anatomy-lit-top:#1a2f63;--anatomy-lit-shade:#132349}
.ind-touch{transition:filter .15s}
.ind-touch:hover,[data-grab]:hover>.ind-touch,.ind-touch.ind-hot{filter:brightness(1.12) drop-shadow(0 0 1.6px var(--anatomy-blue))}
@media (prefers-reduced-motion:reduce){.ind-touch{transition:none}}
[data-grab=switch]{cursor:pointer}
.ind-blue{color:var(--anatomy-blue);font-weight:600}
.ind-head{margin:0 0 -8px}.ind-head h1{margin:0 0 6px;font:600 18px/1.3 var(--anatomy-mono);letter-spacing:.01em;color:var(--anatomy-strong)}.ind-head p{margin:0;max-width:64ch;color:var(--anatomy-text);font-size:14px;line-height:1.6}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
@media (max-width:640px){.iso-stage{overflow-x:auto;overscroll-behavior-x:contain}.iso-stage .iso-svg{width:700px;max-width:none}.iso-plate{padding-left:0;padding-right:0}.iso-plate-corners{inset:18px 14px}}
[data-grab]:active{cursor:grabbing}
${PANEL_CSS}
`;

// The bench sits between the monitor (scope, live numbers, story) and the controls; presets and explanations go under.
const layoutOf = (figure, { monitor, controls, below }) => `<div class="ind-layout"><div class="ind-fig">${figure}</div>${monitor}${controls}</div>${below}`;
const intro = `<header class="ind-head"><h1>How an inductor works</h1><p>An inductor is just a coil of wire. When current flows through it, it builds a magnetic field, and that field doesn't like to change. Everything drawn in <span class="ind-blue">blue</span> can be clicked or dragged: flip the switch, slide the iron core in and out, turn the supply's knobs, and watch what the coil does to the LED.</p></header>`;
const html = k
  .pageHtml({ title: "Inductor", theme, width: 1720, body: layoutOf(intro + page, panelHtml(M)), script: kitScript() + "\n" + stripExports(readFileSync(join(HERE, "world.mjs"), "utf8")) + "\n" + stripExports(readFileSync(join(HERE, "model.mjs"), "utf8")) + "\n" + DATA + live })
  .replace("</style>", extraCss + "</style>");

writeFileSync(join(HERE, OUT), html);
console.log("wrote", OUT, (html.length / 1024).toFixed(0) + " KB");
