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
export const KNOB_F = { at: [-5, -116], r: 6.5, h: 4.5 };
export const FUSE = { at: [24, -114], r: 3.4 };
export const BUTTONS = [
  { mode: "dc", at: [26, -152] },
  { mode: "pulse", at: [26, -142] },
  { mode: "ac", at: [26, -132] },
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
export const wiperY = (wiper) => WIND.y0 + (WIND.y1 - WIND.y0) * wiper;

// ── the LED holder: a block with a small circuit board and two LEDs back to back ──
export const HOLDER = { x: -40, y: 10, w: 38, d: 56, r: 3.5 };
export const HOLDER_H = 7;
export const PCB = { x: -38, y: 12, w: 34, d: 52, r: 2 };
export const PCB_TOP = 8.4;
export const LED_LIFT = 4.2; // the LEDs stand on their legs this far above the board
export const LEDS = [
  { name: "green", at: [-22, 27] }, // carries the current that fills the capacitor
  { name: "red", at: [-22, 49] }, // carries the current that empties it
];
export const LED_R = 6.2; // body radius
export const LED_RIM = 7.2; // the flange at its base
export const LED_BODY = 10; // straight barrel height above the flange
export const LED_DOME = 6.2;
export const ledZ0 = PCB_TOP + LED_LIFT;
export const ledTop = ledZ0 + 1.2 + LED_BODY + LED_DOME;
// The dome as a function of height above the barrel: an ellipse, so the profile is analytic.
export const domeRadius = (h) => LED_R * Math.sqrt(Math.max(0, 1 - (h / LED_DOME) ** 2));

// ── the light meter beside the LEDs ────────────────────────────────────────────
export const LUX = { at: [26, 36], r: 12.5, h: 5 };
export const LUX_SWEEP = 120; // the needle runs from -120° (dark) to +120° (full scale), 0° pointing at the viewer
export const EYE = { at: [LUX.at[0] - LUX.r - 1.6, LUX.at[1]], z: 6.6, r: 3.2 }; // the photocell, looking at the LEDs

// ── the stopwatch: restarts at every flip, with marks at one and five time constants ──
export const WATCH = { at: [38, -46], r: 15, h: 5.5, turn: 10 }; // one turn of the hand is 10 s
export const WATCH_TWELVE = -Math.PI / 2; // 12 o'clock points to the back (-x); angles run clockwise seen from above

// ── the plate capacitor ────────────────────────────────────────────────────────
export const PLATE_W = 56;
export const PLATE_X0 = -58;
export const PLATE_Z0 = 6;
export const PLATE_Z1 = 56;
export const FIXED_Y = 96; // the solid plate
export const SLIDE_Y = 122; // the lattice plate
export const PLATE_T = 3;
export const BAR_OFFSETS = [0, 17, 34, 51];
export const BAR_W = 5;
export const RAIL_Y = 124.5;
export const slideShift = (overlap) => PLATE_W * (1 - overlap);
export const SCOPE_E = { at: [30, 108], rod: 28, pivot: 12, leaf: 10 }; // the electroscope

// ── the knife switch: series or parallel ─────────────────────────────────────────
// A double-throw, two-pole knife switch on a slate base. Each pole has a hinge in the middle and
// a jaw on each side: lever back (toward -x) is SERIES, lever forward (+x) is PARALLEL.
//   pole A: hinge = LED board out, back jaw = (unused), front jaw = ground (the return wire)
//   pole B: hinge = capacitor,     back jaw = LED board out, front jaw = node J (after the resistor)
// Series:   LED out → B back jaw → blade B → capacitor.            Pole A carries nothing.
// Parallel: LED out → A hinge → blade A → ground;  J → B front jaw → blade B → capacitor.
export const SW = { x: 4, y: 60, w: 40, d: 30, r: 2.4 };
export const SW_H = 4;
export const POLES = { A: 67, B: 83 }; // the y of each pole
export const HINGE_X = 24;
export const JAW = 13; // distance from the hinge to each jaw
export const PIVOT_Z = SW_H + 5; // the blades turn about a line along y at this height
export const BLADE = { from: -2.4, to: 14.2, thick: 1.8, half: 1.6 }; // along the blade, across it, along y
export const XBAR = { at: 16, half: 1.8, reach: 3.2 }; // the insulating crossbar at the blade ends
export const GRIP = { from: 17.8, to: 22, r: 1.4, knob: 2.4 }; // the handle beyond the crossbar
export const SWITCH_FRAMES = 18; // the lever is drawn at 19 angles from 0 (series) to 180 (parallel)
// The blade's direction at angle a (degrees): 0 lies back along -x, 90 points up, 180 lies forward.
export const bladeDir = (a) => [-Math.cos((a * Math.PI) / 180), 0, Math.sin((a * Math.PI) / 180)];
export const SEATED = 9; // within this many degrees of a jaw, the blade is touching it

// ── traces ─────────────────────────────────────────────────────────────────────
export const TRACE_W = 4;
export const TRACE_H = 1.2;
export const RETURN_X = 62;
export const J = [RAIL_X, 0]; // the junction after the resistor
export const K = [RETURN_X, POLES.A]; // where the switch's ground wire joins the return
export const LED_OUT = [HOLDER.x + HOLDER.w, 62]; // the LED board's output, on the holder's front face
export const CAP_IN = [-2, 93]; // the fixed plate's terminal
const TAP_X = 42;
export const TRACES = [
  [[-31, -97], [-31, -86]],
  [[RAIL_X, -11], [RAIL_X, HOLDER.y]],
  [J, [TAP_X, 0], [TAP_X, SW.y]], // J to the switch, round the light meter
  [LED_OUT, [SW.x, LED_OUT[1]]], // LED board out to the switch
  [CAP_IN, [CAP_IN[0], 86], [SW.x, 86]], // the capacitor to the switch (B's hinge, under the base)
  [K, [SW.x + SW.w, POLES.A]], // the switch's ground jaw to the return
  [[56, RAIL_Y], [RETURN_X, RAIL_Y], [RETURN_X, -90], [44, -90], [44, -97]],
];

// ── the paths the charge carriers follow ─────────────────────────────────────────
// Each run is a chain of straight segments that one current flows along. A segment can be hidden
// (inside a block), and each belongs to a layer so the page can draw it just after the part it rides on.
// In series one current flows everywhere; in parallel it splits at J and joins again at K.
const TZ = SUP_TOP + 1.1; // carrier height on the supply's terminal pad
const GZ = TRACE_H + 0.5; // on a trace
const BZ = BAR_H + 1.1; // on the winding
const DZ = PIVOT_Z + BLADE.thick / 2 + 0.5; // on top of a seated blade
const line = (a, b, layer, extra = {}) => ({ a, b, layer, ...extra });
const hide = (a, b) => line(a, b, "switch", { hidden: true });

export function carrierRuns({ wiper, overlap }, topo) {
  const yw = wiperY(wiper);
  const exit = Math.min(yw + 5.1, -12.5);
  const s = slideShift(overlap);
  const carriageX = PLATE_X0 + s + PLATE_W + 4.4; // just past the carriage's front face
  const railY = RAIL_Y + 1.3; // the carriers keep to one side of the rail, clear of the handle
  const supply = [
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
    line([RAIL_X, -11, GZ], [J[0], J[1], GZ], "wiper"),
  ];
  // through the LED board: in at the back, out on its front face
  const board = [
    line([J[0], J[1], GZ], [RAIL_X, HOLDER.y, GZ], "wiper"),
    line([RAIL_X, HOLDER.y, GZ], [LED_OUT[0], LED_OUT[1], GZ], "holder", { hidden: true }),
    line([LED_OUT[0], LED_OUT[1], GZ], [SW.x, LED_OUT[1], GZ], "holder"),
  ];
  // along a seated blade, from one end to the other
  const blade = (pole, fromX, toX) => line([fromX, POLES[pole], DZ], [toX, POLES[pole], DZ], "blades");
  const backJaw = HINGE_X - JAW, frontJaw = HINGE_X + JAW;
  const toCap = [
    line([SW.x, 86, GZ], [CAP_IN[0], 86, GZ], "holder"),
    line([CAP_IN[0], 86, GZ], [CAP_IN[0], CAP_IN[1] - 0.4, GZ], "holder"),
  ];
  const ground = [
    line([SW.x + SW.w, POLES.A, GZ], [K[0], K[1], GZ], "switch"),
  ];
  const plateB = [
    line([carriageX, railY, 3.1], [56, railY, 3.1], "capacitor"),
    line([56, railY, 3.1], [RETURN_X, railY, GZ], "return"),
    line([RETURN_X, railY, GZ], [K[0], K[1], GZ], "return"),
  ];
  const home = [
    line([K[0], K[1], GZ], [RETURN_X, -90, GZ], "return"),
    line([RETURN_X, -90, GZ], [44, -90, GZ], "return"),
    line([44, -90, GZ], [44, -96.8, GZ], "supply"),
    line([44, -96.8, GZ], [44, -96.8, TZ], "supply"),
    line([44, -96.8, TZ], [44, POST_MINUS[1], TZ], "supply"),
  ];
  if (topo === "series") {
    return {
      // supply + → resistor → LED board → back jaw of B → blade B → its hinge → the capacitor
      out: { key: "iS", ...measure([
        ...supply, ...board,
        hide([SW.x, LED_OUT[1], GZ], [backJaw, POLES.B, DZ]),
        blade("B", backJaw, HINGE_X),
        hide([HINGE_X, POLES.B, DZ], [SW.x, 86, GZ]),
        ...toCap,
      ]) },
      back: { key: "iS", ...measure([...plateB, ...home]) },
    };
  }
  return {
    supply: { key: "iS", ...measure(supply) },
    // J → LED board → hinge of A → blade A → front jaw → ground → K
    led: { key: "iL", ...measure([
      ...board,
      hide([SW.x, LED_OUT[1], GZ], [HINGE_X, POLES.A, DZ]),
      blade("A", HINGE_X, frontJaw),
      hide([frontJaw, POLES.A, DZ], [SW.x + SW.w, POLES.A, GZ]),
      ...ground,
    ]) },
    // J → round the light meter → front jaw of B → blade B → hinge → the capacitor
    cap: { key: "iC", ...measure([
      line([J[0], J[1], GZ], [TAP_X, 0, GZ], "holder"),
      line([TAP_X, 0, GZ], [TAP_X, SW.y, GZ], "lux"),
      hide([TAP_X, SW.y, GZ], [frontJaw, POLES.B, DZ]),
      blade("B", frontJaw, HINGE_X),
      hide([HINGE_X, POLES.B, DZ], [SW.x, 86, GZ]),
      ...toCap,
    ]) },
    plate: { key: "iC", ...measure(plateB) },
    home: { key: "iS", ...measure(home) },
  };
}

function measure(segments) {
  let total = 0;
  const out = segments.map((segment) => {
    const length = Math.hypot(segment.b[0] - segment.a[0], segment.b[1] - segment.a[1], segment.b[2] - segment.a[2]);
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

// A point at distance d along a run, with the layer it is drawn in and whether it can be seen.
export function carrierAt(run, distance) {
  const segments = run.segments;
  let segment = segments[segments.length - 1];
  for (let k = 0; k < segments.length; k++) {
    if (distance < segments[k].from + segments[k].length) {
      segment = segments[k];
      break;
    }
  }
  const along = segment.length > 1e-9 ? Math.min(1, Math.max(0, (distance - segment.from) / segment.length)) : 0;
  const point = [0, 1, 2].map((k) => segment.a[k] + (segment.b[k] - segment.a[k]) * along);
  const alpha = segment.hidden ? 0 : 1;
  const near = Math.min(segment.fadeA ? (distance - segment.from) / 3 : 9, segment.fadeB ? (segment.from + segment.length - distance) / 3 : 9);
  return { point, layer: segment.layer, alpha: alpha * Math.min(1, Math.max(0, near)) };
}

// ── the charge-sign marks on the plates ────────────────────────────────────────
export const MARK_COLUMNS = 6;
export const MARK_ROWS = 4;
export const markAt = (column, row) => [PLATE_X0 + 4.5 + column * 9.5 + (row % 2) * 4.2, PLATE_Z0 + 8 + row * 11.2];
// Each mark switches on when the charge reaches its own threshold, scattered rather than in rows.
export const markRank = (column, row) => (((column * 7 + row * 13 + 5) * 37) % 24) / 24;

// ── gauges ─────────────────────────────────────────────────────────────────────
export const FULL_SCALE = { I: 0.03, V: 12 }; // the ammeter reads ±30 mA, the voltmeter ±12 V
export const LUX_FULL = 1.5; // the light meter's full scale, in "LED at 20 mA" units
export const KNOB = {
  V: (volts) => -KNOB_SWEEP + (2 * KNOB_SWEEP * volts) / 12,
  F: (frac) => -KNOB_SWEEP + 2 * KNOB_SWEEP * frac,
};
