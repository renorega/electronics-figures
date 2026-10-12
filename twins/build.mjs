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
const OUT = theme === "light" ? "twins-light.html" : "twins.html";

// ── camera ─────────────────────────────────────────────────────────────────────
const P = k.fitProjection(
  [...k.boxCorners(W.PLATE, -W.PLATE_H - W.FOOT_H, 0), [W.LANE.C, W.LAMP_Y, 40], [W.HANDLE_X, -60, 46], [W.SUP.x, W.SUP.y, 30]],
  W.WIDTH,
  W.HEIGHT,
  { pad: 26, azimuth: W.VIEW_AZIMUTH },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const fr = (n) => Math.round(n * 100) / 100;
const TAU = Math.PI * 2;
const { LANE } = W;
const screwsAt = (points, z, ring = 1.9) => L(points.map(([x, y]) => k.ring(x, y, ring, z, P, 14)).join(""), { tone: "lo" }) + D(points.map(([x, y]) => at([x, y, z])), { size: 0.45 });
const halo = (plan, z, h, blur = 3) => `<path class="iso-halo" d="${k.haloOf(plan, z, h, P)}" style="filter:blur(${blur}px)"/>`;
const alongY = (x, y, z) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const alongX = (x, y, z) => G.frameOf([x, y, z], [1, 0, 0], [0, -1, 0], [0, 0, 1]);
const upZ = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

// ── the board ──────────────────────────────────────────────────────────────────
function board() {
  const { PLATE, PLATE_H, FOOT_H } = W;
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = k.corners(PLATE, 24).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P));
  for (const [x, y] of feet) out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3.2, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  out.push(screwsAt(k.corners(PLATE, 10), 0, 2.2));
  // a ruler along the near edge
  const strip = { x: 103, y: -150, w: 7, d: 276, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.y + 4, strip.y + strip.d - 4, 4, 5, strip.x + 0.8, 0.6, [2, 3.6], P, "y");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 3.5, strip.y + 2, 0.6]), at([strip.x + 3.5, strip.y + strip.d - 2, 0.6])], { size: 0.45 }));
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
  // the gauge's thin wires
  for (const path of W.GAUGE_WIRES) out.push(S(k.extrude(ribbon(path, 1.6), 0, 0.8, P, { convex: false }), { tone: "lo", crease: "none" }));
  for (const [x, y] of W.JUNCTIONS) out.push(S(k.cylinder(x, y, 2.9, W.TRACE_H, 0.8, P, 24, 0.3), { tone: "hi" }));
  return out.join("");
}

// ── lamp light on the board, under everything that stands ──────────────────────
function lightDefs() {
  return `<defs>
<radialGradient id="ct-glow"><stop offset="0" class="ct-g0"/><stop offset=".3" class="ct-g1"/><stop offset="1" class="ct-g2"/></radialGradient>
<radialGradient id="ct-pool"><stop offset="0" class="ct-p0"/><stop offset=".55" class="ct-p1"/><stop offset="1" class="ct-p2"/></radialGradient>
<radialGradient id="ct-globe" cx=".5" cy=".55" r=".6"><stop offset="0" class="ct-e0"/><stop offset=".5" class="ct-e1"/><stop offset="1" class="ct-e2"/></radialGradient>
<radialGradient id="ct-spark"><stop offset="0" class="ct-s0"/><stop offset=".35" class="ct-s1"/><stop offset="1" class="ct-s2"/></radialGradient>
</defs>`;
}
const pool = (lane, x) => `<g data-part="pool-${lane}" style="opacity:0"><circle transform="${k.topMatrix([x, W.LAMP_Y], 0, P, "x")}" r="44" fill="url(#ct-pool)"/></g>`;

