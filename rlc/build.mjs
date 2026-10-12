import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../shared/kit/iso-kit.mjs";
import { kitScript } from "../shared/scripts/inline-kit.mjs";
import * as W from "./world.mjs";
import * as M from "./model.mjs";
import { panelHtml, PANEL_CSS } from "./panel.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "rlc-light.html" : "rlc.html";

// ── camera ─────────────────────────────────────────────────────────────────────
const P = k.fitProjection(
  [
    ...k.boxCorners(W.PLATE, -W.PLATE_H - W.FOOT_H, 0),
    ...k.boxCorners(W.BACK, 0, W.BACK_H),
    [W.COIL.xc, 20, 52],
    [0, W.RAIL_Y + 8, 60],
  ],
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

// ── helpers for the plane of the backboard face ────────────────────────────────
// In a face matrix, local x runs to the viewer's right (toward -y) and local y runs down (toward -z).
const faceAt = (x) => k.sideMatrix([x, W.FACE_Y0], 0, P, "right");
const fr = (n) => Math.round(n * 100) / 100;
const fRect = (u0, z0, u1, z1, r = 0) => {
  const a = u0, b = u1, c = -z1, d = -z0;
  if (!r) return `M${a} ${c}H${b}V${d}H${a}Z`;
  return `M${a + r} ${c}H${b - r}A${r} ${r} 0 0 1 ${b} ${c + r}V${d - r}A${r} ${r} 0 0 1 ${b - r} ${d}H${a + r}A${r} ${r} 0 0 1 ${a} ${d - r}V${c + r}A${r} ${r} 0 0 1 ${a + r} ${c}Z`;
};
const fCircle = (u, z, r) => `M${fr(u + r)} ${-z}A${r} ${r} 0 1 0 ${fr(u - r)} ${-z}A${r} ${r} 0 1 0 ${fr(u + r)} ${-z}Z`;
const faceLine = (d, tone = "lo", extra = "") => `<path class="iso-line" data-tone="${tone}" d="${d}"${extra}/>`;
const faceDots = (points, size = 0.45, tone = "mid") => `<g class="iso-dots" data-tone="${tone}">${points.map(([u, z]) => `<circle cx="${fr(u)}" cy="${fr(-z)}" r="${size}"/>`).join("")}</g>`;

// ── the board ──────────────────────────────────────────────────────────────────
function board() {
  const { PLATE, PLATE_H, FOOT_H } = W;
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = k.corners(PLATE, 22).map(([x, y]) => ({ at: [x, y], svg: S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }) }));
  out.push(farFirst(feet));
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
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
    let nx, ny, scale = 1;
    if (!before || !after) {
      const d = before || after;
      nx = -d[1]; ny = d[0];
    } else {
      const a = [-before[1], before[0]], b = [-after[1], after[0]];
      nx = a[0] + b[0]; ny = a[1] + b[1];
      const dot = a[0] * b[0] + a[1] * b[1];
      nx /= 1 + dot; ny /= 1 + dot;
    }
    left.push([p[0] + nx * half * scale, p[1] + ny * half * scale]);
    right.push([p[0] - nx * half * scale, p[1] - ny * half * scale]);
  });
  return [...left, ...right.reverse()];
}
function traces() {
  return W.TRACES.map((path) => S(k.extrude(ribbon(path, W.TRACE_W), 0, W.TRACE_H, P, { convex: false }), { tone: "mid", crease: "none" })).join("");
}

