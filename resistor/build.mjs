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
const OUT = theme === "light" ? "resistor-light.html" : "resistor.html";

// ── camera ─────────────────────────────────────────────────────────────────────
const P = k.fitProjection(
  [
    ...k.boxCorners(W.PLATE, -W.PLATE_H - W.FOOT_H, 0),
    ...k.boxCorners(W.SUP, 0, W.SUP_TOP + 11),
    [W.LEDP.x, W.LEDP.y, W.LED_BODY_TOP + W.LED_DOME + 8],
  ],
  W.WIDTH,
  W.HEIGHT,
  { pad: 20, azimuth: W.VIEW_AZIMUTH },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = ([x, y, z = 0]) => k.depthOf([x, y, z], P);
const farFirst = (items) => [...items].sort((a, b) => depth(a.at) - depth(b.at)).map((item) => item.svg).join("");
const TAU = Math.PI * 2;
const fr = (n) => Math.round(n * 100) / 100;

// ── drawing in the plane of a vertical face ────────────────────────────────────
// A "right" face faces +x: local x runs toward -y, local y runs down (-z). A "left" face faces +y: local x runs toward +x.
const fRect = (u0, z0, u1, z1, r = 0) => {
  const a = u0, b = u1, c = -z1, d = -z0;
  if (!r) return `M${a} ${c}H${b}V${d}H${a}Z`;
  return `M${a + r} ${c}H${b - r}A${r} ${r} 0 0 1 ${b} ${c + r}V${d - r}A${r} ${r} 0 0 1 ${b - r} ${d}H${a + r}A${r} ${r} 0 0 1 ${a} ${d - r}V${c + r}A${r} ${r} 0 0 1 ${a + r} ${c}Z`;
};
const fCircle = (u, z, r) => `M${fr(u + r)} ${fr(-z)}A${r} ${r} 0 1 0 ${fr(u - r)} ${fr(-z)}A${r} ${r} 0 1 0 ${fr(u + r)} ${fr(-z)}Z`;
const fArc = (u, z, r, a0, a1, n = 32) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return `${i ? "L" : "M"}${fr(u + r * Math.sin(a))} ${fr(-z - r * Math.cos(a))}`;
  }).join("");
const faceLine = (d, tone = "lo", extra = "") => `<path class="iso-line" data-tone="${tone}" d="${d}"${extra}/>`;
const faceDots = (points, size = 0.45, tone = "mid") => `<g class="iso-dots" data-tone="${tone}">${points.map(([u, z]) => `<circle cx="${fr(u)}" cy="${fr(-z)}" r="${size}"/>`).join("")}</g>`;
const screwRing = (points, r = 1.8) => `<g>${points.map(([u, z]) => faceLine(fCircle(u, z, r), "lo")).join("")}</g>` + faceDots(points, 0.45);
const frontAt = (x) => k.sideMatrix([x, W.SIDE_Y], 0, P, "right");
const sideAt = (y) => k.sideMatrix([W.SUP.x, y], 0, P, "left");
const meterAt = (x) => k.sideMatrix([x, W.AM_Y0], 0, P, "right");

// ── the board ──────────────────────────────────────────────────────────────────
function board() {
  const { PLATE, PLATE_H, FOOT_H } = W;
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = k.corners(PLATE, 22).map(([x, y]) => ({ at: [x, y], svg: S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }) }));
  out.push(farFirst(feet));
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a ruler along the near edge
  const strip = { x: 66, y: -158, w: 7, d: 240, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.y + 4, strip.y + strip.d - 4, 4, 5, strip.x + 0.8, 0.6, [2, 3.6], P, "y");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 3.5, strip.y + 2, 0.6]), at([strip.x + 3.5, strip.y + strip.d - 2, 0.6])], { size: 0.45 }));
  // a label plate in the near left corner
  const plate = { x: 54, y: 92, w: 16, d: 20, r: 1.6 };
  out.push(S(k.slabOf(plate, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.4), 0.8, P, 4), { tone: "faint" }));
  [[plate.y + 5, plate.y + 15], [plate.y + 5, plate.y + 12], [plate.y + 5, plate.y + 13.5]].forEach(([a, b], index) => {
    out.push(L(k.lineOnTop([plate.x + 4.5 + index * 3, a], [plate.x + 4.5 + index * 3, b], 0.8, P), { tone: "lo", free: true }));
  });
  out.push(D([at([plate.x + 3, plate.y + 3, 0.8]), at([plate.x + 3, plate.y + plate.d - 3, 0.8]), at([plate.x + plate.w - 3, plate.y + 3, 0.8]), at([plate.x + plate.w - 3, plate.y + plate.d - 3, 0.8])], { size: 0.4 }));
  return out.join("");
}

// A copper track: an orthogonal polyline thickened into a flat ribbon.
function ribbon(points, width) {
  const half = width / 2;
  const dirs = points.slice(1).map((p, i) => {
    const q = points[i];
    const n = Math.hypot(p[0] - q[0], p[1] - q[1]);
    return [(p[0] - q[0]) / n, (p[1] - q[1]) / n];
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
      const dot = a[0] * b[0] + a[1] * b[1];
      nx = (a[0] + b[0]) / (1 + dot); ny = (a[1] + b[1]) / (1 + dot);
    }
    left.push([p[0] + nx * half, p[1] + ny * half]);
    right.push([p[0] - nx * half, p[1] - ny * half]);
  });
  return [...left, ...right.reverse()];
}
function traces() {
  const out = W.TRACES.map((path) => S(k.extrude(ribbon(path, W.TRACE_W), 0, W.TRACE_H, P, { convex: false }), { tone: "mid", crease: "none" }));
  // a rivet at every corner of a track
  const corners = W.TRACES.flatMap((path) => path.slice(1, -1));
  out.push(L(corners.map(([x, y]) => k.ring(x, y, 1.4, W.TRACE_H, P, 14)).join(""), { tone: "lo" }));
  out.push(D(corners.map(([x, y]) => at([x, y, W.TRACE_H])), { size: 0.45 }));
  return out.join("");
}