// ── the bench supply ───────────────────────────────────────────────────────────
function supply() {
  const { SUP, SUP_Z, SUP_TOP } = W;
  const out = [halo(SUP, 0, SUP_TOP, 4)];
  const feet = k.corners(SUP, 9).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P));
  for (const [x, y] of feet) out.push(S(k.cylinder(x, y, 4.4, 0, SUP_Z, P, 20), { tone: "lo" }));
  out.push(S(k.slabOf(SUP, SUP_Z, SUP_TOP - SUP_Z, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(SUP, 17, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(SUP, 3), SUP_TOP, P, 6), { tone: "faint" }));
  out.push(screwsAt(k.corners(SUP, 6.5), SUP_TOP));

  // the +x face: vents and a label plate
  const face = k.sideMatrix([SUP.x + SUP.w, SUP.y + SUP.d], 0, P, "right");
  const f = [];
  const rect = (u0, z0, u1, z1, r) => `M${u0 + r} ${-z1}H${u1 - r}A${r} ${r} 0 0 1 ${u1} ${-z1 + r}V${-z0 - r}A${r} ${r} 0 0 1 ${u1 - r} ${-z0}H${u0 + r}A${r} ${r} 0 0 1 ${u0} ${-z0 - r}V${-z1 + r}A${r} ${r} 0 0 1 ${u0 + r} ${-z1}Z`;
  const fl = (d, tone, extra = "") => `<path class="iso-line" data-tone="${tone}" d="${d}"${extra}/>`;
  for (let z = 8; z <= 19; z += 3) f.push(fl(rect(26, z, 52, z + 1.5, 0.75), "faint"));
  f.push(fl(rect(6, 7, 20, 20, 1.5), "lo"));
  f.push(fl(`M9 -16.5H17`, "lo", ' data-free=""'), fl(`M9 -13.5H15`, "lo", ' data-free=""'), fl(`M9 -10.5H16`, "lo", ' data-free=""'));
  f.push(`<g class="iso-dots" data-tone="mid">${[[8, 18], [18, 18], [8, 9], [18, 9]].map(([u, z]) => `<circle cx="${u}" cy="${-z}" r="0.4"/>`).join("")}</g>`);
  out.push(`<g transform="${face}">${f.join("")}</g>`);

  // the display
  const D0 = W.DISPLAY;
  out.push(S(k.slabOf(D0, SUP_TOP, 0.6, P, 3), { tone: "lo", crease: "none" }));
  out.push(`<path class="ct-screen" d="${k.planOutline(k.insetPlan(D0, 1.2), SUP_TOP + 0.6, P, 3)}"/>`);
  out.push(L(k.planOutline(k.insetPlan(D0, 1.2), SUP_TOP + 0.6, P, 3), { tone: "lo" }));
  out.push(`<g data-slot="display" transform="${k.topMatrix([D0.x + 9.5, D0.y + D0.d - 3], SUP_TOP + 0.6, P, "y")}"></g>`);

  // the terminal pads, bent down the +y face to the tracks
  for (const [x, y] of [W.POST_PLUS, W.POST_MINUS]) {
    const pad = { x: x - 5, y: y - 5, w: 10, d: SUP.y + SUP.d - (y - 5), r: 1.4 };
    out.push(S(k.slabOf(pad, SUP_TOP, 0.8, P, 3), { tone: "lo", crease: "none" }));
    out.push(S(k.slabOf({ x: x - 3, y: SUP.y + SUP.d, w: 6, d: 1.4, r: 0.4 }, 1.2, SUP_TOP + 0.8 - 1.2, P, 2), { tone: "lo", crease: "none" }));
  }
  for (const [x, y] of [W.POST_PLUS, W.POST_MINUS]) {
    out.push(S(k.cylinder(x, y, 3.3, SUP_TOP + 0.8, 1.6, P, 24), { tone: "mid" }) + S(k.cylinder(x, y, 2.4, SUP_TOP + 2.4, 2.2, P, 20), { tone: "hi" }) + L(k.knurl(x, y, 2.4, SUP_TOP + 2.4, SUP_TOP + 4.6, 14, P), { tone: "lo" }));
  }
  const mark = (x, y, sign) => {
    let d = k.lineOnTop([x - 1.6, y], [x + 1.6, y], SUP_TOP, P);
    if (sign === "+") d += k.lineOnTop([x, y - 1.6], [x, y + 1.6], SUP_TOP, P);
    return L(d, { tone: "mid", free: true });
  };
  out.push(mark(W.POST_PLUS[0] + 9, W.POST_PLUS[1] - 2, "+"), mark(W.POST_MINUS[0] - 9, W.POST_MINUS[1] - 2, "-"));

  // the wiggle-speed knob (touchable) over its printed scale
  const { at: [kx, ky], r, h } = W.KNOB_F;
  const ticks = k.radialTicks(kx, ky, r + 4.4, 9, 1, SUP_TOP, [1.2, 2.2], P, (-W.KNOB_SWEEP * Math.PI) / 180, (2 * W.KNOB_SWEEP * Math.PI) / 180);
  out.push(L(ticks.major, { tone: "mid" }));
  out.push(`<g class="ct-touch" data-grab="F">${S(k.cylinder(kx, ky, r + 1.6, SUP_TOP, 1, P, 36), { tone: "lo" })}${S(k.cylinder(kx, ky, r, SUP_TOP + 1, h, P, 36, 0.4), { tone: "hi" })}${L(k.knurl(kx, ky, r, SUP_TOP + 1, SUP_TOP + 1 + h, 36, P), { tone: "lo" })}<g data-slot="pointerF"></g></g>`);

  // the three mode keys: steady, slow wiggle, fast wiggle
  for (const b of W.BUTTONS) {
    const [x, y] = b.at;
    const plan = { x: x - 4, y: y - 4, w: 8, d: 8, r: 1.2 };
    const z = SUP_TOP + 2.6;
    const wave = (cycles) => k.onTop(Array.from({ length: 25 }, (_, n) => [x - 1.9 * Math.sin((n / 24) * TAU * cycles), y + 2.4 - (4.8 * n) / 24]), z, P);
    const icon = { steady: k.lineOnTop([x, y - 2.4], [x, y + 2.4], z, P), slow: wave(1), fast: wave(3) }[b.mode];
    out.push(
      `<g data-part="btn-${b.mode}" data-grab="mode-${b.mode}">${S(k.slabOf({ x: plan.x - 0.8, y: plan.y - 0.8, w: 9.6, d: 9.6, r: 1.6 }, SUP_TOP, 0.6, P, 3), { tone: "lo", crease: "none" })}<g data-key class="ct-touch">${S(k.slabOf(plan, SUP_TOP + 0.6, 2, P, 3, 0.3), { tone: "mid" })}${L(icon, { tone: "hi", free: true, className: "ct-icon" })}</g></g>`,
    );
  }
  return out.join("");
}

// ── the two-blade knife switch ─────────────────────────────────────────────────
const { SW_BASE, SW_BASE_H, BLADE, HINGE_Y, JAW_Y } = W;
const CHEEK_H = 9;
const cheeks = (x, y) => {
  const half = BLADE.width / 2 + 0.3;
  return {
    block: { x: x - 5.5, y: y - 5, w: 11, d: 10, r: 1.2 },
    far: { x: x - half - 1.3, y: y - 4, w: 1.3, d: 8, r: 0.3 },
    near: { x: x + half, y: y - 4, w: 1.3, d: 8, r: 0.3 },
  };
};
const POSTS_SW = [LANE.C, LANE.L].flatMap((x) => [cheeks(x, JAW_Y), { ...cheeks(x, HINGE_Y), hinge: x }]);

