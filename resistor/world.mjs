// The bench, in world units (about 1 px of the real thing).
// x runs toward the viewer, y runs to the viewer's left, z is up. The top of the board is z = 0.
// Pure data and pure functions only: build.mjs draws from it and the page moves things with it.

export const VIEW_AZIMUTH = 30;
export const WIDTH = 860;
export const HEIGHT = 480;

// ── the board ──────────────────────────────────────────────────────────────────
export const PLATE = { x: -72, y: -176, w: 152, d: 298, r: 9 };
export const PLATE_H = 10;
export const FOOT_H = 5;

// ── the bench supply (right) ───────────────────────────────────────────────────
export const SUP = { x: -66, y: -162, w: 92, d: 70, r: 5 };
export const SUP_Z = 2; // stands on four feet
export const SUP_TOP = 46;
export const FRONT_X = SUP.x + SUP.w; // the front panel faces +x
export const SIDE_Y = SUP.y + SUP.d; // the side with the terminals faces +y, toward the board
// On the front panel, u runs to the viewer's right (toward -y) from the panel's left edge.
export const uOf = (y) => SIDE_Y - y;
export const yOf = (u) => SIDE_Y - u;
export const DISPLAY = { u0: 10, u1: 40, z0: 27, z1: 40 };
export const KNOB = { u: 53, z: 31, r: 7.5, depth: 6.5 };
export const KNOB_SWEEP = 135; // degrees either side of straight up
export const knobAngle = (volts, max = 12) => -KNOB_SWEEP + (2 * KNOB_SWEEP * volts) / max;
export const SWITCH = { u: 13, z: 13, w: 9, h: 10 };
export const LAMP = { u: 27, z: 13, r: 2.2 };
export const HANDLE = { x: -24, y0: -150, y1: -104 };
// The binding posts stand out of the +y side, red + toward the back, black - toward the front.
export const POST_Z = 18;
export const POST_PLUS = -40;
export const POST_MINUS = 4;

// ── the resistor, held in two spring clips ─────────────────────────────────────
export const RX = -40; // its axis, along y
export const RZ = 19;
export const BODY = { y0: -61, y1: -11, r: 7.2 };
export const CLIPS = [-75, 3]; // the clip stands, where the leads end
export const LEAD_R = 0.95;

// ── the LED in its socket ──────────────────────────────────────────────────────
export const LEDP = { x: RX, y: 70, r: 8.5 };
export const SOCKET = { x: RX - 10, y: 57, w: 20, d: 26, r: 2.5, h: 8 };
export const LEG_Y = [65, 75]; // anode (+, from the resistor), cathode (-)
export const LED_Z0 = 25; // the bottom of its rim
export const LED_RIM = { h: 2.2, r: 10 };
export const LED_BODY_TOP = 36; // the straight part ends here
export const LED_DOME = 8.5; // and the dome rises this much above it

// ── the ammeter at the front ───────────────────────────────────────────────────
export const AM = { x: 24, y: 18, w: 34, d: 50, r: 3 };
export const AM_H = 44;
export const AM_FACE_X = AM.x + AM.w;
export const AM_Y0 = AM.y + AM.d; // face coordinate u counts from here toward -y
export const DIAL = { u: 25, z: 13, r: 18, window: [6, 12, 44, 37] };
export const DIAL_SWEEP = 50; // degrees either side of straight up
export const FULL_SCALE = 0.05; // amps: 50 mA across the dial

// ── copper tracks ──────────────────────────────────────────────────────────────
export const TRACE_W = 5;
export const TRACE_H = 1.2;
export const FRONT_ROW = 41;
export const LEFT_COL = 96;
export const TRACES = [
  [[RX, SIDE_Y], [RX, CLIPS[0] - 3]],
  [[RX, CLIPS[1] + 3], [RX, SOCKET.y + 1]],
  [[RX, SOCKET.y + SOCKET.d - 1], [RX, LEFT_COL], [FRONT_ROW, LEFT_COL], [FRONT_ROW, -72], [POST_MINUS, -72], [POST_MINUS, SIDE_Y]],
];

// ── the loop the charge follows ────────────────────────────────────────────────
// Straight segments in order from the + post to the - post. A segment can be hidden (inside a part),
// and each belongs to a layer so the page can draw it just after the part it rides on.
const GZ = TRACE_H + 0.6; // on a track
const SZ = 1.4; // a dot on a strip runs this far off the supply's face
const line = (a, b, layer, extra = {}) => ({ a, b, layer, ...extra });
export const STAND_TOP = RZ - 2.5;

