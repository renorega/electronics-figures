// Two lanes, one supply, one pure module. build.mjs and the page both read it, so the numbers on
// screen are the numbers that move the parts.
//
// The supply feeds a two-blade knife switch. Each blade starts one lane; both lanes come back to
// the supply's minus post along one shared ground rail.
//
//   back lane:  blade -> lamp (R) -> meter -> capacitor C          R dq/dt + q/C = v
//   front lane: blade -> lamp (R) -> meter -> coil L (wire rL)     L di/dt + (R + rL) i = v
//
// The lamps are the same 6 V, 0.6 A bulbs, treated as a fixed 10 ohms (a real filament's resistance
// rises a little as it heats). Brightness is the lamp's power over its rated 3.6 W.
//
// OFF really opens both lanes:
//   - the capacitor has nowhere to send its charge, so it keeps it (its gauge stays where it was);
//   - the coil's current can't stop at once, so it jumps the opening gap as a spark. The spark is
//     modelled as a fixed arc resistance Rarc, which puts a few hundred volts across the gap.
// The blue EMPTY button (only while OFF) joins the back lane's start to ground, so the capacitor
// empties back through its own lamp, the current running the other way.
// Units: ohms, farads, henries, volts, amps, seconds.

export const PARTS = {
  R: 10, // ohms, each lamp
  rL: 0.5, // ohms, the coil's copper wire
  C: 1000e-6, // farads: a 1000 µF electrolytic capacitor
  L: 0.1, // henries: a 100 mH iron-core coil
  V: 6, // volts: the supply's push (and the peak of a wiggle)
  Irated: 0.6, // amps: the lamps' normal current
  Rarc: 400, // ohms: the spark across the opening switch blade
};
export const PRATED = PARTS.Irated * PARTS.Irated * PARTS.R; // 3.6 W
export const TAU_C = PARTS.R * PARTS.C; // 10 ms
export const TAU_L = PARTS.L / (PARTS.R + PARTS.rL); // 9.5 ms

// Real circuits are far too fast to watch, so the page plays them in slow motion. KAPPA is seconds of
// circuit time per second on screen. A steady push plays 150 times slower. A wiggle is slowed so that
// one wiggle takes 1.4–3 s on screen (faster wiggles still look a little faster).
export const KAPPA = 1 / 150;
export const screenPeriod = (f) => Math.min(3.2, Math.max(1.4, 3.2 - 0.8 * Math.log10(f)));
export const kappaFor = (p) => (p.mode === "steady" ? KAPPA : 1 / (p.f * screenPeriod(p.f)));

export const RANGE = { f: { min: 2, max: 200 } }; // hertz, real time
export const WIGGLE = { slow: 5, fast: 100 };
export const DEFAULTS = { mode: "steady", f: WIGGLE.slow, on: false, drain: false };

export const initial = () => ({ t: 0, q: 0, iC: 0, iL: 0, vGap: 0, spark: 0, sparkJ: 0 });

// The supply's push right now.
export const supplyAt = (p, t) => (p.mode === "steady" ? PARTS.V : PARTS.V * Math.sin(2 * Math.PI * p.f * t));

// Each lane is first order with a constant drive over one short step, so each step is exact:
// x moves toward where it would settle, x∞, by the factor e^(−h/τ).
const toward = (x, settle, h, tau) => settle + (x - settle) * Math.exp(-h / tau);

function advance(s, p, h) {
  const { R, rL, C, L, Rarc } = PARTS;
  const v = supplyAt(p, s.t + h / 2);
  if (p.on) {
    const q = toward(s.q, C * v, h, R * C);
    s.iC = (q - s.q) / h;
    s.q = q;
    s.iL = toward(s.iL, v / (R + rL), h, L / (R + rL));
    s.vGap = 0;
    s.spark = 0;
  } else {
    if (p.drain) {
      const q = toward(s.q, 0, h, R * C);
      s.iC = (q - s.q) / h; // negative: the charge goes back the way it came
      s.q = q;
    } else s.iC = 0;
    // the coil's current crosses the gap as a spark until its field is used up
    const i0 = s.iL;
    const i = toward(i0, 0, h, L / (R + rL + Rarc));
    s.iL = Math.abs(i) < 2e-4 ? 0 : i;
    s.vGap = s.iL * Rarc;
    // the field's lost energy is shared by the spark, the lamp and the wire in proportion to resistance
    const sparkJ = (Rarc / (R + rL + Rarc)) * 0.5 * L * (i0 * i0 - s.iL * s.iL);
    s.spark = sparkJ / h; // watts in the spark, averaged over the step
    s.sparkJ += sparkJ;
  }
  s.t += h;
}

// Advance by dt seconds of circuit time, in steps short against the wiggle and the spark.
export function step(s, p, dt) {
  const fastest = Math.max(1 / TAU_L, p.mode === "steady" ? 0 : 2 * Math.PI * p.f * 4, !p.on && s.iL ? (PARTS.R + PARTS.Rarc) / PARTS.L : 0);
  const hMax = 0.2 / fastest;
  const n = Math.min(600, Math.max(1, Math.ceil(dt / hMax)));
  for (let k = 0; k < n; k++) advance(s, p, dt / n);
  return s;
}

// What each part is doing, from the state.
export function readings(s, p) {
  const { R, rL, C, L, V } = PARTS;
  const v = p.on ? supplyAt(p, s.t) : 0;
  const vC = s.q / C;
  // the coil's own voltage is what the rest of its lane leaves over
  const vL = p.on ? v - (R + rL) * s.iL : -(R + rL) * s.iL - s.vGap;
  return {
    v,
    iC: s.iC,
    iL: s.iL,
    vC,
    vL,
    full: vC / V, // how full the capacitor is, 1 = charged to the supply's 6 V
    bC: (s.iC * s.iC * R) / PRATED, // lamp brightness, 1 = normal full brightness
    bL: (s.iL * s.iL * R) / PRATED,
    eC: 0.5 * C * vC * vC, // joules stored in the capacitor's electric field
    eL: 0.5 * L * s.iL * s.iL, // joules stored in the coil's magnetic field
    flux: L * s.iL,
    vGap: s.vGap,
    spark: s.spark,
  };
}

// For the panel: how hard each part pushes back against a wiggle of f hertz (its reactance),
// and the share of the full current each lane lets through once it has settled.
export function wiggleShare(f) {
  const w = 2 * Math.PI * f;
  const Xc = 1 / (w * PARTS.C);
  const Xl = w * PARTS.L;
  const R = PARTS.R;
  const iC = 1 / Math.hypot(R, Xc); // per volt of push
  const iL = 1 / Math.hypot(R + PARTS.rL, Xl);
  return { Xc, Xl, shareC: iC * R, shareL: iL * R, peakC: iC * PARTS.V, peakL: iL * PARTS.V };
}