function switchBase() {
  const out = [halo(SW_BASE, 0, SW_BASE_H)];
  out.push(S(k.slabOf(SW_BASE, 0, SW_BASE_H, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(SW_BASE, 2.2), SW_BASE_H, P, 4), { tone: "faint" }));
  out.push(screwsAt(k.corners(SW_BASE, 4.2), SW_BASE_H, 1.6));
  for (const c of POSTS_SW) {
    out.push(S(k.slabOf(c.block, SW_BASE_H, 1.4, P, 2, 0.3), { tone: "lo" }));
    out.push(S(k.slabOf(c.far, SW_BASE_H + 1.4, CHEEK_H, P, 2), { tone: "hi" }));
  }
  return out.join("");
}
function switchFront() {
  const out = [];
  for (const c of POSTS_SW) {
    out.push(S(k.slabOf(c.near, SW_BASE_H + 1.4, CHEEK_H, P, 2), { tone: "hi" }));
    if (c.hinge !== undefined) {
      // the hinge pin's head on the near cheek
      const z = BLADE.z + BLADE.t / 2;
      out.push(S(G.disc(0, 0.8, 1.7, alongX(c.near.x + c.near.w, HINGE_Y, z), P), { tone: "mid" }));
    } else out.push(D([at([c.block.x + 1.4, c.block.y + 1.4, SW_BASE_H + 1.4])], { size: 0.4 }));
  }
  return out.join("");
}

// One drawing of the moving part of the switch (blades, crossbar, handle) at opening angle a.
function switchFrame(a) {
  const { along, normal } = W.bladeAxes(a);
  const blades = [LANE.C, LANE.L].map((x) => {
    const F = G.frameOf(W.bladePoint(x, 0, 0, a), along, [1, 0, 0], normal);
    const half = BLADE.width / 2, t = BLADE.t / 2;
    const body = G.prismOf(F, [[-half, -t], [half, -t], [half, t], [-half, t]], -3.2, BLADE.length + 1.2, P);
    return S(body, { tone: "hi" });
  });
  // the crossbar: an insulating bar across both blades, and the handle standing on it
  const barF = G.frameOf(W.bladePoint(LANE.C - 6, BLADE.bar, BLADE.t / 2 + 1.9, a), [1, 0, 0], along, normal);
  const bar = G.prismOf(barF, [[-2.4, -1.9], [2.4, -1.9], [2.4, 1.9], [-2.4, 1.9]], 0, LANE.L - LANE.C + 12, P);
  const bolts = [LANE.C, LANE.L].map((x) => W.bladePoint(x, BLADE.bar, BLADE.t / 2 + 3.8, a));
  const hF = G.frameOf(W.bladePoint(W.HANDLE_X, BLADE.bar, BLADE.t / 2 + 3.8, a), normal, [1, 0, 0], along.map((v) => -v));
  const handle = G.solidOf([[0, 2.2], [6, 2.2], [6.6, 3.1, 1], [8, 3.5, 1], [15, 3.5, 1], [16.6, 3, 1], [17.4, 1.8, 1], [17.7, 0.6]], hF, P);
  return `<g>${blades.join("")}</g><g class="ct-touch" data-grab="switch">${S(bar, { tone: "mid" })}${D(bolts.map(at), { size: 0.6, tone: "lo" })}${S(handle, { tone: "hi" })}</g>`;
}
const SWITCH_FRAMES = Array.from({ length: 37 }, (_, n) => switchFrame((W.OPEN_DEG * n) / 36));

