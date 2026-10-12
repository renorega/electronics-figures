// The board, in world units (about 1 px of the real thing).
// x runs toward the viewer, y runs to the viewer's left, z is up. The floor of the board is z = 0.
// Pure data and pure functions only: build.mjs draws from it and the page moves things with it.

export const VIEW_AZIMUTH = 30;
export const WIDTH = 860;
export const HEIGHT = 540;

// ── the board and the backboard ────────────────────────────────────────────────
export const PLATE = { x: -80, y: -166, w: 160, d: 306, r: 9 };
export const PLATE_H = 10;
export const FOOT_H = 5;

export const BACK = { x: -80, y: -162, w: 12, d: 296, r: 2.5 };
export const BACK_H = 106;
export const FACE_X = -68; // the +x face of the backboard
export const FACE_Y0 = 134; // face coordinate u counts from here toward -y

// A point on the backboard face: u runs to the viewer's right, v = -z (down on the page).
export const SCOPE = { u0: 78, u1: 218, z0: 42, z1: 94 };
export const METER = { r: 21, z: 70, ammeter: 40, voltmeter: 256 };
export const METER_SWEEP = 58; // degrees either side of straight up

// ── the bench supply (far right) ───────────────────────────────────────────────
export const SUP = { x: -52, y: -158, w: 108, d: 60, r: 4 };
export const SUP_Z = 2; // on four feet
export const SUP_TOP = 26;
export const POST_PLUS = [-31, -104];
export const POST_MINUS = [44, -104];
export const KNOB_V = { at: [-5, -138], r: 8.5, h: 5 };
export const KNOB_I = { at: [-5, -116], r: 6.5, h: 4.5 };
export const KNOB_F = { at: [24, -114], r: 5.5, h: 4 };
export const BUTTONS = [
  { mode: "dc", at: [26, -152] },
  { mode: "square", at: [26, -142] },
  { mode: "sine", at: [26, -132] },
];
export const TOGGLE = { at: [42, -140] };
export const LAMP = { at: [42, -122], r: 2.6 };
export const DISPLAY = { x: -47, y: -152, w: 22, d: 42, r: 2 };
export const KNOB_SWEEP = 135; // degrees either side of the knob's "up"

// ── the rheostat: the resistor ─────────────────────────────────────────────────
export const BAR = { x: -48, y: -80, w: 24, d: 62, r: 3 };
export const BAR_H = 9;
export const WIND = { y0: -78, y1: -22, turns: 29 }; // winding from the + end; the wiper slides over it
export const WX = -31; // the contact line along the bar
export const RAIL_X = -18.5;
export const RAIL_TOP = 8;
export const WIPER_ZONE = [WIND.y0, WIND.y1];
export const wiperY = (wiper) => WIND.y0 + (WIND.y1 - WIND.y0) * wiper;

// ── the coil with its ferrite slug: the inductor ───────────────────────────────
export const COIL = { xc: -36, zc: 15.5, r: 10, y0: 0, y1: 40, turns: 9 };
export const TROUGH = { x: -41, y: 40, w: 10, d: 54, r: 2, h: 10 };
export const SLUG = { x: -41, y: 40, w: 10, d: 50, z: 10, h: 11 }; // at rest = slug 0 (all the way out)
export const SLUG_TRAVEL = 40; // sliding in by this much fills the whole coil
export const slugShift = (slug) => -SLUG_TRAVEL * slug;
export const COMPASS = { at: [30, 14], r: 13, h: 4 };
export const THERMO = { at: [30, -52], column: 30 }; // the column's height
export const SCOPE_E = { at: [30, 108], rod: 28, pivot: 12, leaf: 10 }; // the electroscope

// ── the plate capacitor ────────────────────────────────────────────────────────
export const PLATE_W = 56;
export const PLATE_X0 = -58;
export const PLATE_Z0 = 6;
export const PLATE_Z1 = 56;
export const FIXED_Y = 96; // the solid plate
export const SLIDE_Y = 122; // the lattice plate
export const PLATE_T = 3;
export const SLIDE_TRAVEL = PLATE_W * 0.9; // overlap 1 down to 0.1
export const BAR_OFFSETS = [0, 17, 34, 51];
export const BAR_W = 5;
export const RAIL_Y = 124.5;
export const slideShift = (overlap) => PLATE_W * (1 - overlap);