// ── the backboard: scope and two meters ────────────────────────────────────────
function backboard() {
  const { BACK, BACK_H, FACE_X, SCOPE, METER } = W;
  const out = [];
  out.push(S(k.slabOf(BACK, 0, BACK_H, P, 4, 1.2), { tone: "mid" }));
  const face = faceAt(FACE_X);
  const frame = [];
  frame.push(faceLine(fRect(6, 5, 290, BACK_H - 6, 3), "faint"));
  const corners = [[12, 11], [284, 11], [12, BACK_H - 12], [284, BACK_H - 12]];
  frame.push(`<g class="iso-ring">${corners.map(([u, z]) => faceLine(fCircle(u, z, 2.2), "lo")).join("")}</g>`);
  frame.push(faceDots(corners, 0.5, "mid"));
  // vent slots along the bottom
  const slots = [];
  for (const [u0, u1] of [[22, 66], [230, 274]]) {
    for (let z = 10; z <= 22; z += 4) slots.push(faceLine(fRect(u0, z, u1, z + 1.6, 0.8), "faint"));
  }
  frame.push(slots.join(""));
  out.push(`<g transform="${face}">${frame.join("")}</g>`);

  // the plaques that carry the gauges: low blocks sitting on the face
  const plaque = (u0, u1, z0, z1) => ({ x: FACE_X, y: W.FACE_Y0 - u1, w: 3, d: u1 - u0, r: 1.2, z0, h: z1 - z0 });
  const scope = plaque(SCOPE.u0 - 4, SCOPE.u1 + 4, SCOPE.z0 - 6, SCOPE.z1 + 6);
  const meters = [W.METER.ammeter, W.METER.voltmeter].map((u) => plaque(u - 26, u + 26, METER.z - 26, METER.z + 26));
  for (const p of [scope, ...meters]) out.push(S(k.slabOf(p, p.z0, p.h, P, 3, 0.5), { tone: "mid" }));

  // the scope: a recessed screen with a graticule
  const front = faceAt(FACE_X + 3);
  const sc = [];
  sc.push(faceLine(fRect(SCOPE.u0 - 1.6, SCOPE.z0 - 1.6, SCOPE.u1 + 1.6, SCOPE.z1 + 1.6, 3), "lo"));
  sc.push(`<path class="rlc-screen" d="${fRect(SCOPE.u0, SCOPE.z0, SCOPE.u1, SCOPE.z1, 2)}"/>`);
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

  // the meters: a square flange with a round dial
  for (const [index, u] of [W.METER.ammeter, W.METER.voltmeter].entries()) {
    const m = [];
    const z = METER.z;
    m.push(faceLine(fRect(u - 23.4, z - 23.4, u + 23.4, z + 23.4, 3.5), "faint"));
    m.push(`<path class="rlc-glass" d="${fCircle(u, z, 21.5)}"/>`);
    m.push(faceLine(fCircle(u, z, 21.5), "lo"));
    m.push(faceLine(fCircle(u, z, 22.8), "faint"));
    const px = u, pz = z - 8;
    const arc = [], minor = [], major = [];
    const sweep = (W.METER_SWEEP * Math.PI) / 180;
    for (let n = 0; n <= 40; n++) {
      const a = -sweep + (2 * sweep * n) / 40;
      arc.push(`${n ? "L" : "M"}${fr(px + 19 * Math.sin(a))} ${fr(-pz - 19 * Math.cos(a))}`);
    }
    for (let n = 0; n <= 20; n++) {
      const a = -sweep + (2 * sweep * n) / 20;
      const big = n % 5 === 0;
      const r1 = 19, r2 = 19 + (big ? 3.2 : 1.8);
      (big ? major : minor).push(`M${fr(px + r1 * Math.sin(a))} ${fr(-pz - r1 * Math.cos(a))}L${fr(px + r2 * Math.sin(a))} ${fr(-pz - r2 * Math.cos(a))}`);
    }
    m.push(faceLine(arc.join(""), "mid"), faceLine(minor.join(""), "lo"), faceLine(major.join(""), "mid"));
    m.push(`<text class="iso-face-text" data-tone="mid" x="${u}" y="${-(z - 17.2)}" font-size="4.2" text-anchor="middle">${index ? "V" : "A"}</text>`);
    m.push(`<g data-slot="needle${index ? "V" : "A"}"></g>`);
    out.push(`<g transform="${front}">${m.join("")}</g>`);
    const sw = [[u - 20, z - 20], [u + 20, z - 20], [u - 20, z + 20], [u + 20, z + 20]];
    out.push(`<g transform="${front}">${faceDots(sw, 0.5)}</g>`);
  }
  return out.join("");
}

// ── the bench supply ───────────────────────────────────────────────────────────
function knobSvg({ at: [x, y], r, h }, z, count) {
  const out = [];
  out.push(S(k.cylinder(x, y, r + 1.6, z, 1, P, 36), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, r, z + 1, h, P, 36, 0.4), { tone: "hi" }));
  out.push(L(k.knurl(x, y, r, z + 1, z + 1 + h, Math.round(r * 5), P), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, r + 4.6, count, 1, z + 1, [1.2, 2.2], P, (-W.KNOB_SWEEP * Math.PI) / 180, (2 * W.KNOB_SWEEP * Math.PI) / 180);
  out.push(L(ticks.major, { tone: "mid" }));
  return out.join("");
}