// ── the EMPTY button ───────────────────────────────────────────────────────────
function drainButton() {
  const [x, y] = W.DRAIN.at;
  const base = { x: x - 4.6, y: y - 5.5, w: 9.2, d: 11, r: 1.6 };
  const out = [halo(base, 0, 4)];
  // the two pins out of the sides, down onto their traces
  for (const px of W.DRAIN.pins) out.push(S(k.slabOf({ x: Math.min(px, x) - 1.2, y: y - 1.2, w: Math.abs(px - x) + 2.4, d: 2.4, r: 0.3 }, W.TRACE_H, 1, P, 2), { tone: "hi", crease: "none" }));
  out.push(S(k.slabOf(base, 0, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(screwsAt([[x - 2.6, y - 3.8], [x + 2.6, y + 3.8]], 4, 1.1));
  out.push(S(k.cylinder(x, y, 3.9, 4, 1, P, 24), { tone: "lo" }));
  out.push(`<g class="ct-touch" data-grab="drain"><g data-part="drain-cap">${S(k.cylinder(x, y, 3.1, 5, 3.2, P, 28, 0.6), { tone: "hi" })}</g></g>`);
  return out.join("");
}

// ── a lamp in its socket ───────────────────────────────────────────────────────
const BZ = W.bulbZ();
function globeProfile() {
  const { neck, r } = W.BULB;
  const lift = 1.6;
  const sc = lift + Math.sqrt(r * r - neck * neck);
  const t0 = Math.asin(neck / r);
  const profile = [[0, neck], [lift, neck, 1]];
  for (let n = 1; n <= 24; n++) {
    const t = t0 + ((Math.PI - t0) * n) / 24;
    profile.push([sc - r * Math.cos(t), r * Math.sin(t), 1]);
  }
  return profile;
}
const GLOBE = Object.fromEntries(Object.entries(LANE).map(([lane, x]) => [lane, G.solidOf(globeProfile(), upZ(x, W.LAMP_Y, BZ.z2), P)]));
function filament(x) {
  const y = W.LAMP_Y, zc = BZ.centre;
  const legs = [-2.8, 2.8].map((dy) => k.pathOf([at([x, y + dy * 0.7, BZ.z2 + 1]), at([x, y + dy, zc + 0.4])]));
  const coil = [];
  for (let n = 0; n <= 32; n++) {
    const t = n / 32;
    coil.push(at([x + 0.9 * Math.cos(t * TAU * 6), y - 2.8 + 5.6 * t, zc + 0.4 + 0.9 * Math.sin(t * TAU * 6)]));
  }
  return { legs: legs.join(""), coil: k.pathOf(coil) };
}
function lamp(lane) {
  const x = LANE[lane], y = W.LAMP_Y;
  const out = [];
  const plan = { x: x - W.SOCKET_R, y: y - W.SOCKET_R, w: W.SOCKET_R * 2, d: W.SOCKET_R * 2, r: W.SOCKET_R };
  out.push(halo(plan, 0, BZ.z0, 4));
  // the porcelain base with its two terminal screws
  out.push(S(k.cylinder(x, y, W.SOCKET_R, 0, BZ.z0, P, 48, 0.7), { tone: "hi" }));
  out.push(L(k.ring(x, y, W.SOCKET_R - 2, BZ.z0, P, 48), { tone: "faint" }));
  out.push(screwsAt([[x, y - 7], [x, y + 7]], BZ.z0, 1.3));
  // the collar and the ribbed brass shell
  out.push(S(k.cylinder(x, y, 6, BZ.z0, BZ.z1 - BZ.z0, P, 36, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 4.3, BZ.z1, BZ.z2 - BZ.z1, P, 32, 0.2), { tone: "lo" }));
  out.push(L([1.4, 2.8, 4.2, 5.6].map((dz) => k.sideArc(x, y, 4.3, BZ.z1 + dz, P, 24)).join(""), { tone: "mid" }));
  // the glass, the filament seen through it, and the lit glass over both
  out.push(`<g data-part="globe-${lane}">${S(GLOBE[lane], { tone: "hi" })}</g>`);
  const fil = filament(x);
  out.push(L(fil.legs, { tone: "lo", free: true }), L(fil.coil, { tone: "mid", free: true }));
  out.push(`<g data-part="lit-${lane}" style="opacity:0"><path class="ct-globe-lit" d="${GLOBE[lane].fill}"/><path class="ct-fil-lit" d="${fil.coil}"/></g>`);
  const [gx, gy] = at([x, y, BZ.centre]);
  out.push(`<g data-part="glow-${lane}" style="opacity:0"><circle cx="${fr(gx)}" cy="${fr(gy)}" r="${fr(30 * P.scale)}" fill="url(#ct-glow)"/></g>`);
  return out.join("");
}

// ── a centre-zero current meter lying on the board ─────────────────────────────
function meter(lane) {
  const x = LANE[lane];
  const plan = W.meterPlan(x);
  const top = W.METER.h;
  const out = [halo(plan, 0, top, 4)];
  out.push(S(k.slabOf(plan, 0, top, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, 2.2, P, 4), { tone: "faint" }) }));
  const win = k.insetPlan(plan, 2.4);
  out.push(`<path class="ct-glass" d="${k.planOutline(win, top, P, 4)}"/>`);
  out.push(L(k.planOutline(win, top, P, 4), { tone: "lo" }));
  const [px, py] = W.meterPivot(x);
  const R = W.NEEDLE_R;
  const dirOf = (deg) => [-Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const arc = Array.from({ length: 31 }, (_, n) => {
    const [dx, dy] = dirOf(W.METER_SWEEP - (2 * W.METER_SWEEP * n) / 30);
    return [px + dx * R, py + dy * R];
  });
  out.push(L(k.onTop(arc, top, P), { tone: "mid" }));
  const minor = [], major = [];
  let zero = "";
  for (let n = 0; n <= 12; n++) {
    const [dx, dy] = dirOf(W.METER_SWEEP - (2 * W.METER_SWEEP * n) / 12);
    const big = n % 3 === 0;
    const len = n === 6 ? 3.4 : big ? 2.4 : 1.3;
    const d = k.lineOnTop([px + dx * R, py + dy * R], [px + dx * (R + len), py + dy * (R + len)], top, P);
    if (n === 6) zero = d;
    else (big ? major : minor).push(d);
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }), L(zero, { tone: "hi" }));
  // + and − marks at the ends of the scale (current forward / backward)
  const [ex, ey] = dirOf(W.METER_SWEEP + 12), [fx2, fy2] = dirOf(-W.METER_SWEEP - 12);
  const plus = [px + fx2 * (R + 1), py + fy2 * (R + 1)], minus = [px + ex * (R + 1), py + ey * (R + 1)];
  out.push(L(k.lineOnTop([plus[0] - 1.2, plus[1]], [plus[0] + 1.2, plus[1]], top, P) + k.lineOnTop([plus[0], plus[1] - 1.2], [plus[0], plus[1] + 1.2], top, P) + k.lineOnTop([minus[0] - 1.2, minus[1]], [minus[0] + 1.2, minus[1]], top, P), { tone: "mid", free: true }));
  out.push(`<g data-slot="needle-${lane}"></g>`);
  return out.join("");
}

// ── terminal posts and the two subjects ────────────────────────────────────────
function post(x, y, h) {
  return (
    S(k.cylinder(x, y, 3.6, W.TRACE_H, 1, P, 24), { tone: "lo" }) +
    S(k.cylinder(x, y, 2.5, W.TRACE_H + 1, h - W.TRACE_H - 3.4, P, 20), { tone: "mid" }) +
    S(k.cylinder(x, y, 3.2, h - 2.4, 2.4, P, 6, 0.3), { tone: "hi" }) +
    L(k.lineOnTop([x - 1.7, y], [x + 1.7, y], h, P), { tone: "lo" })
  );
}
const wire = (x, y0, y1, z) => S(G.disc(0, y1 - y0, 0.75, alongY(x, y0, z), P), { tone: "hi", crease: "none" });
const saddle = (x, y, h) => {
  const plan = { x: x - 8, y: y - 3, w: 16, d: 6, r: 1 };
  return halo(plan, 0, h, 2) + S(k.slabOf(plan, 0, h, P, 3, 0.3), { tone: "lo" }) + D([at([x - 5.5, y, h]), at([x + 5.5, y, h])], { size: 0.4 });
};

