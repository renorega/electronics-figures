// The whole circuit in one pure module: a supply, a resistor R, an LED board (two LEDs back to back,
// green one way and red the other, with their own small resistor R2) and a capacitor C. A knife
// switch wires the LED board and the capacitor either in series or in parallel. build.mjs and the
// page both read this module, so the numbers on screen are the numbers that move the parts.
//
// Units: ohms, farads, volts, amps, seconds, coulombs.
//
// Series:    supply → R → LED board → C → back.     One current: vs = i·(R + R2) + vLED + vC
// Parallel:  supply → R → node A; C from A to ground, the LED board from A to ground.
//            supply current iS = (vs − vC)/R,  LED current iL from vC,  capacitor current iC = iS − iL
//
//   capacitor:   iC = C·dvC/dt          (charge piles up on the plates: q = C·vC)
//   LEDs:        no current until the push across them passes the LED's own voltage; past
//                that, the extra voltage drives current through the resistance in their path.

export const RANGE = {
  V: { min: 0, max: 12 }, // the supply knob
  R: { min: 220, max: 2200 }, // R = 220 + 1980·wiper, wiper 0..1 along the winding
  C: { min: 220e-6, max: 2200e-6 }, // C = 2200 µF·overlap, overlap 0.1..1 of the plates facing each other
  f: { min: 0.1, max: 10 }, // Hz, for the pulse and AC sources
};

export const LED = {
  green: { vf: 2.1 }, // the green LED needs about 2.1 V before it lights
  red: { vf: 1.8 }, // a red one needs a little less
  rd: 12, // ohms inside the LED once it conducts
  R2: 470, // the small resistor on the LED board that protects the LEDs
  full: 0.02, // 20 mA: a normal LED at full brightness
  hot: 0.03, // above 30 mA a real LED runs hot
};

export const wiperOf = (R) => (R - RANGE.R.min) / (RANGE.R.max - RANGE.R.min);
export const resistanceAt = (wiper) => RANGE.R.min + (RANGE.R.max - RANGE.R.min) * wiper;
export const overlapOf = (C) => C / RANGE.C.max;
export const capacitanceAt = (overlap) => RANGE.C.max * overlap;
// The frequency knob and slider are logarithmic: 0.1, 1 and 10 Hz are evenly spaced.
export const fFrac = (f) => Math.log(f / RANGE.f.min) / Math.log(RANGE.f.max / RANGE.f.min);
export const fAt = (frac) => RANGE.f.min * Math.pow(RANGE.f.max / RANGE.f.min, frac);

// mode "dc": a battery-like supply and a two-way switch. FILL connects the supply. EMPTY takes the
// supply out and joins its two wires, so the capacitor can push its charge back round, whatever the wiring.
// mode "pulse": the supply's output flips between V and 0 by itself, f times a second.
// mode "ac": the supply swings smoothly from +V to −V and back, f times a second.
// topo: "series" or "parallel", set by the knife switch; "open" while its blades are in the air.
export const DEFAULTS = { V: 9, R: 680, C: 1000e-6, f: 1, mode: "dc", fill: false, topo: "series" };

export function sourceAt(p, t) {
  if (p.mode === "dc") return p.fill ? p.V : 0;
  if (p.mode === "pulse") return (t * p.f) % 1 < 0.5 ? p.V : 0;
  return p.V * Math.sin(2 * Math.PI * p.f * t);
}

const loopR = (p) => p.R + LED.R2 + LED.rd; // everything the series current passes through
const ledR = LED.R2 + LED.rd; // the LED board's own resistance, once an LED conducts

// What the parts will do, from their values alone.
export function derived(p) {
  const Xc = 1 / (2 * Math.PI * Math.max(p.f, 1e-6) * p.C); // how hard the capacitor resists AC at this frequency
  if (p.topo === "parallel") {
    // Filling: C charges through R alone at first (the LEDs are dark until it passes 2.1 V).
    // Full: R and the LED board share the supply; the capacitor sits at the LED board's voltage.
    const steady = Math.max(0, p.V - LED.green.vf) / (p.R + ledR);
    const top = p.V > LED.green.vf ? LED.green.vf + steady * ledR : p.V;
    const tau = p.C * ((p.R * ledR) / (p.R + ledR)); // while filling with the LED on
    const drain = p.C * ((p.R * ledR) / (p.R + ledR)); // on EMPTY, C drains through the LED board and back through R
    return { tau, drain, top, steady, peak: p.V / p.R, Xc };
  }
  const tau = loopR(p) * p.C; // after one tau the capacitor is 63% of the way
  const peak = Math.max(0, p.V - LED.green.vf) / loopR(p); // the first rush when the switch flips to FILL
  const top = Math.max(0, p.V - LED.green.vf); // the capacitor stops here: the LED needs the rest to light
  return { tau, drain: tau, top, steady: 0, peak, Xc };
}

