// The whole circuit in one pure module: a series loop of a source, a resistor R,
// an inductor L and a capacitor C. Both build.mjs and the page read it, so the
// numbers on screen are the numbers that move the parts.
//
// Units: ohms, henries, farads, volts, amps, seconds, coulombs, joules.
//
//   source:      vs(t)
//   resistor:    vR = R i                 (it turns current into heat)
//   inductor:    vL = L di/dt             (it resists a change in current)
//   capacitor:   i  = C dvC/dt            (it stores charge: q = C vC)
//   loop law:    vs = vR + vL + vC

// What each physical part can do. Each range is the travel of a real part:
// the wiper on the rheostat, the ferrite slug in the coil, the plate overlap.
export const RANGE = {
  R: { min: 0.5, max: 100 }, // ohms. R = 0.5 + 99.5 * wiper, wiper 0..1 along the winding
  L: { min: 5e-3, max: 50e-3 }, // henries. L = 5 mH * (1 + 9 * slug), slug = share of the coil the ferrite fills
  C: { min: 47e-6, max: 470e-6 }, // farads. C = 470 uF * overlap, overlap = share of the plates facing each other
  V: { min: 0, max: 24 },
  I: { min: 0.1, max: 3 }, // current limit of the supply
  f: { min: 20, max: 400 }, // Hz, for the square and sine drive
};

// Linear position of each part (0..1) and back.
export const wiperOf = (R) => (R - RANGE.R.min) / (RANGE.R.max - RANGE.R.min);
export const slugOf = (L) => (L / RANGE.L.min - 1) / 9;
export const overlapOf = (C) => C / RANGE.C.max;
export const resistanceAt = (wiper) => RANGE.R.min + (RANGE.R.max - RANGE.R.min) * wiper;
export const inductanceAt = (slug) => RANGE.L.min * (1 + 9 * slug);
export const capacitanceAt = (overlap) => RANGE.C.max * overlap;

export const DEFAULTS = { R: 5, L: 20e-3, C: 200e-6, V: 10, Ilim: 2, mode: "dc", f: 160, closed: false };

// What the circuit will do, from the three part values alone.
export function derived({ R, L, C }) {
  const w0 = 1 / Math.sqrt(L * C); // natural angular frequency, rad/s
  const alpha = R / (2 * L); // how fast the ringing dies away, 1/s
  const zeta = alpha / w0; // damping ratio: <1 rings, 1 is critical, >1 creeps
  const Z0 = Math.sqrt(L / C); // characteristic impedance, ohms
  const Rcrit = 2 * Z0; // the resistance at which the ringing just stops
  const wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0;
  const regime = zeta < 0.97 ? "under" : zeta > 1.03 ? "over" : "critical";
  return { w0, f0: w0 / (2 * Math.PI), alpha, zeta, Z0, Rcrit, wd, Q: 1 / (2 * zeta), regime, tau: 1 / alpha };
}

// Impedance of the series loop at a drive frequency.
export function impedance({ R, L, C }, f) {
  const w = 2 * Math.PI * f;
  const X = w * L - 1 / (w * C);
  return { mag: Math.hypot(R, X), phase: Math.atan2(X, R), X };
}

export const initial = () => ({ t: 0, q: 0, i: 0, heat: 0, source: 0, cc: false, vs: 0, vterm: 0 });

// The main switch connects the source to the loop, whatever kind of source it is.
export function sourceAt(p, t) {
  if (!p.closed) return 0;
  if (p.mode === "dc") return p.V;
  if (p.mode === "square") return (t * p.f) % 1 < 0.5 ? p.V : 0;
  return p.V * Math.sin(2 * Math.PI * p.f * t);
}

// One fourth-order Runge-Kutta step of dq/dt = i, di/dt = (vs - R i - q/C) / L.
// The supply has a current limit: when the loop wants more than Ilim it goes into
// constant-current mode, holds i at the limit and lets its own voltage fall to
// whatever the resistor and the capacitor need (that is what the CC lamp means).
function advance(s, p, h) {
  const f = (t, q, i) => [i, (sourceAt(p, t) - p.R * i - q / p.C) / p.L];
  const [a1, b1] = f(s.t, s.q, s.i);
  const [a2, b2] = f(s.t + h / 2, s.q + (h / 2) * a1, s.i + (h / 2) * b1);
  const [a3, b3] = f(s.t + h / 2, s.q + (h / 2) * a2, s.i + (h / 2) * b2);
  const [a4, b4] = f(s.t + h, s.q + h * a3, s.i + h * b3);
  const q = s.q + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
  let i = s.i + (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
  let cc = false;
  if (Math.abs(i) >= p.Ilim) {
    i = Math.sign(i) * p.Ilim;
    cc = true;
  }
  const qMid = (s.q + q) / 2;
  const iMid = (s.i + i) / 2;
  const vs = sourceAt(p, s.t + h / 2);
  // In constant-current mode the supply gives exactly what R and C need; otherwise it is vs.
  const vterm = cc ? p.R * iMid + qMid / p.C : vs;
  s.source += vterm * iMid * h; // energy the supply has delivered
  s.heat += p.R * iMid * iMid * h; // energy the resistor has turned into heat
  s.q = q;
  s.i = i;
  s.t += h;
  s.cc = cc;
  s.vs = vs;
  s.vterm = vterm;
}

// Advance by dt seconds of circuit time. The step is cut small enough for the stiffest
// thing in the loop (R/L or the natural frequency), so a big R and a small L stay stable.
export function step(s, p, dt) {
  const d = derived(p);
  const fastest = Math.max(d.w0, p.R / p.L, 2 * Math.PI * p.f);
  const hMax = 0.2 / fastest;
  const n = Math.min(400, Math.max(1, Math.ceil(dt / hMax)));
  for (let k = 0; k < n; k++) advance(s, p, dt / n);
  return s;
}

export const energies = (s, p) => ({
  magnetic: 0.5 * p.L * s.i * s.i,
  electric: (0.5 * s.q * s.q) / p.C,
  heat: s.heat,
  supplied: s.source,
});

export const readings = (s, p) => ({
  vC: s.q / p.C,
  vR: p.R * s.i,
  vL: s.vterm - p.R * s.i - s.q / p.C, // whatever is left of the loop law is the inductor's share
});