function capacitor() {
  const x = LANE.C, { y0, y1, zc } = W.PART;
  const R = W.CAP_R;
  const F = alongY(x, y0, zc);
  const len = y1 - y0;
  const out = [];
  out.push(post(x, W.POSTS[0], zc + 2));
  out.push(wire(x, W.POSTS[0] + 2.4, y0 + 0.5, zc));
  for (const y of W.SADDLES) out.push(saddle(x, y, zc - R));
  const profile = [
    [0, 7.6], [1.4, 7.6], [1.4, 9.8], [2.2, R, 1],
    [len - 10, R], [len - 9.2, R - 0.8, 1], [len - 8, R - 1.1, 1], [len - 6.8, R - 0.8, 1], [len - 6, R],
    [len - 1, R, 1], [len - 0.3, R - 0.7, 1], [len, R - 1.6],
  ];
  out.push(S(G.solidOf(profile, F, P), { tone: "hi" }));
  // the printed polarity stripe: a column of minus signs along the sleeve, on the side toward us
  const face = G.angleToward(F, G.viewOf(P)) + 0.75;
  const dashes = [];
  for (let s = 5; s < len - 12; s += 5.2) dashes.push(k.pathOf([at(G.pointOf(F, s, R, face)), at(G.pointOf(F, s + 2.6, R, face))]));
  out.push(L(dashes.join(""), { tone: "mid", free: true }));
  out.push(L(k.pathOf(Array.from({ length: 25 }, (_, n) => at(G.pointOf(F, 4 + ((len - 16) * n) / 24, R, face + 0.32)))), { tone: "faint", free: true }));
  out.push(L(k.pathOf(Array.from({ length: 25 }, (_, n) => at(G.pointOf(F, 4 + ((len - 16) * n) / 24, R, face - 0.32)))), { tone: "faint", free: true }));
  // the vent score on the + end, a cross inside a ring
  const endF = alongY(x, y1, zc);
  out.push(L(k.pathOf(Array.from({ length: 41 }, (_, n) => at(G.pointOf(endF, 0, 6.2, (n / 40) * TAU))), true), { tone: "lo" }));
  out.push(L([0, Math.PI / 2].map((q) => k.pathOf([at(G.pointOf(endF, 0, 6.2, q)), at(G.pointOf(endF, 0, 6.2, q + Math.PI))])).join(""), { tone: "lo" }));
  out.push(wire(x, y1, W.POSTS[1] - 2.4, zc));
  out.push(post(x, W.POSTS[1], zc + 2));
  return out.join("");
}

function coil() {
  const x = LANE.L, { y0, y1, zc } = W.PART;
  const { flange, wind, core, turns } = W.COIL;
  const F = alongY(x, y0, zc);
  const len = y1 - y0;
  const leadZ = 9;
  const out = [];
  out.push(post(x, W.POSTS[0], leadZ + 2));
  out.push(wire(x, W.POSTS[0] + 2.4, y0, leadZ));
  for (const y of [y0 + 1, y1 - 1]) out.push(saddle(x, y, zc - flange));
  out.push(S(G.disc(0, 2, flange, F, P), { tone: "mid" }));
  out.push(S(G.disc(2, len - 2, wind, F, P), { tone: "mid" }));
  const c = k.coil(y0 + 2.4, y1 - 2.4, [x, zc], wind + 0.25, turns, "y", P, 20);
  out.push(L(c.front, { tone: "hi" }));
  out.push(S(G.disc(len - 2, len, flange, F, P), { tone: "mid" }));
  // the iron core's end, laminated, in the middle of the near flange
  out.push(S(G.disc(len, len + 0.9, core, F, P), { tone: "lo" }));
  const endF = alongY(x, y1 + 0.9, zc);
  out.push(L([-2.3, 0, 2.3].map((u) => {
    const h = Math.sqrt(core * core - u * u) - 0.4;
    return k.pathOf([at([x + u, y1 + 0.9, zc - h]), at([x + u, y1 + 0.9, zc + h])]);
  }).join(""), { tone: "faint" }));
  void endF;
  // the flange's rim: four rivets on the near face
  out.push(D([0.6, 2.2, 3.8, 5.4].map((q) => at(G.pointOf(alongY(x, y1, zc), 0, flange - 2.2, q))), { size: 0.45, tone: "mid" }));
  out.push(wire(x, y1, W.POSTS[1] - 2.4, leadZ));
  out.push(post(x, W.POSTS[1], leadZ + 2));
  return out.join("");
}

