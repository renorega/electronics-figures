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
const OUT = theme === "light" ? "capacitor-light.html" : "capacitor.html";

// ── camera ─────────────────────────────────────────────────────────────────────
const P = k.fitProjection(
  [
    ...k.boxCorners(W.PLATE, -W.PLATE_H - W.FOOT_H, 0),
    ...k.boxCorners(W.BACK, 0, W.BACK_H),
    [W.LEDS[0].at[0], W.LEDS[0].at[1], W.ledTop + 6],
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

// Everything the reader can click or drag: a group that carries the grab, with a tooltip.
const grab = (name, title, inner) => `<g data-grab="${name}"><title>${title}</title>${inner}</g>`;
// A double arrow printed flat on a surface at height z, showing which way a part slides.
function dragArrow(a, b, z) {
  const d = [b[0] - a[0], b[1] - a[1]], n = Math.hypot(d[0], d[1]);
  const u = [d[0] / n, d[1] / n], v = [-u[1], u[0]];
  const head = (p, s) => k.onTop([[p[0] - s * u[0] * 1.8 + v[0] * 1.3, p[1] - s * u[1] * 1.8 + v[1] * 1.3], p, [p[0] - s * u[0] * 1.8 - v[0] * 1.3, p[1] - s * u[1] * 1.8 - v[1] * 1.3]], z, P);
  return `<path class="iso-line cap-arrow" data-free="" d="${k.lineOnTop(a, b, z, P) + head(b, 1) + head(a, -1)}"/>`;
}

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
  sc.push(`<path class="cap-screen" d="${fRect(SCOPE.u0, SCOPE.z0, SCOPE.u1, SCOPE.z1, 2)}"/>`);
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
    m.push(`<path class="cap-glass" d="${fCircle(u, z, 21.5)}"/>`);
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
    // the ammeter's two halves carry the colour of the LED that lights on that side
    if (!index) {
      const band = (from, to) => Array.from({ length: 17 }, (_, n) => {
        const a = from + ((to - from) * n) / 16;
        return `${n ? "L" : "M"}${fr(px + 16.6 * Math.sin(a))} ${fr(-pz - 16.6 * Math.cos(a))}`;
      }).join("");
      m.push(`<path class="cap-band" data-led="green" d="${band(0.06, sweep)}"/><path class="cap-band" data-led="red" d="${band(-sweep, -0.06)}"/>`);
    }
    m.push(`<text class="iso-face-text" data-tone="mid" x="${u}" y="${-(z - 17.2)}" font-size="4.2" text-anchor="middle">${index ? "V" : "mA"}</text>`);
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
  out.push(S(k.cylinder(x, y, r, z + 1, h, P, 36, 0.4), { tone: "hi", className: "cap-grip" }));
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
  out.push(`<path class="cap-screen" d="${k.planOutline(k.insetPlan(D0, 1.2), SUP_TOP + 0.6, P, 3)}"/>`);
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
  controls.push({ at: W.KNOB_V.at, svg: grab("V", "Voltage knob: drag up or down", knobSvg(W.KNOB_V, SUP_TOP, 13) + `<g data-slot="pointerV"></g>`) });
  controls.push({ at: W.KNOB_F.at, svg: grab("F", "Flips per second: drag up or down", knobSvg(W.KNOB_F, SUP_TOP, 3) + `<g data-slot="pointerF"></g>`) });
  // the output fuse: a bayonet holder with a slotted cap
  const [fx0, fy0] = W.FUSE.at;
  controls.push({
    at: W.FUSE.at,
    svg:
      S(k.cylinder(fx0, fy0, W.FUSE.r + 1.4, SUP_TOP, 1, P, 28), { tone: "lo" }) +
      S(k.cylinder(fx0, fy0, W.FUSE.r, SUP_TOP + 1, 3.6, P, 28, 0.3), { tone: "mid" }) +
      L(k.knurl(fx0, fy0, W.FUSE.r, SUP_TOP + 1, SUP_TOP + 4.6, 16, P), { tone: "lo" }) +
      L(k.lineOnTop([fx0 - W.FUSE.r + 0.9, fy0], [fx0 + W.FUSE.r - 0.9, fy0], SUP_TOP + 4.6, P), { tone: "hi" }),
  });
  for (const b of W.BUTTONS) {
    const [x, y] = b.at;
    const plan = { x: x - 3.6, y: y - 3.6, w: 7.2, d: 7.2, r: 1.2 };
    const icon = {
      dc: k.lineOnTop([x - 0.2, y - 2], [x - 0.2, y + 2], SUP_TOP + 2.6, P),
      pulse: k.onTop([[x - 1.5, y - 2.1], [x - 1.5, y - 0.7], [x + 1.5, y - 0.7], [x + 1.5, y + 0.7], [x - 1.5, y + 0.7], [x - 1.5, y + 2.1]], SUP_TOP + 2.6, P),
      ac: k.onTop(Array.from({ length: 13 }, (_, n) => [x - 1.8 * Math.sin((n / 12) * TAU), y - 2.2 + (4.4 * n) / 12]), SUP_TOP + 2.6, P),
    }[b.mode];
    controls.push({
      at: b.at,
      svg: `<g data-part="btn-${b.mode}" data-grab="mode-${b.mode}"><title>${{ dc: "Battery", pulse: "Auto flip", ac: "AC" }[b.mode]}: click</title>${S(k.slabOf({ ...plan, x: plan.x - 0.8, y: plan.y - 0.8, w: 9, d: 9, r: 1.6 }, SUP_TOP, 0.6, P, 3), { tone: "lo", crease: "none" })}<g data-key>${S(k.slabOf(plan, SUP_TOP + 0.6, 2, P, 3, 0.3), { tone: "mid", className: "cap-grip" })}${L(icon, { tone: "hi", free: true, className: "cap-icon" })}</g></g>`,
    });
  }
  const [tx, ty] = W.TOGGLE.at;
  controls.push({
    at: W.TOGGLE.at,
    svg: grab(
      "switch",
      "Fill / Empty switch: click to flip",
      S(k.cylinder(tx, ty, 4.2, SUP_TOP, 1.2, P, 6), { tone: "lo" }) + S(k.cylinder(tx, ty, 2.6, SUP_TOP + 1.2, 1.6, P, 18), { tone: "mid" }) + `<g data-slot="toggle"></g>`,
    ),
  });
  // printed beside the lever: + where it fills (toward the viewer), a ring where it empties
  out.push(L(k.lineOnTop([tx + 7.4, ty - 1.4], [tx + 7.4, ty + 1.4], SUP_TOP, P) + k.lineOnTop([tx + 6, ty], [tx + 8.8, ty], SUP_TOP, P), { tone: "mid", free: true }));
  out.push(L(k.ring(tx - 7.4, ty, 1.2, SUP_TOP, P, 16), { tone: "mid" }));
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
  out.push(S(k.cylinder(knob[0], knob[1], 3.2, RAIL_TOP + 8, 5, P, 24, 0.3), { tone: "hi", className: "cap-grip" }));
  out.push(L(k.knurl(knob[0], knob[1], 3.2, RAIL_TOP + 8, RAIL_TOP + 13, 16, P), { tone: "lo" }));
  // which way it slides: a double arrow printed on the winding bar beside the contact
  out.push(dragArrow([W.BAR.x + 5, y - 7.5], [W.BAR.x + 5, y + 7.5], W.BAR_H));
  out.push(L(k.lineOnTop([knob[0] - 3.2, knob[1]], [knob[0] + 3.2, knob[1]], RAIL_TOP + 13, P), { tone: "hi" }));
  return out.join("");
}

// ── the LED holder: a block, a small circuit board and two LEDs back to back ───
function holder() {
  const { HOLDER, HOLDER_H, PCB, PCB_TOP } = W;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(HOLDER, 0, HOLDER_H, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(HOLDER, 0, HOLDER_H, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(HOLDER, 2.2, P, 4), { tone: "faint" }) }));
  // the circuit board on four standoffs: thin, so it is a flat inlay with a real edge
  out.push(S(k.slabOf(PCB, HOLDER_H, PCB_TOP - HOLDER_H, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(PCB, 1.2), PCB_TOP, P, 3), { tone: "faint" }));
  const screws = k.corners(PCB, 2.6);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.3, PCB_TOP, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, PCB_TOP])), { size: 0.4 }));
  return out.join("");
}

