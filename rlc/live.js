// The live page. The kit, world.mjs and model.mjs are inlined above this, and DATA gives P, TURNS and the face matrices.
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
  const follow = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));
  const fx = (n) => (Math.round(n * 100) / 100).toString();
  const toScreen = (p) => iso(p, P);
  const solid = (paths, style) => solidSvg(paths, style);
  const stroke = (d, tone, extra = "") => `<path class="iso-line" data-tone="${tone}" d="${d}"${extra}/>`;

  // ── the circuit: the physical parts are the source of truth for the numbers ──
  // `target` is where the sliders (or a preset, or the tour) want the parts. `p` is where the parts
  // are right now, eased toward the target, and it is what the model sees.
  const target = { ...DEFAULTS };
  const p = { ...DEFAULTS };
  const view = { speed: 1 };
  let state = initial();
  let paused = false;
  let phase = 0; // how far the carriers have drifted, in world units

  const KAPPA = 1 / 160; // seconds of circuit time per second on the page, at speed 1
  const WINDOW = 0.04; // the scope shows 40 ms of circuit time
  const SAMPLES = 600;
  const SAMPLE_DT = WINDOW / SAMPLES;
  const hist = { vs: new Float32Array(SAMPLES), vC: new Float32Array(SAMPLES), i: new Float32Array(SAMPLES), count: 0, head: 0, version: 0 };
  let acc = 0;
  const record = () => {
    const at = hist.head;
    hist.vs[at] = state.vs; hist.vC[at] = state.q / p.C; hist.i[at] = state.i;
    hist.head = (at + 1) % SAMPLES;
    hist.count = Math.min(SAMPLES, hist.count + 1);
    hist.version++;
  };

  // ── pieces of the drawing that the loop moves ──
  const part = (name) => $(`[data-part="${name}"]`, svg);
  const slotOf = (name) => $(`[data-slot="${name}"]`, svg);
  const layers = Object.fromEntries($$("[data-layer]", svg).map((node) => [node.dataset.layer, node]));
  const wiperGroup = part("wiper"), slugGroup = part("slug"), slideGroup = part("slide");
  wiperGroup.dataset.grab = "R"; slugGroup.dataset.grab = "L"; slideGroup.dataset.grab = "C";
  const windLive = $$("path", part("winding-live"));
  const lamp = $(".iso-solid", part("lamp"));

  // carriers: two routes (supply + out to the plate, plate back to the supply -), one dot pool each
  const SPACING = 9, DOT_R = Math.max(1.3, 0.72 * P.scale), DRIFT = 70;
  const reach = [loopOf({ wiper: 0, overlap: 1 }), loopOf({ wiper: 1, overlap: 0.1 }), loopOf({ wiper: 0, overlap: 0.1 })];
  const poolSize = (key) => Math.ceil(Math.max(...reach.map((r) => r[key].length)) / SPACING) + 2;
  const pools = { A: [], B: [] };
  for (const key of ["A", "B"]) {
    for (let n = 0; n < poolSize(key); n++) {
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("class", "rlc-carrier");
      dot.setAttribute("r", DOT_R.toFixed(2));
      dot.setAttribute("opacity", "0");
      layers.supply.appendChild(dot);
      dot.layerName = "supply";
      pools[key].push(dot);
    }
  }
  let route = loopOf({ wiper: wiperOf(p.R), overlap: overlapOf(p.C) });
  let routeKey = "";

  // ── gauges and displays ──
  const needles = {};
  for (const [key, full] of [["A", FULL_SCALE.I], ["V", FULL_SCALE.V]]) {
    const slot = slotOf("needle" + key);
    slot.innerHTML = stroke("", "lit", ' data-free="end" style="stroke-width:1.1"') + stroke("", "mid", ' data-free="end" style="stroke-width:1.1"') + `<circle class="rlc-hub" r="1.5"/>`;
    needles[key] = { tip: slot.children[0], tail: slot.children[1], hub: slot.children[2], full, angle: 0 };
  }
  const METER_PIVOT = METER.z - 8;
  function placeNeedle(key, value, dt) {
    const needle = needles[key];
    const want = clamp(value / needle.full, -1.06, 1.06) * METER_SWEEP;
    needle.angle = still.matches ? want : follow(needle.angle, want, dt, 0.07);
    const a = (needle.angle * Math.PI) / 180;
    const u = key === "A" ? METER.ammeter : METER.voltmeter;
    const sx = Math.sin(a), cz = Math.cos(a);
    needle.tip.setAttribute("d", `M${u} ${-METER_PIVOT}L${fx(u + 17 * sx)} ${fx(-METER_PIVOT - 17 * cz)}`);
    needle.tail.setAttribute("d", `M${u} ${-METER_PIVOT}L${fx(u - 5.5 * sx)} ${fx(-METER_PIVOT + 5.5 * cz)}`);
    needle.hub.setAttribute("cx", u); needle.hub.setAttribute("cy", -METER_PIVOT);
  }

  // the supply's display
  const displaySlot = slotOf("display");
  displaySlot.innerHTML = `<text class="rlc-lcd" x="1" y="-1.6" font-size="6.2"></text><text class="rlc-lcd" x="1" y="8.4" font-size="6.2"></text>`;
  const lcd = $$("text", displaySlot);

  // supply knobs: the pointer is a line from the middle to the rim
  const knobDefs = { V: [KNOB_V, KNOB.V, "pointerV"], I: [KNOB_I, KNOB.I, "pointerI"], F: [KNOB_F, KNOB.F, "pointerF"] };
  const pointers = {};
  for (const [key, [def, , slot]] of Object.entries(knobDefs)) {
    slotOf(slot).innerHTML = stroke("", "hi", ' style="stroke-width:1.2"');
    pointers[key] = slotOf(slot).firstChild;
  }
  const lastKnob = {};
  function placeKnob(key, angle) {
    if (lastKnob[key] === angle) return;
    lastKnob[key] = angle;
    const [def] = knobDefs[key];
    const a = (angle * Math.PI) / 180;
    const z = SUP_TOP + 1 + def.h;
    const [x, y] = def.at;
    pointers[key].setAttribute("d", lineOnTop([x + Math.sin(a) * def.r * 0.18, y - Math.cos(a) * def.r * 0.18], [x + Math.sin(a) * def.r * 0.92, y - Math.cos(a) * def.r * 0.92], z, P));
  }

  // the toggle: a lever that tips toward the viewer when the switch is closed
  const toggleSlot = slotOf("toggle");
  toggleSlot.innerHTML = stroke("", "hi", ' style="stroke-width:2.1"') + `<circle class="rlc-hub" r="1.7"/>`;
  const lever = { line: toggleSlot.children[0], tip: toggleSlot.children[1], at: 0 };
  function placeToggle(closed, dt) {
    lever.at = still.matches ? (closed ? 1 : 0) : follow(lever.at, closed ? 1 : 0, dt, 0.06);
    const [x, y] = TOGGLE.at;
    const z0 = SUP_TOP + 2.8, tilt = (lever.at - 0.5) * 2 * 3.8;
    const base = toScreen([x, y, z0]), tip = toScreen([x + tilt, y, z0 + 6.6]);
    lever.line.setAttribute("d", `M${fx(base[0])} ${fx(base[1])}L${fx(tip[0])} ${fx(tip[1])}`);
    lever.tip.setAttribute("cx", fx(tip[0])); lever.tip.setAttribute("cy", fx(tip[1]));
  }

  // ── the parts the sliders move ──
  let lastWiper = -1;
  function placeWiper(wiper) {
    wiperGroup.setAttribute("transform", translateAlong(P, [0, wiperY(wiper), 0]));
    if (Math.abs(wiper - lastWiper) < 1e-4) return;
    lastWiper = wiper;
    const yw = wiperY(wiper);
    windLive.forEach((node, n) => node.setAttribute("opacity", TURNS[n] <= yw + 0.6 ? "1" : "0"));
    $$("path", part("winding-idle")).forEach((node, n) => node.setAttribute("opacity", TURNS[n] <= yw + 0.6 ? "0" : "1"));
  }
  const placeSlug = (slug) => slugGroup.setAttribute("transform", translateAlong(P, [0, slugShift(slug), 0]));
  const placeSlide = (overlap) => slideGroup.setAttribute("transform", translateAlong(P, [slideShift(overlap), 0, 0]));

  // carriers
  function driveCarriers(i, dt) {
    phase += DRIFT * i * dt;
    const key = wiperOf(p.R).toFixed(3) + overlapOf(p.C).toFixed(3);
    if (key !== routeKey) { route = loopOf({ wiper: wiperOf(p.R), overlap: overlapOf(p.C) }); routeKey = key; }
    const facing = (normal) => depthOf(normal, P);
    for (const name of ["A", "B"]) {
      const path = route[name], pool = pools[name];
      const count = Math.floor(path.length / SPACING);
      for (let n = 0; n < pool.length; n++) {
        const dot = pool[n];
        if (n >= count) { if (dot.on) { dot.setAttribute("opacity", "0"); dot.on = false; } continue; }
        let distance;
        if (name === "A") distance = (((phase + n * SPACING) % path.length) + path.length) % path.length;
        else distance = path.length - ((((n * SPACING - phase) % path.length) + path.length) % path.length);
        const here = carrierAt(path, clamp(distance, 0, path.length - 1e-6), facing);
        // fade in and out at the two ends of the whole route
        const ends = Math.min(smoothstep(0, 6, distance), smoothstep(0, 6, path.length - distance));
        const alpha = here.alpha * ends;
        if (alpha < 0.02) { if (dot.on) { dot.setAttribute("opacity", "0"); dot.on = false; } continue; }
        if (dot.layerName !== here.layer) { layers[here.layer].appendChild(dot); dot.layerName = here.layer; }
        const [sx, sy] = toScreen(here.point);
        dot.setAttribute("cx", fx(sx)); dot.setAttribute("cy", fx(sy));
        dot.setAttribute("opacity", alpha.toFixed(2));
        dot.on = true;
      }
    }
  }


  // ── one instrument beside each part ──
  // compass: swings toward the field the coil makes (its flux linkage L·i)
  const compassSlot = slotOf("compass");
  compassSlot.innerHTML = stroke("", "mid", ' data-free="end" style="stroke-width:1.5"') + stroke("", "hi", ' data-free="end" style="stroke-width:1.7"') + `<circle class="rlc-hub" r="1.3"/>`;
  const compassNodes = { south: compassSlot.children[0], north: compassSlot.children[1], hub: compassSlot.children[2] };
  let compassAngle = 0;
  function placeCompass(flux, dt) {
    const want = (Math.atan(70 * flux) * 180) / Math.PI;
    compassAngle = still.matches ? want : follow(compassAngle, want, dt, 0.09);
    const a = ((-90 + compassAngle) * Math.PI) / 180;
    const [cx, cy] = COMPASS.at, z = COMPASS.h + 0.25;
    const dir = [Math.sin(a), -Math.cos(a)];
    compassNodes.north.setAttribute("d", lineOnTop([cx, cy], [cx + dir[0] * 9.2, cy + dir[1] * 9.2], z, P));
    compassNodes.south.setAttribute("d", lineOnTop([cx, cy], [cx - dir[0] * 7, cy - dir[1] * 7], z, P));
    const hub = toScreen([cx, cy, z]);
    compassNodes.hub.setAttribute("cx", fx(hub[0])); compassNodes.hub.setAttribute("cy", fx(hub[1]));
  }

  // thermometer: the resistor's temperature lags its power
  const mercurySlot = slotOf("mercury");
  let heat = 0, lastLevel = -1;
  function placeThermometer(power, dt) {
    heat = still.matches ? power : follow(heat, power, dt, 1.4);
    const level = 1 - Math.exp(-heat / 6);
    if (Math.abs(level - lastLevel) < 0.003) return;
    lastLevel = level;
    const [x, y] = THERMO.at;
    mercurySlot.innerHTML = solid(slabOf({ x: x + 1.8, y: y - 0.7, w: 0.5, d: 1.4, r: 0.2 }, 6.6, 0.8 + level * (THERMO.column - 2), P, 2), { tone: "hi", crease: "none" });
  }

  // electroscope: two leaves that push apart as the capacitor charges, whichever way
  const leavesSlot = slotOf("leaves");
  leavesSlot.innerHTML = stroke("", "hi", ' data-free="end" style="stroke-width:1.5"') + stroke("", "hi", ' data-free="end" style="stroke-width:1.5"');
  const leaf = [leavesSlot.children[0], leavesSlot.children[1]];
  let leafAngle = 0;
  function placeLeaves(volts, dt) {
    const want = 62 * Math.pow(clamp(Math.abs(volts) / 24, 0, 1), 0.85);
    leafAngle = still.matches ? want : follow(leafAngle, want, dt, 0.08);
    const [x, y] = SCOPE_E.at, piv = SCOPE_E.pivot + 3;
    const a = (leafAngle * Math.PI) / 180;
    [-1, 1].forEach((side, n) => {
      const from = toScreen([x, y, piv]), to = toScreen([x, y + side * SCOPE_E.leaf * Math.sin(a), piv - SCOPE_E.leaf * Math.cos(a)]);
      leaf[n].setAttribute("d", `M${fx(from[0])} ${fx(from[1])}L${fx(to[0])} ${fx(to[1])}`);
    });
  }

  // flux loops around the coil
  const fluxSlot = slotOf("flux");
  fluxSlot.innerHTML = FLUX_LOOPS.map(() => stroke("", "mid", ' style="opacity:0"')).join("") + FLUX_LOOPS.map(() => [0, 1, 2].map(() => stroke("", "hi", ' data-free="" style="opacity:0;stroke-width:.9px"')).join("")).join("");
  const fluxArcs = $$("path", fluxSlot).slice(0, FLUX_LOOPS.length);
  const fluxChevrons = $$("path", fluxSlot).slice(FLUX_LOOPS.length);
  fluxArcs.forEach((node, n) => node.setAttribute("d", pathOf(Array.from({ length: 31 }, (_, k) => toScreen(fluxPoint(FLUX_LOOPS[n], k / 30))))));
  let fluxTime = 0;
  function placeFlux(flux, dt, i) {
    const strength = clamp(Math.sqrt(Math.abs(flux) / 0.04), 0, 1);
    const sign = flux >= 0 ? 1 : -1;
    fluxTime += dt * clamp(i * 0.25, -0.6, 0.6);
    fluxArcs.forEach((node) => (node.style.opacity = (0.12 + 0.78 * strength).toFixed(2)));
    FLUX_LOOPS.forEach((loop, n) => {
      for (let j = 0; j < 3; j++) {
        const node = fluxChevrons[n * 3 + j];
        const t = (((j / 3 + fluxTime) % 1) + 1) % 1;
        const fade = smoothstep(0.04, 0.2, t) * smoothstep(0.04, 0.2, 1 - t) * strength;
        if (fade < 0.03) { node.style.opacity = "0"; continue; }
        const c = fluxPoint(loop, t), a = fluxPoint(loop, Math.max(0, t - 0.01)), b = fluxPoint(loop, Math.min(1, t + 0.01));
        const len = Math.hypot(b[1] - a[1], b[2] - a[2]) || 1;
        const ty = ((b[1] - a[1]) / len) * sign, tz = ((b[2] - a[2]) / len) * sign;
        const tip = [c[0], c[1] + ty * 1.9, c[2] + tz * 1.9];
        const w1 = [c[0], c[1] - ty * 1.1 - tz * 1.5, c[2] - tz * 1.1 + ty * 1.5];
        const w2 = [c[0], c[1] - ty * 1.1 + tz * 1.5, c[2] - tz * 1.1 - ty * 1.5];
        node.setAttribute("d", pathOf([toScreen(w1), toScreen(tip), toScreen(w2)]));
        node.style.opacity = fade.toFixed(2);
      }
    });
  }

  // ── the capacitor: charge marks, field lines and the overlap outline ──
  const faceY = FIXED_Y + PLATE_T + 0.05, slideFaceY = SLIDE_Y + PLATE_T + 0.05, markSize = 4.6;
  const markNode = (sign, x, y, z, size) => `<text class="rlc-mark" transform="${sideMatrix([x, y], z, P, "left")}" y="${fx(size * 0.36)}" font-size="${size}" text-anchor="middle">${sign}</text>`;
  const fixedMarks = [], slideMarks = [];
  let html = "";
  for (let c = 0; c < MARK_COLUMNS; c++) for (let r = 0; r < MARK_ROWS; r++) {
    const [x, z] = markAt(c, r);
    html += markNode("+", x, faceY, z, markSize) + markNode("−", x, faceY, z, markSize);
    fixedMarks.push({ x, rank: markRank(c, r) });
  }
  slotOf("marksFixed").innerHTML = html;
  const fixedNodes = $$("text", slotOf("marksFixed"));
  html = "";
  const BAR_ZS = [17, 23, 39, 45];
  BAR_OFFSETS.forEach((offset, b) => BAR_ZS.forEach((z, h) => {
    const x = PLATE_X0 + offset + BAR_W / 2;
    html += markNode("+", x, slideFaceY, z, 3) + markNode("−", x, slideFaceY, z, 3);
    slideMarks.push({ x, rank: markRank(b, h) });
  }));
  slotOf("marksSlide").innerHTML = html;
  const slideNodes = $$("text", slotOf("marksSlide"));

  // field lines start on the lattice, on an upright or on a rung between two, and end on the fixed plate
  const FIELD_SITES = [];
  BAR_OFFSETS.forEach((offset) => [20, 38, 47].forEach((z) => FIELD_SITES.push([PLATE_X0 + offset + BAR_W / 2, z])));
  BAR_OFFSETS.slice(0, -1).forEach((offset, n) => [10.5, 31, 53.5].forEach((z) => FIELD_SITES.push([PLATE_X0 + offset + BAR_W + (BAR_OFFSETS[n + 1] - offset - BAR_W) / 2, z])));
  const fieldLines = [];
  html = "";
  let ends = "";
  FIELD_SITES.forEach(([x, z]) => {
    const y0 = SLIDE_Y, y1 = FIXED_Y + PLATE_T, ym = (y0 + y1) / 2;
    const chevron = (sgn) => pathOf([toScreen([x, ym - sgn * 1.6, z - 1.7]), toScreen([x, ym + sgn * 1.6, z]), toScreen([x, ym - sgn * 1.6, z + 1.7])]);
    fieldLines.push({ x, up: chevron(1), down: chevron(-1), dir: 0 });
    html += stroke(segment([x, y0, z], [x, y1, z], P), "mid", ' style="opacity:0"') + stroke("", "mid", ' data-free="" style="opacity:0"');
    const end = toScreen([x, y1, z]);
    ends += `<circle cx="${fx(end[0])}" cy="${fx(end[1])}" r="0.75" style="opacity:0"/>`;
  });
  slotOf("fieldLines").innerHTML = html + `<g class="iso-dots" data-tone="mid">${ends}</g>`;
  const fieldNodes = $$("path", slotOf("fieldLines"));
  const fieldEnds = $$("circle", slotOf("fieldLines"));
  const overlapSlot = slotOf("overlap");
  overlapSlot.innerHTML = stroke("", "faint", ' data-dashed=""');
  const overlapPath = overlapSlot.firstChild;
  let lastOverlap = -1;
  const set = (node, key, value) => { if (node[key] === undefined || Math.abs(node[key] - value) > 0.02) { node[key] = value; return true; } return false; };

  function placeCapacitor(volts, q, overlap) {
    const s = slideShift(overlap);
    if (Math.abs(overlap - lastOverlap) > 1e-4) {
      lastOverlap = overlap;
      const x0 = PLATE_X0 + s + 0.8, x1 = PLATE_X0 + PLATE_W - 0.8, z0 = PLATE_Z0 + 1.8, z1 = PLATE_Z1 - 1.8;
      overlapPath.setAttribute("d", pathOf([[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => toScreen([x, faceY - 0.02, z])), true));
    }
    const density = clamp(Math.abs(volts) / 24, 0, 1);
    const plus = q >= 0 ? 1 : 0; // on the fixed plate: + when q > 0
    fixedMarks.forEach((m, n) => {
      const w = clamp((m.x - (PLATE_X0 + s)) / 3 + 0.5, 0, 1);
      const a = clamp((density * 1.25 - m.rank) * 5, 0, 1) * w;
      const on = fixedNodes[n * 2 + (plus ? 0 : 1)], off = fixedNodes[n * 2 + (plus ? 1 : 0)];
      if (set(on, "alpha", a)) on.style.opacity = a.toFixed(2);
      if (set(off, "alpha", 0)) off.style.opacity = "0";
    });
    slideMarks.forEach((m, n) => {
      const w = clamp(((PLATE_X0 + PLATE_W) - (m.x + s)) / 3 + 0.5, 0, 1);
      const a = clamp((density * 1.25 - m.rank) * 5, 0, 1) * w;
      const on = slideNodes[n * 2 + (plus ? 1 : 0)], off = slideNodes[n * 2 + (plus ? 0 : 1)];
      if (set(on, "alpha", a)) on.style.opacity = a.toFixed(2);
      if (set(off, "alpha", 0)) off.style.opacity = "0";
    });
    fieldLines.forEach((f, n) => {
      const w = clamp(((PLATE_X0 + PLATE_W) - (f.x + s)) / 3 + 0.5, 0, 1);
      const a = Math.pow(density, 0.7) * w * 0.95;
      const line = fieldNodes[n * 2], chev = fieldNodes[n * 2 + 1];
      if (set(f, "alpha", a)) { line.style.opacity = a.toFixed(2); chev.style.opacity = a.toFixed(2); fieldEnds[n].style.opacity = (a * 0.9).toFixed(2); }
      const dir = plus ? 1 : -1;
      if (f.dir !== dir) { f.dir = dir; chev.setAttribute("d", dir > 0 ? f.up : f.down); }
    });
  }

  // ── the scope: a strip chart of the source, the capacitor voltage and the current ──
  const sc = SCOPE, scW = sc.u1 - sc.u0, scMid = (sc.z0 + sc.z1) / 2, scAmp = (sc.z1 - sc.z0) / 2 - 0.8;
  const scopeSlot = slotOf("scope");
  scopeSlot.innerHTML =
    stroke("", "lo", ' data-dashed="" data-free="start" style="stroke-width:.8px"') +
    stroke("", "mid", ' data-free="start" style="stroke-width:1px"') +
    stroke("", "lit", ' data-free="start" style="stroke-width:1.25px"') +
    `<text class="iso-face-text" data-tone="lo" x="${sc.u0 + 2.5}" y="${-(sc.z0 + 2.2)}" font-size="3.1"></text>`;
  const traceNodes = $$("path", scopeSlot), scopeText = $("text", scopeSlot);
  const V_DIV = [0.5, 1, 2, 5, 10, 20], I_DIV = [0.05, 0.1, 0.2, 0.5, 1];
  const range = { vdiv: 2, idiv: 0.5, vscale: 6, iscale: 1.5 };
  const pickDiv = (list, current, peak) => {
    const want = list.find((d) => 3 * d * 0.92 >= peak) ?? list[list.length - 1];
    if (want > current) return want;
    if (want < current && peak < 0.62 * 3 * want * 1.0) return want;
    return current;
  };
  let lastVersion = -1, lastScaleKey = "";
  function drawScope(dt) {
    let peakV = 0, peakI = 0;
    for (let n = 0; n < hist.count; n++) {
      peakV = Math.max(peakV, Math.abs(hist.vC[n]), Math.abs(hist.vs[n]));
      peakI = Math.max(peakI, Math.abs(hist.i[n]));
    }
    range.vdiv = pickDiv(V_DIV, range.vdiv, peakV);
    range.idiv = pickDiv(I_DIV, range.idiv, peakI);
    range.vscale = still.matches ? 3 * range.vdiv : follow(range.vscale, 3 * range.vdiv, dt, 0.3);
    range.iscale = still.matches ? 3 * range.idiv : follow(range.iscale, 3 * range.idiv, dt, 0.3);
    const key = range.vscale.toFixed(3) + range.iscale.toFixed(3);
    if (hist.version === lastVersion && key === lastScaleKey) return;
    lastVersion = hist.version; lastScaleKey = key;
    const build = (array, scale) => {
      let d = "";
      for (let k = hist.count - 1, first = true; k >= 0; k -= 3) {
        const index = (hist.head - hist.count + k + SAMPLES * 2) % SAMPLES;
        const u = sc.u1 - (scW * (hist.count - 1 - k)) / (SAMPLES - 1);
        const z = scMid + scAmp * clamp(array[index] / scale, -1.04, 1.04);
        d += (first ? "M" : "L") + fx(u) + " " + fx(-z);
        first = false;
      }
      return d;
    };
    traceNodes[0].setAttribute("d", build(hist.vs, range.vscale));
    traceNodes[1].setAttribute("d", build(hist.vC, range.vscale));
    traceNodes[2].setAttribute("d", build(hist.i, range.iscale));
    const text = `${range.vdiv} V/div  ${range.idiv} A/div  ${(WINDOW * 1000) / 10} ms/div`;
    if (scopeText.textContent !== text) scopeText.textContent = text;
  }

  // ── the panel ──
  const inputs = Object.fromEntries($$("[data-in]").map((node) => [node.dataset.in, node]));
  const outs = Object.fromEntries($$("[data-out]").map((node) => [node.dataset.out, node]));
  const live = Object.fromEntries($$("[data-live]").map((node) => [node.dataset.live, node]));
  const bars = Object.fromEntries($$("[data-bar]").map((node) => [node.dataset.bar, node]));
  const now = Object.fromEntries($$("[data-now]").map((node) => [node.dataset.now, node]));
  const story = $("[data-story]");
  const modeButtons = $$("[data-mode]"), chips = $$("[data-preset]");
  const switchButton = $('[data-act="switch"]'), pauseButton = $('[data-act="pause"]');
  const MODE_NAME = { dc: "DC step", square: "square wave", sine: "sine wave" };
  const MODE_HINT = {
    dc: "A steady voltage, switched on and off with the main switch.",
    square: "The voltage jumps between 0 and the set value, again and again.",
    sine: "The voltage swings smoothly up and down, like mains.",
  };
  const ranges = { R: [RANGE.R.min, RANGE.R.max], L: [RANGE.L.min, RANGE.L.max], C: [RANGE.C.min, RANGE.C.max], V: [RANGE.V.min, RANGE.V.max], Ilim: [RANGE.I.min, RANGE.I.max], f: [RANGE.f.min, RANGE.f.max] };
  const toInput = { R: (v) => v, L: (v) => v * 1e3, C: (v) => v * 1e6, V: (v) => v, Ilim: (v) => v, f: (v) => v };
  const fromInput = { R: (v) => v, L: (v) => v / 1e3, C: (v) => v / 1e6, V: (v) => v, Ilim: (v) => v, f: (v) => v };
  const inputKey = { R: "R", L: "L", C: "C", V: "V", Ilim: "I", f: "f" };
  const text = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
  const signed = (v, digits) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(digits);
  const eng = (j) => { const mj = j * 1e3; return (mj >= 100 ? mj.toFixed(0) : mj >= 10 ? mj.toFixed(1) : mj.toFixed(2)) + " mJ"; };

  function syncInputs() {
    for (const key of Object.keys(ranges)) {
      const input = inputs[inputKey[key]];
      if (document.activeElement !== input) input.value = toInput[key](target[key]);
    }
    inputs.speed.value = view.speed;
    text(outs.R, target.R.toFixed(1) + " Ω");
    text(outs.L, (target.L * 1e3).toFixed(1) + " mH");
    text(outs.C, (target.C * 1e6).toFixed(0) + " µF");
    text(outs.V, target.V.toFixed(1) + " V");
    text(outs.I, target.Ilim.toFixed(2) + " A");
    text(outs.f, target.f.toFixed(0) + " Hz");
    text(outs.speed, view.speed.toFixed(2) + "×");
    text(outs.mode, MODE_NAME[target.mode]);
    text($('[data-hint="mode"]'), MODE_HINT[target.mode]);
    modeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === target.mode)));
    $('[data-row="f"]').toggleAttribute("data-off", target.mode === "dc");
    inputs.f.disabled = target.mode === "dc";
    switchButton.setAttribute("aria-pressed", String(target.closed));
    text(switchButton, target.closed ? "Open switch" : "Close switch");
    pauseButton.setAttribute("aria-pressed", String(paused));
    text(pauseButton, paused ? "Resume" : "Pause");
  }

  const announce = (() => {
    const region = document.createElement("div");
    region.setAttribute("aria-live", "polite");
    region.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden";
    document.body.appendChild(region);
    let timer = 0;
    return (message) => { clearTimeout(timer); timer = setTimeout(() => (region.textContent = message), 700); };
  })();

  const setTarget = (key, value) => {
    const [lo, hi] = ranges[key];
    target[key] = clamp(value, lo, hi);
    syncInputs();
    wake();
  };

  const PRESETS = {
    under: { R: 5, L: 20e-3, C: 200e-6, V: 10, Ilim: 2, mode: "dc" },
    critical: { R: null, L: 20e-3, C: 200e-6, V: 10, Ilim: 2, mode: "dc" },
    over: { R: 70, L: 20e-3, C: 200e-6, V: 10, Ilim: 2, mode: "dc" },
    resonance: { R: 3, L: 20e-3, C: 200e-6, V: 6, Ilim: 2.5, mode: "sine", f: null },
    limit: { R: 5, L: 20e-3, C: 200e-6, V: 24, Ilim: 0.6, mode: "dc" },
  };
  let closeTimer = 0;
  function resetCircuit() {
    state = initial();
    hist.count = 0; hist.head = 0; hist.version++;
    acc = 0;
  }
  function applyPreset(name, quiet) {
    const preset = { ...PRESETS[name] };
    const Z0 = Math.sqrt(preset.L / preset.C);
    if (preset.R === null) preset.R = clamp(2 * Z0, ...ranges.R);
    if (preset.f === null) preset.f = clamp(derived(preset).f0, ...ranges.f);
    Object.assign(target, preset);
    if (preset.f === undefined) target.f = Math.round(derived(preset).f0);
    target.closed = false;
    resetCircuit();
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.preset === name)));
    syncInputs();
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { target.closed = true; syncInputs(); wake(); }, 650);
    wake();
    if (!quiet) announce(`${name} preset. Closing the switch.`);
  }

  // ── what the circuit is doing, in words ──
  function storyText() {
    const d = derived(p);
    const fd = (d.wd / (2 * Math.PI)).toFixed(0);
    if (!target.closed && Math.abs(state.q) < 1e-9 && Math.abs(state.i) < 1e-6) return "The switch is open, so nothing drives the loop and nothing moves. Close the switch (or press a preset) to connect the supply.";
    if (target.mode === "sine" || target.mode === "square") {
      const z = impedance(p, p.f);
      const kind = target.mode === "sine" ? "sine" : "square";
      const near = Math.abs(Math.log(p.f / d.f0)) < 0.12;
      return `Driven by a ${kind} source at ${p.f.toFixed(0)} Hz, while the circuit prefers to ring at ${d.f0.toFixed(0)} Hz. At this frequency the loop impedance is ${z.mag.toFixed(1)} Ω, so a ${p.V.toFixed(0)} V swing pushes about ${(p.V / z.mag).toFixed(2)} A. ${near ? "They almost match, which is resonance: the coil and capacitor cancel each other and only R is left, so the current is as big as it can be." : "Move the frequency toward " + d.f0.toFixed(0) + " Hz and the current climbs."}`;
    }
    if (d.regime === "under") {
      const keep = Math.exp((-2 * Math.PI * d.zeta) / Math.sqrt(1 - d.zeta * d.zeta)) * 100;
      return `Underdamped (ζ = ${d.zeta.toFixed(2)}). The energy swaps between the coil and the capacitor ${fd} times a second, and every full swing keeps about ${keep.toFixed(0)}% of its size, because the resistor turns the rest into heat. ${p.R > 0.9 * d.Rcrit ? "" : "Raise R toward " + d.Rcrit.toFixed(0) + " Ω and the ringing dies."}`;
    }
    if (d.regime === "critical") return `Critically damped (ζ ≈ 1, R ≈ 2√(L/C) = ${d.Rcrit.toFixed(1)} Ω). This is the fastest the current can come back to rest without overshooting: the resistor takes energy out at exactly the rate the swing would need to turn around.`;
    const slow = d.alpha - Math.sqrt(d.alpha * d.alpha - d.w0 * d.w0);
    return `Overdamped (ζ = ${d.zeta.toFixed(2)}). R is so large that the energy never gets to swing. The capacitor charges slowly, like a bucket filling through a narrow pipe, with a time constant of about ${((1 / slow) * 1000).toFixed(1)} ms of circuit time.`;
  }

  const dampMarker = $("[data-damp-marker]");
  const eRef = { value: 1e-4 };
  function updatePanel(dt) {
    const d = derived(p);
    const vC = state.q / p.C, vR = p.R * state.i;
    const vterm = state.vterm, vL = vterm - vR - vC;
    const power = p.R * state.i * state.i;
    const en = energies(state, p);
    text(live.i, signed(state.i, 3) + " A");
    text(live.vR, signed(vR, 2) + " V");
    text(live.vL, signed(vL, 2) + " V");
    text(live.vC, signed(vC, 2) + " V");
    text(live.vs, vterm.toFixed(2) + " V");
    text(live.p, power.toFixed(2) + " W");
    text(live.law, `source ${vterm.toFixed(2)} V  =  R ${signed(vR, 2)}  +  L ${signed(vL, 2)}  +  C ${signed(vC, 2)}`);
    text(live.f0, d.f0.toFixed(0) + " Hz");
    text(live.zeta, d.zeta.toFixed(2));
    text(live.zeta2, d.zeta.toFixed(2));
    dampMarker.style.left = (clamp(Math.log10(d.zeta / 1), -1.3, 1.3) / 2.6 + 0.5) * 100 + "%";
    text(live.rcrit, d.Rcrit.toFixed(1) + " Ω");
    text(live.q, d.Q.toFixed(2));
    const top = Math.max(en.magnetic, en.electric, en.heat, 2 * p.C * Math.max(p.V, 1) ** 2 * 0.25);
    eRef.value = Math.max(follow(eRef.value, top, dt, 3), top);
    for (const [key, value] of [["magnetic", en.magnetic], ["electric", en.electric], ["heat", en.heat]]) {
      const bar = bars[key];
      bar.firstElementChild && null;
      const fill = bar.querySelector("b");
      fill.style.transform = `scaleX(${clamp(value / eRef.value, 0, 1).toFixed(3)})`;
      text(bar.querySelector("em"), eng(value));
    }
    text(now.R, `R = ${p.R.toFixed(1)} Ω  ·  vR = ${signed(vR, 2)} V  ·  heat ${power.toFixed(2)} W`);
    text(now.L, `L = ${(p.L * 1e3).toFixed(1)} mH  ·  vL = ${signed(vL, 2)} V  ·  field energy ${eng(en.magnetic)}`);
    text(now.C, `C = ${(p.C * 1e6).toFixed(0)} µF  ·  q = ${signed(state.q * 1e3, 3)} mC  ·  vC = ${signed(vC, 2)} V  ·  stored ${eng(en.electric)}`);
  }

  // ── the loop ──
  let frame = 0, last = 0, visible = true, keepAlive = 0, thermal = 0;
  const wake = () => { keepAlive = performance.now() + 2500; run(); };
  const word = () => {
    const d = derived(p);
    if (!target.closed && Math.abs(state.i) < 1e-4 && Math.abs(state.q / p.C) < 0.02) return "switch open";
    if (p.mode !== "dc" && target.closed) return p.mode === "sine" ? "driven" : "stepping";
    return d.regime === "under" ? "ringing" : d.regime === "over" ? "creeping" : "critical";
  };
  let lastStory = 0;
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    const calm = still.matches;
    tourStep(dt);
    // the parts glide to where the sliders put them
    for (const key of ["R", "L", "C", "V", "Ilim", "f"]) p[key] = calm ? target[key] : follow(p[key], target[key], dt, 0.14);
    p.mode = target.mode; p.closed = target.closed;
    if (!paused) {
      acc += dt * KAPPA * view.speed;
      let n = 0;
      while (acc >= SAMPLE_DT && n < 12) { step(state, p, SAMPLE_DT); record(); acc -= SAMPLE_DT; n++; }
      if (n === 12) acc = 0;
    }
    const i = paused ? 0 : state.i;
    const vC = state.q / p.C;
    const wiper = wiperOf(p.R), slug = slugOf(p.L), overlap = overlapOf(p.C);
    placeWiper(wiper); placeSlug(slug); placeSlide(overlap);
    if (!paused) driveCarriers(i, dt);
    placeFlux(p.L * state.i, dt, state.i);
    placeCompass(p.L * state.i, dt);
    placeThermometer(p.R * state.i * state.i, dt);
    placeLeaves(vC, dt);
    placeCapacitor(vC, state.q, overlap);
    placeNeedle("A", state.i, dt); placeNeedle("V", vC, dt);
    placeKnob("V", KNOB.V(p.V)); placeKnob("I", KNOB.I(p.Ilim)); placeKnob("F", KNOB.F(p.f));
    placeToggle(p.closed, dt);
    $$("[data-part^=btn-]").forEach((node) => {
      const on = node.dataset.part === "btn-" + p.mode;
      if (node.on !== on) { node.on = on; node.toggleAttribute("data-on", on); $("[data-key]", node).setAttribute("transform", on ? translateAlong(P, [0, 0, -0.9]) : ""); }
    });
    const cc = state.cc && p.closed;
    if (lamp.cc !== cc) { lamp.cc = cc; lamp.toggleAttribute("data-lit", cc); }
    drawScope(dt);
    const vterm = state.vterm;
    text(lcd[0], vterm.toFixed(2) + " V");
    text(lcd[1], signed(state.i, 2) + " A");
    updatePanel(dt);
    text(readout, `${word()} · i ${signed(state.i, 2)} A · vC ${signed(vC, 1)} V`);
    if (now - lastStory > 400) { lastStory = now; text(story, storyText()); }
    // The tour keeps the loop running; it only rests when the reader has paused it or asked for stillness.
    const quiet = (still.matches || paused) && Math.abs(state.i) < 2e-4 && Math.abs(state.vterm - vC) < 2e-3 && (p.mode === "dc" || !p.closed || p.V === 0) && leafAngle < 0.05 && Math.abs(compassAngle) < 0.05;
    if (quiet) { if (now > keepAlive) { frame = 0; return; } } else keepAlive = now + 1500;
    frame = visible ? requestAnimationFrame(tick) : 0;
  }
  function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

  // ── the idle tour: it drives the same targets a reader would ──
  const TOUR = [
    { preset: "under", length: 12, open: 6.8 },
    { preset: "critical", length: 9, open: 5.5 },
    { preset: "over", length: 11, open: 7 },
    { preset: "resonance", length: 13 },
    { preset: "limit", length: 10, open: 7 },
  ];
  const tour = { on: false, index: -1, clock: 0, opened: false, idle: 0 };
  function tourStep(dt) {
    if (!tour.on) {
      if (!still.matches && !paused) { tour.idle += dt; if (tour.idle > tour.after) { tour.on = true; tour.index = -1; tour.clock = 99; } }
      return;
    }
    tour.clock += dt;
    const current = TOUR[tour.index];
    if (current && current.open && !tour.opened && tour.clock > current.open) { tour.opened = true; target.closed = false; syncInputs(); }
    if (!current || tour.clock > current.length) {
      tour.index = (tour.index + 1) % TOUR.length;
      tour.clock = 0; tour.opened = false;
      applyPreset(TOUR[tour.index].preset, true);
    }
  }
  tour.after = 1.6;
  function takeOver() {
    tour.on = false; tour.idle = 0; tour.after = 16;
    if (!still.matches) wake();
    chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
  }
  const touched = () => { if (tour.on) takeOver(); else { tour.idle = 0; tour.after = 16; } wake(); };

  // ── controls ──
  for (const key of Object.keys(ranges)) {
    inputs[inputKey[key]].addEventListener("input", (event) => { touched(); setTarget(key, fromInput[key](parseFloat(event.target.value))); });
  }
  inputs.speed.addEventListener("input", (event) => { touched(); view.speed = parseFloat(event.target.value); syncInputs(); });
  modeButtons.forEach((b) => b.addEventListener("click", () => { touched(); target.mode = b.dataset.mode; syncInputs(); }));
  const toggleSwitch = () => { touched(); clearTimeout(closeTimer); target.closed = !target.closed; syncInputs(); announce(target.closed ? "Switch closed." : "Switch open."); };
  switchButton.addEventListener("click", toggleSwitch);
  pauseButton.addEventListener("click", () => { touched(); paused = !paused; syncInputs(); wake(); });
  $('[data-act="reset"]').addEventListener("click", () => { touched(); resetCircuit(); wake(); announce("Discharged."); });
  chips.forEach((chip) => chip.addEventListener("click", () => { touched(); applyPreset(chip.dataset.preset); }));
  stage.addEventListener("keydown", (event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); toggleSwitch(); } });
  document.addEventListener("pointerdown", (event) => { if (event.target.closest(".rlc-panel")) touched(); }, true);

  // drag the real parts: the wiper and the slug along y, the plate along x, the knobs up and down
  const unit = (axis) => { const [a, b] = axisVector(P, axis); return [a, b, a * a + b * b]; };
  const axisX = unit([1, 0, 0]), axisY = unit([0, 1, 0]);
  const viewScale = () => svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
  let drag = null;
  svg.addEventListener("pointerdown", (event) => {
    const grab = event.target.closest("[data-grab]");
    if (!grab) return;
    const what = grab.dataset.grab;
    touched();
    if (what === "switch") { toggleSwitch(); return; }
    if (what.startsWith("mode-")) { target.mode = what.slice(5); syncInputs(); return; }
    drag = { what, x: event.clientX, y: event.clientY, start: { ...target }, id: event.pointerId };
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  svg.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    touched();
    const k = viewScale();
    const dx = (event.clientX - drag.x) / k, dy = (event.clientY - drag.y) / k;
    const along = (axis) => (dx * axis[0] + dy * axis[1]) / axis[2];
    const { what, start } = drag;
    if (what === "R") setTarget("R", resistanceAt(clamp(wiperOf(start.R) + along(axisY) / (WIND.y1 - WIND.y0), 0, 1)));
    else if (what === "L") setTarget("L", inductanceAt(clamp(slugOf(start.L) - along(axisY) / SLUG_TRAVEL, 0, 1)));
    else if (what === "C") setTarget("C", capacitanceAt(clamp(overlapOf(start.C) - along(axisX) / PLATE_W, 0.1, 1)));
    else if (what === "V") setTarget("V", start.V - (dy / 140) * 24);
    else if (what === "I") setTarget("Ilim", start.Ilim - (dy / 140) * 2.9);
    else if (what === "F") setTarget("f", start.f - (dy / 140) * 380);
  });
  const release = (event) => { if (drag && event.pointerId === drag.id) { drag = null; try { svg.releasePointerCapture(event.pointerId); } catch (e) {} } };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  syncInputs();
  // on a phone the card scrolls sideways: start with the board centred
  if (stage.scrollWidth > stage.clientWidth) stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
  // reduced motion: no autoplay. Show the board settled after one step, then wait for the reader.
  if (still.matches) {
    target.closed = true; p.closed = true;
    for (let n = 0; n < 1800; n++) { step(state, p, SAMPLE_DT); record(); }
    lever.at = 1;
  }
  tick(performance.now());
  wake();

  window.__rlc = { target, p, get state() { return state; } };
})();