// ── the capacitor's fullness gauge ─────────────────────────────────────────────
function gauge() {
  const { GAUGE } = W;
  const out = [halo(GAUGE, 0, GAUGE.h, 3)];
  out.push(S(k.slabOf(GAUGE, 0, GAUGE.h, P, 3, 0.5), { tone: "mid" }));
  const win = k.insetPlan(GAUGE, 2);
  out.push(`<path class="ct-screen" d="${k.planOutline(win, GAUGE.h, P, 3)}"/>`);
  out.push(L(k.planOutline(win, GAUGE.h, P, 3), { tone: "lo" }));
  const segs = [];
  const n = GAUGE.segments, span = win.d - 3, each = span / n;
  for (let s = 0; s < n; s++) {
    // segment 0 is the far-left one on screen (largest y): the bar fills left to right like a fuel gauge
    const yHi = win.y + win.d - 1.5 - s * each;
    const plan = { x: win.x + 1.5, y: yHi - each + 0.9, w: win.w - 3, d: each - 0.9, r: 0.3 };
    segs.push(`<path class="ct-seg" data-seg="${s}" d="${k.planOutline(plan, GAUGE.h, P, 2)}"/>`);
  }
  out.push(`<g data-part="gauge">${segs.join("")}</g>`);
  out.push(screwsAt([[GAUGE.x + GAUGE.w / 2, GAUGE.y + 1.1], [GAUGE.x + GAUGE.w / 2, GAUGE.y + GAUGE.d - 1.1]], GAUGE.h, 0.8));
  return out.join("");
}

// ── the compass in front of the coil ───────────────────────────────────────────
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

// ── engraved plates with each lane's circuit symbol ────────────────────────────
function symbolPlate(lane) {
  const x = LANE[lane] + 9, y = 100;
  const plan = { x, y, w: 16, d: 24, r: 1.6 };
  const z = 0.8;
  const out = [S(k.slabOf(plan, 0, z, P, 4), { tone: "lo", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 1.4), z, P, 4), { tone: "faint" }));
  const cx = x + 8, cy = y + 12;
  let d = "";
  if (lane === "C") {
    // two plates with their leads: —| |—
    d += k.lineOnTop([cx, cy - 9], [cx, cy - 1.4], z, P) + k.lineOnTop([cx, cy + 1.4], [cx, cy + 9], z, P);
    d += k.lineOnTop([cx - 4.5, cy - 1.4], [cx + 4.5, cy - 1.4], z, P) + k.lineOnTop([cx - 4.5, cy + 1.4], [cx + 4.5, cy + 1.4], z, P);
  } else {
    // a coil: leads and four bumps
    const pts = [[cx, cy - 9], [cx, cy - 6]];
    for (let n = 0; n <= 48; n++) {
      const t = n / 48;
      const q = t * Math.PI * 4;
      pts.push([cx - 2.6 * Math.abs(Math.sin(q)), cy - 6 + 12 * t]);
    }
    pts.push([cx, cy + 9]);
    d += k.onTop(pts, z, P);
  }
  out.push(L(d, { tone: "hi", free: true }));
  out.push(D([at([x + 2.2, y + 2.2, z]), at([x + plan.w - 2.2, y + plan.d - 2.2, z])], { size: 0.4 }));
  return out.join("");
}

// ── the name plate: an engraved plate with rule lines for its printing, screwed at the corners ──
function namePlate() {
  const plan = W.NAMEPLATE, z = 1;
  const out = [S(k.slabOf(plan, 0, z, P, 4, 0.3), { tone: "lo", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 1.6), z, P, 4), { tone: "faint" }));
  const rows = [[plan.y + 8, plan.y + plan.d - 8], [plan.y + 8, plan.y + plan.d - 16], [plan.y + 8, plan.y + plan.d - 12]];
  rows.forEach(([a, b], n) => out.push(L(k.lineOnTop([plan.x + 6 + n * 4, a], [plan.x + 6 + n * 4, b], z, P), { tone: n ? "lo" : "mid", free: true })));
  out.push(screwsAt(k.corners(plan, 3), z, 1.2));
  return out.join("");
}

// ── assembly ───────────────────────────────────────────────────────────────────
const LABEL =
  "A lab bench with two circuits side by side, fed by one supply through one two-blade knife switch. The back lane has a lamp, a current meter and a capacitor with a fullness gauge; the front lane has a lamp, a current meter and a coil with a compass. The lamps, needles and current dots show how differently the capacitor and the coil let current through.";

const body = [
  lightDefs(),
  board(),
  traces(),
  pool("C", LANE.C),
  pool("L", LANE.L),
  `<g data-layer="dots"></g>`,
  namePlate(),
  supply(),
  switchBase(),
  `<g data-slot="switch"></g>`,
  switchFront(),
  `<g data-slot="spark"></g>`,
  drainButton(),
  lamp("C"),
  meter("C"),
  symbolPlate("C"),
  capacitor(),
  gauge(),
  lamp("L"),
  meter("L"),
  symbolPlate("L"),
  coil(),
  compass(),
];

const svg = k.figureSvg({ width: W.WIDTH, height: W.HEIGHT, label: LABEL, body });

// ── the page ───────────────────────────────────────────────────────────────────
const stripExports = (text) => text.replace(/^export /gm, "");
// Fig 2's code sits inside the live script, just before its animation loop
const live = readFileSync(join(HERE, "live.js"), "utf8").replace("  // ── the loop ──", () => readFileSync(join(HERE, "diagram.js"), "utf8") + "  // ── the loop ──");
const DATA = `const P = ${JSON.stringify(P)};\nconst SWITCH_FRAMES = ${JSON.stringify(SWITCH_FRAMES)};\n`;

const page = k.plateHtml({
  fig: "Fig 1",
  title: "Capacitor vs coil",
  hint: "Blue parts: click or drag them",
  readout: "",
  keys: [
    { mark: "lit", label: "Lamp light and moving dots: current flowing" },
    { mark: "raised", label: "Back lane: capacitor (gauge shows how full)" },
    { mark: "dim", label: "Front lane: coil (compass shows its magnetic field)" },
  ],
  caption:
    "Both lanes get the same push from the same supply through the same switch, and both lamps are the same. The only difference is the part at the end: a capacitor (it stores charge, like a tank filling with water) or a coil (it stores a magnetic field, like a heavy wheel that is hard to start and hard to stop). Real circuits do all this in thousandths of a second, so the figure plays in slow motion (the factor is shown beside the controls).",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Capacitor and coil circuits on one bench. Press space to flip the switch.">${svg}</div>`,
});