// The copper on the board: the input pad feeds a bus at the back, the output bus runs along the front.
// Green's long leg (its + side) is on the input bus, red's on the output bus: back to back.
const LEG = 2.4; // half the spacing of an LED's two legs
const BUS_IN = W.LEDS[0].at[0] - 9.5, BUS_OUT = W.LEDS[0].at[0] + 9.5;
const PAD_IN = [W.PCB.x + W.PCB.w - 7, W.PCB.y + 4.4], PAD_OUT = [W.PCB.x + W.PCB.w - 7, W.PCB.y + W.PCB.d - 4.4];
function copper() {
  const z = W.PCB_TOP;
  const out = [];
  const [g, r] = W.LEDS.map((led) => led.at);
  const lines = [
    k.onTop([PAD_IN, [BUS_IN, PAD_IN[1]], [BUS_IN, r[1]]], z, P),
    k.lineOnTop([BUS_OUT, g[1]], [BUS_OUT, R2_AT[1] - 0.9], z, P),
    k.onTop([[BUS_OUT, R2_AT[1] + R2_LEN + 0.9], [BUS_OUT, PAD_OUT[1]], PAD_OUT], z, P),
    ...W.LEDS.flatMap(({ at: [x, y] }) => [k.lineOnTop([BUS_IN, y], [x - LEG, y], z, P), k.lineOnTop([x + LEG, y], [BUS_OUT, y], z, P)]),
  ];
  out.push(L(lines.join(""), { tone: "mid" }));
  // pads: a ring round each solder joint
  const pads = [PAD_IN, PAD_OUT];
  out.push(L(pads.map(([x, y]) => k.ring(x, y, 2.2, z, P, 18)).join(""), { tone: "mid" }));
  const joints = W.LEDS.flatMap(({ at: [x, y] }) => [[x - LEG, y], [x + LEG, y]]);
  out.push(L(joints.map(([x, y]) => k.ring(x, y, 1.2, z, P, 12)).join(""), { tone: "mid" }));
  out.push(D([...pads, [BUS_IN, PAD_IN[1]], [BUS_IN, r[1]], [BUS_OUT, g[1]], [BUS_OUT, PAD_OUT[1]], [BUS_OUT, R2_AT[1] - 0.9], [BUS_OUT, R2_AT[1] + R2_LEN + 0.9]].map(([x, y]) => at([x, y, z])), { size: 0.55, tone: "mid" }));
  // a diode symbol beside each LED, pointing the way its current goes
  const symbol = ([x, y], dir) => {
    const sx = W.PCB.x + W.PCB.w - 6.5, tip = y + dir * 1.8, base = y - dir * 1.8;
    return k.onTop([[sx - 1.8, base], [sx + 1.8, base], [sx, tip]], z, P, true) + k.lineOnTop([sx - 1.8, tip], [sx + 1.8, tip], z, P);
  };
  out.push(L(symbol(g, 1) + symbol(r, -1), { tone: "lo" }));
  return out.join("");
}

