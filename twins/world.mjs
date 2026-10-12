// The bench, in world units (about 1 px of the real thing).
// x runs toward the viewer (down-right on screen), y runs to the viewer's left, z is up.
// The top of the board is z = 0. Pure data and pure functions: build.mjs draws from it, the page moves things with it.

export const VIEW_AZIMUTH = 30;
export const WIDTH = 900;
export const HEIGHT = 450;

// ── the board ──────────────────────────────────────────────────────────────────
export const PLATE = { x: -84, y: -210, w: 198, d: 360, r: 10 };
export const PLATE_H = 10;
export const FOOT_H = 5;

// Two lanes run side by side along y: the capacitor lane at the back, the coil lane at the front.
export const LANE = { C: -50, L: 48 };

// ── the bench supply, at the back between the lanes ────────────────────────────
export const SUP = { x: -62, y: -204, w: 100, d: 58, r: 4 };
export const SUP_Z = 2;
export const SUP_TOP = 26;
export const POST_PLUS = [-10, -154];
export const POST_MINUS = [22, -154];
export const DISPLAY = { x: -54, y: -196, w: 20, d: 36, r: 2 };
export const KNOB_F = { at: [-16, -184], r: 7.5, h: 5 };
export const KNOB_SWEEP = 135;
export const BUTTONS = [
  { mode: "steady", at: [16, -194] },
  { mode: "slow", at: [16, -183] },
  { mode: "fast", at: [16, -172] },
];