export function loopOf() {
  const legX = RX + 1.2; // the near side of each LED leg
  const segments = [
    line([RX, SIDE_Y - 0.5, POST_Z], [RX, SIDE_Y + SZ, POST_Z], "supply", { hidden: true }),
    line([RX, SIDE_Y + SZ, POST_Z - 7.4], [RX, SIDE_Y + SZ, GZ + 1], "supply"),
    line([RX, SIDE_Y + SZ, GZ + 1], [RX, SIDE_Y + 4, GZ], "board"),
    line([RX, SIDE_Y + 4, GZ], [RX, CLIPS[0] - 5, GZ], "board"),
    line([RX, CLIPS[0] - 5, GZ], [RX, CLIPS[0], RZ], "stand", { hidden: true }),
    line([RX, CLIPS[0], RZ + LEAD_R], [RX, BODY.y0, RZ + LEAD_R], "leadR"),
    line([RX, BODY.y0, RZ], [RX, BODY.y1, RZ], "leadR", { hidden: true }),
    line([RX, BODY.y1, RZ + LEAD_R], [RX, CLIPS[1], RZ + LEAD_R], "leadL"),
    line([RX, CLIPS[1], RZ], [RX, CLIPS[1] + 5, GZ], "stand", { hidden: true }),
    line([RX, CLIPS[1] + 5, GZ], [RX, SOCKET.y, GZ], "board"),
    line([RX, SOCKET.y, GZ], [legX, LEG_Y[0], SOCKET.h], "legs", { hidden: true }),
    line([legX, LEG_Y[0], SOCKET.h], [legX, LEG_Y[0], LED_Z0], "legs"),
    line([legX, LEG_Y[0], LED_Z0], [legX, LEG_Y[1], LED_Z0], "legs", { hidden: true, chip: true }),
    line([legX, LEG_Y[1], LED_Z0], [legX, LEG_Y[1], SOCKET.h], "legs"),
    line([legX, LEG_Y[1], SOCKET.h], [RX, SOCKET.y + SOCKET.d, GZ], "legs", { hidden: true }),
    line([RX, SOCKET.y + SOCKET.d, GZ], [RX, LEFT_COL, GZ], "board"),
    line([RX, LEFT_COL, GZ], [FRONT_ROW, LEFT_COL, GZ], "board"),
    line([FRONT_ROW, LEFT_COL, GZ], [FRONT_ROW, AM_Y0, GZ], "board"),
    line([FRONT_ROW, AM_Y0, GZ], [FRONT_ROW, AM.y, GZ], "board", { hidden: true }),
    line([FRONT_ROW, AM.y, GZ], [FRONT_ROW, -72, GZ], "board"),
    line([FRONT_ROW, -72, GZ], [POST_MINUS, -72, GZ], "board"),
    line([POST_MINUS, -72, GZ], [POST_MINUS, SIDE_Y + 4, GZ], "board"),
    line([POST_MINUS, SIDE_Y + 4, GZ], [POST_MINUS, SIDE_Y + SZ, GZ + 1], "board"),
    line([POST_MINUS, SIDE_Y + SZ, GZ + 1], [POST_MINUS, SIDE_Y + SZ, POST_Z - 7.4], "supply"),
    line([POST_MINUS, SIDE_Y + SZ, POST_Z], [POST_MINUS, SIDE_Y - 0.5, POST_Z], "supply", { hidden: true }),
  ];
  return measure(segments);
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

// A point at distance d along the route, with the layer it is drawn in and how visible it is.
export function carrierAt(route, distance) {
  const segments = route.segments;
  let segment = segments[segments.length - 1];
  for (let k = 0; k < segments.length; k++) {
    if (distance < segments[k].from + segments[k].length) {
      segment = segments[k];
      break;
    }
  }
  const along = segment.length > 1e-9 ? Math.min(1, Math.max(0, (distance - segment.from) / segment.length)) : 0;
  const point = [0, 1, 2].map((k) => segment.a[k] + (segment.b[k] - segment.a[k]) * along);
  let alpha = segment.hidden ? 0 : 1;
  const near = Math.min(segment.fadeA ? (distance - segment.from) / 3 : 9, segment.fadeB ? (segment.from + segment.length - distance) / 3 : 9);
  alpha *= Math.min(1, Math.max(0, near));
  return { point, layer: segment.layer, alpha, chip: !!segment.chip };
}
