// The whole circuit in one pure module: a bench supply, one resistor and one red LED in a loop.
// build.mjs and the page both read it, so every number on screen is the number that moves the parts.
//
// Units: volts, ohms, amps, seconds.
//
//   supply:    pushes with V volts
//   resistor:  vR = I * R                       (Ohm's law)
//   LED:       vLED = n*Vt*ln(1 + I/Is) + I*Rs  (a diode: almost no current below ~1.7 V)
//   loop:      V = vR + vLED                    (the pushes add up around the loop)

// A 5 mm red LED: 1.75 V at 1 mA, about 2.0 V at 20 mA.
export const LED = {
  nVt: 0.06, // volts per e-fold of current (ideality x thermal voltage)
  Is: 1e-3 / Math.exp(1.75 / 0.06), // saturation current, amps
  Rs: 4, // the chip's own small resistance, ohms
  rated: 0.02, // the current it is made for
  safe: 0.03, // the most it can take for long
  fatal: 0.15, // at this current it dies in a fraction of a second
};

export const RANGE = { V: { min: 0, max: 12 }, I: { min: 1, max: 60 } }; // I in mA, for the "pick the current" slider

// Real resistors come in standard sizes. The E12 series, 10 ohms to 10 kilohms.
const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
export const STANDARD = [10, 100, 1000].flatMap((decade) => E12.map((m) => m * (decade / 10))).concat([10000]);

export const DEFAULTS = { V: 9, R: 470, mode: "resistor", Iwant: 20 };

export const ledVoltage = (I) => (I <= 0 ? 0 : LED.nVt * Math.log1p(I / LED.Is) + I * LED.Rs);

// The one current that makes the pushes add up: V = I*R + vLED(I). Bisection, since vLED is monotone.
export function currentFor(V, R) {
  if (V <= 0) return 0;
  let lo = 0, hi = V / R;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (mid * R + ledVoltage(mid) > V) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

// The resistor the "pick the current" mode needs, and the closest one you can actually buy.
export function resistorFor(V, Iwant) {
  const vLED = ledVoltage(Iwant);
  if (V <= vLED + 0.05) return { exact: Infinity, standard: null, vLED };
  const exact = (V - vLED) / Iwant;
  let best = STANDARD[0];
  for (const r of STANDARD) if (Math.abs(Math.log(r / exact)) < Math.abs(Math.log(best / exact))) best = r;
  return { exact, standard: best, vLED };
}

export const nearestStandard = (R) => STANDARD.reduce((best, r) => (Math.abs(Math.log(r / R)) < Math.abs(Math.log(best / R)) ? r : best), STANDARD[0]);

// Everything the page shows, from the supply voltage, the resistor and whether the LED still works.
export function circuit(V, R, burned = false) {
  const I = burned ? 0 : currentFor(V, R);
  const vLED = burned ? V : ledVoltage(I); // a burned LED is an open gap: the whole push sits across it
  const vR = I * R;
  // Light output grows in step with the current; the eye sees roughly its square root.
  const light = I / LED.rated;
  return {
    I,
    vR,
    vLED,
    pR: vR * I, // heat in the resistor, watts
    pLED: vLED * I,
    light,
    glow: Math.min(1.25, Math.sqrt(Math.max(0, light))), // 1 = rated brightness
    state: stateOf(V, I, burned),
  };
}

export function stateOf(V, I, burned) {
  if (burned) return "burned";
  if (I < 0.05e-3) return V < 1.6 ? "nopush" : "off";
  if (I < 3e-3) return "dim";
  if (I <= LED.safe) return "good";
  return "hot";
}

// Over its safe current the LED heats up. `stress` climbs toward 1 (burned out) and cools when the current drops.
// At 60 mA it lasts about a second and a third, at 40 mA about nine: in real life it lasts a little longer,
// but it is cooking all the same.
export function stressStep(stress, I, dt) {
  const over = (I - LED.safe) / LED.safe;
  if (over > 0) return Math.min(1, stress + dt * (0.15 * over + 0.6 * over * over));
  return Math.max(0, stress - dt * 0.35);
}

// The four colour bands of a resistor: two digits, a multiplier, and gold for 5 %.
export const COLOURS = ["black", "brown", "red", "orange", "yellow", "green", "blue", "violet", "grey", "white"];
export function bandsOf(R) {
  const exp = Math.floor(Math.log10(R) + 1e-9) - 1;
  const digits = Math.round(R / Math.pow(10, exp));
  return [Math.floor(digits / 10), digits % 10, exp, "gold"];
}

export const formatOhms = (R) => (R >= 1000 ? `${+(R / 1000).toFixed(R % 1000 ? 1 : 0)} kΩ` : `${Math.round(R)} Ω`);
export const formatmA = (I) => (I * 1e3 >= 10 ? (I * 1e3).toFixed(0) : I * 1e3 >= 1 ? (I * 1e3).toFixed(1) : (I * 1e3).toFixed(2));