function supply() {
  const { SUP, SUP_Z, SUP_TOP } = W;
  const out = [];
  // feet
  out.push(farFirst(k.corners(SUP, 9).map(([x, y]) => ({ at: [x, y], svg: S(k.cylinder(x, y, 4.4, 0, SUP_Z, P, 20), { tone: "lo" }) }))));
  // the case, with a lid seam
  out.push(S(k.slabOf(SUP, SUP_Z, SUP_TOP - SUP_Z, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(SUP, 17, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(SUP, 3), SUP_TOP, P, 6), { tone: "faint" }));
  const screws = k.corners(SUP, 6.5);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.9, SUP_TOP, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, SUP_TOP])), { size: 0.45 }));

  // the +x face: vents and a label plate
  const face = k.sideMatrix([SUP.x + SUP.w, SUP.y + SUP.d], 0, P, "right");
  const f = [];
  for (let z = 8; z <= 19; z += 3) f.push(faceLine(fRect(25, z, 55, z + 1.5, 0.75), "faint"));
  f.push(faceLine(fRect(6, 7, 20, 20, 1.5), "lo"));
  f.push(faceLine(`M9 ${-16.5}H17`, "lo", " data-free=\"\""), faceLine(`M9 ${-13.5}H15`, "lo", " data-free=\"\""), faceLine(`M9 ${-10.5}H16`, "lo", " data-free=\"\""));
  f.push(faceDots([[8, 18], [18, 18], [8, 9], [18, 9]], 0.4));
  out.push(`<g transform="${face}">${f.join("")}</g>`);

  // the display
  const D0 = W.DISPLAY;
  out.push(S(k.slabOf(D0, SUP_TOP, 0.6, P, 3), { tone: "lo", crease: "none" }));
  out.push(`<path class="rlc-screen" d="${k.planOutline(k.insetPlan(D0, 1.2), SUP_TOP + 0.6, P, 3)}"/>`);
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
  // printed + and - beside the pads
  const mark = (x, y, sign) => {
    const a = [x - 1.6, y], b = [x + 1.6, y];
    let d = k.lineOnTop(a, b, SUP_TOP, P);
    if (sign === "+") d += k.lineOnTop([x, y - 1.6], [x, y + 1.6], SUP_TOP, P);
    return L(d, { tone: "mid", free: true });
  };
  out.push(mark(W.POST_PLUS[0] + 10, W.POST_PLUS[1] + 1, "+"), mark(W.POST_MINUS[0] - 10, W.POST_MINUS[1] + 1, "-"));

  // controls, far to near
  const controls = [];
  controls.push({ at: W.KNOB_V.at, svg: knobSvg(W.KNOB_V, SUP_TOP, 11) + `<g data-grab="V"><g data-slot="pointerV"></g></g>` });
  controls.push({ at: W.KNOB_I.at, svg: knobSvg(W.KNOB_I, SUP_TOP, 11) + `<g data-grab="I"><g data-slot="pointerI"></g></g>` });
  controls.push({ at: W.KNOB_F.at, svg: knobSvg(W.KNOB_F, SUP_TOP, 9) + `<g data-grab="F"><g data-slot="pointerF"></g></g>` });
  for (const b of W.BUTTONS) {
    const [x, y] = b.at;
    const plan = { x: x - 3.6, y: y - 3.6, w: 7.2, d: 7.2, r: 1.2 };
    const icon = {
      dc: k.lineOnTop([x - 0.2, y - 2], [x - 0.2, y + 2], SUP_TOP + 2.6, P),
      square: k.onTop([[x - 1.5, y - 2.1], [x - 1.5, y - 0.7], [x + 1.5, y - 0.7], [x + 1.5, y + 0.7], [x - 1.5, y + 0.7], [x - 1.5, y + 2.1]].map(([a, b2]) => [a, b2]), SUP_TOP + 2.6, P),
      sine: k.onTop(Array.from({ length: 13 }, (_, n) => [x - 1.8 * Math.sin((n / 12) * TAU), y - 2.2 + (4.4 * n) / 12]), SUP_TOP + 2.6, P),
    }[b.mode];
    controls.push({
      at: b.at,
      svg: `<g data-part="btn-${b.mode}" data-grab="mode-${b.mode}">${S(k.slabOf({ ...plan, x: plan.x - 0.8, y: plan.y - 0.8, w: 9, d: 9, r: 1.6 }, SUP_TOP, 0.6, P, 3), { tone: "lo", crease: "none" })}<g data-key>${S(k.slabOf(plan, SUP_TOP + 0.6, 2, P, 3, 0.3), { tone: "mid" })}${L(icon, { tone: "hi", free: true, className: "rlc-icon" })}</g></g>`,
    });
  }
  const [tx, ty] = W.TOGGLE.at;
  controls.push({
    at: W.TOGGLE.at,
    svg:
      S(k.cylinder(tx, ty, 4.2, SUP_TOP, 1.2, P, 6), { tone: "lo" }) +
      S(k.cylinder(tx, ty, 2.6, SUP_TOP + 1.2, 1.6, P, 18), { tone: "mid" }) +
      `<g data-grab="switch"><g data-slot="toggle"></g></g>`,
  });
  const [lx, ly] = W.LAMP.at;
  controls.push({
    at: W.LAMP.at,
    svg: S(k.cylinder(lx, ly, W.LAMP.r + 1.6, SUP_TOP, 1.2, P, 24), { tone: "lo" }) + `<g data-part="lamp">${S(k.cylinder(lx, ly, W.LAMP.r, SUP_TOP + 1.2, 2.2, P, 24, 0.3), { tone: "mid" })}</g>`,
  });
  out.push(farFirst(controls));
  return out.join("");
}