// ── the two-blade knife switch ─────────────────────────────────────────────────
// Each blade is hinged at HINGE_Y and lies along -y into its jaws when closed. Opening swings both
// blades up together about the hinge line; an insulating crossbar ties them, with the handle in the middle.
export const SW_BASE = { x: LANE.C - 17, y: -113, w: LANE.L - LANE.C + 34, d: 55, r: 3 };
export const SW_BASE_H = 3;
export const HINGE_Y = -68;
export const JAW_Y = -100;
export const BLADE = { length: 34, width: 6.2, t: 2, z: 9, bar: 24 }; // z: the blade's underside when closed
export const OPEN_DEG = 72;
export const HANDLE_X = (LANE.C + LANE.L) / 2;
// a point on a blade, `along` from the hinge toward the jaws, lifted by `up` off its top face, at opening angle a (degrees)
export function bladePoint(x, along, up, a) {
  const r = (a * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  // the blade's long axis points -y when closed and swings up toward +z; its top face's normal is (0, s, c)
  return [x, HINGE_Y - along * c + up * s, BLADE.z + BLADE.t / 2 + along * s + up * c];
}
export const bladeAxes = (a) => {
  const r = (a * Math.PI) / 180;
  return { along: [0, -Math.cos(r), Math.sin(r)], normal: [0, Math.sin(r), Math.cos(r)] };
};
export const SPARK_AT = [LANE.L, JAW_Y + 1.5, BLADE.z + BLADE.t + 1.2];

// ── the EMPTY button, across the back lane's start and the ground ──────────────
// It sits between the lanes: one pin taps the back lane just after the switch, the other runs to the front rail.
export const DRAIN = { at: [-20, -52], pins: [-14, -26] };
export const DRAIN_RAIL_X = -6;

// ── each lane, along y ─────────────────────────────────────────────────────────
export const LAMP_Y = -32;
export const SOCKET_R = 10;
export const BULB = { base: 4, collar: 5, shell: 7, neck: 3.7, r: 8.6 };
export const bulbZ = () => {
  const z0 = BULB.base, z1 = z0 + BULB.collar, z2 = z1 + BULB.shell;
  return { z0, z1, z2, centre: z2 + 1.6 + BULB.r * 0.92, top: z2 + 1.6 + BULB.r * 1.92 };
};
export const METER = { y: -13, d: 28, w: 26, h: 9, r: 3 };
export const meterPlan = (x) => ({ x: x - METER.w / 2, y: METER.y, w: METER.w, d: METER.d, r: METER.r });
export const meterPivot = (x) => [x + 8, METER.y + METER.d / 2];
export const NEEDLE_R = 16;
export const METER_SWEEP = 50; // degrees either side of pointing -x
export const AMPS_FULL = 0.6; // the meters read −0.6 … +0.6 A

export const PART = { y0: 30, y1: 84, zc: 15 };
export const POSTS = [21, 93];
export const CAP_R = 11;
export const COIL = { flange: 13, wind: 10.4, core: 4.6, turns: 15 };
export const SADDLES = [38, 76];

// the capacitor's fullness gauge (a 10-segment light bar) between the lanes, wired across the capacitor
export const GAUGE = { x: -28, y: 32, w: 12, d: 50, r: 2, h: 4.5, segments: 10 };
// the compass in front of the coil
export const COMPASS = { at: [78, 57], r: 11.5, h: 4 };
// a name plate in the open corner in front of the switch
export const NAMEPLATE = { x: 66, y: -118, w: 20, d: 44, r: 1.8 };

// ── traces ─────────────────────────────────────────────────────────────────────
export const TRACE_W = 4;
export const TRACE_H = 1.2;
export const RAIL_Y = 130;
export const RAIL_X = 98;
export const TEE = [POST_PLUS[0], -124];
export const TRACES = [
  [[POST_PLUS[0], SUP.y + SUP.d], TEE], // + post to the tee
  [[LANE.C, SW_BASE.y], [LANE.C, TEE[1]], [LANE.L, TEE[1]], [LANE.L, SW_BASE.y]], // the + bus to both jaws
  [[LANE.C, SW_BASE.y + SW_BASE.d], [LANE.C, RAIL_Y]], // back lane
  [[LANE.L, SW_BASE.y + SW_BASE.d], [LANE.L, RAIL_Y]], // front lane
  [[DRAIN.pins[1], DRAIN.at[1]], [LANE.C, DRAIN.at[1]]], // EMPTY button tap
  [[DRAIN.pins[0], DRAIN.at[1]], [DRAIN_RAIL_X, DRAIN.at[1]], [DRAIN_RAIL_X, RAIL_Y]], // EMPTY button to the rail
  [[LANE.C, RAIL_Y], [RAIL_X, RAIL_Y], [RAIL_X, -134], [POST_MINUS[0], -134], [POST_MINUS[0], SUP.y + SUP.d]], // ground
];
export const JUNCTIONS = [TEE, [LANE.L, RAIL_Y], [DRAIN_RAIL_X, RAIL_Y], [LANE.C, DRAIN.at[1]]];
// the gauge's two thin wires to the capacitor's posts
export const GAUGE_WIRES = [
  [[GAUGE.x + GAUGE.w / 2, GAUGE.y], [GAUGE.x + GAUGE.w / 2, POSTS[0]], [LANE.C + 3.4, POSTS[0]]],
  [[GAUGE.x + GAUGE.w / 2, GAUGE.y + GAUGE.d], [GAUGE.x + GAUGE.w / 2, POSTS[1]], [LANE.C + 3.4, POSTS[1]]],
];

// ── current dots: one route per stretch of wire that carries its own current ───
// Dots ride on the flat traces, drawn just above them, so every part standing on a trace hides them.
// Each route lists its corners in the direction a positive current flows.
const S0 = SUP.y + SUP.d;
export const ROUTES = {
  plus: [[POST_PLUS[0], S0], TEE],
  feedC: [TEE, [LANE.C, TEE[1]], [LANE.C, SW_BASE.y]],
  feedL: [TEE, [LANE.L, TEE[1]], [LANE.L, SW_BASE.y]],
  laneC: [[LANE.C, SW_BASE.y + SW_BASE.d], [LANE.C, RAIL_Y]],
  laneL: [[LANE.L, SW_BASE.y + SW_BASE.d], [LANE.L, RAIL_Y]],
  drain: [[LANE.C, DRAIN.at[1]], [DRAIN.pins[1], DRAIN.at[1]], [DRAIN.pins[0], DRAIN.at[1]], [DRAIN_RAIL_X, DRAIN.at[1]], [DRAIN_RAIL_X, RAIL_Y]],
  railA: [[LANE.C, RAIL_Y], [DRAIN_RAIL_X, RAIL_Y]],
  railB: [[DRAIN_RAIL_X, RAIL_Y], [LANE.L, RAIL_Y]],
  railC: [[LANE.L, RAIL_Y], [RAIL_X, RAIL_Y], [RAIL_X, -134], [POST_MINUS[0], -134], [POST_MINUS[0], S0]],
};
// what each route carries, from the model's readings
export function routeCurrents(r, p) {
  const drain = !p.on && p.drain ? -r.iC : 0;
  return {
    plus: (p.on ? r.iC : 0) + r.iL,
    feedC: p.on ? r.iC : 0,
    feedL: r.iL,
    laneC: r.iC,
    laneL: r.iL,
    drain,
    railA: r.iC,
    railB: r.iC + drain,
    railC: r.iC + drain + r.iL,
  };
}
export function measure(points) {
  let total = 0;
  const legs = [];
  for (let n = 1; n < points.length; n++) {
    const a = points[n - 1], b = points[n];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    legs.push({ a, b, from: total, length });
    total += length;
  }
  return { legs, length: total };
}
export function pointAt(route, distance) {
  let leg = route.legs[route.legs.length - 1];
  for (const l of route.legs) if (distance < l.from + l.length) { leg = l; break; }
  const t = leg.length ? Math.min(1, Math.max(0, (distance - leg.from) / leg.length)) : 0;
  return [leg.a[0] + (leg.b[0] - leg.a[0]) * t, leg.a[1] + (leg.b[1] - leg.a[1]) * t];
}

// knob angle for a wiggle speed (log scale)
export const knobAngle = (f) => -KNOB_SWEEP + (2 * KNOB_SWEEP * Math.log(f / 2)) / Math.log(100);
