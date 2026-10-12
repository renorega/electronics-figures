// The live page. The kit, world.mjs and model.mjs are inlined above this, and DATA gives P and FACE.
// Everything is inside one function so its names can't collide with the inlined ones.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const stage = document.querySelector(".iso-stage");
  const svg = stage.querySelector("svg");
  const readout = document.querySelector("[data-readout]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smooth01 = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const follow = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));
  const fx = (n) => (Math.round(n * 100) / 100).toString();
  const toScreen = (p) => iso(p, P);
  const stroke = (d, tone, extra = "") => `<path class="iso-line" data-tone="${tone}" d="${d}"${extra}/>`;

  // ── what the controls ask for, and what the bench is doing ──
  const want = { V: DEFAULTS.V, R: DEFAULTS.R, mode: DEFAULTS.mode, Iwant: DEFAULTS.Iwant / 1000, power: true };
  const now = { V: DEFAULTS.V, out: DEFAULTS.V, I: 0, shownI: 0, needle: 0, glow: 0, flash: 0 };
  let burned = false, stress = 0, phase = 0, touched = false, visible = true;

  // ── pieces of the drawing ──
  const slotOf = (name) => $(`[data-slot="${name}"]`, svg);
  const layers = Object.fromEntries($$("[data-layer]", svg).map((node) => [node.dataset.layer, node]));
  const led = $('[data-part="led"]', svg);
  const glow = slotOf("glow"), pool = slotOf("pool"), smokeSlot = slotOf("smoke");
  const bands = $$("[data-band]", svg);
  const lamp = $('[data-part="lamp"]', svg);

  // the supply's display
  const lcdSlot = slotOf("lcd");
  const lcdU = DISPLAY.u1 - 2;
  lcdSlot.innerHTML = `<text class="rs-lcd" x="${lcdU}" y="${-(DISPLAY.z1 - 6)}" font-size="5.6" text-anchor="end"></text><text class="rs-lcd" x="${lcdU}" y="${-(DISPLAY.z0 + 1.6)}" font-size="4.4" text-anchor="end"></text>`;
  const lcd = $$("text", lcdSlot);
  let lastLcd = "";
  function placeLcd(V, I, on) {
    const a = on ? V.toFixed(1) + " V" : "", b = on ? formatmA(I) + " mA" : "";
    if (a + b === lastLcd) return;
    lastLcd = a + b;
    lcd[0].textContent = a;
    lcd[1].textContent = b;
  }

  // the knob's pointer, drawn on its cap
  const pointerSlot = slotOf("pointer");
  pointerSlot.innerHTML = stroke("", "lit", ' data-free="end" style="stroke-width:1.3"');
  const pointer = pointerSlot.firstChild;
  let lastKnob = null;
  function placeKnob(V) {
    const angle = knobAngle(V);
    if (lastKnob !== null && Math.abs(lastKnob - angle) < 0.05) return;
    lastKnob = angle;
    const a = (angle * Math.PI) / 180, r0 = KNOB.r * 0.2, r1 = KNOB.r * 0.86;
    pointer.setAttribute("d", `M${fx(KNOB.u + r0 * Math.sin(a))} ${fx(-KNOB.z - r0 * Math.cos(a))}L${fx(KNOB.u + r1 * Math.sin(a))} ${fx(-KNOB.z - r1 * Math.cos(a))}`);
  }

  // the rocker: the half that is pressed in shows its line
  const rockerSlot = slotOf("rocker");
  const rh = SWITCH.h / 2 - 1.4, ru0 = SWITCH.u - SWITCH.w / 2 + 1.6, ru1 = SWITCH.u + SWITCH.w / 2 - 1.6;
  rockerSlot.innerHTML = stroke(`M${ru0} ${-(SWITCH.z + rh)}H${ru1}`, "lo", ' data-free=""') + stroke(`M${SWITCH.u} ${-(SWITCH.z - rh + 1.2)}V${-(SWITCH.z - rh - 0.8)}`, "lo", ' data-free=""');
  const rocker = $$("path", rockerSlot);
  function placeSwitch(on) {
    rocker[0].dataset.tone = on ? "lit" : "lo";
    rocker[1].dataset.tone = on ? "lo" : "hi";
    if (on) lamp.setAttribute("data-on", ""); else lamp.removeAttribute("data-on");
  }

  // the meter's needle
  const needleSlot = slotOf("needle");
  needleSlot.innerHTML = stroke("", "lit", ' data-free="end" style="stroke-width:1.1"') + stroke("", "mid", ' data-free="end" style="stroke-width:1.1"') + `<circle class="rs-hub" r="1.6" cx="${DIAL.u}" cy="${-DIAL.z}"/>`;
  const [needleTip, needleTail] = $$("path", needleSlot);
  function placeNeedle(I, dt) {
    const target = clamp(I / FULL_SCALE, 0, 1.08);
    // a damped spring, like a real moving-coil meter
    const k = 140, c = 17;
    if (still.matches) { now.needle = target; now.needleV = 0; }
    else {
      const n = Math.max(1, Math.ceil(dt / 0.004));
      for (let i = 0; i < n; i++) {
        const h = dt / n;
        now.needleV = (now.needleV || 0) + (k * (target - now.needle) - c * (now.needleV || 0)) * h;
        now.needle = clamp(now.needle + now.needleV * h, -0.02, 1.1);
      }
    }
    const a = ((-DIAL_SWEEP + 2 * DIAL_SWEEP * now.needle) * Math.PI) / 180;
    const sx = Math.sin(a), cz = Math.cos(a);
    needleTip.setAttribute("d", `M${DIAL.u} ${-DIAL.z}L${fx(DIAL.u + (DIAL.r + 1.6) * sx)} ${fx(-DIAL.z - (DIAL.r + 1.6) * cz)}`);
    needleTail.setAttribute("d", `M${DIAL.u} ${-DIAL.z}L${fx(DIAL.u - 4 * sx)} ${fx(-DIAL.z + 4 * cz)}`);
  }

  // the resistor's colour bands
  let lastBands = "";
  function placeBands(R) {
    const code = bandsOf(R);
    const key = code.join();
    if (key === lastBands) return;
    lastBands = key;
    code.forEach((digit, index) => bands[index].style.setProperty("--c", `var(--band-${typeof digit === "string" ? digit : COLOURS[digit]})`));
    ui.bands.innerHTML = code.map((digit) => `<i style="--c:var(--band-${typeof digit === "string" ? digit : COLOURS[digit]})" title="${typeof digit === "string" ? digit : COLOURS[digit]}"></i>`).join("");
    const [a, b, zeros] = code;
    ui.decode.textContent = `${cap(COLOURS[a])} ${a}, ${COLOURS[b]} ${b}, ${COLOURS[zeros]} = ${zeros} zero${zeros === 1 ? "" : "s"}  →  ${a}${b}${"0".repeat(zeros)} Ω, gold ±5%`;
    $$(".rs-legend li").forEach((li, digit) => (digit === a || digit === b || digit === zeros ? li.setAttribute("data-on", "") : li.removeAttribute("data-on")));
  }
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  // ── the dots: electric charge riding the copper ──
  const route = loopOf();
  const SPACING = 8.5, DOT_R = Math.max(1.2, 0.95 * P.scale);
  const DRIFT = 2400; // world units per second per amp: 20 mA moves the dots about 48 units a second
  const MAX_SPEED = 330;
  const dots = [];
  for (let n = 0; n < Math.ceil(route.length / SPACING); n++) {
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("class", "rs-dot");
    dot.setAttribute("r", DOT_R.toFixed(2));
    dot.setAttribute("opacity", "0");
    layers.board.appendChild(dot);
    dot.layerName = "board";
    dots.push(dot);
  }
  function placeDots(on) {
    const L = route.length;
    for (let n = 0; n < dots.length; n++) {
      const dot = dots[n];
      const distance = (((phase + n * SPACING) % L) + L) % L;
      const here = carrierAt(route, distance);
      const ends = Math.min(smooth01(0, 5, distance), smooth01(0, 5, L - distance));
      const alpha = here.alpha * ends * on;
      if (alpha < 0.02) { if (dot.on) { dot.setAttribute("opacity", "0"); dot.on = false; } continue; }
      if (dot.layerName !== here.layer) { layers[here.layer].appendChild(dot); dot.layerName = here.layer; }
      const [sx, sy] = toScreen(here.point);
      dot.setAttribute("cx", fx(sx)); dot.setAttribute("cy", fx(sy));
      dot.setAttribute("opacity", alpha.toFixed(2));
      dot.on = true;
    }
  }

  // ── smoke when the LED burns out ──
  const puffs = [];
  const domeTop = [LEDP.x, LEDP.y, LED_BODY_TOP + LED_DOME];
  function burnOut() {
    burned = true;
    now.flash = 1;
    led.setAttribute("data-burned", "");
    if (still.matches) return;
    for (let n = 0; n < 7; n++) {
      const puff = document.createElementNS(NS, "circle");
      puff.setAttribute("class", "rs-smoke");
      smokeSlot.appendChild(puff);
      puffs.push({ node: puff, age: -n * 0.22, drift: (n % 3) - 1 + Math.sin(n * 2.3) * 0.6 });
    }
  }
  function placeSmoke(dt) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const puff = puffs[i];
      puff.age += dt;
      if (puff.age < 0) { puff.node.setAttribute("opacity", "0"); continue; }
      const t = puff.age / 2.8;
      if (t >= 1) { puff.node.remove(); puffs.splice(i, 1); continue; }
      const p = toScreen([domeTop[0] + puff.drift * 6 * t, domeTop[1] + puff.drift * 4 * t, domeTop[2] + 2 + 46 * t]);
      puff.node.setAttribute("cx", fx(p[0] + Math.sin(t * 6 + puff.drift) * 3));
      puff.node.setAttribute("cy", fx(p[1]));
      puff.node.setAttribute("r", fx((2 + 9 * t) * P.scale));
      puff.node.setAttribute("opacity", (0.5 * smooth01(0, 0.08, t) * (1 - t) * (1 - t)).toFixed(3));
    }
  }

  // ── the panel ──
  const ui = {
    V: $('[data-in="V"]'), R: $('[data-in="R"]'), I: $('[data-in="I"]'),
    outV: $('[data-out="V"]'), outR: $('[data-out="R"]'), outI: $('[data-out="I"]'),
    rowR: $('[data-row="R"]'), rowI: $('[data-row="I"]'), hintI: $('[data-hint="I"]'),
    modes: $$("[data-mode]"), power: $('[data-act="power"]'), replace: $('[data-act="replace"]'),
    bands: $("[data-bands]"), decode: $('[data-live="decode"]'), status: $("[data-status]"),
    light: $('[data-bar="light"]'), heat: $('[data-bar="heat"]'),
    eqV: $('[data-live="V"]'), eqLED: $('[data-live="vLED"]'), eqR: $('[data-live="R"]'), eqI: $('[data-live="I"]'), note: $('[data-live="note"]'),
  };
  const firstTouch = () => { touched = true; svg.setAttribute("data-touched", ""); };

  ui.V.addEventListener("input", () => { firstTouch(); want.V = +ui.V.value; solveForCurrent(); kick(); });
  ui.R.addEventListener("input", () => { firstTouch(); want.R = STANDARD[+ui.R.value]; kick(); });
  ui.I.addEventListener("input", () => { firstTouch(); want.Iwant = +ui.I.value / 1000; solveForCurrent(); kick(); });
  ui.modes.forEach((button) => button.addEventListener("click", () => { firstTouch(); setMode(button.dataset.mode); kick(); }));
  ui.power.addEventListener("click", () => { firstTouch(); setPower(!want.power); kick(); });
  ui.replace.addEventListener("click", () => { firstTouch(); replaceLed(); kick(); });

  function setMode(mode) {
    want.mode = mode;
    ui.modes.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    if (mode === "current") { ui.rowR.setAttribute("data-off", ""); ui.rowI.removeAttribute("data-off"); want.Iwant = +ui.I.value / 1000; solveForCurrent(); }
    else { ui.rowI.setAttribute("data-off", ""); ui.rowR.removeAttribute("data-off"); }
  }
  function setPower(on) {
    want.power = on;
    ui.power.setAttribute("aria-pressed", String(on));
    ui.power.querySelector("span").textContent = on ? "On" : "Off";
  }
  // the spare LEDs in the tray: each new LED comes out of it, and the tray is topped up when it runs out
  const spareNodes = $$("[data-spare]", svg);
  let sparesLeft = spareNodes.length;
  function replaceLed() {
    if (burned) {
      if (sparesLeft === 0) { sparesLeft = spareNodes.length; spareNodes.forEach((node) => node.removeAttribute("data-used")); }
      sparesLeft--;
      spareNodes[sparesLeft].setAttribute("data-used", "");
    }
    burned = false; stress = 0;
    led.removeAttribute("data-burned");
  }
  let fit = null; // what "pick the current" found
  function solveForCurrent() {
    if (want.mode !== "current") return;
    fit = resistorFor(want.V, want.Iwant);
    if (fit.standard) { want.R = fit.standard; ui.R.value = STANDARD.indexOf(fit.standard); }
  }
  function setR(R) { want.R = R; ui.R.value = STANDARD.indexOf(R); }
  function setV(V) { want.V = V; ui.V.value = V; }

  // Presets
  const presets = {
    slow: () => { setMode("resistor"); setR(470); setV(0); setPower(true); replaceLed(); ramp = { from: 0, to: 9, t: 0, dur: 9 }; },
    right: () => { setMode("resistor"); setR(470); setV(9); setPower(true); replaceLed(); },
    big: () => { setMode("resistor"); setR(10000); setV(9); setPower(true); replaceLed(); },
    tiny: () => { setMode("resistor"); setR(56); setV(5); setPower(true); replaceLed(); },
  };
  let ramp = null;
  $$("[data-preset]").forEach((button) => button.addEventListener("click", () => { firstTouch(); presets[button.dataset.preset](); kick(); }));

  // ── the figure's own controls: turn the knob, flip the switch, arrow keys ──
  const knob = $('[data-grab="V"]', svg);
  let drag = null;
  knob.addEventListener("pointerdown", (event) => {
    firstTouch();
    drag = { x: event.clientX, y: event.clientY, V: want.V };
    knob.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  knob.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dv = ((event.clientX - drag.x) - (event.clientY - drag.y)) / 14;
    setV(Math.round(clamp(drag.V + dv, RANGE.V.min, RANGE.V.max) * 10) / 10);
    solveForCurrent();
    kick();
  });
  const endDrag = () => { drag = null; };
  knob.addEventListener("pointerup", endDrag);
  knob.addEventListener("pointercancel", endDrag);
  $('[data-grab="power"]', svg).addEventListener("click", () => { firstTouch(); setPower(!want.power); kick(); });
  stage.addEventListener("keydown", (event) => {
    const step = { ArrowUp: 0.5, ArrowDown: -0.5 }[event.key];
    const rStep = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step) { firstTouch(); setV(Math.round(clamp(want.V + step, 0, 12) * 10) / 10); solveForCurrent(); }
    else if (rStep && want.mode === "resistor") { firstTouch(); setR(STANDARD[clamp(STANDARD.indexOf(want.R) + rStep, 0, STANDARD.length - 1)]); }
    else if (event.key === " " || event.key === "Enter") { firstTouch(); setPower(!want.power); }
    else return;
    event.preventDefault();
    kick();
  });

  // ── the idle tour: until someone touches a control, show the main idea on a loop ──
  // Turn up from 0 V (dark below 2 V), then swap resistors big to small, never into the danger zone.
  const TOUR = [
    { t: 0, V: 0, R: 470 }, { t: 7, V: 9, R: 470 }, { t: 10, V: 9, R: 1000 }, { t: 12.5, V: 9, R: 4700 },
    { t: 15, V: 9, R: 1000 }, { t: 17.5, V: 9, R: 470 }, { t: 20, V: 9, R: 330 }, { t: 23, V: 9, R: 330 }, { t: 26, V: 0, R: 470 },
  ];
  let tourT = 0;
  function tour(dt) {
    tourT = (tourT + dt) % 26;
    let a = TOUR[0], b = TOUR[1];
    for (let i = 0; i < TOUR.length - 1; i++) if (tourT >= TOUR[i].t && tourT < TOUR[i + 1].t) { a = TOUR[i]; b = TOUR[i + 1]; }
    const u = (tourT - a.t) / (b.t - a.t);
    setV(Math.round((a.V + (b.V - a.V) * u) * 10) / 10);
    if (want.R !== a.R) setR(a.R);
  }

  // ── the words ──
  const STATES = {
    power: ["Power off", "Nothing is pushing, so nothing flows. Switch the supply on.", "var(--anatomy-muted)"],
    nopush: ["Not enough push", "The LED needs a push of about 2 volts before electricity can get through it. Turn the voltage up.", "var(--anatomy-muted)"],
    off: ["Not enough push", "Only a tiny bit gets through. The LED needs about 2 volts before it really lets electricity in.", "var(--anatomy-muted)"],
    dim: ["A trickle", "Only a little current gets through the resistor, so the LED glows dimly. A smaller resistor or more push will make it brighter.", "var(--anatomy-strong)"],
    good: ["Just right!", "The resistor lets through a safe amount of current. The LED shines and stays cool.", "var(--rs-green)"],
    hot: ["Too much current!", "The resistor is too small, so too much current rushes through. The LED is getting hot. Quick: pick a bigger resistor or turn the push down! If it burns out, you will need one of the spares from the tray.", "var(--rs-red)"],
    burned: ["Pop! The LED burned out", "Too much current cooked it. Now there is a gap inside it, so no current can flow at all: the dots stopped. A burned LED never works again, so take a spare from the tray, and this time use a bigger resistor.", "var(--rs-red)"],
  };
  let lastWords = "", lastState = "";
  const statusCard = ui.status.closest(".rs-now");
  function placeWords(c, V) {
    const key = !want.power ? "power" : c.state;
    const mA = c.I * 1000;
    const text = `${key}|${want.mode}|${V.toFixed(1)}|${want.R}|${mA.toFixed(mA < 10 ? 1 : 0)}|${fit && fit.standard}|${(want.Iwant * 1e3).toFixed(0)}`;
    if (text === lastWords) return;
    lastWords = text;
    const [title, body, colour] = STATES[key];
    ui.status.innerHTML = `<b class="rs-badge"><i aria-hidden="true"></i>${title}</b><span>${body}</span>`;
    if (key !== lastState) {
      // a new state colours the badge and the card's border; only "too much current" moves (it pulses, in CSS)
      lastState = key;
      statusCard.dataset.state = key;
    }
    document.documentElement.style.setProperty("--rs-state", colour);
    ui.outV.textContent = V.toFixed(1) + " V";
    ui.outR.textContent = formatOhms(want.R);
    ui.outI.textContent = (want.Iwant * 1000).toFixed(0) + " mA";
    ui.eqV.textContent = V.toFixed(1) + " V";
    ui.eqLED.textContent = (burned ? 0 : Math.min(V, c.vLED)).toFixed(1) + " V";
    ui.eqR.textContent = formatOhms(want.R);
    ui.eqI.textContent = formatmA(c.I) + " mA";
    readout.textContent = `${V.toFixed(1)} V · ${formatOhms(want.R)} · ${formatmA(c.I)} mA`;
    let note;
    if (burned) note = "A burned-out LED is like a broken pipe: the loop is open, so the current is zero no matter how hard the supply pushes.";
    else if (want.mode === "current") {
      if (!fit || !fit.standard) note = `To push ${(want.Iwant * 1e3).toFixed(0)} mA through the LED you need more than ${fit ? fit.vLED.toFixed(1) : "2"} volts. Turn the push up.`;
      else note = `You asked for ${(want.Iwant * 1e3).toFixed(0)} mA. The sum says (${V.toFixed(1)} V − ${fit.vLED.toFixed(1)} V) ÷ ${(want.Iwant * 1e3).toFixed(0)} mA = ${Math.round(fit.exact)} Ω. Resistors only come in certain sizes, so the closest one was picked: ${formatOhms(fit.standard)}, which lets ${formatmA(c.I)} mA through.`;
    } else if (!want.power || V < 1.6) note = "The LED is like a little gate that only opens when the push is above about 2 volts. Below that, almost nothing flows, whatever the resistor.";
    else note = `The LED keeps about 2 volts of the push. The resistor sets how much current the rest (${Math.max(0, V - c.vLED).toFixed(1)} V) can push through: bigger resistor, smaller current. Double the resistance and the current halves.`;
    ui.note.textContent = note;
    if (burned) ui.replace.removeAttribute("hidden"); else ui.replace.setAttribute("hidden", "");
    ui.replace.textContent = sparesLeft > 0 ? `Take a spare LED from the tray (${sparesLeft} left)` : "The tray is empty: refill it and take one";
  }

  // ── the loop ──
  let last = 0, raf = 0;
  function frame(time) {
    raf = 0;
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60;
    last = time;
    if (!touched && !still.matches) tour(dt);
    if (ramp) {
      ramp.t += dt;
      setV(Math.round((ramp.from + (ramp.to - ramp.from) * Math.min(1, ramp.t / ramp.dur)) * 10) / 10);
      if (ramp.t >= ramp.dur) ramp = null;
    }
    // The supply's output follows its knob quickly, and drops to 0 when it is switched off.
    now.V = still.matches ? want.V : follow(now.V, want.V, dt, 0.08);
    now.out = still.matches ? (want.power ? want.V : 0) : follow(now.out, want.power ? now.V : 0, dt, 0.06);
    const c = circuit(now.out, want.R, burned);
    now.I = c.I;
    stress = stressStep(stress, c.I, dt);
    if (!burned && stress >= 1) burnOut();
    const flow = burned ? circuit(now.out, want.R, true) : c;

    phase += clamp(DRIFT * flow.I, 0, MAX_SPEED) * (still.matches ? 0 : dt);
    placeDots(1);
    placeKnob(now.V);
    placeSwitch(want.power);
    placeLcd(want.power ? now.out : 0, flow.I, want.power);
    placeNeedle(flow.I, dt);
    placeBands(want.R);

    // light: the lens colour, the halo and the pool on the board
    now.flash = Math.max(0, now.flash - dt * 1.6);
    const target = burned ? 0 : flow.glow;
    now.glow = still.matches ? target : follow(now.glow, target, dt, 0.05);
    const g = clamp(now.glow, 0, 1);
    led.style.setProperty("--g", g.toFixed(3));
    const halo = clamp(Math.max(now.glow / 1.25, now.flash * 1.4), 0, 1);
    glow.setAttribute("opacity", halo.toFixed(3));
    glow.firstChild.setAttribute("r", fx((18 + 22 * Math.min(1.25, Math.max(now.glow, now.flash * 1.3))) * P.scale));
    pool.setAttribute("opacity", clamp(Math.max(now.glow * 0.85, now.flash), 0, 1).toFixed(3));
    placeSmoke(dt);

    ui.light.style.transform = `scaleX(${clamp(flow.glow / 1.25, 0, 1).toFixed(3)})`;
    ui.heat.style.transform = `scaleX(${(burned ? 1 : stress).toFixed(3)})`;
    placeWords(flow, want.power ? now.out : 0);

    const settling = Math.abs(now.V - want.V) > 0.005 || Math.abs(now.out - (want.power ? want.V : 0)) > 0.005 || Math.abs(now.glow - target) > 0.002 || Math.abs(now.needleV || 0) > 0.002 || puffs.length || now.flash > 0 || stress > 0;
    const moving = flow.I > 1e-6 && !still.matches;
    if (visible && (moving || settling || !touched || ramp)) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); }
  }
  new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible) kick();
  }).observe(stage);
  still.addEventListener("change", kick);

  ui.V.value = want.V;
  setMode(want.mode);
  setPower(true);
  if (still.matches) touched = true;
  kick();
})();