const extraCss = `
.ct-screen{fill:var(--ct-screen);stroke:none}
.ct-glass{fill:var(--anatomy-face);stroke:none}
.iso[data-theme="dark"]{--ct-screen:#060606;--lamp-core:#fffaf0;--lamp-hot:#ffd27a;--lamp-edge:#f0a23a;--glow0:rgba(255,214,140,.9);--glow1:rgba(255,170,60,.36);--pool0:rgba(255,190,90,.3);--pool1:rgba(255,160,60,.09);--seg-on:#5ee08a;--spark0:#ffffff;--spark1:rgba(150,200,255,.75)}
.iso[data-theme="light"]{--ct-screen:#ffffff;--lamp-core:#fff6dc;--lamp-hot:#ffc048;--lamp-edge:#d98a1c;--glow0:rgba(255,190,80,.6);--glow1:rgba(250,160,40,.18);--pool0:rgba(240,160,40,.18);--pool1:rgba(240,160,40,.05);--seg-on:#17a34a;--spark0:#fff7c8;--spark1:rgba(70,120,230,.55)}
.ct-g0{stop-color:var(--glow0)}.ct-g1{stop-color:var(--glow1)}.ct-g2{stop-color:rgba(255,170,60,0)}
.ct-p0{stop-color:var(--pool0)}.ct-p1{stop-color:var(--pool1)}.ct-p2{stop-color:rgba(255,170,60,0)}
.ct-e0{stop-color:var(--lamp-core)}.ct-e1{stop-color:var(--lamp-hot)}.ct-e2{stop-color:var(--lamp-edge)}
.ct-s0{stop-color:var(--spark0)}.ct-s1{stop-color:var(--spark1)}.ct-s2{stop-color:rgba(120,170,255,0)}
.ct-globe-lit{fill:url(#ct-globe);stroke:var(--lamp-edge);stroke-width:.6px}
.ct-fil-lit{fill:none;stroke:var(--lamp-core);stroke-width:1.3px;stroke-linecap:round}
.ct-seg{fill:var(--anatomy-faint);stroke:none;transition:fill .12s}
.ct-seg[data-on]{fill:var(--seg-on)}
.ct-spark{fill:none;stroke:var(--spark0);stroke-width:1.1px;stroke-linejoin:round;stroke-linecap:round}
.iso[data-theme="dark"] [data-part^=glow],.iso[data-theme="dark"] [data-part^=pool],.iso[data-theme="dark"] .ct-spark-glow{mix-blend-mode:screen}
[data-part^=glow],[data-part^=pool],[data-part^=lit-],[data-slot=spark]{pointer-events:none}
.ct-hub{fill:var(--anatomy-hi);stroke:var(--anatomy-paper);stroke-width:.5px;paint-order:stroke}
.ct-lcd{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-weight:600;letter-spacing:.02em}
[data-part^=btn-][data-on] .ct-icon{stroke:var(--anatomy-lit);stroke-width:1.1px}
.ct-carrier{stroke:var(--anatomy-paper);stroke-width:.7px;paint-order:stroke;fill:var(--anatomy-lit)}
[data-grab]{cursor:grab;touch-action:none}
[data-grab=switch],[data-grab^=mode-],[data-grab=drain]{cursor:pointer}
.iso[data-theme="light"] .ct-touch{--anatomy-shade-0:#c4d2fa;--anatomy-shade-1:#d0dbfb;--anatomy-shade-2:#dce5fd;--anatomy-shade-3:#e7eefe;--anatomy-top:#f1f5ff;--anatomy-hi:#3e63dd;--anatomy-mid:#5a7be4;--anatomy-lo:#7f99ea;--anatomy-faint:#b8c8f6;--anatomy-lit-top:#f1f5ff;--anatomy-lit-shade:#dce5fd}
.iso[data-theme="dark"] .ct-touch{--anatomy-shade-0:#0d1730;--anatomy-shade-1:#101d3d;--anatomy-shade-2:#132349;--anatomy-shade-3:#162854;--anatomy-top:#1a2f63;--anatomy-hi:#6b9bff;--anatomy-mid:#5583e6;--anatomy-lo:#3f63b8;--anatomy-faint:#284482;--anatomy-lit-top:#1a2f63;--anatomy-lit-shade:#132349}
.ct-touch{transition:filter .15s}
.ct-touch:hover,[data-grab]:hover>.ct-touch,.ct-touch.ct-hot{filter:brightness(1.12) drop-shadow(0 0 1.6px var(--anatomy-blue))}
.ct-touch[data-off]{filter:saturate(.55) opacity(.75)}
@media (prefers-reduced-motion:reduce){.ct-touch{transition:none}}
.ct-blue{color:var(--anatomy-blue);font-weight:600}
.ct-head{margin:0 0 -8px}.ct-head h1{margin:0 0 6px;font:600 18px/1.3 var(--anatomy-mono);letter-spacing:.01em;color:var(--anatomy-strong)}.ct-head p{margin:0;max-width:70ch;color:var(--anatomy-text);font-size:14px;line-height:1.6}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
@media (max-width:640px){.iso-stage{overflow-x:auto;overscroll-behavior-x:contain}.iso-stage .iso-svg{width:720px;max-width:none}.iso-plate{padding-left:0;padding-right:0}.iso-plate-corners{inset:18px 14px}}
[data-grab]:active{cursor:grabbing}

.iso[data-theme="dark"]{--grip:#4f9dff;--grip-hot:#8cc0ff}.iso[data-theme="light"]{--grip:#2f74e0;--grip-hot:#1553b8}
.ct-diagram-fig{margin-top:28px}
.ct-diagram{padding:44px 24px 36px}
.ct-diagram svg{display:block;width:100%;height:auto;overflow:visible}
.dg-wire{fill:none;stroke:var(--anatomy-mid);stroke-width:2.4px;stroke-linejoin:round;stroke-linecap:round}
.dg-part{fill:none;stroke:var(--anatomy-hi);stroke-width:2.4px;stroke-linejoin:round;stroke-linecap:round}
.dg-part.dg-fill{fill:var(--anatomy-card)}
.dg-plate{stroke:var(--anatomy-hi);stroke-width:5px;stroke-linecap:round}
.dg-lamp{fill:var(--ct-lamp);fill-opacity:0;stroke:var(--anatomy-hi);stroke-width:2.4px}
.dg-halo{mix-blend-mode:var(--ct-blend,normal);pointer-events:none}
.iso[data-theme="dark"]{--ct-blend:screen}
.dg-loop{fill:none;stroke:var(--anatomy-hi);stroke-width:1.4px;stroke-dasharray:3 4}
.dg-text{font:12px/1 var(--anatomy-mono);fill:var(--anatomy-text)}
.dg-small{font:10.5px/1 var(--anatomy-mono);fill:var(--anatomy-muted)}
.dg-status{font:600 14px/1 var(--anatomy-mono);fill:var(--anatomy-strong)}
.dg-charge{font:600 12px/1 var(--anatomy-mono);text-anchor:middle}
.dg-charge[data-sign="+"]{fill:var(--anatomy-strong)}.dg-charge[data-sign="−"]{fill:var(--anatomy-muted)}
.dg-dot{fill:none;stroke:var(--anatomy-lit);stroke-width:2.2px;stroke-linecap:round;stroke-linejoin:round}
.dg-node{fill:var(--anatomy-hi)}
.dg-contact{fill:var(--anatomy-card);stroke:var(--anatomy-hi);stroke-width:2px}
.dg-lever{fill:none;stroke:var(--grip);stroke-width:4px;stroke-linecap:round}
.dg-gang{stroke:var(--grip);stroke-width:1.6px;stroke-dasharray:4 4}
.dg-spark{fill:none;stroke:var(--spark0);stroke-width:1.6px;stroke-linejoin:round}
.dg-spark-glow{pointer-events:none}.iso[data-theme="dark"] .dg-spark-glow{mix-blend-mode:screen}
.dg-click{cursor:pointer}
.dg-click:hover .dg-lever,.dg-click:hover .dg-gang{stroke:var(--grip-hot)}
.dg-click[data-off]{opacity:.45;cursor:not-allowed}
.dg-pill{fill:var(--anatomy-card);stroke:var(--grip);stroke-width:1.5px}
.dg-opt{font:12px/1 var(--anatomy-mono);fill:var(--grip)}
.dg-click:hover .dg-opt{fill:var(--grip-hot)}
.dg-opt[data-on]{font-weight:700;text-decoration:underline}
@media (max-width:640px){.ct-diagram{padding:40px 0 30px;overflow-x:auto;overscroll-behavior-x:contain}.ct-diagram svg{width:640px;max-width:none}}
${PANEL_CSS}
`;