// ── the resistor: a slide-wire rheostat ────────────────────────────────────────
function rheostat() {
  const { BAR, BAR_H, WIND, RAIL_X, RAIL_TOP } = W;
  const out = [];
  out.push(S(k.slabOf(BAR, 0, BAR_H, P, 5, 0.7), { tone: "hi" }));
  // the winding: one turn is a line across the top and down the near face, edge to edge
  const x0 = BAR.x, x1 = BAR.x + BAR.w;
  const turns = Array.from({ length: WIND.turns }, (_, n) => WIND.y0 + ((WIND.y1 - WIND.y0) * n) / (WIND.turns - 1));
  const top = (y) => k.lineOnTop([x0, y], [x1, y], BAR_H, P);
  const side = (y) => k.segment([x1, y, BAR_H], [x1, y, 0], P);
  out.push(`<g data-part="winding-idle" data-tone="lo">${turns.map((y) => L(top(y) + side(y), { tone: "lo" })).join("")}</g>`);
  out.push(`<g data-part="winding-live">${turns.map((y) => L(top(y) + side(y), { tone: "mid" })).join("")}</g>`);
  // terminal tab at the + end
  out.push(S(k.slabOf({ x: WX_TAB.x, y: WX_TAB.y, w: 6, d: 5, r: 0.8 }, BAR_H, 0.6, P, 2), { tone: "lo", crease: "none" }));
  out.push(`<g data-layer="winding"></g>`);
  // rail posts and rail
  const post = (y) => S(k.slabOf({ x: RAIL_X - 2.5, y, w: 5, d: 5, r: 0.8 }, 0, RAIL_TOP, P, 2, 0.3), { tone: "mid" });
  out.push(post(-85));
  out.push(S(k.slabOf({ x: RAIL_X - 1.5, y: -80, w: 3, d: 64, r: 0.6 }, 5.5, RAIL_TOP - 5.5, P, 2), { tone: "mid" }));
  out.push(post(-16));
  out.push(D([at([RAIL_X, -83, RAIL_TOP]), at([RAIL_X, -13.5, RAIL_TOP])], { size: 0.4 }));
  return out.join("");
}
const WX_TAB = { x: W.WX - 3, y: W.BAR.y };