// ── traces ─────────────────────────────────────────────────────────────────────
export const TRACE_W = 4;
export const TRACE_H = 1.2;
export const RETURN_X = 62;
export const TRACES = [
  [[-31, -97], [-31, -86]],
  [[RAIL_X, -11], [RAIL_X, 0], [-26, 0]],
  [[-26, 40], [-26, 93]],
  [[56, RAIL_Y], [RETURN_X, RAIL_Y], [RETURN_X, -90], [44, -90], [44, -97]],
];

// ── the loop the charge carriers follow ────────────────────────────────────────
// Segments are straight lines or the coil's helix. A segment can be hidden (inside a block),
// and each belongs to a layer so the page can draw it just after the part it rides on.
const TZ = SUP_TOP + 1.1; // carrier height on the supply's terminal pad
const GZ = TRACE_H + 0.5; // on a trace
const BZ = BAR_H + 1.1; // on the winding
const line = (a, b, layer, extra = {}) => ({ a, b, layer, ...extra });

export function loopOf({ wiper, overlap }) {
  const yw = wiperY(wiper);
  const exit = Math.min(yw + 5.1, -12.5);
  const s = slideShift(overlap);
  const carriageX = PLATE_X0 + s + PLATE_W + 4.4; // just past the carriage's front face
  const railY = RAIL_Y + 1.3; // the carriers keep to one side of the rail, clear of the handle
  const A = [
    line([WX, POST_PLUS[1], TZ], [WX, -97, TZ], "supply"),
    line([WX, -97, TZ], [WX, -97, GZ], "supply"),
    line([WX, -97, GZ], [WX, -86, GZ], "supply"),
    line([WX, -86, GZ], [WX, WIND.y0, BZ], "supply", { hidden: true }),
    line([WX, WIND.y0, BZ], [WX, yw, BZ], "winding"),
    line([WX, yw, BZ], [WX, yw, 14.6], "wiper"),
    line([WX, yw, 16.6], [-21.5, yw, 16.6], "wiper"),
    line([-21.5, yw, 16.6], [RAIL_X, exit, RAIL_TOP + 1.1], "wiper", { hidden: true }),
    line([RAIL_X, exit, RAIL_TOP + 1.1], [RAIL_X, -11, RAIL_TOP + 1.1], "wiper"),
    line([RAIL_X, -11, RAIL_TOP + 1.1], [RAIL_X, -11, GZ], "wiper"),
    line([RAIL_X, -11, GZ], [RAIL_X, 0, GZ], "wiper"),
    line([RAIL_X, 0, GZ], [-25.2, 0, GZ], "wiper"),
    line([-25.2, 0, GZ], [-25.2, 0, COIL.zc], "coil"),
    { helix: true, layer: "coil", y0: COIL.y0, y1: COIL.y1, turns: COIL.turns, xc: COIL.xc, zc: COIL.zc, r: COIL.r + 0.8 },
    line([-25.2, COIL.y1, COIL.zc], [-25.2, COIL.y1, GZ], "coil"),
    line([-25.2, COIL.y1, GZ], [-26, COIL.y1, GZ], "coil"),
    line([-26, COIL.y1, GZ], [-26, 92.6, GZ], "coil"),
  ];
  const B = [
    line([carriageX, railY, 3.1], [56, railY, 3.1], "capacitor"),
    line([56, railY, 3.1], [RETURN_X, railY, GZ], "return"),
    line([RETURN_X, railY, GZ], [RETURN_X, -90, GZ], "return"),
    line([RETURN_X, -90, GZ], [44, -90, GZ], "return"),
    line([44, -90, GZ], [44, -96.8, GZ], "supply"),
    line([44, -96.8, GZ], [44, -96.8, TZ], "supply"),
    line([44, -96.8, TZ], [44, POST_MINUS[1], TZ], "supply"),
  ];
  return { A: measure(A), B: measure(B) };
}

