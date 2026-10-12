// The bench, in world units (about 1 px of the real thing).
// x runs toward the viewer, y runs to the viewer's left, z is up. The top of the board is z = 0.
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

// On the backboard face: u runs to the viewer's right, z up.
export const SCOPE = { u0: 78, u1: 218, z0: 42, z1: 94 };
export const METER = { z: 70, ammeter: 40, voltmeter: 256 };
export const METER_SWEEP = 58; // degrees either side of straight up
export const FULL_SCALE = { mA: 40, coil: 12 }; // the mA meter reads 0..40, the coil meter -12..+12 V

// ── the bench supply (far right) ───────────────────────────────────────────────
export const SUP = { x: -52, y: -158, w: 108, d: 60, r: 4 };
export const SUP_Z = 2; // on four feet
export const SUP_TOP = 26;
export const LOOP_X = -26; // the line the loop runs along, from the + post to the LED
export const POST_PLUS = [LOOP_X, -104];
export const POST_MINUS = [44, -104];
export const KNOB_V = { at: [-5, -138], r: 8.5, h: 5 };
export const KNOB_I = { at: [-5, -116], r: 6.5, h: 4.5 };
export const KNOB_F = { at: [24, -114], r: 5.5, h: 4 };
export const BUTTONS = [
  { mode: "dc", at: [26, -152] },
  { mode: "square", at: [26, -142] },
  { mode: "sine", at: [26, -132] },
];
export const LAMPS = { cv: [42, -146], cc: [42, -130] };
export const LAMP_R = 2.6;
export const DISPLAY = { x: -47, y: -152, w: 22, d: 40, r: 2 };
export const KNOB_SWEEP = 135; // degrees either side of the knob's "up"

// ── the two-way switch ─────────────────────────────────────────────────────────
// A flat blade turns about a post. ON: it points -y into the jaws fed by the supply's + post.
// OFF: it points +x into the jaws wired straight to the return line, so the loop closes without the supply.
export const SW_BASE = { x: -40, y: -95, w: 50, d: 39, r: 3 };
export const SW_BASE_H = 3;
export const PIVOT = [LOOP_X, -64];
export const BLADE = { length: 23, width: 4.4, z: 7, t: 1.6, handleAt: 15 };
export const ANGLE_ON = -90; // degrees in plan, from +x toward +y
export const ANGLE_OFF = 0;
export const JAW_ON = [LOOP_X, PIVOT[1] - BLADE.length];
export const JAW_OFF = [LOOP_X + BLADE.length, PIVOT[1]];
export const bladeDir = (degrees) => [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];

// ── the resistor: a white cement block on two terminal posts ───────────────────
export const RES = { x: -32.5, y: -45, w: 13, d: 28, r: 1.2, z: 4, h: 11 };
export const RES_POSTS = [-50, -12]; // y of the two posts on the loop line
export const POST_H = 11;

// ── the coil and its iron core ─────────────────────────────────────────────────
export const COIL = { xc: -36, zc: 15.5, r: 10, y0: 0, y1: 40, turns: 9 };
export const TROUGH = { x: -41, y: 40, w: 10, d: 54, r: 2, h: 10 };
export const CORE = { x: -41, y: 40, w: 10, d: 50, z: 10, h: 11 }; // at rest = all the way out
export const CORE_TRAVEL = 40; // sliding in by this much fills the whole coil
export const coreShift = (core) => -CORE_TRAVEL * core;
export const COMPASS = { at: [26, 18], r: 13, h: 4 };

// ── a light meter: a photocell on a stalk looks at the LED, a needle on the top reads the light ──
export const LUX = { x: 14, y: 70, w: 26, d: 30, r: 3, h: 9 };
export const LUX_PIVOT = [LUX.x + LUX.w - 6, LUX.y + LUX.d / 2]; // the needle turns about this, on the top
export const LUX_R = 15; // needle length
export const LUX_SWEEP = 50; // degrees either side of pointing -x
export const CELL = { at: [LUX.x + 6, LUX.y + LUX.d - 6], z: LUX.h, stalk: 7, r: 4.2 };

// ── the LED in its socket ──────────────────────────────────────────────────────
export const SOCKET = { x: -37, y: 102, w: 22, d: 22, r: 2.4, h: 5 };
export const LED = { at: [LOOP_X, 113], z: 11.5, flange: 7.8, r: 6.8, body: 8, dome: 6.8, legs: [-2.8, 2.8] };
export const LED_TOP = LED.z + 1.2 + LED.body + LED.dome;
export const LED_GLOW_AT = [LED.at[0], LED.at[1], LED.z + 1.2 + LED.body + 1.5];

// ── traces ─────────────────────────────────────────────────────────────────────
export const TRACE_W = 4;
export const TRACE_H = 1.2;
export const RETURN_X = 62;
export const RETURN_Y = 113;
export const BYPASS_Y = PIVOT[1];
export const TRACES = [
  [[LOOP_X, -97], [LOOP_X, JAW_ON[1]]], // + post to the ON jaws
  [[LOOP_X, PIVOT[1]], [LOOP_X, RES_POSTS[0]]], // pivot to the resistor
  [[LOOP_X, RES_POSTS[1]], [LOOP_X, 0]], // resistor to the coil
  [[LOOP_X, 40], [LOOP_X, SOCKET.y + 4]], // coil to the LED
  [[LOOP_X, RETURN_Y], [RETURN_X, RETURN_Y], [RETURN_X, -90], [44, -90], [44, -97]], // LED back to the - post
  [[JAW_OFF[0], BYPASS_Y], [RETURN_X, BYPASS_Y]], // the OFF jaws to the return line
];
export const JUNCTION = [RETURN_X, BYPASS_Y];