// One LED: two legs, a flange, a barrel and a dome turned from one profile, tinted its own colour.
function ledSvg({ name, at: [x, y] }) {
  const { LED_R, LED_RIM, LED_BODY, LED_DOME, PCB_TOP, ledZ0 } = W;
  const out = [];
  // the legs: the + leg is the longer one, bent at the board (here the front one for green)
  for (const dx of [-LEG, LEG]) out.push(S(k.slabOf({ x: x + dx - 0.45, y: y - 0.45, w: 0.9, d: 0.9, r: 0.2 }, PCB_TOP, ledZ0 - PCB_TOP + 0.2, P, 2), { tone: "hi", crease: "none" }));
  const F = G.frameAlong([x, y, ledZ0], [0, 0, 1]);
  const flange = G.disc(0, 1.2, LED_RIM, F, P);
  const profile = [[1.2, LED_R], [1.2 + LED_BODY, LED_R, 1]];
  for (let n = 1; n <= 12; n++) {
    const a = (n / 12) * (Math.PI / 2);
    profile.push([1.2 + LED_BODY + LED_DOME * Math.sin(a), LED_R * Math.cos(a), 1]);
  }
  const body = G.solidOf(profile, F, P);
  out.push(S(flange, { tone: "hi" }));
  out.push(`<path class="cap-tint" data-led="${name}" d="${flange.fill}"/>`);
  out.push(S(body, { tone: "hi" }));
  out.push(`<path class="cap-tint" data-led="${name}" d="${body.fill}"/>`);
  // inside the clear epoxy: the anvil that holds the chip, and the post
  const zA = ledZ0 + 1.2;
  out.push(`<g class="cap-frame">${L(k.segment([x - LEG, y, zA], [x - LEG, y, zA + 7], P) + k.segment([x + LEG, y, zA], [x + LEG, y, zA + 8], P) + k.segment([x - LEG, y, zA + 7], [x + 0.8, y, zA + 7], P), { tone: "mid", free: true })}</g>`);
  // what the page lights: the lit body, the chip, then the glow
  out.push(`<path class="cap-lit" data-led="${name}" d="${body.fill}" style="opacity:0"/>`);
  const chip = at([x, y, zA + 7.6]);
  out.push(`<circle class="cap-die" data-led="${name}" cx="${fr(chip[0])}" cy="${fr(chip[1])}" r="${fr(1.6 * P.scale)}" style="opacity:0"/>`);
  return out.join("");
}
// The LED board's own 470 Ω resistor: an axial body on two bent legs, on the output bus.
const R2_AT = [BUS_OUT, 51.6], R2_LEN = 5.6;
function resistor() {
  const [x, y0] = R2_AT, z = W.PCB_TOP + 2;
  const out = [];
  for (const y of [y0 - 0.9, y0 + R2_LEN + 0.9]) out.push(S(k.slabOf({ x: x - 0.35, y: y - 0.35, w: 0.7, d: 0.7, r: 0.2 }, W.PCB_TOP, z - W.PCB_TOP, P, 2), { tone: "hi", crease: "none" }));
  const F = G.frameAlong([x, y0, z], [0, 1, 0]);
  const body = G.solidOf([[0, 1.05], [0.5, 1.45, 1], [1.2, 1.45], [R2_LEN - 1.2, 1.45], [R2_LEN - 0.5, 1.45, 1], [R2_LEN, 1.05]], F, P);
  const bands = [1.6, 2.4, 3.2, 4.4].map((s) => G.arcOf(F, s, 1.45, P)).join("");
  out.push(S(body, { tone: "hi", inner: L(bands, { tone: "mid" }) }));
  return out.join("");
}
function leds() {
  return farFirst([
    ...W.LEDS.map((led) => ({ at: led.at, svg: `<g data-part="led-${led.name}">${ledSvg(led)}</g>` })),
    { at: [R2_AT[0], R2_AT[1] + R2_LEN / 2], svg: resistor() },
  ]);
}