const HELIX_STEPS = 24;
function measure(segments) {
  let total = 0;
  const out = segments.map((segment) => {
    let length;
    if (segment.helix) {
      length = 0;
      let last = helixAt(segment, 0);
      for (let k = 1; k <= segment.turns * HELIX_STEPS; k++) {
        const next = helixAt(segment, k / (segment.turns * HELIX_STEPS));
        length += Math.hypot(next[0] - last[0], next[1] - last[1], next[2] - last[2]);
        last = next;
      }
    } else {
      length = Math.hypot(segment.b[0] - segment.a[0], segment.b[1] - segment.a[1], segment.b[2] - segment.a[2]);
    }
    const here = { ...segment, length, from: total };
    total += length;
    return here;
  });
  out.forEach((segment, index) => {
    segment.fadeA = index > 0 && !!out[index - 1].hidden;
    segment.fadeB = index < out.length - 1 && !!out[index + 1].hidden;
  });
  return { segments: out, length: total };
}

export function helixAt(segment, t) {
  const angle = t * segment.turns * Math.PI * 2;
  return [segment.xc + segment.r * Math.cos(angle), segment.y0 + (segment.y1 - segment.y0) * t, segment.zc + segment.r * Math.sin(angle)];
}

// A point at distance d along the route, with the layer it is drawn in and whether it can be seen.
// Dots on the back half of the coil are hidden by the coil's front turns, so they fade out there.
export function carrierAt(route, distance, faceOf) {
  const segments = route.segments;
  let segment = segments[segments.length - 1];
  for (let k = 0; k < segments.length; k++) {
    if (distance < segments[k].from + segments[k].length) {
      segment = segments[k];
      break;
    }
  }
  const along = segment.length > 1e-9 ? Math.min(1, Math.max(0, (distance - segment.from) / segment.length)) : 0;
  let point;
  let alpha = 1;
  if (segment.helix) {
    point = helixAt(segment, along);
    const angle = along * segment.turns * Math.PI * 2;
    const facing = faceOf([Math.cos(angle), 0, Math.sin(angle)]);
    alpha = Math.min(1, Math.max(0, (facing - 0.02) / 0.4));
  } else {
    point = [
      segment.a[0] + (segment.b[0] - segment.a[0]) * along,
      segment.a[1] + (segment.b[1] - segment.a[1]) * along,
      segment.a[2] + (segment.b[2] - segment.a[2]) * along,
    ];
  }
  if (segment.hidden) alpha = 0;
  const near = Math.min(segment.fadeA ? (distance - segment.from) / 3 : 9, segment.fadeB ? (segment.from + segment.length - distance) / 3 : 9);
  return { point, layer: segment.layer, alpha: alpha * Math.min(1, Math.max(0, near)) };
}

// ── the charge-sign marks on the plates ────────────────────────────────────────
export const MARK_COLUMNS = 6;
export const MARK_ROWS = 4;
export const markAt = (column, row) => [PLATE_X0 + 4.5 + column * 9.5 + (row % 2) * 4.2, PLATE_Z0 + 8 + row * 11.2];
// Each mark switches on when the charge density reaches its own threshold, scattered rather than in rows.
export const markRank = (column, row) => (((column * 7 + row * 13 + 5) * 37) % 24) / 24;

// ── flux loops around the coil ─────────────────────────────────────────────────
// Each loop leaves the ring at one end of the coil, climbs over it and comes down into the ring at the other.
export const FLUX_LOOPS = [
  { angle: 62, reach: 12, rise: 20 },
  { angle: 90, reach: 20, rise: 34 },
  { angle: 118, reach: 12, rise: 20 },
];
export function fluxPoint(loop, t) {
  const a = (loop.angle * Math.PI) / 180;
  const sx = COIL.xc + COIL.r * Math.cos(a);
  const sz = COIL.zc + COIL.r * Math.sin(a);
  const p0 = [sx, COIL.y0, sz];
  const p1 = [sx, COIL.y0 - loop.reach, sz + loop.rise];
  const p2 = [sx, COIL.y1 + loop.reach, sz + loop.rise];
  const p3 = [sx, COIL.y1, sz];
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [0, 1, 2].map((k) => w[0] * p0[k] + w[1] * p1[k] + w[2] * p2[k] + w[3] * p3[k]);
}

// ── gauges ─────────────────────────────────────────────────────────────────────
export const FULL_SCALE = { I: 2, V: 30 };
export const KNOB = {
  V: (volts) => -KNOB_SWEEP + (2 * KNOB_SWEEP * volts) / 24,
  I: (amps) => -KNOB_SWEEP + (2 * KNOB_SWEEP * (amps - 0.1)) / 2.9,
  F: (hz) => -KNOB_SWEEP + (2 * KNOB_SWEEP * (hz - 20)) / 380,
};