function wiper() {
  const { RAIL_X, RAIL_TOP, WX } = W;
  const out = [];
  const y = 0;
  out.push(S(k.slabOf({ x: WX - 3.2, y: y - 1.6, w: 9.4, d: 3.2, r: 0.8 }, 12.4, 3.2, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: WX - 1.2, y: y - 1.2, w: 2.4, d: 2.4, r: 0.5 }, 9.9, 2.6, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: WX - 1.8, y: y - 1.8, w: 3.6, d: 3.6, r: 0.8 }, W.BAR_H, 0.9, P, 2), { tone: "hi" }));
  // the carriage rides the rail
  const block = { x: RAIL_X - 4.5, y: y - 5, w: 9, d: 10, r: 1.4 };
  out.push(S(k.slabOf(block, RAIL_TOP, 8, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(block, 1.6), RAIL_TOP + 8, P, 3), { tone: "faint" }));
  const knob = [RAIL_X + 1.6, y];
  out.push(S(k.cylinder(knob[0], knob[1], 3.2, RAIL_TOP + 8, 5, P, 24, 0.3), { tone: "hi" }));
  out.push(L(k.knurl(knob[0], knob[1], 3.2, RAIL_TOP + 8, RAIL_TOP + 13, 16, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([knob[0] - 3.2, knob[1]], [knob[0] + 3.2, knob[1]], RAIL_TOP + 13, P), { tone: "hi" }));
  return out.join("");
}