// The light that falls on the board and the circuit board, and the haze round each dome.
// Each pool is a disc in its own plane, so it lies flat on what it lights.
function pools(z, radius, plane) {
  return W.LEDS.map(({ name, at: [x, y] }) => `<g transform="${k.topMatrix([x, y], z, P, "x")}"><circle class="cap-pool" data-led="${name}" data-plane="${plane}" r="${radius}" fill="url(#cap-pool-${name})" style="opacity:0"/></g>`).join("");
}
function halos() {
  return W.LEDS.map(({ name, at: [x, y] }) => {
    const c = at([x, y, W.ledZ0 + 1.2 + W.LED_BODY + W.LED_DOME * 0.2]);
    return `<circle class="cap-halo" data-led="${name}" cx="${fr(c[0])}" cy="${fr(c[1])}" r="${fr(24 * P.scale)}" fill="url(#cap-halo-${name})" style="opacity:0"/>`;
  }).join("");
}
const GLOW = {
  green: { core: "#f2fff6", body: "#5dff9b", rim: "#00b85c" },
  red: { core: "#fff3ef", body: "#ff6a55", rim: "#e0281c" },
};
const defs = () =>
  `<defs>${Object.entries(GLOW)
    .map(
      ([name, c]) =>
        `<radialGradient id="cap-halo-${name}"><stop offset="0" stop-color="${c.core}" stop-opacity=".95"/><stop offset=".18" stop-color="${c.body}" stop-opacity=".7"/><stop offset=".5" stop-color="${c.rim}" stop-opacity=".22"/><stop offset="1" stop-color="${c.rim}" stop-opacity="0"/></radialGradient>` +
        `<radialGradient id="cap-pool-${name}"><stop offset="0" stop-color="${c.body}" stop-opacity=".55"/><stop offset=".45" stop-color="${c.rim}" stop-opacity=".2"/><stop offset="1" stop-color="${c.rim}" stop-opacity="0"/></radialGradient>` +
        `<radialGradient id="cap-lit-${name}" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="${c.core}"/><stop offset=".45" stop-color="${c.body}"/><stop offset="1" stop-color="${c.rim}"/></radialGradient>`,
    )
    .join("")}</defs>`;

// ── the light meter: a photocell looking at the LEDs, and a dial ───────────────
function luxMeter() {
  const { LUX, EYE } = W;
  const [x, y] = LUX.at;
  const top = LUX.h;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.cylinder(x, y, LUX.r, 0, LUX.h, P, 40).fill}" style="filter:blur(4px)"/>`);
  // the photocell sits in a bracket on the far side, so it is drawn before the dial
  const bracket = { x: EYE.at[0] - 1.4, y: y - 3.4, w: 4.6, d: 6.8, r: 0.8 };
  out.push(S(k.slabOf(bracket, 0, EYE.z + EYE.r - 0.6, P, 2, 0.3), { tone: "mid" }));
  const F = G.frameAlong([EYE.at[0] - 1.4, y, EYE.z], [-1, 0, 0]);
  out.push(S(G.disc(0, 2.6, EYE.r, F, P), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, LUX.r, 0, LUX.h, P, 48, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, LUX.r, top - 1.4, top, 72, P, 0.2), { tone: "lo" }));
  out.push(L(k.ring(x, y, LUX.r - 1.4, top, P, 48), { tone: "lo" }));
  const span = (2 * W.LUX_SWEEP * Math.PI) / 180, from = ((90 - W.LUX_SWEEP) * Math.PI) / 180;
  const t = k.radialTicks(x, y, LUX.r - 1.4, 24, 4, top, [1.1, 2.4], P, from, span);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // a small sun printed under the hub: a ring with short rays
  const sun = [k.ring(x - 5.2, y, 1.1, top, P, 14)];
  for (let n = 0; n < 8; n++) {
    const a = (n / 8) * TAU;
    sun.push(k.lineOnTop([x - 5.2 + 1.7 * Math.cos(a), y + 1.7 * Math.sin(a)], [x - 5.2 + 2.6 * Math.cos(a), y + 2.6 * Math.sin(a)], top, P));
  }
  out.push(L(sun.join(""), { tone: "mid", free: true }));
  out.push(`<g data-slot="lux"></g>`);
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