export const initial = () => ({ t: 0, vC: 0, i: 0, iS: 0, iL: 0, iC: 0, vs: 0, charge: 0 });

// Current through the LED board for a voltage x across it (positive: green, negative: red).
function ledCurrent(x, R) {
  if (x > LED.green.vf) return (x - LED.green.vf) / R;
  if (x < -LED.red.vf) return (x + LED.red.vf) / R;
  return 0;
}

// One step of length h with the source held at its midpoint value. In every case the capacitor
// heads exponentially toward a target voltage at a rate set by the conductances it sees, so
// within one LED state the step is exact and it stays stable for any h.
function advance(s, p, h) {
  const vs = sourceAt(p, s.t + h / 2);
  let vC = s.vC;
  if (p.topo === "series") {
    const decay = Math.exp(-h / (loopR(p) * p.C));
    const x = vs - vC;
    if (x > LED.green.vf) vC = vs - LED.green.vf - (vs - LED.green.vf - vC) * decay;
    else if (x < -LED.red.vf) vC = vs + LED.red.vf - (vs + LED.red.vf - vC) * decay;
  } else if (p.topo === "parallel") {
    const gS = 1 / p.R;
    const on = vC > LED.green.vf ? LED.green.vf : vC < -LED.red.vf ? -LED.red.vf : null;
    const gL = on === null ? 0 : 1 / ledR;
    const g = gS + gL;
    if (g > 0) {
      const target = (gS * vs + gL * (on ?? 0)) / g;
      vC = target + (vC - target) * Math.exp((-h * g) / p.C);
    }
  }
  s.charge += Math.abs(vC - s.vC) * p.C; // charge moved onto or off the plates so far
  s.vC = vC;
  s.t += h;
  s.vs = vs;
  Object.assign(s, currentsOf(vs, vC, p));
  s.i = s.iL;
}

// The three currents for a supply voltage and a capacitor voltage.
export function currentsOf(vs, vC, p) {
  if (p.topo === "series") {
    const i = ledCurrent(vs - vC, loopR(p));
    return { iS: i, iL: i, iC: i };
  }
  if (p.topo === "parallel") {
    const iS = (vs - vC) / p.R;
    const iL = ledCurrent(vC, ledR);
    return { iS, iL, iC: iS - iL };
  }
  return { iS: 0, iL: 0, iC: 0 }; // the knife switch is between its clips: nothing is connected
}

// Advance by dt seconds. Steps are kept short next to the source's period so a pulse edge
// lands within a millisecond of where it should.
export function step(s, p, dt) {
  const hMax = Math.min(1e-3, 0.01 / Math.max(p.f, 0.1));
  const n = Math.min(2000, Math.max(1, Math.ceil(dt / hMax)));
  for (let k = 0; k < n; k++) advance(s, p, dt / n);
  return s;
}

// The voltage across each part. In series the same current passes R, then the LED board.
export function readings(s, p) {
  const vR = s.iS * p.R;
  const vBoard = p.topo === "series" ? s.vs - vR - s.vC : p.topo === "parallel" ? s.vC : 0;
  return { vR, vBoard, vC: s.vC, q: p.C * s.vC, energy: 0.5 * p.C * s.vC * s.vC };
}

// How bright each LED looks, 0..1 (more than 1 when it is overdriven). The eye sees light
// on a roughly square-root scale, so a quarter of the current looks about half as bright.
export const glowOf = (i) => ({
  green: i > 0 ? Math.sqrt(i / LED.full) : 0,
  red: i < 0 ? Math.sqrt(-i / LED.full) : 0,
});