// ── the inductor: a coil with a sliding ferrite slug ───────────────────────────
function coilBack() {
  const { COIL } = W;
  const out = [];
  for (const y of [3, 32]) out.push(S(k.slabOf({ x: COIL.xc - 8, y, w: 16, d: 5, r: 1 }, 0, 5.5, P, 3, 0.3), { tone: "mid" }));
  const c = k.coil(COIL.y0, COIL.y1, [COIL.xc, COIL.zc], COIL.r, COIL.turns, "y", P, 18);
  return { back: out.join("") + L(c.back, { tone: "mid" }), front: L(c.front, { tone: "hi" }) };
}
function trough() {
  const { TROUGH } = W;
  const out = [];
  out.push(S(k.slabOf(TROUGH, 0, TROUGH.h, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.lineOnTop([TROUGH.x + TROUGH.w / 2, TROUGH.y], [TROUGH.x + TROUGH.w / 2, TROUGH.y + TROUGH.d], TROUGH.h, P), { tone: "faint" }));
  return out.join("");
}
function slug() {
  const { SLUG, COIL } = W;
  const out = [];
  const plan = { x: SLUG.x, y: SLUG.y, w: SLUG.w, d: SLUG.d, r: 1.4 };
  out.push(S(k.slabOf(plan, SLUG.z, SLUG.h, P, 3, 0.5), { tone: "hi" }));
  for (const y of [SLUG.y + 14, SLUG.y + 26]) {
    out.push(L(k.lineOnTop([SLUG.x, y], [SLUG.x + SLUG.w, y], SLUG.z + SLUG.h, P) + k.segment([SLUG.x + SLUG.w, y, SLUG.z + SLUG.h], [SLUG.x + SLUG.w, y, SLUG.z], P), { tone: "faint" }));
  }
  const knob = [SLUG.x + SLUG.w / 2, SLUG.y + SLUG.d - 6];
  out.push(S(k.cylinder(knob[0], knob[1], 3.6, SLUG.z + SLUG.h, 5, P, 24, 0.3), { tone: "hi" }));
  out.push(L(k.knurl(knob[0], knob[1], 3.6, SLUG.z + SLUG.h, SLUG.z + SLUG.h + 5, 18, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([knob[0], knob[1] - 3.6], [knob[0], knob[1] + 3.6], SLUG.z + SLUG.h + 5, P), { tone: "hi" }));
  return out.join("");
}
function coilLeads() {
  const { COIL } = W;
  const out = [];
  for (const y of [COIL.y0, COIL.y1]) {
    out.push(S(k.slabOf({ x: COIL.xc + COIL.r - 0.6, y: y - 0.8, w: 1.2, d: 1.6, r: 0.3 }, W.TRACE_H, COIL.zc - W.TRACE_H + 0.8, P, 2), { tone: "lo", crease: "none" }));
  }
  // the end turns of the winding
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

// ── one instrument beside each part ────────────────────────────────────────────
function thermometer() {
  const [x, y] = W.THERMO.at;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: x - 7, y: y - 8, w: 14, d: 16, r: 2 }, 0, 3, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf({ x: x - 7, y: y - 8, w: 14, d: 16, r: 2 }, 0, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([x - 4.5, y - 5.5, 3]), at([x + 4.5, y - 5.5, 3]), at([x - 4.5, y + 5.5, 3]), at([x + 4.5, y + 5.5, 3])], { size: 0.4 }));
  out.push(S(k.cylinder(x, y, 3.4, 3, 3.4, P, 24, 0.3), { tone: "hi" }));
  out.push(S(k.slabOf({ x: x - 1.8, y: y - 1.8, w: 3.6, d: 3.6, r: 1.4 }, 6.4, W.THERMO.column, P, 3, 0.3), { tone: "hi" }));
  out.push(`<g data-slot="mercury"></g>`);
  // scale ticks hanging from the top edge of a card behind the tube
  const card = { x: x - 4.2, y: y - 0.8, w: 2.4, d: 1.6, r: 0.3 };
  return out.join("");
}
function electroscope() {
  const { at: [x, y], rod, pivot } = W.SCOPE_E;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: x - 9, y: y - 14, w: 18, d: 28, r: 2 }, 0, 3, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf({ x: x - 9, y: y - 14, w: 18, d: 28, r: 2 }, 0, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(D([[-6.5, -11.5], [6.5, -11.5], [-6.5, 11.5], [6.5, 11.5]].map(([a, b]) => at([x + a, y + b, 3])), { size: 0.4 }));
  // the board behind the leaves, printed with the angle they open to
  const board = { x: x - 6, y: y - 12, w: 2.4, d: 24, r: 0.8 };
  out.push(S(k.slabOf(board, 3, rod - 2, P, 2, 0.3), { tone: "mid" }));
  const px = x - 6 + 2.4;
  const at3 = (yy, zz) => at([px, yy, zz]);
  const arc = (r, from, to) => Array.from({ length: 25 }, (_, n) => {
    const a = ((from + ((to - from) * n) / 24) * Math.PI) / 180;
    return at3(y + r * Math.sin(a), pivot + 3 - r * Math.cos(a));
  });
  const piv = pivot + 3;
  out.push(L(k.pathOf(arc(11.5, -62, 62)), { tone: "lo" }));
  const major = [], minor = [];
  for (let a = -60; a <= 60; a += 10) {
    const big = a % 30 === 0;
    const s1 = (a * Math.PI) / 180;
    const d = k.pathOf([at3(y + 11.5 * Math.sin(s1), piv - 11.5 * Math.cos(s1)), at3(y + (11.5 + (big ? 3.4 : 2)) * Math.sin(s1), piv - (11.5 + (big ? 3.4 : 2)) * Math.cos(s1))]);
    (big ? major : minor).push(d);
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  // rod, ball and the hook the leaves hang from
  out.push(S(k.slabOf({ x: x - 1, y: y - 1, w: 2, d: 2, r: 0.6 }, 3, rod - 3, P, 2), { tone: "hi" }));
  out.push(S(k.cylinder(x, y, 3.2, rod, 2.4, P, 24, 0.3), { tone: "hi" }));
  out.push(`<g data-slot="leaves"></g>`);
  out.push(S(k.cylinder(x, y, 1.9, piv - 1.2, 2.4, P, 16), { tone: "mid" }));
  return out.join("");
}

// ── the capacitor: a fixed plate and a sliding lattice plate ───────────────────
function capacitorBack() {
  const out = [];
  const { PLATE_X0, PLATE_W, PLATE_Z0, PLATE_Z1, FIXED_Y, PLATE_T } = W;
  out.push(S(k.slabOf({ x: PLATE_X0 - 4, y: FIXED_Y - 3, w: PLATE_W + 8, d: 9, r: 1.5 }, 0, PLATE_Z0, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([PLATE_X0, FIXED_Y + 1, PLATE_Z0]), at([PLATE_X0 + PLATE_W - 0, FIXED_Y + 1, PLATE_Z0])].map(([a, b]) => [a, b]), { size: 0.4 }));
  out.push(S(k.slabOf({ x: PLATE_X0, y: FIXED_Y, w: PLATE_W, d: PLATE_T, r: 1.2 }, PLATE_Z0, PLATE_Z1 - PLATE_Z0, P, 3, 0.4), { tone: "hi" }));
  // fixing screws on the foot
  out.push(D([PLATE_X0 - 1.5, PLATE_X0 + PLATE_W + 1.5].map((x) => at([x, FIXED_Y + 3, PLATE_Z0 - 0.0])), { size: 0.45 }));
  return out.join("");
}
function capacitorRail() {
  const { RAIL_Y } = W;
  const out = [];
  out.push(S(k.slabOf({ x: W.PLATE_X0 - 10, y: RAIL_Y - 3, w: 124, d: 6, r: 1 }, 0, 2, P, 3, 0.3), { tone: "mid" }));
  out.push(D([at([W.PLATE_X0 - 6, RAIL_Y, 2]), at([W.PLATE_X0 + 108, RAIL_Y, 2])], { size: 0.4 }));
  return out.join("");
}
function lattice() {
  const { PLATE_X0, PLATE_W, PLATE_Z0, PLATE_Z1, SLIDE_Y, PLATE_T, BAR_OFFSETS, BAR_W } = W;
  const out = [];
  // the carriage that rides the rail
  const carriage = { x: PLATE_X0 - 4, y: SLIDE_Y - 3, w: PLATE_W + 8, d: 9, r: 1.5 };
  out.push(S(k.slabOf(carriage, 2, PLATE_Z0 + 2 - 2, P, 3, 0.4), { tone: "mid" }));
  // horizontal pieces between the uprights, then the uprights
  const rows = [[PLATE_Z0 + 2, PLATE_Z0 + 7], [28.5, 33.5], [PLATE_Z1 - 5, PLATE_Z1]];
  for (const [z0, z1] of rows) {
    BAR_OFFSETS.slice(0, -1).forEach((o, n) => {
      const x = PLATE_X0 + o + BAR_W, w = BAR_OFFSETS[n + 1] - o - BAR_W;
      out.push(S(k.slabOf({ x, y: SLIDE_Y, w, d: PLATE_T, r: 0.3 }, z0, z1 - z0, P, 2, 0.3), { tone: "hi" }));
    });
  }
  for (const o of BAR_OFFSETS) out.push(S(k.slabOf({ x: PLATE_X0 + o, y: SLIDE_Y, w: BAR_W, d: PLATE_T, r: 0.8 }, PLATE_Z0 + 2, PLATE_Z1 - PLATE_Z0 - 2, P, 2, 0.4), { tone: "hi" }));
  // a handle on the carriage's near end, off the line the carriers take along the rail
  const hx = PLATE_X0 + PLATE_W + 4, hy = SLIDE_Y - 2.2;
  out.push(S(k.slabOf({ x: hx - 0.5, y: hy - 1.5, w: 3, d: 3, r: 0.8 }, 3, 2.5, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(hx + 4, hy, 3.1, 2.5, 5, P, 20, 0.3), { tone: "hi" }));
  out.push(L(k.knurl(hx + 4, hy, 3.1, 2.5, 7.5, 16, P), { tone: "lo" }));
  return out.join("");
}

// ── assembly ───────────────────────────────────────────────────────────────────
const LABEL =
  "A bench demonstration of a series RLC circuit. A bench supply drives a loop through a slide-wire rheostat (the resistor, set by a sliding wiper), a coil with a sliding ferrite slug (the inductor) and a plate capacitor with a sliding plate. Charge carriers flow around the loop at a speed set by the current and pile up on the plates; a compass beside the coil swings with the magnetic field, a thermometer shows the heat, and a strip-chart scope and two dial meters on the backboard show the current and the capacitor voltage.";

const slot = (name) => `<g data-slot="${name}"></g>`;
const layer = (name) => `<g data-layer="${name}"></g>`;
const coilParts = coilBack();

const body = [
  board(),
  traces(),
  backboard(),
  supply(),
  layer("supply"),
  rheostat(),
  `<g data-part="wiper" transform="translate(0 0)">${wiper()}</g>`,
  layer("wiper"),
  thermometer(),
  coilParts.back,
  trough(),
  `<g data-part="slug">${slug()}</g>`,
  coilParts.front,
  coilLeads(),
  layer("coil"),
  slot("flux"),
  compass(),
  capacitorBack(),
  slot("marksFixed"),
  slot("overlap"),
  electroscope(),
  capacitorRail(),
  `<g data-part="slide">${slot("fieldLines")}${lattice()}${slot("marksSlide")}</g>`,
  layer("capacitor"),
  layer("return"),
];

const svg = k.figureSvg({ width: W.WIDTH, height: W.HEIGHT, label: LABEL, body });

// ── the page ───────────────────────────────────────────────────────────────────
const stripExports = (text) => text.replace(/^export /gm, "");
const live = readFileSync(join(HERE, "live.js"), "utf8");
const DATA = `const P = ${JSON.stringify(P)};\nconst TURNS = ${JSON.stringify(Array.from({ length: W.WIND.turns }, (_, n) => W.WIND.y0 + ((W.WIND.y1 - W.WIND.y0) * n) / (W.WIND.turns - 1)))};\nconst FACE = ${JSON.stringify({ rear: faceAt(W.FACE_X), front: faceAt(W.FACE_X + 3) })};\nconst DISPLAY_AT = ${JSON.stringify(k.topMatrix([W.DISPLAY.x + 10.5, W.DISPLAY.y + W.DISPLAY.d - 3], W.SUP_TOP + 0.6, P, "y"))};\n`;

const page = k.plateHtml({
  fig: "Fig 1",
  title: "Series RLC circuit",
  hint: "Drag the parts or use the panel",
  readout: "",
  keys: [
    { mark: "lit", label: "Current: carriers on the wire, and the trace on the scope" },
    { mark: "raised", label: "Capacitor voltage: the second trace and the second meter" },
    { mark: "dim", label: "Source voltage: the faint trace" },
  ],
  caption:
    "A bench supply drives one loop through a resistor, an inductor and a capacitor in series. The resistor turns current into heat. The inductor stores energy in a magnetic field and resists any change in current. The capacitor stores energy in the electric field between its plates, and no charge ever crosses the gap.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Series RLC circuit board. Use the panel below to change resistance, inductance, capacitance, voltage and the current limit.">${svg}</div>`,
});

const extraCss = `
.rlc-screen{fill:var(--rlc-screen);stroke:none}
.rlc-glass{fill:var(--anatomy-face);stroke:none}
.iso[data-theme="dark"]{--rlc-screen:#060606}
.iso[data-theme="light"]{--rlc-screen:#ffffff}
.rlc-hub{fill:var(--anatomy-hi);stroke:var(--anatomy-paper);stroke-width:.5px;paint-order:stroke}
.rlc-lcd{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-weight:600;letter-spacing:.02em}
[data-part^=btn-][data-on] .rlc-icon{stroke:var(--anatomy-lit);stroke-width:1.1px}
[data-part=lamp] .iso-solid[data-lit]>.iso-top{fill:var(--anatomy-lit)}
[data-part=lamp] .iso-solid[data-lit]>.iso-shade{fill:var(--anatomy-hi)}
.rlc-carrier{fill:var(--anatomy-lit);stroke:var(--anatomy-paper);stroke-width:.7px;paint-order:stroke}
.rlc-mark{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-weight:600;opacity:0;pointer-events:none}
[data-grab]{cursor:grab;touch-action:none}
.rlc-head{margin:0 0 -8px}.rlc-head h1{margin:0 0 6px;font:600 18px/1.3 var(--anatomy-mono);letter-spacing:.01em;color:var(--anatomy-strong)}.rlc-head p{margin:0;max-width:62ch;color:var(--anatomy-text);font-size:14px;line-height:1.6}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
@media (max-width:640px){.iso-stage{overflow-x:auto;overscroll-behavior-x:contain}.iso-stage .iso-svg{width:700px;max-width:none}.iso-plate{padding-left:0;padding-right:0}.iso-plate-corners{inset:18px 14px}}
[data-grab]:active{cursor:grabbing}
${PANEL_CSS}
`;

const layoutOf = (figure, panel) => {
  const cut = panel.indexOf("</aside>") + "</aside>".length;
  return `<div class="rlc-layout"><div class="rlc-fig">${figure}</div>${panel.slice(0, cut)}</div>${panel.slice(cut)}`;
};
const intro = `<header class="rlc-head"><h1>Inside a series RLC circuit</h1><p>A resistor, an inductor and a capacitor in one loop, driven by a bench supply. Slide the parts on the board or use the panel, and watch where the current, the voltage and the energy go.</p></header>`;
const html = k
  .pageHtml({ title: "RLC circuit", theme, width: 1320, body: layoutOf(intro + page, panelHtml(M)), script: kitScript() + "\n" + stripExports(readFileSync(join(HERE, "world.mjs"), "utf8")) + "\n" + stripExports(readFileSync(join(HERE, "model.mjs"), "utf8")) + "\n" + DATA + live })
  .replace("</style>", extraCss + "</style>");

writeFileSync(join(HERE, OUT), html);
console.log("wrote", OUT, (html.length / 1024).toFixed(0) + " KB");