// ── the knife switch: series or parallel ───────────────────────────────────────
// The base, the clips and the hinges are drawn once. The blades, the crossbar and the handle turn,
// so they are drawn at SWITCH_FRAMES + 1 angles here and the page shows the one it needs.
const CLIPS = [W.HINGE_X - W.JAW, W.HINGE_X, W.HINGE_X + W.JAW];
function knifeBase() {
  const { SW, SW_H } = W;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(SW, 0, SW_H, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(SW, 0, SW_H, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(SW, 2.2), SW_H, P, 4), { tone: "faint" }));
  const screws = k.corners(SW, 3);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.4, SW_H, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, SW_H])), { size: 0.45 }));
  // a slotted terminal screw beside every clip, on the outside of the pair of poles
  const terminals = [];
  for (const x of CLIPS) for (const [y, side] of [[W.POLES.A, -1], [W.POLES.B, 1]]) terminals.push([x, y + side * 4.4]);
  out.push(terminals.map(([x, y]) => S(k.cylinder(x, y, 1.5, SW_H, 0.7, P, 16), { tone: "mid", crease: "none" })).join(""));
  out.push(L(terminals.map(([x, y]) => k.lineOnTop([x - 1.1, y], [x + 1.1, y], SW_H + 0.7, P)).join(""), { tone: "lo" }));
  // a rib between the two poles: the slate is raised there to keep them apart
  const rib = { x: SW.x + 5, y: (W.POLES.A + W.POLES.B) / 2 - 1, w: SW.w - 10, d: 2, r: 0.6 };
  out.push(S(k.slabOf(rib, SW_H, 1.6, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}
// One pole's clips: a foot and two cheeks for each jaw, two taller cheeks for the hinge.
// `side` -1 gives the cheeks on the far side of the blade, +1 the near side (drawn after the blade).
function poleClips(y, side) {
  const { SW_H, PIVOT_Z, BLADE } = W;
  const out = [];
  CLIPS.forEach((x) => {
    const hinge = x === W.HINGE_X;
    const w = hinge ? 4.4 : 3.2;
    if (side < 0) out.push(S(k.slabOf({ x: x - w / 2, y: y - BLADE.half - 1, w, d: 2 * BLADE.half + 2, r: 0.4 }, SW_H, 1, P, 2), { tone: "mid", crease: "none" }));
    const cy = side < 0 ? y - BLADE.half - 1 : y + BLADE.half;
    const top = PIVOT_Z + (hinge ? 1.8 : 0.5); // the blade's top face stays in view above the jaws
    out.push(S(k.slabOf({ x: x - w / 2, y: cy, w, d: 1, r: 0.35 }, SW_H + 1, top - SW_H - 1, P, 2, 0.2), { tone: "hi" }));
    if (hinge && side > 0) out.push(D([at([x, cy + 1, PIVOT_Z])], { size: 0.75, tone: "mid" }));
  });
  return out.join("");
}
function knifeFrame(angle) {
  const { HINGE_X, PIVOT_Z, POLES, BLADE, XBAR, GRIP } = W;
  const a = (angle * Math.PI) / 180;
  const d = [-Math.cos(a), Math.sin(a)], n = [Math.sin(a), Math.cos(a)]; // along the blade and across it, in the x-z plane
  const F = G.frameOf([HINGE_X, 0, PIVOT_Z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const rect = (r0, r1, h) => [[r0, -h], [r1, -h], [r1, h], [r0, h]].map(([r, t]) => [d[0] * r + n[0] * t, d[1] * r + n[1] * t]);
  const blade = (y) => S(G.prismOf(F, rect(BLADE.from, BLADE.to, BLADE.thick / 2), y - BLADE.half, y + BLADE.half, P), { tone: "hi" });
  const bar = S(G.prismOf(F, rect(XBAR.at - XBAR.half, XBAR.at + XBAR.half, XBAR.half), POLES.A - BLADE.half - XBAR.reach, POLES.B + BLADE.half + XBAR.reach, P), { tone: "mid" });
  const mid = (POLES.A + POLES.B) / 2;
  const axis = [d[0], 0, d[1]];
  const H = G.frameAlong([HINGE_X, mid, PIVOT_Z], axis);
  const octagon = Array.from({ length: 8 }, (_, j) => [GRIP.r * Math.cos(((j + 0.5) / 8) * TAU), GRIP.r * Math.sin(((j + 0.5) / 8) * TAU)]);
  const stick = S(G.prismOf(H, octagon, GRIP.from, GRIP.to, P), { tone: "mid" });
  const centre = [HINGE_X + axis[0] * (GRIP.to + GRIP.knob * 0.8), mid, PIVOT_Z + axis[2] * (GRIP.to + GRIP.knob * 0.8)];
  const ball = G.sphereOf(centre, GRIP.knob, P);
  const c = at(centre);
  const knob = S(ball, { tone: "hi" }) + `<circle class="cap-grip-ball" cx="${fr(c[0])}" cy="${fr(c[1])}" r="${fr(GRIP.knob * P.scale - 0.2)}"/>`;
  // the handle goes on the near side of the crossbar once the lever leans forward
  const handle = angle < 90 ? stick + knob + bar : bar + stick + knob;
  return { A: blade(POLES.A), B: blade(POLES.B), back: angle < 90 ? handle : "", front: angle < 90 ? "" : handle };
}
const KNIFE = Array.from({ length: W.SWITCH_FRAMES + 1 }, (_, j) => knifeFrame((180 * j) / W.SWITCH_FRAMES));
function knifeSwitch() {
  const f = KNIFE[0];
  return grab(
    "topo",
    "Knife switch: click to change series / parallel",
    knifeBase() +
      `<g data-slot="xbarBack">${f.back}</g>` +
      poleClips(W.POLES.A, -1) + `<g data-slot="bladeA">${f.A}</g>` + poleClips(W.POLES.A, 1) +
      poleClips(W.POLES.B, -1) + `<g data-slot="bladeB">${f.B}</g>` + poleClips(W.POLES.B, 1) +
      `<g data-slot="xbarFront">${f.front}</g>` +
      `<g data-layer="blades"></g>`,
  );
}

// ── the stopwatch ──────────────────────────────────────────────────────────────
function stopwatch() {
  const { WATCH, WATCH_TWELVE } = W;
  const [x, y] = WATCH.at;
  const top = WATCH.h;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.cylinder(x, y, WATCH.r, 0, WATCH.h, P, 40).fill}" style="filter:blur(4px)"/>`);
  // the crown and its stem at 12 o'clock, on the far side, so they go first
  const stem = G.frameAlong([x - WATCH.r + 0.4, y, top * 0.55], [-1, 0, 0]);
  out.push(S(G.disc(0, 3.2, 1.5, stem, P), { tone: "mid" }));
  out.push(S(G.disc(3.2, 6.4, 3, stem, P), { tone: "hi" }));
  out.push(L(G.ribsOf(stem, 3.2, 6.4, 3, 18, P), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, WATCH.r, 0, WATCH.h, P, 56, 0.6), { tone: "mid", crease: "lo" }));
  out.push(L(k.ring(x, y, WATCH.r - 1.6, top, P, 56), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, WATCH.r - 2.2, top, 0.4, P, 56), { tone: "hi", crease: "none" }));
  const face = top + 0.4;
  const t = k.radialTicks(x, y, WATCH.r - 2.6, 50, 5, face, [1, 2.3], P, WATCH_TWELVE, TAU);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(L(k.ring(x + 5.6, y, 2.6, face, P, 24), { tone: "faint" }));
  out.push(`<g data-slot="watch"></g>`);
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
  out.push(dragArrow([hx + 9, hy], [hx + 19, hy], 0.05));
  out.push(S(k.cylinder(hx + 4, hy, 3.1, 2.5, 5, P, 20, 0.3), { tone: "hi", className: "cap-grip" }));
  out.push(L(k.knurl(hx + 4, hy, 3.1, 2.5, 7.5, 16, P), { tone: "lo" }));
  return out.join("");
}

// ── assembly ───────────────────────────────────────────────────────────────────
const LABEL =
  "A bench demonstration of a capacitor. A bench supply pushes current round one loop: through a slide-wire resistor, through two LEDs mounted back to back (green lights while the capacitor fills, red while it empties) and onto the plates of a capacitor with a sliding plate. Charge carriers move along the wires at a speed set by the current and stop at the plates; nothing crosses the gap. A light meter reads the LEDs, an electroscope beside the capacitor opens as it charges, and a strip-chart scope and two meters on the backboard show the current and the capacitor voltage.";

const slot = (name) => `<g data-slot="${name}"></g>`;
const layer = (name) => `<g data-layer="${name}"></g>`;

const body = [
  defs(),
  board(),
  traces(),
  pools(0, 70, "floor"),
  backboard(),
  supply(),
  layer("supply"),
  rheostat(),
  `<g data-part="wiper" transform="translate(0 0)">${wiper()}</g>`,
  layer("wiper"),
  holder(),
  copper(),
  pools(W.PCB_TOP, 24, "pcb"),
  leds(),
  layer("holder"),
  luxMeter(),
  layer("lux"),
  stopwatch(),
  knifeSwitch(),
  layer("switch"),
  capacitorBack(),
  slot("marksFixed"),
  slot("overlap"),
  electroscope(),
  capacitorRail(),
  `<g data-part="slide">${slot("fieldLines")}${lattice()}${slot("marksSlide")}</g>`,
  layer("capacitor"),
  layer("return"),
  `<g class="cap-halos">${halos()}</g>`,
];

const svg = k.figureSvg({ width: W.WIDTH, height: W.HEIGHT, label: LABEL, body });

// ── the page ───────────────────────────────────────────────────────────────────
const stripExports = (text) => text.replace(/^export /gm, "");
const live = readFileSync(join(HERE, "live.js"), "utf8");
const DATA = `const KNIFE = ${JSON.stringify(KNIFE)};\nconst P = ${JSON.stringify(P)};\nconst TURNS = ${JSON.stringify(Array.from({ length: W.WIND.turns }, (_, n) => W.WIND.y0 + ((W.WIND.y1 - W.WIND.y0) * n) / (W.WIND.turns - 1)))};\nconst DISPLAY_AT = ${JSON.stringify(k.topMatrix([W.DISPLAY.x + 10.5, W.DISPLAY.y + W.DISPLAY.d - 3], W.SUP_TOP + 0.6, P, "y"))};\n`;

const page = k.plateHtml({
  fig: "Fig 1",
  title: "How a capacitor fills",
  hint: "Blue parts can be clicked or dragged",
  readout: "",
  keys: [
    { mark: "lit", label: "Current: dots on the wires; the bold trace is the LEDs' current" },
    { mark: "raised", label: "In parallel, the dotted trace is the capacitor's own current: up while it fills, down while it empties" },
    { mark: "raised", label: "How full the capacitor is: its voltage, the second trace" },
    { mark: "dim", label: "The supply's voltage: the faint trace" },
  ],
  caption:
    "A supply, a resistor, two LEDs and a capacitor. The knife switch wires the LEDs and the capacitor in series (lever back) or in parallel (lever forward). In series, current flows only while the capacitor's charge is changing, so the LED goes dark when it is full. In parallel, the capacitor stores charge beside the LEDs and keeps them lit after the supply is unplugged. No charge ever crosses the gap between the plates.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Capacitor and LED circuit board. Press Space to flip the fill and empty switch. Use the panel to change the voltage, the capacitor, the resistor and the frequency.">${svg}</div>`,
});

// Fig 2: the same circuit as a plain diagram. live.js draws it from the same state as the board.
const diagram = `<figure class="iso-figure cap-diagram-fig"><div class="iso-plate"><div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 2</span><span class="iso-plate-corner" data-corner="title">The same circuit, drawn simply</span><span class="iso-plate-corner" data-corner="hint">Click the blue switch or the blue wiring label</span></div><div class="cap-diagram"><svg viewBox="0 -30 740 330" role="img" aria-label="Circuit diagram of the same circuit: supply, fill and empty switch, resistor, two LEDs pointing opposite ways, and the capacitor, wired in series or in parallel. Arrows on the wires show which way the current flows."></svg></div></div><figcaption class="iso-legend"><span class="iso-caption">Each LED is a one-way door: current only passes the way its triangle points. While the capacitor fills, current flows forward, so the green one lights. While it empties, the current comes back the other way, so the red one lights. The little arrows on the wires move at the speed of the current.</span></figcaption></figure>`;

const extraCss = `
.cap-screen{fill:var(--cap-screen);stroke:none}
.cap-glass{fill:var(--anatomy-face);stroke:none}
.iso[data-theme="dark"]{--cap-screen:#060606;--led-green:#2bd673;--led-red:#ff4b3a;--tint:.34;--halo-blend:screen;--grip:#4f9dff;--grip-hot:#8cc0ff}
.iso[data-theme="light"]{--cap-screen:#ffffff;--led-green:#11a556;--led-red:#e3301f;--tint:.42;--halo-blend:multiply;--grip:#2f74e0;--grip-hot:#1553b8}
.cap-grip>.iso-top{fill:var(--grip);animation:cap-grip 2.8s ease-in-out infinite}
.cap-grip-ball{fill:var(--grip);stroke:var(--anatomy-paper);stroke-width:.5px;paint-order:stroke;animation:cap-grip 2.8s ease-in-out infinite}
.cap-arrow{fill:none;stroke:var(--grip);stroke-width:.9px;stroke-linecap:round;stroke-linejoin:round}
@keyframes cap-grip{0%,100%{fill-opacity:1}50%{fill-opacity:.62}}
[data-grab]:hover .cap-grip>.iso-top,[data-grab]:hover .cap-grip-ball{fill:var(--grip-hot);animation:none}
[data-grab]:hover .cap-arrow{stroke:var(--grip-hot);stroke-width:1.2px}
@media (prefers-reduced-motion:reduce){.cap-grip>.iso-top,.cap-grip-ball{animation:none}}
.cap-hub{fill:var(--anatomy-hi);stroke:var(--anatomy-paper);stroke-width:.5px;paint-order:stroke}
.cap-lcd{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-weight:600;letter-spacing:.02em}
[data-part^=btn-][data-on] .cap-icon{stroke:var(--anatomy-lit);stroke-width:1.1px}
[data-part=lamp] .iso-solid[data-lit]>.iso-top{fill:var(--anatomy-lit)}
[data-part=lamp] .iso-solid[data-lit]>.iso-shade{fill:var(--anatomy-hi)}
.cap-carrier{fill:var(--anatomy-lit);stroke:var(--anatomy-paper);stroke-width:.7px;paint-order:stroke}
.cap-mark{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-weight:600;opacity:0;pointer-events:none}
.cap-tint{stroke:none;pointer-events:none;opacity:var(--tint)}
.cap-tint[data-led=green]{fill:var(--led-green)}.cap-tint[data-led=red]{fill:var(--led-red)}
.cap-band{fill:none;stroke-width:1.5px;stroke-linecap:butt;opacity:.8}
.cap-band[data-led=green]{stroke:var(--led-green)}.cap-band[data-led=red]{stroke:var(--led-red)}
.cap-trace-pos{stroke:var(--led-green)!important}.cap-trace-neg{stroke:var(--led-red)!important}
.cap-lit{stroke:none;pointer-events:none}
.cap-lit[data-led=green]{fill:url(#cap-lit-green)}.cap-lit[data-led=red]{fill:url(#cap-lit-red)}
.cap-die{fill:#fff;stroke:none;pointer-events:none}
.cap-tau{fill:var(--anatomy-lit);stroke:none}.cap-tau5{fill:none;stroke:var(--anatomy-lit);stroke-width:.8px}
.cap-frame{opacity:.55}
.cap-halo,.cap-pool{pointer-events:none;mix-blend-mode:var(--halo-blend)}
[data-grab]{cursor:grab;touch-action:none}
.cap-head{margin:0 0 -8px}.cap-head h1{margin:0 0 6px;font:600 18px/1.3 var(--anatomy-mono);letter-spacing:.01em;color:var(--anatomy-strong)}.cap-head p{margin:0;max-width:66ch;color:var(--anatomy-text);font-size:14px;line-height:1.6}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
@media (max-width:640px){.iso-stage{overflow-x:auto;overscroll-behavior-x:contain}.iso-stage .iso-svg{width:700px;max-width:none}.iso-plate{padding-left:0;padding-right:0}.iso-plate-corners{inset:18px 14px}}
[data-grab]:active{cursor:grabbing}
.cap-diagram-fig{margin-top:28px}
.cap-diagram{padding:44px 24px 40px}
.cap-diagram svg{display:block;width:100%;height:auto;overflow:visible}
.dg-wire{fill:none;stroke:var(--anatomy-mid);stroke-width:2.4px;stroke-linejoin:round;stroke-linecap:round}
.dg-part{fill:none;stroke:var(--anatomy-hi);stroke-width:2.4px;stroke-linejoin:round;stroke-linecap:round}
.dg-plate{stroke:var(--anatomy-hi);stroke-width:5px;stroke-linecap:round}
.dg-text{font:12px/1 var(--anatomy-mono);fill:var(--anatomy-text)}
.dg-small{font:10.5px/1 var(--anatomy-mono);fill:var(--anatomy-muted)}
.dg-status{font:600 14px/1 var(--anatomy-mono);fill:var(--anatomy-strong)}
.dg-green{fill:var(--led-green)}.dg-red{fill:var(--led-red)}
.dg-led[data-led=green]{fill:var(--led-green);stroke:var(--led-green)}.dg-led[data-led=red]{fill:var(--led-red);stroke:var(--led-red)}
.dg-led{stroke-width:2px;stroke-linejoin:round}
.dg-ray{fill:none;stroke-width:1.6px;stroke-linecap:round}
.dg-ray[data-led=green]{stroke:var(--led-green)}.dg-ray[data-led=red]{stroke:var(--led-red)}
.dg-glow{mix-blend-mode:var(--halo-blend);pointer-events:none}
.dg-charge{font:600 13px/1 var(--anatomy-mono);text-anchor:middle}
.dg-charge[data-sign="+"]{fill:var(--anatomy-strong)}.dg-charge[data-sign="−"]{fill:var(--anatomy-muted)}
.dg-dot{fill:none;stroke:var(--anatomy-lit);stroke-width:2.2px;stroke-linecap:round;stroke-linejoin:round}
.dg-node{fill:var(--anatomy-hi)}
.dg-contact{fill:var(--anatomy-card);stroke:var(--anatomy-hi);stroke-width:2px}
.dg-lever{stroke:var(--grip);stroke-width:4px;stroke-linecap:round}
.dg-click{cursor:pointer}
.dg-click:hover .dg-lever{stroke:var(--grip-hot)}
.dg-pill{fill:var(--anatomy-card);stroke:var(--grip);stroke-width:1.5px}
.dg-click:hover .dg-pill{stroke:var(--grip-hot);stroke-width:2.2px}
.dg-opt{font:12px/1 var(--anatomy-mono);fill:var(--anatomy-muted)}
.dg-opt[data-on]{fill:var(--grip);font-weight:600}
@media (max-width:640px){.cap-diagram{padding:40px 0 34px;overflow-x:auto;overscroll-behavior-x:contain}.cap-diagram svg{width:640px;max-width:none}}
${PANEL_CSS}
`;

const layoutOf = (figure, panel) => {
  const cut = panel.indexOf("</aside>") + "</aside>".length;
  return `<div class="cap-layout"><div class="cap-fig">${figure}</div>${panel.slice(0, cut)}</div>${panel.slice(cut)}`;
};
const intro = `<header class="cap-head"><h1>How a capacitor works</h1><p>A capacitor is a little store for electric charge. Flip the switch and watch the LED: it flashes while the capacitor fills, then goes dark when it is full. Flip it back and the stored charge comes out the other way and lights the red LED. Then throw the knife switch to parallel and see the capacitor keep the LED glowing on its own. Anything blue on the board can be clicked or dragged.</p></header>`;
const html = k
  .pageHtml({ title: "Capacitor and LED", theme, width: 1320, body: layoutOf(intro + page + diagram, panelHtml(M)), script: kitScript() + "\n" + stripExports(readFileSync(join(HERE, "world.mjs"), "utf8")) + "\n" + stripExports(readFileSync(join(HERE, "model.mjs"), "utf8")) + "\n" + DATA + live })
  .replace("</style>", extraCss + "</style>");

const gripKey = `<span class="iso-key"><svg class="iso-swatch" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="var(--grip)"/></svg>Blue: a part you can click or drag</span>`;
const finished = html.replace(`</span><span class="iso-caption">`, `${gripKey}</span><span class="iso-caption">`);
writeFileSync(join(HERE, OUT), finished);
console.log("wrote", OUT, (finished.length / 1024).toFixed(0) + " KB");