// ── the bench supply ───────────────────────────────────────────────────────────
function supply() {
  const { SUP, SUP_Z, SUP_TOP, FRONT_X, SIDE_Y, KNOB, DISPLAY, SWITCH, LAMP, HANDLE } = W;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(SUP, 0, SUP_TOP, P)}" style="filter:blur(3px)"/>`);
  out.push(farFirst(k.corners(SUP, 9).map(([x, y]) => ({ at: [x, y], svg: S(k.cylinder(x, y, 4.6, 0, SUP_Z, P, 20), { tone: "lo" }) }))));
  out.push(S(k.slabOf(SUP, SUP_Z, SUP_TOP - SUP_Z, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(SUP, SUP_TOP - 7, P, 6), { tone: "faint" }) }));
  // the lid: screws and a field of closed vent slots
  out.push(L(k.planOutline(k.insetPlan(SUP, 3), SUP_TOP, P, 6), { tone: "faint" }));
  const screws = k.corners(SUP, 6.5);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.9, SUP_TOP, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, SUP_TOP])), { size: 0.45 }));
  const slots = [];
  for (let n = 0; n < 6; n++) {
    const x = SUP.x + 12 + n * 4.6;
    slots.push(k.planOutline({ x, y: SUP.y + 14, w: 2, d: 22, r: 1 }, SUP_TOP, P, 3));
    slots.push(k.planOutline({ x, y: SUP.y + 40, w: 2, d: 18, r: 1 }, SUP_TOP, P, 3));
  }
  out.push(L(slots.join(""), { tone: "faint" }));
  // the carry handle: two posts and a bar
  const post = (y) => ({ at: [HANDLE.x, y], svg: S(k.cylinder(HANDLE.x, y, 3.6, SUP_TOP, 1, P, 20), { tone: "lo" }) + S(k.cylinder(HANDLE.x, y, 2.4, SUP_TOP + 1, 7, P, 18), { tone: "mid" }) });
  out.push(farFirst([post(HANDLE.y0), post(HANDLE.y1)]));
  const bar = { x: HANDLE.x - 3, y: HANDLE.y0 - 3.2, w: 6, d: HANDLE.y1 - HANDLE.y0 + 6.4, r: 3 };
  out.push(S(k.slabOf(bar, SUP_TOP + 8, 3.4, P, 6, 0.5), { tone: "hi" }));
  out.push(D([at([HANDLE.x, HANDLE.y0, SUP_TOP + 11.4]), at([HANDLE.x, HANDLE.y1, SUP_TOP + 11.4])], { size: 0.45 }));

  // the front panel
  const f = [];
  f.push(faceLine(fRect(3, 4, SUP.d - 3, SUP_TOP - 3, 2.5), "faint"));
  f.push(screwRing([[6.5, 7.5], [SUP.d - 6.5, 7.5], [6.5, SUP_TOP - 6.5], [SUP.d - 6.5, SUP_TOP - 6.5]], 1.6));
  // display
  f.push(faceLine(fRect(DISPLAY.u0 - 2, DISPLAY.z0 - 2, DISPLAY.u1 + 2, DISPLAY.z1 + 2, 2), "lo"));
  f.push(`<path class="rs-screen" d="${fRect(DISPLAY.u0, DISPLAY.z0, DISPLAY.u1, DISPLAY.z1, 1.2)}"/>`);
  f.push(faceLine(fRect(DISPLAY.u0, DISPLAY.z0, DISPLAY.u1, DISPLAY.z1, 1.2), "lo"));
  f.push(`<g data-slot="lcd"></g>`);
  // the knob's scale: 0 to 12 volts
  const ticksMinor = [], ticksMajor = [];
  for (let v = 0; v <= 24; v++) {
    const a = W.knobAngle(v / 2);
    const big = v % 4 === 0;
    const r0 = KNOB.r + 2.6, r1 = r0 + (big ? 2.4 : 1.3);
    const rad = (a * Math.PI) / 180;
    (big ? ticksMajor : ticksMinor).push(`M${fr(KNOB.u + r0 * Math.sin(rad))} ${fr(-KNOB.z - r0 * Math.cos(rad))}L${fr(KNOB.u + r1 * Math.sin(rad))} ${fr(-KNOB.z - r1 * Math.cos(rad))}`);
  }
  f.push(faceLine(fArc(KNOB.u, KNOB.z, KNOB.r + 2.6, -W.KNOB_SWEEP, W.KNOB_SWEEP, 48), "lo"));
  f.push(faceLine(ticksMinor.join(""), "lo"), faceLine(ticksMajor.join(""), "mid"));
  // the power switch bezel and lamp ring
  f.push(faceLine(fRect(SWITCH.u - SWITCH.w / 2 - 1.4, SWITCH.z - SWITCH.h / 2 - 1.4, SWITCH.u + SWITCH.w / 2 + 1.4, SWITCH.z + SWITCH.h / 2 + 1.4, 1.6), "lo"));
  f.push(faceLine(fCircle(LAMP.u, LAMP.z, LAMP.r + 1.3), "lo"));
  // a soft glow behind each part you can touch
  f.push(`<g class="rs-pulse"><path d="${fCircle(KNOB.u, KNOB.z, KNOB.r + 3.2)}"/><path d="${fRect(SWITCH.u - SWITCH.w / 2 - 2.6, SWITCH.z - SWITCH.h / 2 - 2.6, SWITCH.u + SWITCH.w / 2 + 2.6, SWITCH.z + SWITCH.h / 2 + 2.6, 2.4)}"/></g>`);
  // vents
  for (let z = 7; z <= 16; z += 3) f.push(faceLine(fRect(36, z, 62, z + 1.5, 0.75), "faint"));
  out.push(`<g transform="${frontAt(FRONT_X)}">${f.join("")}</g>`);

  // the rocker switch: a block standing out of the panel; the page tips it
  const sw = { x: FRONT_X, y: W.yOf(SWITCH.u + SWITCH.w / 2), w: 1.6, d: SWITCH.w, r: 0.5 };
  out.push(`<g data-part="switch" data-grab="power">${S(k.slabOf(sw, SWITCH.z - SWITCH.h / 2, SWITCH.h, P, 2), { tone: "mid", className: "rs-touch" })}<g transform="${frontAt(FRONT_X + 1.6)}" data-slot="rocker"></g></g>`);
  // the lamp
  const FL = G.frameOf([FRONT_X, W.yOf(LAMP.u), LAMP.z], [1, 0, 0], [0, 0, 1], [0, -1, 0]);
  out.push(`<g data-part="lamp">${S(G.disc(0, 1.4, LAMP.r, FL, P), { tone: "mid" })}</g>`);

  // the voltage knob: a skirt and a knurled cap, turned out of the panel
  const FK = G.frameOf([FRONT_X, W.yOf(KNOB.u), KNOB.z], [1, 0, 0], [0, 0, 1], [0, -1, 0]);
  const knob = [];
  knob.push(S(G.disc(0, 1.3, KNOB.r + 1.8, FK, P), { tone: "lo" }));
  const ribs = G.ribsOf(FK, 1.3, KNOB.depth, KNOB.r, 44, P, { fade: [0.04, 0.4], seams: "first" });
  knob.push(S(G.disc(1.3, KNOB.depth, KNOB.r, FK, P), { tone: "hi", className: "rs-touch", inner: k.fadedSvg(ribs, { tone: "lo" }) }));
  knob.push(L(G.circleOf(FK, KNOB.depth, KNOB.r - 1.6, P), { tone: "faint" }));
  knob.push(`<g transform="${frontAt(FRONT_X + KNOB.depth)}" data-slot="pointer"></g>`);
  out.push(`<g data-grab="V">${knob.join("")}</g>`);

  // the +y side: vents, polarity marks, and the two binding posts with their strips down to the board
  const s = [];
  for (let z = 26; z <= 38; z += 3.5) s.push(faceLine(fRect(6, z, 20, z + 1.6, 0.8), "faint"));
  s.push(faceLine(fRect(78, 30, 88, 40, 1.4), "lo"));
  s.push(faceLine(`M80.5 ${-36.5}H85.5`, "lo", ' data-free=""'), faceLine(`M80.5 ${-33.5}H84`, "lo", ' data-free=""'));
  const mark = (u, z, plus) => faceLine(`M${u - 2} ${-z}H${u + 2}` + (plus ? `M${u} ${-z - 2}V${-z + 2}` : ""), "hi", ' data-free=""');
  s.push(mark(W.POST_PLUS - SUP.x, W.POST_Z + 11, true), mark(W.POST_MINUS - SUP.x, W.POST_Z + 11, false));
  out.push(`<g transform="${sideAt(SIDE_Y)}">${s.join("")}</g>`);
  const posts = [[W.POST_PLUS, "plus"], [W.POST_MINUS, "minus"]].map(([x, kind]) => {
    const strip = { x: x - 2.6, y: SIDE_Y, w: 5.2, d: 1.3, r: 0.4 };
    const F = G.frameOf([x, SIDE_Y, W.POST_Z], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
    const p = [];
    p.push(S(k.slabOf(strip, 0.2, W.POST_Z - 2, P, 2), { tone: "mid", crease: "none" }));
    p.push(S(G.disc(0, 1.3, 6.4, F, P), { tone: "lo" }));
    p.push(S(G.disc(1.3, 3.4, 4.2, F, P), { tone: "mid" }));
    p.push(S(G.disc(3.4, 4.4, 3.1, F, P), { tone: "mid" }));
    const capRibs = G.ribsOf(F, 4.4, 10.4, 5.2, 28, P, { fade: [0.04, 0.4], seams: true });
    p.push(S(G.disc(4.4, 10.4, 5.2, F, P), { tone: "hi", className: `rs-post rs-${kind}`, inner: k.fadedSvg(capRibs, { tone: "lo" }) }));
    p.push(S(G.disc(10.4, 11.6, 3.6, F, P), { tone: "hi", className: `rs-post rs-${kind}` }));
    p.push(L(G.circleOf(F, 11.6, 1.4, P), { tone: "lo" }));
    return { at: [x, SIDE_Y], svg: p.join("") };
  });
  out.push(farFirst(posts));
  return out.join("");
}

