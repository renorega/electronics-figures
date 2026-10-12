// The live page. The kit, world.mjs and model.mjs are inlined above this; DATA gives P and SWITCH_FRAMES.
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
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const follow = (cur, want, dt, tau) => cur + (want - cur) * (1 - Math.exp(-dt / tau));
  const fx = (n) => (Math.round(n * 100) / 100).toString();
  const toScreen = (p) => iso(p, P);
  const stroke = (d, tone, extra = "") => `<path class="iso-line" data-tone="${tone}" d="${d}"${extra}/>`;
  const text = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
  const amps = (i) => (Math.abs(i) < 0.0005 ? "0.00" : (i < 0 ? "−" : "") + Math.abs(i).toFixed(2)) + " A";
  const signed = (v, digits) => (v > 0.005 ? "+" : v < -0.005 ? "−" : "") + Math.abs(v).toFixed(digits);
  const pct = (b) => Math.round(clamp(b, 0, 1.5) * 100) + "%";
  const mJ = (e) => (e * 1000).toFixed(1) + " mJ";

  // ── the circuit ──
  const target = { ...DEFAULTS };
  const p = { ...DEFAULTS };
  let state = initial();
  let paused = false;

  // The scope keeps the last 12 s on screen, whatever the slow-motion factor; each sample remembers
  // how much circuit time it stands for so the tooltip can say how long ago it was.
  const WINDOW = 12;
  const SAMPLES = 600;
  const SAMPLE_DT = WINDOW / SAMPLES; // seconds on screen
  const hist = { v: new Float32Array(SAMPLES), iC: new Float32Array(SAMPLES), iL: new Float32Array(SAMPLES), dt: new Float32Array(SAMPLES), count: 0, head: 0, version: 0 };
  let kappa = KAPPA;
  let acc = 0;
  const record = () => {
    const r = readings(state, p);
    const h = hist.head;
    hist.v[h] = r.v; hist.iC[h] = r.iC; hist.iL[h] = r.iL; hist.dt[h] = SAMPLE_DT * kappa;
    hist.head = (h + 1) % SAMPLES;
    hist.count = Math.min(SAMPLES, hist.count + 1);
    hist.version++;
  };
  const sampleAt = (array, k) => array[(hist.head - hist.count + k + SAMPLES * 2) % SAMPLES];

  // ── pieces of the drawing ──
  const part = (name) => $(`[data-part="${name}"]`, svg);
  const slotOf = (name) => $(`[data-slot="${name}"]`, svg);
  const lit = { C: part("lit-C"), L: part("lit-L") }, glow = { C: part("glow-C"), L: part("glow-L") }, pool = { C: part("pool-C"), L: part("pool-L") };
  const segs = $$("[data-seg]", svg).sort((a, b) => a.dataset.seg - b.dataset.seg);

  // ── current dots: one pool per stretch of wire, each drifting with its own current ──
  const SPACING = 9, DOT_R = Math.max(1.3, 0.75 * P.scale), DRIFT = 75; // units per second per amp
  const dotLayer = $('[data-layer="dots"]', svg);
  const routes = Object.fromEntries(Object.entries(ROUTES).map(([name, points]) => [name, measure(points)]));
  const pools = {}, drift = {};
  for (const [name, route] of Object.entries(routes)) {
    drift[name] = 0;
    pools[name] = Array.from({ length: Math.max(1, Math.floor(route.length / SPACING)) }, () => {
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("class", "ct-carrier");
      dot.setAttribute("r", DOT_R.toFixed(2));
      dot.setAttribute("opacity", "0");
      dotLayer.appendChild(dot);
      return dot;
    });
  }
  const DOT_Z = TRACE_H + 0.3;
  function driveDots(r, dt) {
    const currents = routeCurrents(r, p);
    for (const [name, route] of Object.entries(routes)) {
      const i = currents[name];
      drift[name] += DRIFT * i * dt;
      const pool = pools[name];
      const spacing = route.length / pool.length;
      const shown = smoothstep(0.004, 0.03, Math.abs(i));
      for (let n = 0; n < pool.length; n++) {
        const dot = pool[n];
        if (shown < 0.02) { if (dot.on) { dot.setAttribute("opacity", "0"); dot.on = false; } continue; }
        const d = (((drift[name] + n * spacing) % route.length) + route.length) % route.length;
        const ends = Math.min(smoothstep(0, 4, d), smoothstep(0, 4, route.length - d));
        const [x, y] = pointAt(route, d);
        const [sx, sy] = toScreen([x, y, DOT_Z]);
        dot.setAttribute("cx", fx(sx)); dot.setAttribute("cy", fx(sy));
        dot.setAttribute("opacity", (shown * ends).toFixed(2));
        dot.on = true;
      }
    }
  }

  // ── the knife switch: one of 37 prebuilt drawings, picked by its opening angle ──
  const switchSlot = slotOf("switch");
  const sw = { angle: OPEN_DEG, drawn: -1 };
  function placeSwitch(dt) {
    const want = p.on ? 0 : OPEN_DEG;
    sw.angle = still.matches ? want : follow(sw.angle, want, dt, 0.07);
    const n = Math.round((sw.angle / OPEN_DEG) * (SWITCH_FRAMES.length - 1));
    if (n === sw.drawn) return;
    sw.drawn = n;
    switchSlot.innerHTML = SWITCH_FRAMES[n];
  }

  // ── the spark: the coil's current jumping the opening gap. Its light lingers a moment, like a camera flash. ──
  const sparkSlot = slotOf("spark");
  sparkSlot.innerHTML = `<circle class="ct-spark-glow" r="1" fill="url(#ct-spark)" opacity="0"/><path class="ct-spark" d="" opacity="0"/><path class="ct-spark" d="" opacity="0" style="stroke-width:.6px"/>`;
  const [sparkGlow, sparkA, sparkB] = sparkSlot.children;
  let flash = 0, lastSparkJ = 0, jitterAt = 0;
  function zigzag(a, b, seed) {
    const pts = [toScreen(a)];
    let s = seed;
    const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
    for (let n = 1; n < 6; n++) {
      const t = n / 6;
      pts.push(toScreen([a[0] + (b[0] - a[0]) * t + rand() * 3, a[1] + (b[1] - a[1]) * t + rand() * 2.4, a[2] + (b[2] - a[2]) * t + rand() * 2.4]));
    }
    pts.push(toScreen(b));
    return pathOf(pts);
  }
  function placeSpark(dt, now) {
    if (state.sparkJ < lastSparkJ) lastSparkJ = state.sparkJ;
    const fresh = state.sparkJ - lastSparkJ;
    lastSparkJ = state.sparkJ;
    flash = Math.min(1.4, flash * Math.exp(-dt / 0.32) + fresh / 0.012);
    if (flash < 0.02) { if (sparkGlow.getAttribute("opacity") !== "0") [sparkGlow, sparkA, sparkB].forEach((n) => n.setAttribute("opacity", "0")); return; }
    const tip = bladePoint(LANE.L, BLADE.length, -BLADE.t / 2, sw.angle);
    const jaw = SPARK_AT;
    const [gx, gy] = toScreen([(tip[0] + jaw[0]) / 2, (tip[1] + jaw[1]) / 2, (tip[2] + jaw[2]) / 2]);
    sparkGlow.setAttribute("cx", fx(gx)); sparkGlow.setAttribute("cy", fx(gy));
    sparkGlow.setAttribute("r", fx((10 + 16 * flash) * P.scale));
    sparkGlow.setAttribute("opacity", clamp(flash, 0, 1).toFixed(2));
    if (now - jitterAt > 45) {
      jitterAt = now;
      const seed = 1 + Math.floor(now) % 9973;
      sparkA.setAttribute("d", zigzag(tip, jaw, seed));
      sparkB.setAttribute("d", zigzag(tip, jaw, seed * 7 + 3));
    }
    sparkA.setAttribute("opacity", clamp(flash * 1.3, 0, 1).toFixed(2));
    sparkB.setAttribute("opacity", clamp(flash * 0.8, 0, 1).toFixed(2));
  }

  // ── lamps: light follows the power at once ──
  const lastLamp = { C: -1, L: -1 };
  function placeLamp(lane, b) {
    b = clamp(b, 0, 1.2);
    if (Math.abs(b - lastLamp[lane]) < 0.004) return;
    lastLamp[lane] = b;
    const seen = Math.pow(b, 0.55); // the eye sees dim light as brighter than it is
    lit[lane].style.opacity = clamp(seen * 1.1, 0, 1).toFixed(3);
    glow[lane].style.opacity = clamp(seen, 0, 1.1).toFixed(3);
    pool[lane].style.opacity = clamp(seen, 0, 1).toFixed(3);
  }

  // ── the two current meters: centre-zero needles on their top faces ──
  const needles = {};
  for (const lane of ["C", "L"]) {
    const slot = slotOf("needle-" + lane);
    slot.innerHTML = stroke("", "lit", ' data-free="end" style="stroke-width:1.1"') + `<circle class="ct-hub" r="1.4"/>`;
    needles[lane] = { line: slot.firstChild, hub: slot.lastChild, angle: 0 };
  }
  function placeNeedle(lane, i, dt) {
    const n = needles[lane];
    const want = -clamp(i / AMPS_FULL, -1.06, 1.06) * METER_SWEEP; // forward current swings right
    n.angle = still.matches ? want : follow(n.angle, want, dt, 0.05);
    const a = (n.angle * Math.PI) / 180;
    const [px, py] = meterPivot(LANE[lane]);
    const z = METER.h + 0.2;
    n.line.setAttribute("d", lineOnTop([px, py], [px - Math.cos(a) * (NEEDLE_R + 1), py + Math.sin(a) * (NEEDLE_R + 1)], z, P));
    const hub = toScreen([px, py, z]);
    n.hub.setAttribute("cx", fx(hub[0])); n.hub.setAttribute("cy", fx(hub[1]));
  }

  // ── the capacitor's gauge ──
  let lastLit = -1;
  function placeGauge(full) {
    const n = clamp(Math.round(full * segs.length), 0, segs.length);
    if (n === lastLit) return;
    lastLit = n;
    segs.forEach((seg, k) => seg.toggleAttribute("data-on", k < n));
  }

  // ── the compass: its needle turns toward the coil's field ──
  const compassSlot = slotOf("compass");
  compassSlot.innerHTML = stroke("", "mid", ' data-free="end" style="stroke-width:1.5"') + stroke("", "hi", ' data-free="end" style="stroke-width:1.7"') + `<circle class="ct-hub" r="1.3"/>`;
  const cNodes = { south: compassSlot.children[0], north: compassSlot.children[1], hub: compassSlot.children[2] };
  let compassAngle = 0;
  function placeCompass(flux, dt) {
    const want = (Math.atan(30 * flux) * 180) / Math.PI;
    compassAngle = still.matches ? want : follow(compassAngle, want, dt, 0.09);
    const a = ((-90 + compassAngle) * Math.PI) / 180;
    const [cx, cy] = COMPASS.at, z = COMPASS.h + 0.25;
    const dir = [Math.sin(a), -Math.cos(a)];
    cNodes.north.setAttribute("d", lineOnTop([cx, cy], [cx + dir[0] * 8.4, cy + dir[1] * 8.4], z, P));
    cNodes.south.setAttribute("d", lineOnTop([cx, cy], [cx - dir[0] * 6.4, cy - dir[1] * 6.4], z, P));
    const hub = toScreen([cx, cy, z]);
    cNodes.hub.setAttribute("cx", fx(hub[0])); cNodes.hub.setAttribute("cy", fx(hub[1]));
  }

  // ── the supply: display, knob, keys ──
  const displaySlot = slotOf("display");
  displaySlot.innerHTML = `<text class="ct-lcd" x="1" y="-1.2" font-size="6.4"></text><text class="ct-lcd" x="1" y="8.6" font-size="5.2"></text>`;
  const lcd = $$("text", displaySlot);
  const pointerSlot = slotOf("pointerF");
  pointerSlot.innerHTML = stroke("", "hi", ' style="stroke-width:1.2"');
  let lastKnob = 1e9;
  function placeKnob(f) {
    const angle = knobAngle(f);
    if (Math.abs(lastKnob - angle) < 0.05) return;
    lastKnob = angle;
    const a = (angle * Math.PI) / 180;
    const { at: [x, y], r, h } = KNOB_F;
    pointerSlot.firstChild.setAttribute("d", lineOnTop([x + Math.sin(a) * r * 0.18, y - Math.cos(a) * r * 0.18], [x + Math.sin(a) * r, y - Math.cos(a) * r], SUP_TOP + 1 + h, P));
  }
  const modeKey = () => (p.mode === "steady" ? "steady" : p.f <= 20 ? "slow" : "fast");
  const keys = $$("[data-part^=btn-]", svg);
  const drainCap = part("drain-cap"), drainTouch = drainCap.closest(".ct-touch");

  // ── the big scope in the panel: one strip per lane, the push dashed behind the current ──
  const strips = Object.fromEntries($$("[data-strip]").map((node) => [node.dataset.strip, node]));
  for (const node of Object.values(strips)) {
    $("[data-traces]", node).innerHTML = `<path class="ct-tr ct-tr-vs" d=""/><path class="ct-tr ct-tr-i" d=""/>`;
    $("[data-grid]", node).innerHTML = [0, 1, 2, 3, 4].map((n) => `<line x1="0" x2="600" y1="${n * 30}" y2="${n * 30}" class="${n === 2 ? "ct-zero" : "ct-grid-line"}"/>`).join("");
    $("[data-yticks]", node).innerHTML = ["+0.6 A", "+0.3", "0", "−0.3", "−0.6 A"].map((t, n) => `<span style="top:${n * 25}%">${t}</span>`).join("");
  }
  const bigPaths = Object.fromEntries(Object.entries(strips).map(([lane, node]) => [lane, { v: $(".ct-tr-vs", node), i: $(".ct-tr-i", node) }]));
  let lastVersion = -1;
  function drawScope() {
    if (hist.version === lastVersion) return;
    lastVersion = hist.version;
    const line = (array, scale) => {
      let d = "";
      for (let k = hist.count - 1, first = true; k >= 0; k -= 2) {
        const x = 600 - (600 * (hist.count - 1 - k)) / (SAMPLES - 1);
        d += (first ? "M" : "L") + fx(x) + " " + fx(60 - 58 * clamp(sampleAt(array, k) / scale, -1.03, 1.03));
        first = false;
      }
      return d;
    };
    const v = line(hist.v, PARTS.V);
    bigPaths.C.v.setAttribute("d", v); bigPaths.L.v.setAttribute("d", v);
    bigPaths.C.i.setAttribute("d", line(hist.iC, AMPS_FULL));
    bigPaths.L.i.setAttribute("d", line(hist.iL, AMPS_FULL));
    if (hover.on) showTip();
  }
  const realMs = (ms) => (ms < 10 ? ms.toFixed(1) : ms.toFixed(0)) + " ms";
  let spanKey = "";
  function labelSpan() {
    const key = Math.round(1 / kappa);
    if (key === spanKey) return;
    spanKey = key;
    text($("[data-scope-span]"), `${WINDOW} s on screen = ${realMs(WINDOW * kappa * 1000)} of real time`);
    text($("[data-slowmo]"), `${key}× slower than real`);
  }
  const tip = $("[data-tip]"), scopeCard = $(".ct-scope");
  const hover = { on: false, frac: 0 };
  function showTip() {
    const k = Math.round(hover.frac * (SAMPLES - 1)) - (SAMPLES - hist.count);
    for (const node of Object.values(strips)) {
      const cross = $("[data-cross]", node);
      cross.setAttribute("x1", fx(hover.frac * 600)); cross.setAttribute("x2", fx(hover.frac * 600));
      cross.style.opacity = "1";
    }
    if (k < 0 || k >= hist.count) { tip.hidden = true; return; }
    let ago = 0;
    for (let j = k + 1; j < hist.count; j++) ago += sampleAt(hist.dt, j) * 1000;
    tip.innerHTML = `<b>${ago < 0.05 ? "now" : realMs(ago) + " ago (real time)"}</b><br>push ${signed(sampleAt(hist.v, k), 1)} V<br>capacitor lane <b>${amps(sampleAt(hist.iC, k))}</b><br>coil lane <b>${amps(sampleAt(hist.iL, k))}</b>`;
    tip.hidden = false;
  }
  for (const node of Object.values(strips)) {
    const plot = $(".ct-plot", node);
    plot.addEventListener("pointermove", (event) => {
      const box = plot.getBoundingClientRect(), card = scopeCard.getBoundingClientRect();
      hover.on = true;
      hover.frac = clamp((event.clientX - box.left) / box.width, 0, 1);
      showTip();
      tip.style.left = Math.min(event.clientX - card.left + 14, card.width - 190) + "px";
      tip.style.top = event.clientY - card.top + 14 + "px";
    });
    plot.addEventListener("pointerleave", () => { hover.on = false; tip.hidden = true; $$("[data-cross]").forEach((c) => (c.style.opacity = "0")); });
  }

  // ── the panel ──
  const outs = Object.fromEntries($$("[data-out]").map((node) => [node.dataset.out, node]));
  const live = Object.fromEntries($$("[data-live]").map((node) => [node.dataset.live, node]));
  const bars = Object.fromEntries($$("[data-bar]").map((node) => [node.dataset.bar, node]));
  const story = $("[data-story]");
  const modeButtons = $$("[data-mode]"), chips = $$("[data-preset]");
  const switchButton = $('[data-act="switch"]'), pauseButton = $('[data-act="pause"]'), drainButton = $('[data-act="drain"]');
  const fInput = $('[data-in="f"]');
  const fToInput = (f) => Math.log(f / RANGE.f.min) / Math.log(RANGE.f.max / RANGE.f.min);
  const fFromInput = (u) => RANGE.f.min * Math.pow(RANGE.f.max / RANGE.f.min, u);
  const MODE_NAME = { steady: "steady", slow: "slow wiggle", fast: "fast wiggle" };
  const MODE_HINT = {
    steady: "A steady push in one direction, like a battery.",
    slow: "The push swings forward and backward, slowly.",
    fast: "The push swings forward and backward, very fast, like the power from a wall socket.",
  };

  function syncInputs() {
    if (document.activeElement !== fInput) fInput.value = fToInput(target.f).toFixed(3);
    text(outs.f, `${target.f < 10 ? target.f.toFixed(1) : target.f.toFixed(0)} per second`);
    const key = target.mode === "steady" ? "steady" : target.f <= 20 ? "slow" : "fast";
    text(outs.mode, MODE_NAME[key]);
    text($('[data-hint="mode"]'), MODE_HINT[key]);
    modeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === key)));
    $('[data-row="f"]').toggleAttribute("data-off", target.mode === "steady");
    fInput.disabled = target.mode === "steady";
    switchButton.setAttribute("aria-pressed", String(target.on));
    text(switchButton, target.on ? "Turn OFF" : "Turn ON");
    text($('[data-hint="switch"]'), target.on ? "ON: both blades are down, and the power box pushes on both lanes at once." : "OFF: both blades are up, so both lanes are cut open.");
    drainButton.disabled = target.on;
    drainButton.setAttribute("aria-pressed", String(target.drain));
    text($('[data-hint="drain"]'), target.on ? "Turn the switch OFF first. Then this lets the capacitor's stored charge flow back out through its lamp." : target.drain ? "Emptying: the charge is flowing back out through the lamp, the other way round." : "Lets the capacitor's stored charge flow back out through its own lamp.");
    pauseButton.setAttribute("aria-pressed", String(paused));
    text(pauseButton, paused ? "Resume" : "Pause");
  }
  const announce = (() => {
    const region = document.createElement("div");
    region.setAttribute("aria-live", "polite");
    region.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden";
    document.body.appendChild(region);
    let timer = 0;
    return (message) => { clearTimeout(timer); timer = setTimeout(() => (region.textContent = message), 500); };
  })();

  function setMode(key) {
    if (key === "steady") target.mode = "steady";
    else { target.mode = "wiggle"; target.f = WIGGLE[key]; }
    syncInputs(); wake();
  }
  function setSwitch(on) {
    target.on = on;
    if (on) target.drain = false;
    syncInputs(); wake();
    announce(on ? "Switch on." : "Switch off.");
  }
  function startDrain() {
    if (target.on) return;
    target.drain = true;
    syncInputs(); wake();
  }

  // ── what is going on, in words a ten-year-old can follow ──
  let onSince = -1, offSince = -1, peakGap = 0;
  function storyText(r, now) {
    const full = Math.round(clamp(r.full, 0, 1) * 100);
    if (p.mode === "steady") {
      if (p.on) {
        if (r.bC > 0.05 && r.bL < 0.5) return `Switch ON! The capacitor was empty, so current rushes in to fill it, and its lamp flashes bright. The coil's "heavy wheel" (its magnetic field) is only starting to turn, so its lamp is still dim, but getting brighter.`;
        if (r.bC > 0.02 || r.bL < 0.85) return `The capacitor is filling up (${full}% full), so less and less current gets in and its lamp fades. The coil's field is speeding up (look at the compass), so its lamp keeps getting brighter.`;
        return `Now the capacitor is full, so the flow into it has stopped: its lamp is dark. The coil's field is spinning steadily, and the coil lets the current straight through: its lamp is bright. A steady push: the capacitor blocks it, the coil lets it through. Now try switching OFF.`;
      }
    } else if (p.on) {
      const s = wiggleShare(p.f);
      const word = p.f <= 20 ? "slowly" : "fast";
      const lead = s.shareC > s.shareL ? "the capacitor's lamp wins" : "the coil's lamp wins";
      const why = s.shareC > s.shareL
        ? "The push turns round so quickly that the capacitor never gets full, so current keeps flowing in and out of it. The coil's heavy wheel can't turn round that fast, so hardly any current gets through it."
        : "The push turns round so slowly that the capacitor fills up each time and then blocks the flow. The coil has plenty of time to keep up, so it lets the current through.";
      return `The push wiggles ${word}, ${p.f < 10 ? p.f.toFixed(1) : p.f.toFixed(0)} times a second, and ${lead}. ${why} Right now the capacitor lets through ${Math.round(s.shareC * 100)}% of the current and the coil ${Math.round(s.shareL * 100)}%.`;
    }
    // switch off
    if (p.drain && r.full > 0.005) return `The capacitor is emptying through its own lamp, so the lamp lights again with no power box at all! The current runs the other way now: watch the back needle swing left. That is the energy the capacitor stored, coming back out.`;
    const sinceOff = (now - offSince) / 1000;
    if (offSince > 0 && sinceOff < 2.6 && peakGap > 20) return `Switch OFF! The coil's current couldn't stop at once, so it jumped the gap as a spark, pushing about ${Math.round(peakGap / 10) * 10} volts for a split second (the power box only gives 6!). ${r.full > 0.05 ? `The capacitor just keeps its charge: the gauge is still ${full}% full.` : ""}`;
    if (r.full > 0.05) return `The switch is OFF, and the capacitor is still holding its charge (${r.vC.toFixed(1)} V, ${full}% full) like a closed tank. It could keep it for a long time. Press the blue EMPTY button to let it flow back out through its lamp.`;
    return "The switch is OFF and everything is empty and still. Click the blue handle (or Turn ON) and watch both lamps closely.";
  }

  function updatePanel(r) {
    text(live.iC, amps(r.iC));
    text(live.iL, amps(r.iL));
    text(live.vC, r.vC.toFixed(2) + " V");
    text(live.vL, signed(r.vL, 1) + " V");
    text(live.eC, mJ(r.eC));
    text(live.eL, mJ(r.eL));
    text(live.bC, pct(r.bC));
    text(live.bL, pct(r.bL));
    text(live.full, pct(r.full));
    const fieldShare = Math.abs(r.flux) / (PARTS.L * PARTS.V / (PARTS.R + PARTS.rL));
    text(live.field, pct(fieldShare));
    bars.bC.style.transform = `scaleX(${clamp(r.bC, 0, 1).toFixed(3)})`;
    bars.bL.style.transform = `scaleX(${clamp(r.bL, 0, 1).toFixed(3)})`;
    bars.full.style.transform = `scaleX(${clamp(r.full, 0, 1).toFixed(3)})`;
    bars.field.style.transform = `scaleX(${clamp(fieldShare, 0, 1).toFixed(3)})`;
  }

  // ── presets ──
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearLater = () => { timers.forEach(clearTimeout); timers = []; };
  function resetCircuit() {
    state = initial();
    lastSparkJ = 0; flash = 0;
    hist.count = 0; hist.head = 0; hist.version++;
    acc = 0;
  }
  function settled() {
    // jump straight to the bench switched ON and steady for a while
    const q = { ...p, on: true, mode: "steady" };
    state = initial();
    step(state, q, 0.12);
    lastSparkJ = state.sparkJ;
  }
  function applyPreset(name, quiet) {
    clearLater();
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.preset === name)));
    target.drain = false;
    if (name === "on") {
      target.mode = "steady"; target.on = false; p.on = false;
      resetCircuit();
      later(700, () => setSwitch(true));
    } else if (name === "off") {
      target.mode = "steady"; p.mode = "steady";
      if (!(p.on && Math.abs(state.iC) < 0.01 && state.iL > 0.5)) { settled(); target.on = true; p.on = true; sw.angle = 0; }
      later(900, () => setSwitch(false));
    } else if (name === "empty") {
      target.mode = "steady"; p.mode = "steady";
      if (state.q < 0.5 * PARTS.C * PARTS.V) { settled(); state.iL = 0; state.iC = 0; }
      target.on = false; p.on = false; sw.angle = OPEN_DEG;
      later(900, startDrain);
    } else {
      setMode(name);
      target.on = false; p.on = false;
      resetCircuit();
      later(600, () => setSwitch(true));
    }
    syncInputs(); wake();
    if (!quiet) announce(`${name} preset.`);
  }

  // ── the loop ──
  let frame = 0, last = 0, visible = true, keepAlive = 0, lastStory = 0;
  const wake = () => { keepAlive = performance.now() + 2500; run(); };
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    tourStep(dt);
    p.f = still.matches ? target.f : Math.exp(follow(Math.log(p.f), Math.log(target.f), dt, 0.12));
    p.mode = target.mode;
    if (p.on !== target.on) { p.on = target.on; if (p.on) onSince = now; else { offSince = now; peakGap = 0; } }
    p.drain = target.drain;
    if (!paused) {
      // ease between slow-motion factors so a mode change never jumps
      kappa = still.matches ? kappaFor(p) : Math.exp(follow(Math.log(kappa), Math.log(kappaFor(p)), dt, 0.25));
      labelSpan();
      // the circuit moves every frame; the scope takes a sample every SAMPLE_DT of screen time
      step(state, p, dt * kappa);
      peakGap = Math.max(peakGap, state.vGap);
      acc += dt;
      while (acc >= SAMPLE_DT) { record(); acc -= SAMPLE_DT; }
      if (acc > SAMPLE_DT * 3) acc = 0;
    }
    if (target.drain && state.q / PARTS.C < 0.003) { target.drain = false; syncInputs(); }
    const r = readings(state, p);
    placeSwitch(dt);
    placeSpark(dt, now);
    placeDiagram(r, dt);
    if (!paused) driveDots(r, dt);
    placeLamp("C", r.bC); placeLamp("L", r.bL);
    placeNeedle("C", r.iC, dt); placeNeedle("L", r.iL, dt);
    placeGauge(r.full);
    placeCompass(r.flux, dt);
    placeKnob(p.f);
    const mk = modeKey();
    for (const node of keys) {
      const on = node.dataset.part === "btn-" + mk;
      if (node.on !== on) { node.on = on; node.toggleAttribute("data-on", on); $("[data-key]", node).setAttribute("transform", on ? translateAlong(P, [0, 0, -0.9]) : ""); }
    }
    const pressed = p.drain;
    if (drainCap.pressed !== pressed) { drainCap.pressed = pressed; drainCap.setAttribute("transform", pressed ? translateAlong(P, [0, 0, -1.4]) : ""); }
    if (drainTouch.off !== p.on) { drainTouch.off = p.on; drainTouch.toggleAttribute("data-off", p.on); }
    text(lcd[0], PARTS.V.toFixed(1) + (p.mode === "steady" ? " V" : " V~"));
    text(lcd[1], p.mode === "steady" ? "STEADY" : (p.f < 10 ? p.f.toFixed(1) : p.f.toFixed(0)) + " Hz");
    drawScope();
    updatePanel(r);
    text(readout, `${p.on ? "ON" : "OFF"} · capacitor lamp ${pct(r.bC)} · coil lamp ${pct(r.bL)}`);
    if (now - lastStory > 350) { lastStory = now; text(story, storyText(r, now)); }
    const quiet = (still.matches || paused) && Math.abs(r.iC) < 1e-4 && Math.abs(r.iL) < 1e-4 && flash < 0.02 && (p.mode === "steady" || !p.on);
    if (quiet) { if (now > keepAlive) { frame = 0; return; } } else keepAlive = now + 1500;
    frame = visible ? requestAnimationFrame(tick) : 0;
  }
  function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
  const seen = new Set();
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.isIntersecting ? seen.add(entry.target) : seen.delete(entry.target);
    visible = seen.size > 0;
    if (visible) run();
  }, { rootMargin: "120px 0px" });
  watcher.observe(stage);
  watcher.observe(scopeCard);
  watcher.observe(dg);

  // ── the idle tour: it presses the same presets a reader would ──
  const TOUR = [
    { preset: "on", length: 6.5 },
    { preset: "off", length: 4.5 },
    { preset: "empty", length: 5 },
    { preset: "slow", length: 15 },
    { preset: "fast", length: 9 },
  ];
  const tour = { on: false, index: -1, clock: 0, idle: 0, after: 1.2 };
  function tourStep(dt) {
    if (!tour.on) {
      if (!still.matches && !paused) { tour.idle += dt; if (tour.idle > tour.after) { tour.on = true; tour.index = -1; tour.clock = 99; } }
      return;
    }
    tour.clock += dt;
    const current = TOUR[tour.index];
    if (!current || tour.clock > current.length) {
      tour.index = (tour.index + 1) % TOUR.length;
      tour.clock = 0;
      applyPreset(TOUR[tour.index].preset, true);
    }
  }
  function touched() {
    if (tour.on) { tour.on = false; clearLater(); chips.forEach((c) => c.setAttribute("aria-pressed", "false")); }
    tour.idle = 0; tour.after = 25;
    wake();
  }

  // ── controls ──
  switchButton.addEventListener("click", () => { touched(); setSwitch(!target.on); });
  modeButtons.forEach((b) => b.addEventListener("click", () => { touched(); setMode(b.dataset.mode); }));
  fInput.addEventListener("input", () => { touched(); target.f = fFromInput(parseFloat(fInput.value)); syncInputs(); });
  drainButton.addEventListener("click", () => { touched(); startDrain(); });
  pauseButton.addEventListener("click", () => { touched(); paused = !paused; syncInputs(); });
  $('[data-act="reset"]').addEventListener("click", () => { touched(); target.on = false; p.on = false; target.drain = false; resetCircuit(); syncInputs(); announce("Started over."); });
  chips.forEach((chip) => chip.addEventListener("click", () => { touched(); tour.idle = 0; applyPreset(chip.dataset.preset); chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip))); }));
  stage.addEventListener("keydown", (event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); touched(); setSwitch(!target.on); } });
  document.addEventListener("pointerdown", (event) => { if (event.target.closest(".ct-panel, .ct-side")) touched(); }, true);

  // the parts in the drawing: click the switch, the keys and the EMPTY button; drag the knob up and down
  const viewScale = () => svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
  let drag = null;
  svg.addEventListener("pointerover", (event) => { const g = event.target.closest('[data-grab="switch"]'); if (g) g.classList.add("ct-hot"); });
  svg.addEventListener("pointerout", (event) => { const g = event.target.closest('[data-grab="switch"]'); if (g) g.classList.remove("ct-hot"); });
  svg.addEventListener("pointerdown", (event) => {
    const grab = event.target.closest("[data-grab]");
    if (!grab) return;
    const what = grab.dataset.grab;
    touched();
    if (what === "switch") { setSwitch(!target.on); return; }
    if (what === "drain") { startDrain(); return; }
    if (what.startsWith("mode-")) { setMode(what.slice(5)); return; }
    if (what === "F") {
      if (target.mode === "steady") setMode("slow");
      drag = { y: event.clientY, start: fToInput(target.f), id: event.pointerId };
      svg.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  });
  svg.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    touched();
    const dy = (event.clientY - drag.y) / viewScale();
    target.f = fFromInput(clamp(drag.start - dy / 120, 0, 1));
    syncInputs();
  });
  const release = (event) => { if (drag && event.pointerId === drag.id) { drag = null; try { svg.releasePointerCapture(event.pointerId); } catch (e) {} } };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  syncInputs();
  if (stage.scrollWidth > stage.clientWidth) stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) * 0.3;
  // reduced motion: no tour. Show the bench switched on and settled, then wait for the reader.
  if (still.matches) {
    target.on = true; p.on = true; sw.angle = 0;
    for (let n = 0; n < SAMPLES; n++) { step(state, p, SAMPLE_DT * kappa); record(); }
  }
  tick(performance.now());
  wake();

  window.__ct = { target, p, get state() { return state; }, applyPreset, setSwitch, setMode, startDrain, stopTour: () => { tour.on = false; tour.after = 1e9; clearLater(); }, set paused(v) { paused = v; } };
})();