// Fig 2: the same circuit as a plain diagram. diagram.js draws it from the same state as the bench.
const diagram = `<figure class="iso-figure ct-diagram-fig"><div class="iso-plate"><div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 2</span><span class="iso-plate-corner" data-corner="title">The same circuit, drawn simply</span><span class="iso-plate-corner" data-corner="hint">Click the blue parts</span></div><div class="ct-diagram"><svg viewBox="0 -48 720 400" role="img" aria-label="Circuit diagram of the same bench: a power box feeds a two-blade switch; the top branch has a lamp and a capacitor, the bottom branch a lamp and a coil; both return along one wire. An EMPTY button links the top branch to the return wire. Arrows on the wires show which way the current flows."></svg></div></div><figcaption class="iso-legend"><span class="iso-caption">How to read it: each line is a wire. ⊗ is a lamp. Two parallel plates with a gap are the capacitor: nothing crosses the gap, charge just piles up on the plates (+ on one, − on the other). The bumps are the coil; the loops around it are its magnetic field. The two switch blades are tied together by the dashed line, so they always move together. The little arrows move at the speed of the current, and turn round when it flows backward.</span></figcaption></figure>`;

const layoutOf = (figure, { monitor, controls, below }) => `<div class="ct-layout"><div class="ct-fig">${figure}</div>${monitor}${controls}</div>${below}`;
const intro = `<header class="ct-head"><h1>Capacitor or coil: who lets the current through?</h1><p>Two lamps, one switch, one power box. The back lamp has a <b>capacitor</b> in its path; the front lamp has a <b>coil</b>. Everything drawn in <span class="ct-blue">blue</span> can be clicked or dragged: flip the switch, change how the power pushes, and watch which lamp lights up.</p></header>`;
const html = k
  .pageHtml({ title: "Capacitor vs coil", theme, width: 1760, body: layoutOf(intro + page + diagram, panelHtml(M)), script: kitScript() + "\n" + stripExports(readFileSync(join(HERE, "world.mjs"), "utf8")) + "\n" + stripExports(readFileSync(join(HERE, "model.mjs"), "utf8")) + "\n" + DATA + live })
  .replace("</style>", extraCss + "</style>");

writeFileSync(join(HERE, OUT), html);
console.log("wrote", OUT, (html.length / 1024).toFixed(0) + " KB");