// ── the resistor ───────────────────────────────────────────────────────────────
// A carbon-film resistor, much larger than life: a body with two swollen end caps, two wire leads
// and four colour bands. The body's surface is one analytic curve, so it shades smoothly.
const LEN = W.BODY.y1 - W.BODY.y0;
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function bodyRadius(s) {
  const cap = W.BODY.r, waist = W.BODY.r - 0.85;
  const bulge = (d) => 1 - smoothstep(4, 11.5, d);
  const core = waist + (cap - waist) * Math.max(bulge(s), bulge(LEN - s));
  const e = Math.max(0, Math.min(s, LEN - s));
  const round = e >= 2.2 ? 1 : 0.6 + 0.4 * Math.sqrt(Math.max(0, 1 - ((2.2 - e) / 2.2) ** 2));
  return core * round;
}
const bodySlope = (s) => (bodyRadius(Math.min(LEN, s + 0.02)) - bodyRadius(Math.max(0, s - 0.02))) / (Math.min(LEN, s + 0.02) - Math.max(0, s - 0.02));
const FR = G.frameOf([W.RX, W.BODY.y0, W.RZ], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
export const BAND_AT = [[40.5, 44], [33.6, 37.1], [26.7, 30.2], [7, 10.5]]; // first band nearest the viewer's left

function clipStand(c, part) {
  const { RX, TRACE_H, STAND_TOP, RZ, LEAD_R } = W;
  const base = { x: RX - 7, y: c - 4.5, w: 14, d: 9, r: 1.6 };
  const out = [];
  if (part === "back") {
    out.push(`<path class="iso-halo" d="${k.haloOf(base, TRACE_H, 4, P)}" style="filter:blur(2px)"/>`);
    out.push(S(k.slabOf(base, TRACE_H, 4, P, 3, 0.5), { tone: "mid" }));
    out.push(L([-5, 5].map((dx) => k.ring(RX + dx, c, 1.3, TRACE_H + 4, P, 12)).join(""), { tone: "lo" }));
    out.push(D([-5, 5].map((dx) => at([RX + dx, c, TRACE_H + 4])), { size: 0.42 }));
    out.push(S(k.slabOf({ x: RX - 1.6, y: c - 1.6, w: 3.2, d: 3.2, r: 0.6 }, TRACE_H + 4, STAND_TOP - TRACE_H - 4, P, 2, 0.3), { tone: "mid" }));
    out.push(S(k.slabOf({ x: RX - LEAD_R - 1.1, y: c - 1.9, w: 2 * LEAD_R + 2.2, d: 3.8, r: 0.5 }, STAND_TOP, 1.0, P, 2), { tone: "hi" }));
    out.push(S(k.slabOf({ x: RX - LEAD_R - 1.1, y: c - 1.9, w: 1.1, d: 3.8, r: 0.3 }, STAND_TOP + 1, RZ + 3.2 - STAND_TOP - 1, P, 2), { tone: "hi" }));
  } else {
    out.push(S(k.slabOf({ x: RX + LEAD_R, y: c - 1.9, w: 1.1, d: 3.8, r: 0.3 }, STAND_TOP + 1, RZ + 3.2 - STAND_TOP - 1, P, 2), { tone: "hi" }));
  }
  return out.join("");
}
function lead(y0, y1) {
  const F = G.frameOf([W.RX, y0, W.RZ], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
  return S(G.disc(0, y1 - y0, W.LEAD_R, F, P, { rims: "none" }), { tone: "hi" });
}
function resistorBody() {
  const knots = Array.from({ length: 61 }, (_, n) => {
    const s = (LEN * n) / 60;
    return [s, bodyRadius(s), 1];
  });
  knots[0] = [0, bodyRadius(0)];
  knots[60] = [LEN, bodyRadius(LEN)];
  const out = [];
  out.push(S(G.solidOf(knots, FR, P, { smooth: { slope: bodySlope } }), { tone: "hi", className: "rs-body" }));
  BAND_AT.forEach(([a, b], index) => {
    const lift = 0.14;
    const radius = (s) => bodyRadius(s) + lift;
    const band = G.bandOfProfile([[a, radius(a)], [b, radius(b)]], FR, P, { smooth: { slope: bodySlope, radius }, fill: "facets", rims: "none" });
    const seams = [a, b].map((s) => G.arcOf(FR, s, radius(s), P, { slope: bodySlope(s) })).join("");
    out.push(`<g class="rs-band" data-band="${index}">${S(band, { tone: "lo", crease: "none", inner: L(seams, { tone: "mid", className: "rs-seam" }) })}</g>`);
  });
  return out.join("");
}

// ── the LED ────────────────────────────────────────────────────────────────────
const LENS_H = W.LED_BODY_TOP - (W.LED_Z0 + W.LED_RIM.h);
const FL = G.frameOf([W.LEDP.x, W.LEDP.y, W.LED_Z0 + W.LED_RIM.h], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const lensRadius = (s) => (s <= LENS_H ? W.LEDP.r : Math.sqrt(Math.max(0, W.LEDP.r ** 2 - (s - LENS_H) ** 2)));
const lensSlope = (s) => (s <= LENS_H ? 0 : -(s - LENS_H) / Math.max(0.35, lensRadius(s)));
function socket() {
  const { SOCKET, TRACE_H, LEG_Y, LEDP } = W;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(SOCKET, 0, SOCKET.h, P)}" style="filter:blur(2px)"/>`);
  out.push(S(k.slabOf(SOCKET, 0, SOCKET.h, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(SOCKET, 2.4, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(SOCKET, 2), SOCKET.h, P, 3), { tone: "faint" }));
  // the two sprung holes the legs go into
  out.push(L(LEG_Y.map((y) => k.ring(LEDP.x, y, 2, SOCKET.h, P, 16)).join(""), { tone: "lo" }));
  out.push(`<g class="rs-hole">${LEG_Y.map((y) => `<path d="${k.planOutline({ x: LEDP.x - 1.1, y: y - 1.1, w: 2.2, d: 2.2, r: 1.1 }, SOCKET.h, P, 6)}"/>`).join("")}</g>`);
  // a printed + beside the anode
  const px = LEDP.x + 6.5, py = LEG_Y[0];
  out.push(L(k.lineOnTop([px - 1.5, py], [px + 1.5, py], SOCKET.h, P) + k.lineOnTop([px, py - 1.5], [px, py + 1.5], SOCKET.h, P), { tone: "mid", free: true }));
  out.push(D(k.corners(SOCKET, 2.6).map(([x, y]) => at([x, y, SOCKET.h])), { size: 0.4 }));
  return out.join("");
}
function legs() {
  const { LEG_Y, LEDP, SOCKET, LED_Z0 } = W;
  return LEG_Y.map((y) => S(k.cylinder(LEDP.x, y, 0.8, SOCKET.h, LED_Z0 - SOCKET.h, P, 14), { tone: "hi" })).join("");
}
function ledLens() {
  const { LEDP, LED_Z0, LED_RIM, LEG_Y } = W;
  const out = [];
  // the rim, with the flat that marks the cathode side
  const flatAt = LEDP.y + LED_RIM.r - 1.4;
  const ring = k.circleRing(LEDP.x, LEDP.y, LED_RIM.r, 64).map(([x, y]) => [x, Math.min(y, flatAt)]);
  out.push(`<g class="rs-lensgroup">${S(k.extrude(ring, LED_Z0, LED_RIM.h, P), { tone: "hi", className: "rs-rim" })}</g>`);
  // the lens: a straight body and a dome, one surface
  const knots = [[0, LEDP.r], [LENS_H, LEDP.r, 1]];
  for (let n = 1; n <= 12; n++) {
    const a = (n / 12) * (Math.PI / 2);
    knots.push([LENS_H + LEDP.r * Math.sin(a), LEDP.r * Math.cos(a), n < 12 ? 1 : 0]);
  }
  out.push(`<g class="rs-lensgroup">${S(G.solidOf(knots, FL, P, { smooth: { slope: lensSlope } }), { tone: "hi", className: "rs-lens" })}</g>`);
  // the lead frame inside: the post (anode) and the anvil with its cup (cathode), seen through the lens
  const zb = LED_Z0 + LED_RIM.h, zt = zb + 6.2;
  const post = [[LEDP.x, LEG_Y[0] + 1, zb], [LEDP.x, LEG_Y[0] + 1, zt + 0.6]];
  const anvil = [[LEDP.x, LEG_Y[1] - 1, zb], [LEDP.x, LEG_Y[1] - 1, zt - 0.8], [LEDP.x, LEG_Y[1] - 3.8, zt - 0.8], [LEDP.x, LEG_Y[1] - 4.4, zt + 0.6]];
  out.push(`<g class="rs-inner">${L(k.pathOf(post.map(at)), { tone: "mid" })}${L(k.pathOf(anvil.map(at)), { tone: "mid" })}${L(k.pathOf([at([LEDP.x, LEG_Y[0] + 1, zt + 0.6]), at([LEDP.x, 70.4, zt + 2.6]), at([LEDP.x, LEG_Y[1] - 4.4, zt])]), { tone: "lo" })}${D([post[0], anvil[0]].map(at), { size: 0.55 })}</g>`);
  out.push(`<circle class="rs-chip" data-part="chip" cx="${fr(at([LEDP.x, LEG_Y[1] - 4.4, zt + 0.2])[0])}" cy="${fr(at([LEDP.x, LEG_Y[1] - 4.4, zt + 0.2])[1])}" r="1.1"/>`);
  return out.join("");
}


// ── a tray of spare LEDs, lying on their sides ─────────────────────────────────
const TRAY = { x: -12, y: -66, w: 46, d: 46, r: 3 };
const SPARE_X = [-1, 21];
function spares() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(TRAY, 0, 4, P)}" style="filter:blur(2px)"/>`);
  out.push(S(k.slabOf(TRAY, 0, 4, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(TRAY, 2.2), 4, P, 4), { tone: "lo" }));
  out.push(L(k.lineOnTop([TRAY.x + TRAY.w / 2, TRAY.y + 2.2], [TRAY.x + TRAY.w / 2, TRAY.y + TRAY.d - 2.2], 4, P), { tone: "faint" }));
  out.push(D(k.corners(TRAY, 1.1).map(([x, y]) => at([x, y, 4])), { size: 0.38 }));
  const z = 4 + W.LED_RIM.r;
  const y0 = TRAY.y + 20; // where the rim starts; the legs run back from here
  const items = SPARE_X.map((x, index) => {
    const F = G.frameOf([x, y0, z], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
    const parts = [];
    for (const dz of [-2.5, 2.5]) {
      const FL2 = G.frameOf([x, TRAY.y + 5, z + dz], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
      parts.push(S(G.disc(0, y0 - TRAY.y - 5, 0.8, FL2, P), { tone: "hi" }));
    }
    const flat = W.LED_RIM.r - 1.4;
    const rim = G.prismOf(F, Array.from({ length: 64 }, (_, n) => { const a = (n / 64) * TAU; return [W.LED_RIM.r * Math.cos(a), Math.min(flat, W.LED_RIM.r * Math.sin(a))]; }), 0, W.LED_RIM.h, P);
    parts.push(S(rim, { tone: "hi", className: "rs-rim" }));
    const knots = [[W.LED_RIM.h, W.LEDP.r], [W.LED_RIM.h + LENS_H, W.LEDP.r, 1]];
    for (let n = 1; n <= 12; n++) { const a = (n / 12) * (Math.PI / 2); knots.push([W.LED_RIM.h + LENS_H + W.LEDP.r * Math.sin(a), W.LEDP.r * Math.cos(a), n < 12 ? 1 : 0]); }
    const slope = (s) => lensSlope(s - W.LED_RIM.h);
    parts.push(S(G.solidOf(knots, F, P, { smooth: { slope } }), { tone: "hi", className: "rs-lens" }));
    return { at: [x, y0, z], svg: `<g data-spare="${index}" style="--g:0">${parts.join("")}</g>` };
  });
  out.push(farFirst(items));
  return out.join("");
}

// ── the ammeter ────────────────────────────────────────────────────────────────
function ammeter() {
  const { AM, AM_H, AM_FACE_X, DIAL, DIAL_SWEEP, FULL_SCALE } = W;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(AM, 0, AM_H, P)}" style="filter:blur(3px)"/>`);
  out.push(farFirst(k.corners(AM, 5).map(([x, y]) => ({ at: [x, y], svg: S(k.cylinder(x, y, 3, 0, 1.6, P, 16), { tone: "lo" }) }))));
  out.push(S(k.slabOf(AM, 1.6, AM_H - 1.6, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(AM, AM_H - 5, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(AM, 3), AM_H, P, 4), { tone: "faint" }));
  out.push(D(k.corners(AM, 5).map(([x, y]) => at([x, y, AM_H])), { size: 0.45 }));
  const f = [];
  const [w0, z0, w1, z1] = DIAL.window;
  f.push(faceLine(fRect(3, 3.5, AM.d - 3, AM_H - 7, 2), "faint"));
  f.push(screwRing([[6.5, 7], [AM.d - 6.5, 7], [6.5, AM_H - 10.5], [AM.d - 6.5, AM_H - 10.5]], 1.5));
  f.push(faceLine(fRect(w0 - 1.8, z0 - 1.8, w1 + 1.8, z1 + 1.8, 2.4), "lo"));
  f.push(`<path class="rs-glass" d="${fRect(w0, z0, w1, z1, 1.6)}"/>`);
  f.push(faceLine(fRect(w0, z0, w1, z1, 1.6), "lo"));
  // the scale: 0 to 50 mA, a tick every 2 mA, a long one every 10
  const angleOf = (mA) => -DIAL_SWEEP + (2 * DIAL_SWEEP * mA) / (FULL_SCALE * 1000);
  const R = DIAL.r;
  const minor = [], major = [];
  for (let mA = 0; mA <= 50; mA += 2) {
    const big = mA % 10 === 0;
    const a = (angleOf(mA) * Math.PI) / 180;
    const r1 = R + (big ? 3 : 1.7);
    (big ? major : minor).push(`M${fr(DIAL.u + R * Math.sin(a))} ${fr(-DIAL.z - R * Math.cos(a))}L${fr(DIAL.u + r1 * Math.sin(a))} ${fr(-DIAL.z - r1 * Math.cos(a))}`);
  }
  f.push(faceLine(fArc(DIAL.u, DIAL.z, R, -DIAL_SWEEP, DIAL_SWEEP, 48), "mid"));
  f.push(faceLine(fArc(DIAL.u, DIAL.z, R + 3, -DIAL_SWEEP, DIAL_SWEEP, 48), "faint"));
  f.push(faceLine(minor.join(""), "lo"), faceLine(major.join(""), "mid"));
  // the good zone and the danger zone, as bands just inside the scale
  f.push(`<path class="rs-zone rs-good" d="${fArc(DIAL.u, DIAL.z, R - 1.4, angleOf(5), angleOf(30), 24)}"/>`);
  f.push(`<path class="rs-zone rs-bad" d="${fArc(DIAL.u, DIAL.z, R - 1.4, angleOf(30), angleOf(50), 24)}"/>`);
  f.push(`<text class="iso-face-text" data-tone="mid" x="${DIAL.u}" y="${-(DIAL.z + 6.2)}" font-size="3.6" text-anchor="middle">mA</text>`);
  f.push(`<g data-slot="needle"></g>`);
  // the zero-adjust screw under the window
  f.push(faceLine(fCircle(DIAL.u, 6.6, 2), "lo"), faceLine(`M${DIAL.u - 1.4} -6.6H${DIAL.u + 1.4}`, "mid"));
  out.push(`<g transform="${meterAt(AM_FACE_X)}">${f.join("")}</g>`);
  return out.join("");
}

// ── assembly ───────────────────────────────────────────────────────────────────
const LABEL =
  "A bench with a power supply, one resistor and one red LED wired in a loop by copper strips, with a current meter at the front. Dots on the strips show the current flowing from the supply's red post, through the resistor and the LED, and back to the black post. A tray beside it holds two spare LEDs. The resistor's colour bands show its value, the LED glows brighter as more current flows, and the meter's needle reads the current.";

const slot = (name) => `<g data-slot="${name}"></g>`;
const layer = (name) => `<g data-layer="${name}"></g>`;
const defs = `<defs>
<radialGradient id="rs-glow"><stop offset="0" stop-color="var(--rs-glow-core)" stop-opacity="1"/><stop offset=".22" stop-color="var(--rs-glow)" stop-opacity=".75"/><stop offset=".55" stop-color="var(--rs-glow)" stop-opacity=".18"/><stop offset="1" stop-color="var(--rs-glow)" stop-opacity="0"/></radialGradient>
<radialGradient id="rs-pool"><stop offset="0" stop-color="var(--rs-glow)" stop-opacity=".55"/><stop offset=".45" stop-color="var(--rs-glow)" stop-opacity=".18"/><stop offset="1" stop-color="var(--rs-glow)" stop-opacity="0"/></radialGradient>
</defs>`;
const pool = `<g data-slot="pool" transform="${k.topMatrix([W.LEDP.x, W.LEDP.y], W.TRACE_H + 0.1, P)}" opacity="0"><circle r="58" fill="url(#rs-pool)"/></g>`;
const glowAt = at([W.LEDP.x, W.LEDP.y, W.LED_BODY_TOP + 1]);
const glow = `<g data-slot="glow" opacity="0"><circle cx="${fr(glowAt[0])}" cy="${fr(glowAt[1])}" r="${fr(30 * P.scale)}" fill="url(#rs-glow)"/></g>`;

const body = [
  defs,
  board(),
  supply(),
  layer("supply"),
  traces(),
  pool,
  layer("board"),
  clipStand(W.CLIPS[0], "back"),
  lead(W.CLIPS[0], W.BODY.y0 + 1),
  layer("leadR"),
  clipStand(W.CLIPS[0], "front"),
  resistorBody(),
  slot("heat"),
  clipStand(W.CLIPS[1], "back"),
  lead(W.BODY.y1 - 1, W.CLIPS[1]),
  layer("leadL"),
  clipStand(W.CLIPS[1], "front"),
  spares(),
  socket(),
  legs(),
  layer("legs"),
  `<g data-part="led">${ledLens()}</g>`,
  glow,
  slot("smoke"),
  ammeter(),
];

const svg = k.figureSvg({ width: W.WIDTH, height: W.HEIGHT, label: LABEL, body });

// ── the page ───────────────────────────────────────────────────────────────────
const stripExports = (text) => text.replace(/^export /gm, "");
const live = readFileSync(join(HERE, "live.js"), "utf8");
const DATA = `const P = ${JSON.stringify(P)};
const FACE = ${JSON.stringify({ meter: meterAt(W.AM_FACE_X) })};
`;

const page = k.plateHtml({
  fig: "Fig 1",
  title: "A resistor and an LED",
  hint: "Turn the blue knob, press the blue switch",
  readout: "",
  keys: [
    { mark: "lit", label: "Moving dots: the electric current" },
    { mark: "red", label: "LED light: brighter with more current" },
    { mark: "blue", label: "Blue parts: you can turn or press them" },
  ],
  caption:
    "The supply pushes electricity around one loop: out of the red post, through the resistor, through the LED, through the meter and back into the black post. The same current flows everywhere in the loop, so the dots all move at the same speed. A bigger resistance lets less current through, and the LED gets dimmer. The two LEDs lying in the tray are spares, waiting in case the one in the socket burns out.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Circuit bench. Use the controls to change the supply voltage and the resistor.">${svg}</div>`,
});

const extraCss = `
.rs-screen{fill:var(--rs-screen);stroke:none}
.rs-glass{fill:var(--anatomy-face);stroke:none}
.rs-hole path{fill:var(--rs-screen);stroke:none}
.rs-lcd{fill:var(--rs-lcd);font-family:var(--anatomy-mono);font-weight:600;letter-spacing:.02em}
.rs-lcd-small{fill:var(--anatomy-mid);font-family:var(--anatomy-mono)}
.rs-hub{fill:var(--anatomy-hi);stroke:var(--anatomy-paper);stroke-width:.5px;paint-order:stroke}
.rs-zone{fill:none;stroke-width:1.5px;stroke-linecap:butt}
.rs-good{stroke:var(--rs-green)}.rs-bad{stroke:var(--rs-red)}
.rs-dot{fill:var(--anatomy-lit);stroke:var(--anatomy-paper);stroke-width:.6px;paint-order:stroke}
[data-grab]{cursor:grab;touch-action:none}
[data-grab=power]{cursor:pointer}
[data-grab]:active{cursor:grabbing}
/* the poles of the supply: red for +, dark for - */
svg .iso-solid.rs-plus.rs-plus>.iso-fill,svg .iso-solid.rs-plus.rs-plus>.iso-top{fill:var(--rs-red)}
svg .iso-solid.rs-plus.rs-plus>.iso-shade{fill:color-mix(in oklab,var(--rs-red),#000 calc(var(--k,1) * 14%))}
svg .iso-solid.rs-plus.rs-plus>.iso-shade[data-shade="0"]{--k:0}svg .iso-solid.rs-plus.rs-plus>.iso-shade[data-shade="1"]{--k:1}svg .iso-solid.rs-plus.rs-plus>.iso-shade[data-shade="2"]{--k:2}svg .iso-solid.rs-plus.rs-plus>.iso-shade[data-shade="3"]{--k:3}
svg .iso-solid.rs-minus.rs-minus>.iso-fill,svg .iso-solid.rs-minus.rs-minus>.iso-top{fill:var(--rs-black)}
svg .iso-solid.rs-minus.rs-minus>.iso-shade{fill:color-mix(in oklab,var(--rs-black),#000 calc(var(--k,1) * 10%))}
svg .iso-solid.rs-minus.rs-minus>.iso-shade[data-shade="0"]{--k:0}svg .iso-solid.rs-minus.rs-minus>.iso-shade[data-shade="1"]{--k:1}svg .iso-solid.rs-minus.rs-minus>.iso-shade[data-shade="2"]{--k:2}svg .iso-solid.rs-minus.rs-minus>.iso-shade[data-shade="3"]{--k:3}
/* the resistor body: the beige of a carbon-film resistor */
svg .iso-solid.rs-body.rs-body>.iso-fill,svg .iso-solid.rs-body.rs-body>.iso-top{fill:var(--rs-beige)}
svg .iso-solid.rs-body.rs-body>.iso-shade{fill:color-mix(in oklab,var(--rs-beige),#000 calc(var(--k,1) * 6%));stroke:color-mix(in oklab,var(--rs-beige),#000 calc(var(--k,1) * 6%))}
svg .iso-solid.rs-body.rs-body>.iso-shade[data-shade="0"]{--k:0}svg .iso-solid.rs-body.rs-body>.iso-shade[data-shade="1"]{--k:1}svg .iso-solid.rs-body.rs-body>.iso-shade[data-shade="2"]{--k:2}svg .iso-solid.rs-body.rs-body>.iso-shade[data-shade="3"]{--k:3}
svg .iso-solid.rs-body.rs-body>.iso-top{stroke:var(--rs-beige)}
/* the colour bands */
svg .rs-band .iso-solid.iso-solid>.iso-fill,svg .rs-band .iso-solid.iso-solid>.iso-top{fill:var(--c,#888);stroke:var(--c,#888)}
svg .rs-band .iso-solid.iso-solid>.iso-shade{fill:color-mix(in oklab,var(--c,#888),#000 calc(var(--k,1) * 11%));stroke:color-mix(in oklab,var(--c,#888),#000 calc(var(--k,1) * 11%))}
svg .rs-band .iso-solid.iso-solid>.iso-shade[data-shade="0"]{--k:0}svg .rs-band .iso-solid.iso-solid>.iso-shade[data-shade="1"]{--k:1}svg .rs-band .iso-solid.iso-solid>.iso-shade[data-shade="2"]{--k:2}svg .rs-band .iso-solid.iso-solid>.iso-shade[data-shade="3"]{--k:3}
.rs-band .rs-seam{stroke:color-mix(in oklab,var(--c,#888),#000 30%)}
/* the LED: deep red when dark, bright when lit (--g from 0 to 1), smoke-brown when burned */
[data-part=led]{--g:0}
svg .iso-solid.rs-lens.rs-lens>.iso-fill,svg .iso-solid.rs-lens.rs-lens>.iso-top,svg .iso-solid.rs-lens.rs-lens>.iso-shade{--base:color-mix(in oklab,var(--rs-led-on) calc(var(--g) * 100%),var(--rs-led-off));fill:color-mix(in oklab,var(--base),#000 calc(var(--k,0) * (1 - var(--g)) * 9%));stroke:color-mix(in oklab,var(--base),#000 calc(var(--k,0) * (1 - var(--g)) * 9%));}
svg .iso-solid.rs-lens.rs-lens>.iso-top{fill:color-mix(in oklab,var(--base),#fff 18%)}
svg .iso-solid.rs-lens.rs-lens>.iso-shade[data-shade="1"]{--k:1}svg .iso-solid.rs-lens.rs-lens>.iso-shade[data-shade="2"]{--k:2}svg .iso-solid.rs-lens.rs-lens>.iso-shade[data-shade="3"]{--k:3}
svg .iso-solid.rs-lens.rs-lens>.iso-edge{stroke:color-mix(in oklab,var(--rs-led-edge),var(--rs-led-on) calc(var(--g) * 60%))}
svg .iso-solid.rs-rim.rs-rim>.iso-fill,svg .iso-solid.rs-rim.rs-rim>.iso-top{fill:color-mix(in oklab,var(--rs-led-on) calc(var(--g) * 70%),var(--rs-led-off))}
svg .iso-solid.rs-rim.rs-rim>.iso-shade{fill:color-mix(in oklab,color-mix(in oklab,var(--rs-led-on) calc(var(--g) * 70%),var(--rs-led-off)),#000 18%)}
svg .iso-solid.rs-rim.rs-rim>.iso-edge,svg .iso-solid.rs-lens.rs-lens>.iso-edge{stroke-width:var(--anatomy-weight)}
.rs-inner .iso-line{stroke:color-mix(in oklab,var(--rs-led-edge),var(--rs-glow-core) calc(var(--g) * 70%))}
.rs-inner .iso-dots circle{fill:var(--rs-led-edge)}
.rs-chip{fill:color-mix(in oklab,var(--rs-glow-core) calc(var(--g) * 100%),var(--rs-led-edge))}
[data-part=led][data-burned] .iso-solid.rs-lens.rs-lens>*:not(.iso-edge),[data-part=led][data-burned] .iso-solid.rs-rim.rs-rim>*:not(.iso-edge){fill:var(--rs-burnt);stroke:var(--rs-burnt)}
[data-part=led][data-burned] .rs-chip{fill:#000}
[data-slot=glow]{mix-blend-mode:var(--rs-blend);pointer-events:none}
[data-slot=pool]{mix-blend-mode:var(--rs-blend);pointer-events:none}
[data-spare][data-used]{opacity:0;transition:opacity .4s}
/* parts you can touch: one colour, brighter under the pointer, a soft pulsing glow until the first touch */
svg .iso-solid.rs-touch.rs-touch>.iso-fill,svg .iso-solid.rs-touch.rs-touch>.iso-top{fill:var(--rs-touch)}
svg .iso-solid.rs-touch.rs-touch>.iso-shade{fill:color-mix(in oklab,var(--rs-touch),#000 calc(var(--k,1) * 9%));stroke:color-mix(in oklab,var(--rs-touch),#000 calc(var(--k,1) * 9%))}
svg .iso-solid.rs-touch.rs-touch>.iso-shade[data-shade="0"]{--k:0}svg .iso-solid.rs-touch.rs-touch>.iso-shade[data-shade="1"]{--k:1}svg .iso-solid.rs-touch.rs-touch>.iso-shade[data-shade="2"]{--k:2}svg .iso-solid.rs-touch.rs-touch>.iso-shade[data-shade="3"]{--k:3}
.iso-solid.rs-touch>.iso-edge{stroke:color-mix(in oklab,var(--anatomy-blue),var(--anatomy-hi) 30%)}
[data-grab]:hover .rs-touch,[data-grab]:active .rs-touch{--rs-touch:color-mix(in oklab,var(--anatomy-blue),#fff 22%)}
.rs-pulse{fill:var(--anatomy-blue);stroke:none;filter:blur(1.6px);opacity:.35;pointer-events:none;animation:rs-pulse 2.2s ease-in-out infinite}
@keyframes rs-pulse{0%,100%{opacity:.12}50%{opacity:.55}}
svg[data-touched] .rs-pulse{animation:none;opacity:.14}
@media (prefers-reduced-motion:reduce){.rs-pulse{animation:none;opacity:.3}}
.iso-swatch[data-mark="blue"] path{stroke:var(--anatomy-blue)}
.rs-smoke{fill:var(--anatomy-mid);pointer-events:none}
[data-part=lamp][data-on] .iso-solid>.iso-fill,[data-part=lamp][data-on] .iso-solid>.iso-shade,[data-part=lamp][data-on] .iso-solid>.iso-top{fill:var(--rs-green)}
.iso[data-theme="dark"]{--rs-touch:color-mix(in oklab,var(--anatomy-blue),#000 18%);--rs-screen:#060606;--rs-lcd:#e9e9e9;--rs-red:#d8382c;--rs-black:#2a2a2a;--rs-green:#3fae5a;--rs-beige:#8a7656;--rs-led-off:#5a1c16;--rs-led-on:#ff4a34;--rs-led-edge:#a8463c;--rs-glow:#ff3a22;--rs-glow-core:#fff1e6;--rs-blend:screen;--rs-burnt:#2b241f;--rs-lens-alpha:.94}
.iso[data-theme="light"]{--rs-touch:color-mix(in oklab,var(--anatomy-blue),#fff 12%);--rs-screen:#f2f2f0;--rs-lcd:#1d1d1f;--rs-red:#d8382c;--rs-black:#3a3a3e;--rs-green:#2f9b48;--rs-beige:#e6d4ae;--rs-led-off:#a2302a;--rs-led-on:#ff5038;--rs-led-edge:#6e1b16;--rs-glow:#ff4a2e;--rs-glow-core:#fff6ec;--rs-blend:normal;--rs-burnt:#4a403a;--rs-lens-alpha:.92}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
@media (max-width:640px){.iso-plate{padding-left:0;padding-right:0}}
${PANEL_CSS}
`;

const html = k
  .pageHtml({
    title: "How a resistor works",
    theme,
    width: 1240,
    body: panelHtml(M, page),
    script: kitScript() + "\n" + stripExports(readFileSync(join(HERE, "world.mjs"), "utf8")) + "\n" + stripExports(readFileSync(join(HERE, "model.mjs"), "utf8")) + "\n" + DATA + live,
  })
  .replace("</style>", extraCss + "</style>");

writeFileSync(join(HERE, OUT), html);
console.log("wrote", OUT, (html.length / 1024).toFixed(0) + " KB");
