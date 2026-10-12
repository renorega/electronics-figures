// The whole circuit in one pure module. build.mjs and the page both read it, so the
// numbers on screen are the numbers that move the parts.
//
// One loop: supply -> two-way switch -> resistor R -> coil (L, with its wire's own rL) -> red LED -> back.
// Units: ohms, henries, volts, amps, seconds.
//
//   resistor:  vR = R i
//   coil:      vL = L di/dt + rL i     (it pushes back against any change in current)
//   LED:       lights only one way. Below Vknee it passes nothing; above it, vLED = Vknee + Rd i
//   loop law:  vs = vR + vL + vLED
//
// The switch has two positions. ON connects the supply. OFF takes the supply out and joins the
// loop's two ends, so whatever current the coil is carrying can keep flowing round through the LED
// until the resistor and the LED have used up the coil's energy. Nothing is ever left open, so
// there is no spark to model.

export const PARTS = {
  R: 220, // ohms, the white cement resistor
  rL: 30, // ohms, the copper wire of the coil
  Vknee: 1.75, // volts, where a red LED starts to glow
  Rd: 8, // ohms, the LED's own resistance once it is on
  Irated: 0.02, // amps: full brightness, the LED's normal current
  Imax: 0.03, // amps: above this the LED runs hot
};
export const R_LOOP = PARTS.R + PARTS.rL + PARTS.Rd;

// What each physical control can do. L is the iron core: L = 0.5 H * (1 + 9 * core),
// core = how much of the coil the iron fills (0..1). An open iron rod multiplies a coil's L about tenfold.
export const RANGE = {
  L: { min: 0.5, max: 5 },
  V: { min: 0, max: 12 },
  I: { min: 0.005, max: 0.04 }, // the supply's current limit
  f: { min: 2, max: 50 }, // hertz, for blink and wave
};
export const coreOf = (L) => (L / RANGE.L.min - 1) / 9;
export const inductanceAt = (core) => RANGE.L.min * (1 + 9 * core);

export const DEFAULTS = { L: 3, V: 6.5, Ilim: 0.03, mode: "dc", f: 8, on: false };

// The current the loop settles to with a steady supply, and how long the coil makes it take.
export function expected({ V, Ilim, L }) {
  const free = Math.max(0, (V - PARTS.Vknee) / R_LOOP);
  const I = Math.min(free, Ilim);
  const tau = L / R_LOOP; // time constant: 63% of the way there after tau
  return { I, limited: free > Ilim, tau, settle: 5 * tau };
}

export const initial = () => ({ t: 0, i: 0, vs: 0, vterm: 0, vL: 0, cc: false, didt: 0 });

// The voltage the supply would put out right now (before the current limit).
export function supplyAt(p, t) {
  if (p.mode === "dc") return p.V;
  if (p.mode === "square") return (t * p.f) % 1 < 0.5 ? p.V : 0;
  return p.V * Math.sin(2 * Math.PI * p.f * t);
}

// What the loop sees: the supply when the switch is ON, the bridging wire (0 V) when it is OFF.
export const drive = (p, t) => (p.on ? supplyAt(p, t) : 0);

// di/dt for current i under drive v. The LED stops any current flowing backwards: once i is 0 and
// the drive is below the LED's knee, nothing moves.
function slope(v, i, L) {
  if (i <= 0 && v <= PARTS.Vknee) return 0;
  return (v - R_LOOP * i - PARTS.Vknee) / L;
}

// One RK4 step. The supply has a current limit: when the loop asks for more than Ilim, it goes into
// constant-current mode and lowers its own voltage to exactly what the loop needs (the CC lamp).
function advance(s, p, h) {
  const v0 = drive(p, s.t), vm = drive(p, s.t + h / 2), v1 = drive(p, s.t + h);
  const k1 = slope(v0, s.i, p.L);
  const k2 = slope(vm, s.i + (h / 2) * k1, p.L);
  const k3 = slope(vm, s.i + (h / 2) * k2, p.L);
  const k4 = slope(v1, s.i + h * k3, p.L);
  let i = Math.max(0, s.i + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
  let cc = false;
  if (p.on && i >= p.Ilim) {
    i = p.Ilim;
    cc = true;
  }
  const v = drive(p, s.t + h);
  const vLED = i > 0 ? PARTS.Vknee + PARTS.Rd * i : Math.min(v, PARTS.Vknee);
  // with the limit holding the current still, the supply gives only what R and the LED need
  const vterm = cc ? (PARTS.R + PARTS.rL) * i + vLED : v;
  s.didt = (i - s.i) / h;
  s.i = i;
  s.t += h;
  s.cc = cc;
  s.vs = p.on ? supplyAt(p, s.t) : 0;
  s.vterm = vterm;
  // the coil's voltage is whatever the loop law leaves over: drive minus resistor minus LED
  s.vL = vterm - PARTS.R * i - vLED;
}

// Advance by dt seconds of circuit time, in steps small enough for the fastest thing in the loop.
export function step(s, p, dt) {
  const fastest = Math.max(R_LOOP / p.L, 2 * Math.PI * p.f * 4);
  const hMax = 0.1 / fastest;
  const n = Math.min(400, Math.max(1, Math.ceil(dt / hMax)));
  for (let k = 0; k < n; k++) advance(s, p, dt / n);
  return s;
}

// What each part is doing, from the state.
export function readings(s, p) {
  const i = s.i;
  const vLED = i > 0 ? PARTS.Vknee + PARTS.Rd * i : Math.max(0, Math.min(s.vterm, PARTS.Vknee));
  return {
    i,
    vR: PARTS.R * i,
    vLED,
    vL: s.vL,
    vterm: s.vterm,
    brightness: Math.min(1.25, i / PARTS.Irated), // 1 = the LED's normal full brightness
    hot: i > PARTS.Imax,
    energy: 0.5 * p.L * i * i, // joules stored in the coil's magnetic field
  };
}