// ── the routes the current dots follow ─────────────────────────────────────────
// Four open routes, in the direction the current flows (from + round to -):
//   feed:   + post, down to the board, under the switch base, up into the ON jaws, along the blade to the pivot
//   loop:   pivot, resistor, coil, LED, along the front to the junction    (always carries the current)
//   back:   junction to the - post                                          (only when ON)
//   bypass: junction along the bypass trace, into the OFF jaws, along the blade to the pivot (only when OFF)
const TZ = SUP_TOP + 1.1; // on the supply's terminal pad
const GZ = TRACE_H + 0.5; // on a trace
const BZ = BLADE.z + BLADE.t + 0.5; // on the blade
const RZ = RES.z + RES.h + 0.9; // over the resistor
const PZ = POST_H + 0.9; // on top of a terminal post
const line = (a, b, layer, extra = {}) => ({ a, b, layer, ...extra });
const X = LOOP_X;

export function routes() {
  const feed = [
    line([X, POST_PLUS[1], TZ], [X, -97, TZ], "supply"),
    line([X, -97, TZ], [X, -97, GZ], "supply"),
    line([X, -97, GZ], [X, SW_BASE.y, GZ], "supply"),
    line([X, SW_BASE.y, GZ], [X, JAW_ON[1] - 1, BZ], "switch", { hidden: true }),
    line([X, JAW_ON[1] - 1, BZ], [X, PIVOT[1] - 3, BZ], "blade", { blade: "on" }),
  ];
  const [r0, r1] = RES_POSTS;
  const loop = [
    line([X, PIVOT[1] - 3, BZ], [X, SW_BASE.y + SW_BASE.d, GZ], "switch", { hidden: true }),
    line([X, SW_BASE.y + SW_BASE.d, GZ], [X, r0 - 2.6, GZ], "resistor"),
    line([X, r0 - 2.6, GZ], [X, r0, PZ], "resistor", { hidden: true }),
    line([X, r0, PZ], [X, RES.y - 0.5, RZ], "resistor"),
    line([X, RES.y - 0.5, RZ], [X, RES.y + RES.d + 0.5, RZ], "resistor"),
    line([X, RES.y + RES.d + 0.5, RZ], [X, r1, PZ], "resistor"),
    line([X, r1, PZ], [X, r1 + 2.6, GZ], "resistor", { hidden: true }),
    line([X, r1 + 2.6, GZ], [X + 0.8, 0, GZ], "resistor"),
    line([X + 0.8, 0, GZ], [X + 0.8, 0, COIL.zc], "coil"),
    { helix: true, layer: "coil", y0: COIL.y0, y1: COIL.y1, turns: COIL.turns, xc: COIL.xc, zc: COIL.zc, r: COIL.r + 0.8 },
    line([X + 0.8, COIL.y1, COIL.zc], [X + 0.8, COIL.y1, GZ], "coil"),
    line([X + 0.8, COIL.y1, GZ], [X, SOCKET.y - 0.6, GZ], "coil"),
    line([X, SOCKET.y - 0.6, GZ], [X, LED.at[1] + 6, GZ], "led", { hidden: true }),
    line([X, LED.at[1], GZ], [SOCKET.x + SOCKET.w + 0.6, RETURN_Y, GZ], "led", { hidden: true }),
    line([SOCKET.x + SOCKET.w + 0.6, RETURN_Y, GZ], [RETURN_X, RETURN_Y, GZ], "front"),
    line([RETURN_X, RETURN_Y, GZ], [RETURN_X, BYPASS_Y, GZ], "front"),
  ];
  const back = [
    line([RETURN_X, BYPASS_Y, GZ], [RETURN_X, -90, GZ], "front"),
    line([RETURN_X, -90, GZ], [44, -90, GZ], "front"),
    line([44, -90, GZ], [44, -97, GZ], "supply"),
    line([44, -97, GZ], [44, -97, TZ], "supply"),
    line([44, -97, TZ], [44, POST_MINUS[1], TZ], "supply"),
  ];
  const bypass = [
    line([RETURN_X, BYPASS_Y, GZ], [SW_BASE.x + SW_BASE.w, BYPASS_Y, GZ], "bypass"),
    line([SW_BASE.x + SW_BASE.w, BYPASS_Y, GZ], [JAW_OFF[0] + 1, BYPASS_Y, BZ], "switch", { hidden: true }),
    line([JAW_OFF[0] + 1, BYPASS_Y, BZ], [PIVOT[0] + 3, BYPASS_Y, BZ], "blade", { blade: "off" }),
  ];
  return { feed: measure(feed), loop: measure(loop), back: measure(back), bypass: measure(bypass) };
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

// A point at distance d along a route, with the layer it is drawn in and how visible it is.
// Dots on the back half of the coil are hidden by its front turns, so they fade out there.
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
  return { point, layer: segment.layer, blade: segment.blade, alpha: alpha * Math.min(1, Math.max(0, near)) };
}

// ── field loops around the coil ────────────────────────────────────────────────
// Each loop leaves one end of the coil, climbs over it and comes down into the other end.
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

// ── knob angles ────────────────────────────────────────────────────────────────
export const KNOB = {
  V: (volts) => -KNOB_SWEEP + (2 * KNOB_SWEEP * volts) / 12,
  I: (amps) => -KNOB_SWEEP + (2 * KNOB_SWEEP * (amps - 0.005)) / 0.035,
  F: (hz) => -KNOB_SWEEP + (2 * KNOB_SWEEP * (hz - 2)) / 48,
};
