// The live page. The kit, world.mjs and model.mjs are inlined above this, and DATA gives P, TURNS and DISPLAY_AT.
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
  const stroke = (d, tone, extra = "") => `<path class="iso-line" data-tone="${tone}" d="${d}"${extra}/>`;

  // ── the circuit: the physical parts are the source of truth for the numbers ──
  // `target` is where the controls want the parts. `p` is where the parts are right now,
  // eased toward the target, and it is what the model sees.
  const target = { ...DEFAULTS };
  const p = { ...DEFAULTS };
  const view = { speed: 1 };
  let state = initial();
  let paused = false;
  let phase = 0; // how far the carriers have drifted, in world units

  // The scope keeps 12 s of history at 2.5 ms a sample and shows the newest part of it.
  const SAMPLE_DT = 0.0025;
  const SAMPLES = 4800;
  const hist = { vs: new Float32Array(SAMPLES), vC: new Float32Array(SAMPLES), i: new Float32Array(SAMPLES), iC: new Float32Array(SAMPLES), count: 0, head: 0, version: 0 };
  let acc = 0;
  const record = () => {
    const at = hist.head;
    hist.vs[at] = state.vs; hist.vC[at] = state.vC; hist.i[at] = state.i; hist.iC[at] = state.iC;
    hist.head = (at + 1) % SAMPLES;
    hist.count = Math.min(SAMPLES, hist.count + 1);
    hist.version++;
  };

  // ── pieces of the drawing that the loop moves ──
  const part = (name) => $(`[data-part="${name}"]`, svg);
  const slotOf = (name) => $(`[data-slot="${name}"]`, svg);
  const layers = Object.fromEntries($$("[data-layer]", svg).map((node) => [node.dataset.layer, node]));
  const wiperGroup = part("wiper"), slideGroup = part("slide");
  wiperGroup.dataset.grab = "R"; slideGroup.dataset.grab = "C";
  const windLive = $$("path", part("winding-live"));
  const lamp = $(".iso-solid", part("lamp"));

  // carriers: one dot pool per run. In series two runs carry the one current; in parallel five
  // runs carry the supply, LED and capacitor currents, which split at J and join again at K.
  const SPACING = 9, DOT_R = Math.max(1.3, 0.72 * P.scale), DRIFT = 2600; // world units a second per amp
  const RUN_NAMES = ["out", "back", "supply", "led", "cap", "plate", "home"];
  const extremes = [];
  for (const topo of ["series", "parallel"]) for (const wiper of [0, 1]) for (const overlap of [0.1, 1]) extremes.push(carrierRuns({ wiper, overlap }, topo));
  const pools = {}, phases = {};
  for (const name of RUN_NAMES) {
    const longest = Math.max(...extremes.map((r) => (r[name] ? r[name].length : 0)));
    pools[name] = [];
    phases[name] = 0;
    for (let n = 0; n < Math.ceil(longest / SPACING) + 2; n++) {
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("class", "cap-carrier");
      dot.setAttribute("r", DOT_R.toFixed(2));
      dot.setAttribute("opacity", "0");
      layers.supply.appendChild(dot);
      dot.layerName = "supply";
      pools[name].push(dot);
    }
  }
  let runs = carrierRuns({ wiper: wiperOf(p.R), overlap: overlapOf(p.C) }, "series");
  let runsKey = "";
  const hideDot = (dot) => { if (dot.on) { dot.setAttribute("opacity", "0"); dot.on = false; } };
  function driveCarriers(dt) {
    // while the knife switch is in the air nothing flows, so the dots keep the runs they had
    const topo = p.topo === "open" ? lastTopo : p.topo;
    const key = topo + wiperOf(p.R).toFixed(3) + overlapOf(p.C).toFixed(3);
    if (key !== runsKey) { runs = carrierRuns({ wiper: wiperOf(p.R), overlap: overlapOf(p.C) }, topo); runsKey = key; }
    for (const name of RUN_NAMES) {
      const run = runs[name], pool = pools[name];
      if (!run) { pool.forEach(hideDot); continue; }
      phases[name] += DRIFT * state[run.key] * dt;
      const count = Math.floor(run.length / SPACING);
      for (let n = 0; n < pool.length; n++) {
        const dot = pool[n];
        if (n >= count) { hideDot(dot); continue; }
        const distance = (((phases[name] + n * SPACING) % run.length) + run.length) % run.length;
        const here = carrierAt(run, clamp(distance, 0, run.length - 1e-6));
        // fade in and out at the two ends of each run: at the posts, the plates and the junctions
        const ends = Math.min(smoothstep(0, 6, distance), smoothstep(0, 6, run.length - distance));
        const alpha = here.alpha * ends;
        if (alpha < 0.02) { hideDot(dot); continue; }
        if (dot.layerName !== here.layer) { layers[here.layer].appendChild(dot); dot.layerName = here.layer; }
        const [sx, sy] = toScreen(here.point);
        dot.setAttribute("cx", fx(sx)); dot.setAttribute("cy", fx(sy));
        dot.setAttribute("opacity", alpha.toFixed(2));
        dot.on = true;
      }
    }
  }

  // ── the knife switch: the lever swings at a steady rate; between the clips the circuit is open ──
  const knifeSlots = { A: slotOf("bladeA"), B: slotOf("bladeB"), back: slotOf("xbarBack"), front: slotOf("xbarFront") };
  let knifeAngle = target.topo === "parallel" ? 180 : 0, knifeFrame = -1, lastTopo = "series";
  function placeKnife(dt) {
    const want = target.topo === "parallel" ? 180 : 0;
    knifeAngle = still.matches ? want : want > knifeAngle ? Math.min(want, knifeAngle + 300 * dt) : Math.max(want, knifeAngle - 300 * dt);
    p.topo = knifeAngle <= SEATED ? "series" : knifeAngle >= 180 - SEATED ? "parallel" : "open";
    if (p.topo !== "open") lastTopo = p.topo;
    const frame = Math.round((knifeAngle / 180) * SWITCH_FRAMES);
    if (frame === knifeFrame) return;
    knifeFrame = frame;
    for (const key of ["A", "B", "back", "front"]) knifeSlots[key].innerHTML = KNIFE[frame][key];
  }

  // ── the LEDs: the lit body, the chip, the haze round the dome and the light on the boards ──
  const glowNodes = {};
  for (const name of ["green", "red"]) {
    glowNodes[name] = {
      lit: $(`.cap-lit[data-led=${name}]`, svg),
      chip: $(`.cap-die[data-led=${name}]`, svg),
      halo: $(`.cap-halo[data-led=${name}]`, svg),
      pools: $$(`.cap-pool[data-led=${name}]`, svg),
      shown: -1,
      level: 0,
    };
  }
  function placeLeds(glow, dt) {
    for (const name of ["green", "red"]) {
      const g = glowNodes[name];
      // an LED answers in microseconds; the short follow only keeps a frame from strobing
      g.level = still.matches ? glow[name] : follow(g.level, glow[name], dt, 0.025);
      const b = g.level;
      if (Math.abs(b - g.shown) < 0.004) continue;
      g.shown = b;
      const on = clamp(b, 0, 1);
      g.lit.style.opacity = (0.95 * smoothstep(0, 0.5, b)).toFixed(3);
      g.chip.style.opacity = (0.9 * smoothstep(0.05, 0.7, b)).toFixed(3);
      g.halo.style.opacity = (0.9 * Math.min(1.25, b)).toFixed(3);
      g.halo.setAttribute("transform", "");
      g.pools.forEach((node) => (node.style.opacity = (0.85 * on).toFixed(3)));
    }
  }

  // ── gauges and displays ──
  const needles = {};
  for (const [key, full] of [["A", FULL_SCALE.I], ["V", FULL_SCALE.V]]) {
    const slot = slotOf("needle" + key);
    slot.innerHTML = stroke("", "lit", ' data-free="end" style="stroke-width:1.1"') + stroke("", "mid", ' data-free="end" style="stroke-width:1.1"') + `<circle class="cap-hub" r="1.5"/>`;
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

  // the light meter: the photocell adds up the light from both LEDs
  const luxSlot = slotOf("lux");
  luxSlot.innerHTML = stroke("", "lit", ' data-free="end" style="stroke-width:1.4"') + stroke("", "mid", ' data-free="end" style="stroke-width:1.2"') + `<circle class="cap-hub" r="1.3"/>`;
  const luxNodes = { tip: luxSlot.children[0], tail: luxSlot.children[1], hub: luxSlot.children[2] };
  let luxAngle = -LUX_SWEEP, lastLux = 999;
  function placeLux(light, dt) {
    const want = -LUX_SWEEP + 2 * LUX_SWEEP * clamp(light / LUX_FULL, 0, 1.04);
    luxAngle = still.matches ? want : follow(luxAngle, want, dt, 0.12);
    if (Math.abs(luxAngle - lastLux) < 0.05) return;
    lastLux = luxAngle;
    // the kit's dial angles: 0 points to -y and they turn toward +x, so the scale's middle (+x) is 90°
    const a = ((90 + luxAngle) * Math.PI) / 180;
    const [cx, cy] = LUX.at, z = LUX.h + 0.25;
    const dir = [Math.sin(a), -Math.cos(a)];
    luxNodes.tip.setAttribute("d", lineOnTop([cx, cy], [cx + dir[0] * 9.6, cy + dir[1] * 9.6], z, P));
    luxNodes.tail.setAttribute("d", lineOnTop([cx, cy], [cx - dir[0] * 3.2, cy - dir[1] * 3.2], z, P));
    const hub = toScreen([cx, cy, z]);
    luxNodes.hub.setAttribute("cx", fx(hub[0])); luxNodes.hub.setAttribute("cy", fx(hub[1]));
  }


  // the stopwatch: its hand counts the seconds since the last flip; a lit dot marks one time
  // constant (about two-thirds full) and a lit ring five (as good as full)
  const watchSlot = slotOf("watch");
  watchSlot.innerHTML = `<circle class="cap-hub" r="1.1" style="opacity:0"/><circle class="cap-tau5" r="1.5" style="opacity:0"/>` + stroke("", "lit", ' data-free="end" style="stroke-width:1.1"') + stroke("", "mid", ' data-free="end" style="stroke-width:1"') + `<circle class="cap-hub" r="1.2"/>`;
  const watchNodes = { tau: watchSlot.children[0], tau5: watchSlot.children[1], tip: watchSlot.children[2], tail: watchSlot.children[3], hub: watchSlot.children[4] };
  watchNodes.tau.setAttribute("class", "cap-tau");
  let watchStart = 0, watchEdge = null, lastTau = -1;
  const faceZ = WATCH.h + 0.45;
  const onDial = (angle, r) => { const [cx, cy] = WATCH.at; return toScreen([cx + Math.sin(angle) * r, cy - Math.cos(angle) * r, faceZ]); };
  const dialAngle = (seconds) => WATCH_TWELVE + (seconds / WATCH.turn) * 2 * Math.PI;
  function placeWatch(tau) {
    // what counts as a flip: the switch in battery mode, the supply's edge on auto flip, a rising zero on AC
    const edge = p.mode === "dc" ? (p.fill ? 1 : 0) : p.mode === "pulse" ? (state.vs > 0 ? 1 : 0) : state.vs >= 0 ? 1 : 0;
    if (edge !== watchEdge) { if (p.mode !== "ac" || edge === 1 || watchEdge === null) watchStart = state.t; watchEdge = edge; }
    const elapsed = state.t - watchStart;
    const a = dialAngle(elapsed % WATCH.turn);
    const [cx, cy] = WATCH.at;
    const r = WATCH.r - 3.4;
    const dir = [Math.sin(a), -Math.cos(a)];
    watchNodes.tip.setAttribute("d", lineOnTop([cx, cy], [cx + dir[0] * r, cy + dir[1] * r], faceZ, P));
    watchNodes.tail.setAttribute("d", lineOnTop([cx, cy], [cx - dir[0] * 3.4, cy - dir[1] * 3.4], faceZ, P));
    const hub = toScreen([cx, cy, faceZ]);
    watchNodes.hub.setAttribute("cx", fx(hub[0])); watchNodes.hub.setAttribute("cy", fx(hub[1]));
    if (Math.abs(tau - lastTau) > 1e-3) {
      lastTau = tau;
      const m1 = onDial(dialAngle(tau), WATCH.r - 6), m5 = onDial(dialAngle(5 * tau), WATCH.r - 6);
      watchNodes.tau.setAttribute("cx", fx(m1[0])); watchNodes.tau.setAttribute("cy", fx(m1[1]));
      watchNodes.tau5.setAttribute("cx", fx(m5[0])); watchNodes.tau5.setAttribute("cy", fx(m5[1]));
      watchNodes.tau.style.opacity = tau < WATCH.turn ? "1" : "0";
      watchNodes.tau5.style.opacity = 5 * tau < WATCH.turn ? "1" : "0";
    }
  }

  // the supply's display
  const displaySlot = slotOf("display");
  displaySlot.innerHTML = `<text class="cap-lcd" x="1" y="-1.6" font-size="6.2"></text><text class="cap-lcd" x="1" y="8.4" font-size="6.2"></text>`;
  const lcd = $$("text", displaySlot);

  // supply knobs: the pointer is a line from the middle to the rim
  const knobDefs = { V: [KNOB_V, "pointerV"], F: [KNOB_F, "pointerF"] };
  const pointers = {};
  for (const [key, [, slot]] of Object.entries(knobDefs)) {
    // the indicator printed on the cap: a line out to the rim from a dot near the middle
    slotOf(slot).innerHTML = stroke("", "hi", ' style="stroke-width:1.2"') + `<circle class="cap-hub" r="0.9"/>`;
    pointers[key] = slotOf(slot).firstChild;
    pointers[key].dot = slotOf(slot).lastChild;
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
    const inner = toScreen([x + Math.sin(a) * def.r * 0.18, y - Math.cos(a) * def.r * 0.18, z]);
    pointers[key].dot.setAttribute("cx", fx(inner[0])); pointers[key].dot.setAttribute("cy", fx(inner[1]));
  }

  // the switch: a lever that tips toward the viewer on FILL. On Auto flip it flips by itself.
  const toggleSlot = slotOf("toggle");
  // the lever pivots in a nut at its base, and ends in a blue ball the reader can click
  toggleSlot.innerHTML = stroke("", "hi", ' style="stroke-width:2.1"') + `<circle class="cap-grip-ball" r="1.9"/><circle class="cap-hub" r="1.3"/>`;
  const lever = { line: toggleSlot.children[0], tip: toggleSlot.children[1], nut: toggleSlot.children[2], at: 0 };
  function placeToggle(on, dt) {
    lever.at = still.matches ? (on ? 1 : 0) : follow(lever.at, on ? 1 : 0, dt, 0.04);
    const [x, y] = TOGGLE.at;
    const z0 = SUP_TOP + 2.8, tilt = (lever.at - 0.5) * 2 * 3.8;
    const base = toScreen([x, y, z0]), tip = toScreen([x + tilt, y, z0 + 6.6]);
    lever.line.setAttribute("d", `M${fx(base[0])} ${fx(base[1])}L${fx(tip[0])} ${fx(tip[1])}`);
    lever.tip.setAttribute("cx", fx(tip[0])); lever.tip.setAttribute("cy", fx(tip[1]));
    lever.nut.setAttribute("cx", fx(base[0])); lever.nut.setAttribute("cy", fx(base[1]));
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
  const placeSlide = (overlap) => slideGroup.setAttribute("transform", translateAlong(P, [slideShift(overlap), 0, 0]));

  // electroscope: two leaves that push apart as the capacitor charges, whichever way
  const leavesSlot = slotOf("leaves");
  leavesSlot.innerHTML = stroke("", "hi", ' data-free="end" style="stroke-width:1.5"') + stroke("", "hi", ' data-free="end" style="stroke-width:1.5"');
  const leaf = [leavesSlot.children[0], leavesSlot.children[1]];
  let leafAngle = 0;
  function placeLeaves(volts, dt) {
    const want = 62 * Math.pow(clamp(Math.abs(volts) / 12, 0, 1), 0.85);
    leafAngle = still.matches ? want : follow(leafAngle, want, dt, 0.08);
    const [x, y] = SCOPE_E.at, piv = SCOPE_E.pivot + 3;
    const a = (leafAngle * Math.PI) / 180;
    [-1, 1].forEach((side, n) => {
      const from = toScreen([x, y, piv]), to = toScreen([x, y + side * SCOPE_E.leaf * Math.sin(a), piv - SCOPE_E.leaf * Math.cos(a)]);
      leaf[n].setAttribute("d", `M${fx(from[0])} ${fx(from[1])}L${fx(to[0])} ${fx(to[1])}`);
    });
  }

  // ── the capacitor: charge marks, field lines and the overlap outline ──
  const faceY = FIXED_Y + PLATE_T + 0.05, slideFaceY = SLIDE_Y + PLATE_T + 0.05, markSize = 4.6;
  const markNode = (sign, x, y, z, size) => `<text class="cap-mark" transform="${sideMatrix([x, y], z, P, "left")}" y="${fx(size * 0.36)}" font-size="${size}" text-anchor="middle">${sign}</text>`;
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

  function placeCapacitor(volts, overlap) {
    const s = slideShift(overlap);
    if (Math.abs(overlap - lastOverlap) > 1e-4) {
      lastOverlap = overlap;
      const x0 = PLATE_X0 + s + 0.8, x1 = PLATE_X0 + PLATE_W - 0.8, z0 = PLATE_Z0 + 1.8, z1 = PLATE_Z1 - 1.8;
      overlapPath.setAttribute("d", pathOf([[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => toScreen([x, faceY - 0.02, z])), true));
    }
    // the number of marks follows the charge, q = C·v, so a bigger capacitor shows more at the same voltage
    const density = clamp((Math.abs(volts) / 10) * (0.35 + 0.65 * overlap), 0, 1);
    const plus = volts >= 0 ? 1 : 0; // on the fixed plate: + when the supply's + side has filled it
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
    const field = clamp(Math.abs(volts) / 10, 0, 1);
    fieldLines.forEach((f, n) => {
      const w = clamp(((PLATE_X0 + PLATE_W) - (f.x + s)) / 3 + 0.5, 0, 1);
      const a = Math.pow(field, 0.7) * w * 0.95;
      const line = fieldNodes[n * 2], chev = fieldNodes[n * 2 + 1];
      if (set(f, "alpha", a)) { line.style.opacity = a.toFixed(2); chev.style.opacity = a.toFixed(2); fieldEnds[n].style.opacity = (a * 0.9).toFixed(2); }
      const dir = plus ? 1 : -1;
      if (f.dir !== dir) { f.dir = dir; chev.setAttribute("d", dir > 0 ? f.up : f.down); }
    });
  }

  // ── the scope: a strip chart, newest on the right, like a heart monitor ──
  // The current trace is drawn twice and clipped: green above the line (filling), red below (emptying).
  const sc = SCOPE, scW = sc.u1 - sc.u0, scMid = (sc.z0 + sc.z1) / 2, scAmp = (sc.z1 - sc.z0) / 2 - 0.8;
  const scopeSlot = slotOf("scope");
  scopeSlot.innerHTML =
    `<defs><clipPath id="cap-clip-pos" clipPathUnits="userSpaceOnUse"><rect x="${sc.u0}" y="${-sc.z1 - 2}" width="${scW}" height="${sc.z1 - scMid + 2 - 0.5}"/></clipPath>` +
    `<clipPath id="cap-clip-neg" clipPathUnits="userSpaceOnUse"><rect x="${sc.u0}" y="${-scMid + 0.5}" width="${scW}" height="${scMid - sc.z0 + 2}"/></clipPath></defs>` +
    stroke("", "lo", ' data-dashed="" data-free="start" style="stroke-width:.8px"') +
    stroke("", "mid", ' data-free="start" style="stroke-width:1.1px"') +
    stroke("", "hi", ' data-dotted="" data-free="start" style="stroke-width:.9px"') +
    stroke("", "lit", ' data-free="start" style="stroke-width:1.35px"') +
    stroke("", "lit", ' data-free="start" clip-path="url(#cap-clip-pos)" style="stroke-width:1.35px"') +
    stroke("", "lit", ' data-free="start" clip-path="url(#cap-clip-neg)" style="stroke-width:1.35px"') +
    `<text class="iso-face-text" data-tone="lo" x="${sc.u0 + 2.5}" y="${-(sc.z0 + 2.2)}" font-size="3.1"></text>`;
  const traceNodes = $$("path", scopeSlot), scopeText = $("text", scopeSlot);
  // the two clipped copies carry a class of their own; the generic iso-line class is kept for the theme
  // 0 supply, 1 capacitor voltage, 2 capacitor current (parallel only), 3 LED current, 4/5 its green and red halves
  traceNodes[4].setAttribute("class", "iso-line cap-trace-pos");
  traceNodes[5].setAttribute("class", "iso-line cap-trace-neg");
  const I_DIV = [0.001, 0.002, 0.005, 0.01, 0.02], V_DIV = 4;
  const WINDOWS = [0.5, 1, 2, 5, 10];
  const range = { idiv: 0.005, iscale: 0.015, window: 5 };
  const pickDiv = (list, current, peak) => {
    const want = list.find((d) => 3 * d * 0.92 >= peak) ?? list[list.length - 1];
    if (want > current) return want;
    if (want < current && peak < 0.85 * 3 * want) return want;
    return current;
  };
  function windowFor() {
    if (p.mode === "dc") return WINDOWS.find((w) => w >= 6 * derived(p).tau) ?? 10;
    return WINDOWS.find((w) => w >= 3 / p.f) ?? 10;
  }
  const COLUMNS = 280;
  let lastVersion = -1, lastScaleKey = "";
  function drawScope(dt) {
    range.window = Math.max(windowFor(), WINDOWS[0]);
    const span = Math.min(hist.count, Math.round(range.window / SAMPLE_DT));
    let peakI = 0;
    const both = p.topo === "parallel";
    for (let n = 0; n < span; n++) {
      const at = (hist.head - 1 - n + SAMPLES) % SAMPLES;
      peakI = Math.max(peakI, Math.abs(hist.i[at]), both ? Math.abs(hist.iC[at]) : 0);
    }
    range.idiv = pickDiv(I_DIV, range.idiv, peakI);
    range.iscale = still.matches ? 3 * range.idiv : follow(range.iscale, 3 * range.idiv, dt, 0.3);
    const key = range.iscale.toFixed(5) + range.window + both;
    if (hist.version === lastVersion && key === lastScaleKey) return;
    lastVersion = hist.version; lastScaleKey = key;
    const total = Math.round(range.window / SAMPLE_DT);
    // one column holds several samples: draw its lowest and highest so a short flash is never lost
    const build = (array, scale) => {
      let d = "";
      const columns = Math.min(COLUMNS, total), per = total / columns;
      for (let c = 0; c < columns; c++) {
        const newest = Math.floor((columns - 1 - c) * per), oldest = Math.max(newest + 1, Math.floor((columns - c) * per));
        if (newest >= hist.count) continue;
        let lo = Infinity, hi = -Infinity, first = 0, last = 0;
        for (let n = Math.min(oldest, hist.count) - 1; n >= newest; n--) {
          const v = array[(hist.head - 1 - n + SAMPLES * 2) % SAMPLES];
          if (n === Math.min(oldest, hist.count) - 1) first = v;
          last = v;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        const u0 = sc.u0 + (scW * c) / columns, u1 = sc.u0 + (scW * (c + 1)) / columns;
        const z = (v) => fx(-(scMid + scAmp * clamp(v / scale, -1.04, 1.04)));
        const step = d ? "L" : "M";
        if (hi - lo < scale * 0.01) d += `${step}${fx(u0)} ${z(first)}L${fx(u1)} ${z(last)}`;
        else d += `${step}${fx(u0)} ${z(first)}L${fx((u0 + u1) / 2)} ${z(first < last ? lo : hi)}L${fx((u0 + u1) / 2)} ${z(first < last ? hi : lo)}L${fx(u1)} ${z(last)}`;
      }
      return d;
    };
    traceNodes[0].setAttribute("d", build(hist.vs, 3 * V_DIV));
    traceNodes[1].setAttribute("d", build(hist.vC, 3 * V_DIV));
    const di = build(hist.i, range.iscale);
    for (const n of [3, 4, 5]) traceNodes[n].setAttribute("d", di);
    traceNodes[2].setAttribute("d", both ? build(hist.iC, range.iscale) : "");
    const text = `${V_DIV} V/div  ${range.idiv * 1000} mA/div  ${range.window / 10} s/div`;
    if (scopeText.textContent !== text) scopeText.textContent = text;
  }

  // ── the panel ──
  const inputs = Object.fromEntries($$("[data-in]").map((node) => [node.dataset.in, node]));
  const outs = Object.fromEntries($$("[data-out]").map((node) => [node.dataset.out, node]));
  const live = Object.fromEntries($$("[data-live]").map((node) => [node.dataset.live, node]));
  const story = $("[data-story]");
  const modeButtons = $$("[data-mode]"), topoButtons = $$("[data-topo]"), chips = $$("[data-preset]");
  const fillButton = $('[data-act="fill"]'), emptyButton = $('[data-act="empty"]'), pauseButton = $('[data-act="pause"]');
  const TOPO_HINT = {
    series: "The LEDs feed the capacitor: the knife switch's lever is back.",
    parallel: "The capacitor sits across the LEDs: the knife switch's lever is forward.",
  };
  const MODE_NAME = { dc: "battery", pulse: "auto flip", ac: "AC" };
  const MODE_HINT = {
    dc: "A steady push, like a battery. You flip the switch yourself.",
    pulse: "The supply flips itself between Fill and Empty, again and again.",
    ac: "The push swings forward and backward, like the mains.",
  };
  const ranges = { V: [RANGE.V.min, RANGE.V.max], R: [RANGE.R.min, RANGE.R.max], C: [RANGE.C.min, RANGE.C.max], f: [RANGE.f.min, RANGE.f.max] };
  const toInput = { V: (v) => v, R: (v) => v, C: (v) => v * 1e6, f: (v) => fFrac(v) };
  const fromInput = { V: (v) => v, R: (v) => v, C: (v) => v / 1e6, f: (v) => fAt(v) };
  const text = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
  const mA = (i, digits = 1) => (i >= 0 ? "+" : "−") + Math.abs(i * 1000).toFixed(digits) + " mA";
  const seconds = (s) => (s < 1 ? (s * 1000).toFixed(0) + " ms" : s.toFixed(s < 10 ? 2 : 1) + " s");
  const hz = (f) => (f < 1 ? f.toFixed(2) : f.toFixed(1)) + " Hz";

  function syncInputs() {
    for (const key of Object.keys(ranges)) {
      const input = inputs[key];
      if (document.activeElement !== input) input.value = toInput[key](target[key]);
    }
    inputs.speed.value = view.speed;
    const d = derived(target);
    text(outs.V, target.V.toFixed(1) + " V");
    text(outs.R, target.R.toFixed(0) + " Ω");
    text(outs.C, (target.C * 1e6).toFixed(0) + " µF");
    text(outs.f, hz(target.f) + (target.f >= 1 ? "" : " · one flip every " + (1 / target.f).toFixed(1) + " s"));
    text(outs.speed, view.speed.toFixed(2) + "×");
    text(outs.mode, MODE_NAME[target.mode]);
    text($('[data-hint="mode"]'), MODE_HINT[target.mode]);
    text($('[data-hint="R"]'), `slows the flow: at most ${(d.peak * 1000).toFixed(1)} mA can get through at ${target.V.toFixed(1)} V`);
    $$("[data-wiring]").forEach((node) => node.toggleAttribute("hidden", node.dataset.wiring !== target.topo));
    modeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === target.mode)));
    topoButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.topo === target.topo)));
    text(outs.topo, target.topo);
    text($('[data-hint="topo"]'), TOPO_HINT[target.topo]);
    text($('[data-act="empty"] i'), "supply out, wires joined");
    $('[data-row="f"]').toggleAttribute("data-off", target.mode === "dc");
    inputs.f.disabled = target.mode === "dc";
    $('[data-row="switch"]').toggleAttribute("data-off", target.mode !== "dc");
    fillButton.setAttribute("aria-pressed", String(target.fill));
    emptyButton.setAttribute("aria-pressed", String(!target.fill));
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
    fill: { topo: "series", mode: "dc", V: 9, R: 680, C: 1000e-6, start: "empty", then: "fill" },
    empty: { topo: "series", mode: "dc", V: 9, R: 680, C: 1000e-6, start: "full", then: "empty" },
    big: { topo: "series", mode: "dc", V: 9, R: 470, C: 2200e-6, start: "empty", then: "fill" },
    small: { topo: "series", mode: "dc", V: 9, R: 470, C: 220e-6, start: "empty", then: "fill" },
    slow: { topo: "series", mode: "pulse", V: 9, R: 470, C: 470e-6, f: 0.25, start: "empty" },
    fast: { topo: "series", mode: "ac", V: 9, R: 470, C: 2200e-6, f: 6, start: "empty" },
    unplug: { topo: "parallel", mode: "dc", V: 12, R: 1000, C: 2200e-6, start: "full", then: "empty" },
    smooth: { topo: "parallel", mode: "pulse", V: 12, R: 470, C: 2200e-6, f: 4, start: "empty" },
  };
  let flipTimer = 0;
  function resetCircuit() {
    state = initial();
    hist.count = 0; hist.head = 0; hist.version++;
    acc = 0;
  }
  function applyPreset(name, quiet) {
    const preset = PRESETS[name];
    for (const key of ["topo", "mode", "V", "R", "C", "f"]) if (preset[key] !== undefined) target[key] = preset[key];
    Object.assign(p, { V: target.V, R: target.R, C: target.C, f: target.f, mode: target.mode });
    resetCircuit();
    target.fill = false;
    // "full" means as full as this supply can make it through the green LED
    if (preset.start === "full") { state.vC = derived({ ...target, topo: preset.topo }).top; target.fill = true; }
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.preset === name)));
    syncInputs();
    clearTimeout(flipTimer);
    if (preset.then) flipTimer = setTimeout(() => { target.fill = preset.then === "fill"; syncInputs(); wake(); }, 700);
    wake();
    if (!quiet) announce(`${name} preset.`);
  }

  // ── what the circuit is doing, in words a child can follow ──
  function storyText() {
    const d = derived(p);
    const i = state.iL, vC = state.vC, small = 0.0003;
    const hot = Math.abs(i) > LED.hot ? " That is more than a real LED likes (about 30 mA): turn the resistor up or the voltage down." : "";
    if (p.topo === "open") return "The knife switch is between its clips, so nothing is connected and nothing flows. The capacitor keeps whatever charge it had.";
    if (p.topo === "parallel") return parallelStory(d, small, hot);
    if (p.mode === "pulse") {
      const half = 0.5 / p.f;
      const full = half > 4 * d.tau;
      return `The supply flips between Fill and Empty by itself, ${hz(p.f)}. Every flip makes a flash: green while the capacitor fills, red while it empties. ${full ? `Each flip lasts ${seconds(half)}, much longer than the fill time of ${seconds(d.tau)}, so the capacitor fills up completely, the flash dies away and the LED waits dark for the next flip.` : `Each flip lasts only ${seconds(half)}, shorter than the fill time of ${seconds(d.tau)}, so it flips again before the capacitor is full. The current hardly stops, and the LEDs stay lit.`}${hot}`;
    }
    if (p.mode === "ac") {
      return `The supply pushes forward, then backward, ${hz(p.f)}. The capacitor fills one way, empties, fills the other way, and never gets to stay full, so current keeps flowing back and forth and the LEDs take turns. At this speed the capacitor resists AC by only about ${d.Xc < 10 ? d.Xc.toFixed(1) : d.Xc.toFixed(0)} Ω${d.Xc < p.R ? ", less than the resistor, so the LEDs are about as bright as the resistor allows" : `. Flip faster or use a bigger capacitor and it resists less`}.${hot}`;
    }
    if (p.fill) {
      if (i > small) {
        const pct = d.top > 0 ? clamp(vC / d.top, 0, 1) * 100 : 100;
        return `Series, switch on Fill. Charge is rushing onto the capacitor through the green LED, so it lights up. The capacitor is ${pct.toFixed(0)}% full, and as it fills it pushes back harder, so the current gets smaller and the LED dims.${hot}`;
      }
      if (p.V <= LED.green.vf) return `The supply gives only ${p.V.toFixed(1)} V, but the green LED needs about ${LED.green.vf} V before any current can flow. Turn the voltage up.`;
      return `The capacitor is full at ${vC.toFixed(1)} V. It now pushes back as hard as the supply can push through the LED, so nothing flows and the LED is dark, even though the switch is still on Fill. Flip it to Empty.`;
    }
    if (i < -small) return `Series, switch on Empty. The supply is out of the loop, and the two ends are joined. The charge stored in the capacitor rushes back round the other way, through the red LED. As the capacitor empties, its push gets weaker and the red LED fades.${hot}`;
    if (Math.abs(vC) > 0.5) return `Almost empty. The last ${vC.toFixed(1)} V stays on the capacitor because the red LED needs about ${LED.red.vf} V before it lets any current through. Flip to Fill to charge it again.`;
    return "The capacitor is empty and nothing is flowing. Flip the switch to Fill (or press Space on the board) and watch the green LED.";
  }
  function parallelStory(d, small, hot) {
    const { iS, iL, iC, vC } = state;
    if (p.mode === "pulse") {
      const steady = d.drain * p.f > 1;
      return `Parallel, with the supply flipping between ${p.V.toFixed(0)} V and 0, ${hz(p.f)}. The capacitor sits across the LEDs like a tank: it soaks up charge while the supply is on and feeds the LED while it is off. ${steady ? "It flips faster than the capacitor can drain, so the LED hardly notices the gaps and glows steadily. This is how capacitors smooth bumpy power in real circuits." : "The gaps are long enough for the capacitor to run down, so the LED still dims between flips. Flip faster or use a bigger capacitor and the glow evens out."}${hot}`;
    }
    if (p.mode === "ac") return `Parallel, with AC ${hz(p.f)}. The capacitor sits right across the LEDs and soaks up the fast changes before they reach them. The faster the supply swings, or the bigger the capacitor, the less is left for the LEDs, the opposite of series, where faster AC made them brighter.${hot}`;
    if (p.fill) {
      if (iC > small && iL < small) return `Parallel, supply plugged in. All the current is going into the empty capacitor, and none into the LED: the LED needs about ${LED.green.vf} V and the capacitor is only at ${vC.toFixed(1)} V. It has to fill up first.`;
      if (iC > small) return `Parallel, supply plugged in. The capacitor has passed ${LED.green.vf} V, so the current now splits: ${(iL * 1000).toFixed(1)} mA lights the LED and ${(iC * 1000).toFixed(1)} mA still fills the capacitor. Watch the dots split at the junction after the resistor.${hot}`;
      return `Parallel, and the capacitor is full at ${vC.toFixed(1)} V. Now all ${(iS * 1000).toFixed(1)} mA from the supply goes through the LED. Switch to Empty to take the supply away, and see what the capacitor does.${hot}`;
    }
    if (iL > small) return `Parallel, supply switched out: the supply gives nothing now, but the LED is still lit. The capacitor is emptying, ${(iL * 1000).toFixed(1)} mA through the LED (and ${(Math.abs(iS) * 1000).toFixed(1)} mA back round through the resistor), like a tank draining through two taps. As it empties its push gets weaker and the LED fades.`;
    if (Math.abs(vC) > 0.2 && iS < -small) return `The LED has gone out: the capacitor is below the ${LED.green.vf} V an LED needs. The little charge left drains away slowly through the resistor.`;
    if (Math.abs(vC) > 0.2) return `Almost empty. The LED needs about ${LED.green.vf} V, so it went out a while ago; the last bit of charge is leaking away through the resistor.`;
    return "Parallel: the capacitor sits across the LEDs. Switch to Fill. The LED waits until the capacitor has filled past 2 V, then lights up.";
  }

  function updatePanel() {
    const d = derived(p);
    const r = readings(state, p);
    const glow = glowOf(state.iL);
    text(live.vC, (r.vC >= 0 ? "" : "−") + Math.abs(r.vC).toFixed(2) + " V");
    text(live.i, mA(state.i, 2));
    const level = $("[data-level]"), mark = $("[data-mark]"), flow = $("[data-flow]");
    level.style.transform = `scaleX(${clamp(Math.abs(r.vC) / 12, 0, 1).toFixed(4)})`;
    level.toggleAttribute("data-neg", r.vC < 0);
    mark.style.left = clamp((d.top / 12) * 100, 0, 100).toFixed(2) + "%";
    text(live.fillNote, p.mode === "dc" ? `the line shows how full this supply can get it: ${d.top.toFixed(1)} V` : p.mode === "ac" ? "with AC it fills one way, then the other" : "it fills on each flip and drains between");
    const w = clamp(Math.abs(state.i) / FULL_SCALE.I, 0, 1) * 50;
    flow.style.left = (state.i >= 0 ? 50 : 50 - w).toFixed(2) + "%";
    flow.style.width = w.toFixed(2) + "%";
    flow.style.transform = "none";
    flow.toggleAttribute("data-neg", state.i < 0);
    text(live.flowNote, Math.abs(state.i) < 0.0003 ? "no current: both LEDs dark" : state.i > 0 ? "through the green LED" : "through the red LED");
    text(live.iS, mA(state.iS, 2));
    text(live.iC, mA(state.iC, 2) + (Math.abs(state.iC) < 0.0003 ? "" : state.iC > 0 ? " (filling)" : " (emptying)"));
    const pct = (b) => (b <= 0.001 ? "off" : Math.min(100, b * 100).toFixed(0) + "% bright");
    text(live.green, pct(glow.green));
    text(live.red, pct(glow.red));
    text(live.q, (Math.abs(r.q) * 1000).toFixed(2) + " mC");
    text(live.tau, `${seconds(d.tau)} · full in about ${seconds(5 * d.tau)}`);
    text(live.peak, (d.peak * 1000).toFixed(1) + " mA");
    text(live.xc, p.mode === "dc" ? "— (battery)" : (d.Xc < 10 ? d.Xc.toFixed(1) : d.Xc.toFixed(0)) + " Ω");
    text(live.law, p.topo === "parallel"
      ? `from the supply ${mA(state.iS, 2)}  =  into the LEDs ${mA(state.iL, 2)}  +  into the capacitor ${mA(state.iC, 2)}`
      : p.topo === "series"
        ? `supply ${state.vs.toFixed(2)} V  =  resistor ${r.vR.toFixed(2)} V  +  LED board ${r.vBoard.toFixed(2)} V  +  capacitor ${r.vC.toFixed(2)} V`
        : "the knife switch is open: nothing is connected");
  }

  // ── the loop ──
  let frame = 0, last = 0, visible = true, keepAlive = 0;
  const wake = () => { keepAlive = performance.now() + 2500; run(); };
  const word = () => {
    if (p.topo === "open") return "switching";
    if (Math.abs(state.iC) < 0.0003) return Math.abs(state.vC) > 0.5 ? "holding its charge" : "empty";
    return state.iC > 0 ? "filling" : "emptying";
  };
  let lastStory = 0;
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    const calm = still.matches;
    tourStep(dt);
    // the parts glide to where the controls put them
    for (const key of ["V", "R", "C"]) p[key] = calm ? target[key] : follow(p[key], target[key], dt, 0.14);
    p.f = calm ? target.f : Math.exp(follow(Math.log(p.f), Math.log(target.f), dt, 0.14));
    p.mode = target.mode; p.fill = target.fill;
    placeKnife(dt);
    const ran = paused ? 0 : dt * view.speed;
    if (ran) {
      acc += ran;
      let n = 0;
      while (acc >= SAMPLE_DT && n < 40) { step(state, p, SAMPLE_DT); record(); acc -= SAMPLE_DT; n++; }
      if (n === 40) acc = 0;
    }
    const vC = state.vC;
    placeWiper(wiperOf(p.R)); placeSlide(overlapOf(p.C));
    if (ran) driveCarriers(ran);
    const glow = glowOf(state.i);
    placeLeds(glow, dt);
    placeLux(glow.green + glow.red, dt);
    placeLeaves(vC, dt);
    const d = derived(p);
    placeWatch(p.mode === "dc" && !p.fill ? d.drain : d.tau);
    placeCapacitor(vC, overlapOf(p.C));
    placeNeedle("A", state.i, dt); placeNeedle("V", vC, dt);
    placeKnob("V", KNOB.V(p.V)); placeKnob("F", KNOB.F(fFrac(p.f)));
    const connected = p.mode === "dc" ? p.fill : p.mode === "pulse" ? state.vs > 0 : true; // the lever on the supply
    placeToggle(connected, dt);
    $$("[data-part^=btn-]").forEach((node) => {
      const on = node.dataset.part === "btn-" + p.mode;
      if (node.on !== on) { node.on = on; node.toggleAttribute("data-on", on); $("[data-key]", node).setAttribute("transform", on ? translateAlong(P, [0, 0, -0.9]) : ""); }
    });
    if (lamp.on !== connected) { lamp.on = connected; lamp.toggleAttribute("data-lit", connected); }
    drawScope(dt);
    placeDiagram(ran);
    text(lcd[0], state.vs.toFixed(2) + " V");
    text(lcd[1], mA(state.iS, 1));
    updatePanel();
    text(readout, `${p.topo === "open" ? "" : p.topo + " · "}${word()} · LED ${mA(state.iL, 1)} · capacitor ${vC.toFixed(1)} V`);
    if (now - lastStory > 400) { lastStory = now; text(story, storyText()); }
    // The loop rests only when nothing is moving and nothing will: no current, no drive, gauges settled.
    const idle = p.mode === "dc" && Math.abs(state.iS) < 1e-6 && Math.abs(state.iL) < 1e-6 && !tour.on && knifeAngle === (target.topo === "parallel" ? 180 : 0);
    const settled = Math.abs(needles.A.angle) < 0.05 && Math.abs(luxAngle + LUX_SWEEP) < 0.1 && Math.abs(lever.at - (connected ? 1 : 0)) < 0.01;
    const quiet = paused || (calm && idle) || (idle && settled);
    if (quiet) { if (now > keepAlive) { frame = 0; return; } } else keepAlive = now + 1500;
    frame = visible ? requestAnimationFrame(tick) : 0;
  }
  function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

  // ── the idle tour: it drives the same controls a reader would ──
  const TOUR = [
    { preset: "fill", length: 7 },
    { preset: "empty", length: 6 },
    { preset: "big", length: 12 },
    { preset: "small", length: 4 },
    { preset: "slow", length: 12 },
    { preset: "fast", length: 7 },
    { preset: "unplug", length: 8 },
    { preset: "smooth", length: 9 },
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
  function takeOver() {
    tour.on = false; tour.idle = 0; tour.after = 20;
    clearTimeout(flipTimer); // a preset the tour started must not flip the switch under the reader
    if (!still.matches) wake();
    chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
  }
  // Under reduced motion the page opens paused on one lit moment; the first touch lets it run.
  let autoPaused = false;
  const touched = () => {
    if (autoPaused) { autoPaused = false; paused = false; syncInputs(); }
    if (tour.on) takeOver(); else { tour.idle = 0; tour.after = 20; }
    wake();
  };

  // ── controls ──
  for (const key of Object.keys(ranges)) {
    inputs[key].addEventListener("input", (event) => { touched(); setTarget(key, fromInput[key](parseFloat(event.target.value))); });
  }
  inputs.speed.addEventListener("input", (event) => { touched(); view.speed = parseFloat(event.target.value); syncInputs(); });
  modeButtons.forEach((b) => b.addEventListener("click", () => { touched(); target.mode = b.dataset.mode; syncInputs(); }));
  const setTopo = (topo) => { touched(); target.topo = topo; syncInputs(); announce(`Knife switch to ${topo}.`); };
  topoButtons.forEach((b) => b.addEventListener("click", () => setTopo(b.dataset.topo)));
  const setFill = (on) => {
    touched(); clearTimeout(flipTimer);
    if (target.mode !== "dc") target.mode = "dc";
    target.fill = on; syncInputs();
    announce(on ? "Switch on Fill." : "Switch on Empty.");
  };
  fillButton.addEventListener("click", () => setFill(true));
  emptyButton.addEventListener("click", () => setFill(false));
  pauseButton.addEventListener("click", () => { const was = paused; touched(); paused = !was; syncInputs(); wake(); });
  $('[data-act="reset"]').addEventListener("click", () => { touched(); clearTimeout(flipTimer); target.fill = false; resetCircuit(); syncInputs(); wake(); announce("Capacitor emptied."); });
  chips.forEach((chip) => chip.addEventListener("click", () => { touched(); applyPreset(chip.dataset.preset); }));
  stage.addEventListener("keydown", (event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); setFill(!(target.mode === "dc" && target.fill)); } });
  document.addEventListener("pointerdown", (event) => { if (event.target.closest(".cap-panel, .cap-side") && !event.target.closest('[data-act="pause"]')) touched(); }, true);

  // ── Fig 2: the same circuit, drawn simply ──
  // A flat diagram driven by the same state as the board. Parts slide into place when the knife
  // switch changes the wiring; little arrows on the wires move at the speed of the current and go
  // through whichever LED is passing it.
  const dg = $(".cap-diagram svg");
  const D = {
    plus: [70, 150], minus: [70, 166], F: [118, 70], E: [128, 104], S: [160, 70],
    top: 70, ground: 240, rIn: 200, rOut: 260,
    led: { series: [380, 70], parallel: [400, 150] }, // the LED pair's centre
    cap: { series: 600, parallel: 600 }, // the capacitor stays put; only the LEDs move into their own branch
    plateTop: 140, plateBottom: 172,
  };
  const zig = (x0, x1, y, peaks, amp) => {
    let d = `M${x0} ${y}`;
    const step = (x1 - x0) / (peaks * 2);
    for (let n = 1; n < peaks * 2; n++) d += `L${fx(x0 + step * n)} ${y + (n % 2 ? -amp : amp)}`;
    return d + `L${x1} ${y}`;
  };
  // the LED pair, drawn lying along x with current flowing +x; it turns 90° into the parallel branch
  const ledSymbol = (name, y, dir) => {
    const tip = 9 * dir, back = -9 * dir;
    const rays = [-3, 3].map((dx) => `M${dx} ${y - 12}l4 -7m0 0l-3.4 .4m3.4 -.4l-.2 3.4`).join("");
    return `<circle class="dg-glow" data-led="${name}" cx="0" cy="${y}" r="26" fill="url(#cap-halo-${name})" opacity="0"/>` +
      `<path class="dg-led" data-led="${name}" d="M${back} ${y - 9}L${tip} ${y}L${back} ${y + 9}Z M${tip} ${y - 9}V${y + 9}"/>` +
      `<path class="dg-ray" data-led="${name}" d="${rays}" opacity="0"/>`;
  };
  dg.innerHTML = `
    <g class="dg-wires-series"><path class="dg-wire" d="M446 70H600V140M600 172V240H400"/></g>
    <g class="dg-wires-parallel" opacity="0"><path class="dg-wire" d="M340 70H600V140M400 70V110M400 216V240M600 172V240H400"/></g>
    <path class="dg-wire" d="M70 150V70H118M160 70H200M260 70H340M128 104V240M70 166V240H400"/>
    <path class="dg-part" d="${zig(D.rIn, D.rOut, D.top, 4, 8)}"/>
    <path class="dg-part" d="M48 150H92" style="stroke-width:3px"/><path class="dg-part" d="M58 166H82" style="stroke-width:6px"/>
    <g class="dg-ledpair">
      <path class="dg-wire" d="M-40 0V-16H-9M9 -16H40V0M-40 0V16H-9M9 16H40V0M40 0H44M62 0H66"/>
      <path class="dg-part" d="${zig(44, 62, 0, 3, 5)}" style="stroke-width:1.8px"/>
      ${ledSymbol("green", -16, 1)}${ledSymbol("red", 16, -1)}
    </g>
    <g class="dg-cap">
      <path class="dg-plate" d="M-32 ${D.plateTop}H32M-32 ${D.plateBottom}H32"/>
      <g class="dg-charges"></g>
      <text class="dg-text" x="40" y="146">capacitor</text>
      <text class="dg-text" data-dg="vC" x="40" y="162"></text>
      <text class="dg-small" x="40" y="180">nothing crosses</text>
      <text class="dg-small" x="40" y="193">the gap</text>
    </g>
    <circle class="dg-node" cx="128" cy="240" r="3.6"/>
    <circle class="dg-node dg-pnode" cx="400" cy="70" r="4" opacity="0"/><circle class="dg-node dg-pnode" cx="400" cy="240" r="4" opacity="0"/>
    <g class="dg-dots"></g>
    <g class="dg-click" data-dg="fill"><title>Fill / Empty switch: click to flip</title>
      <rect x="104" y="52" width="66" height="66" fill="transparent"/>
      <line class="dg-lever" x1="${D.S[0]}" y1="${D.S[1]}" x2="${D.F[0]}" y2="${D.F[1]}"/>
      <circle class="dg-contact" cx="${D.F[0]}" cy="${D.F[1]}" r="3.4"/><circle class="dg-contact" cx="${D.E[0]}" cy="${D.E[1]}" r="3.4"/>
      <circle class="dg-node" cx="${D.S[0]}" cy="${D.S[1]}" r="4"/>
    </g>
    <text class="dg-text" x="52" y="162" text-anchor="end">supply</text>
    <text class="dg-small" data-dg="vs" x="52" y="177" text-anchor="end"></text>
    <text class="dg-small" x="98" y="146">+</text><text class="dg-small" x="90" y="178">−</text>
    <text class="dg-small" x="${D.F[0]}" y="58" text-anchor="middle">fill</text>
    <text class="dg-small" x="136" y="124">empty</text>
    <text class="dg-text" x="230" y="50" text-anchor="middle">resistor</text>
    <text class="dg-small" x="230" y="94" text-anchor="middle">slows the flow</text>
    <g class="dg-led-labels">
      <text class="dg-text dg-green" data-pos="green"></text>
      <text class="dg-text dg-red" data-pos="red"></text>
    </g>
    <text class="dg-status" x="370" y="-8" text-anchor="middle"></text>
    <g class="dg-click" data-dg="topo"><title>Wiring: click to change series / parallel</title>
      <rect class="dg-pill" x="474" y="266" width="252" height="28" rx="14"/>
      <text class="dg-small" x="490" y="284">wiring:</text>
      <text class="dg-opt" data-opt="series" x="548" y="284">series</text>
      <text class="dg-small" x="604" y="284">|</text>
      <text class="dg-opt" data-opt="parallel" x="618" y="284">parallel</text>
    </g>`;
  const dgq = (sel) => $(sel, dg);
  const dgNodes = {
    series: dgq(".dg-wires-series"), parallel: dgq(".dg-wires-parallel"), pnodes: $$(".dg-pnode", dg),
    pair: dgq(".dg-ledpair"), cap: dgq(".dg-cap"), charges: dgq(".dg-charges"), lever: dgq(".dg-lever"),
    status: dgq(".dg-status"), vC: dgq('[data-dg="vC"]'), vs: dgq('[data-dg="vs"]'), dots: dgq(".dg-dots"),
    labels: { green: dgq('[data-pos="green"]'), red: dgq('[data-pos="red"]') },
    opts: $$("[data-opt]", dg),
    glow: { green: dgq('.dg-glow[data-led="green"]'), red: dgq('.dg-glow[data-led="red"]') },
    rays: { green: dgq('.dg-ray[data-led="green"]'), red: dgq('.dg-ray[data-led="red"]') },
    sym: { green: dgq('.dg-led[data-led="green"]'), red: dgq('.dg-led[data-led="red"]') },
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  // where a point of the LED pair (in its own lying-down frame) sits, for a blend t from series (0) to parallel (1)
  const pairAt = (t, [x, y]) => {
    const c = [lerp(D.led.series[0], D.led.parallel[0], t), lerp(D.led.series[1], D.led.parallel[1], t)];
    const a = (t * Math.PI) / 2, cs = Math.cos(a), sn = Math.sin(a);
    return [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs];
  };
  // the runs the arrows follow, with the current that drives each
  function dgRuns(topo, fillSide, sign) {
    const t = topo === "parallel" ? 1 : 0;
    const branch = sign >= 0 ? -16 : 16;
    const throughLeds = [[-40, 0], [-40, branch], [40, branch], [40, 0], [66, 0]].map((pt) => pairAt(t, pt));
    const start = fillSide ? [D.plus, [70, D.top], D.F, D.S] : [[128, D.ground], D.E, D.S];
    const capX = D.cap[topo];
    if (topo === "series") {
      return [
        { key: "iS", pts: [...start, [D.rIn, D.top], [D.rOut, D.top], ...throughLeds, [capX, D.top], [capX, D.plateTop - 4]] },
        { key: "iS", pts: [[capX, D.plateBottom + 4], [capX, D.ground], ...(fillSide ? [[70, D.ground], D.minus] : [[128, D.ground]])] },
      ];
    }
    const J = [400, D.top], K = [400, D.ground];
    return [
      { key: "iS", pts: [...start, [D.rIn, D.top], [D.rOut, D.top], J] },
      { key: "iL", pts: [J, ...throughLeds, K] },
      { key: "iC", pts: [J, [capX, D.top], [capX, D.plateTop - 4]] },
      { key: "iC", pts: [[capX, D.plateBottom + 4], [capX, D.ground], K] },
      { key: "iS", pts: [K, ...(fillSide ? [[70, D.ground], D.minus] : [[128, D.ground]])] },
    ];
  }
  const runLength = (pts) => pts.slice(1).reduce((sum, pt, n) => sum + Math.hypot(pt[0] - pts[n][0], pt[1] - pts[n][1]), 0);
  function runPoint(pts, d) {
    for (let n = 1; n < pts.length; n++) {
      const a = pts[n - 1], b = pts[n], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= len || n === pts.length - 1) {
        const u = len ? Math.min(1, d / len) : 0;
        return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[1] - a[1], b[0] - a[0])];
      }
      d -= len;
    }
    return [pts[0][0], pts[0][1], 0];
  }
  const DG_GAP = 30, DG_SPEED = 5200; // diagram units a second per amp
  const dgPhases = [0, 0, 0, 0, 0];
  const dgPool = [];
  function dgDot() {
    const node = document.createElementNS(NS, "path");
    node.setAttribute("class", "dg-dot");
    node.setAttribute("d", "M-4 -4.5L3 0L-4 4.5");
    dgNodes.dots.appendChild(node);
    dgPool.push(node);
    return node;
  }
  let dgLast = {};
  function placeDiagram(dt) {
    const t = knifeAngle / 180;
    const fillSide = lever.at > 0.5;
    // the wiring crossfades while the parts slide
    if (dgLast.t !== t) {
      dgLast.t = t;
      dgNodes.series.setAttribute("opacity", fx(1 - smoothstep(0.2, 0.8, t)));
      dgNodes.parallel.setAttribute("opacity", fx(smoothstep(0.2, 0.8, t)));
      dgNodes.pnodes.forEach((node) => node.setAttribute("opacity", fx(smoothstep(0.6, 1, t))));
      const c = pairAt(t, [0, 0]);
      dgNodes.pair.setAttribute("transform", `translate(${fx(c[0])} ${fx(c[1])}) rotate(${fx(90 * t)})`);
      dgNodes.cap.setAttribute("transform", `translate(${fx(lerp(D.cap.series, D.cap.parallel, t))} 0)`);
      // the LED labels sit above and below the pair in series, beside it in parallel
      const side = t > 0.5;
      const fade = fx(Math.abs(2 * t - 1));
      const place = (node, x, y, anchor, label) => { node.setAttribute("x", x); node.setAttribute("y", y); node.setAttribute("text-anchor", anchor); node.setAttribute("opacity", fade); node.textContent = label; };
      if (side) {
        place(dgNodes.labels.green, 432, 140, "start", "green: only ↓");
        place(dgNodes.labels.red, 368, 140, "end", "red: only ↑");
      } else {
        place(dgNodes.labels.green, 393, 34, "middle", "green: only →");
        place(dgNodes.labels.red, 393, 114, "middle", "red: only ←");
      }
      dgNodes.opts.forEach((node) => node.toggleAttribute("data-on", node.dataset.opt === (t > 0.5 ? "parallel" : "series")));
    }
    // the switch lever, between its fill and empty contacts
    const tip = [lerp(D.E[0], D.F[0], lever.at), lerp(D.E[1], D.F[1], lever.at)];
    dgNodes.lever.setAttribute("x2", fx(tip[0])); dgNodes.lever.setAttribute("y2", fx(tip[1]));
    // the LEDs light with the same brightness as on the board
    for (const name of ["green", "red"]) {
      const b = clamp(glowNodes[name].level, 0, 1.2);
      dgNodes.glow[name].setAttribute("opacity", fx(0.9 * Math.min(1, b)));
      dgNodes.rays[name].setAttribute("opacity", fx(smoothstep(0.05, 0.4, b)));
      dgNodes.sym[name].style.fillOpacity = fx(0.25 + 0.75 * Math.min(1, b));
    }
    // charge on the plates: + on one, − on the other, as many as the charge
    const count = Math.round(clamp((Math.abs(state.vC) / 10) * (0.4 + 0.6 * overlapOf(p.C)), 0, 1) * 7);
    const key = count + (state.vC >= 0 ? "+" : "−");
    if (dgLast.charge !== key) {
      dgLast.charge = key;
      const [topSign, bottomSign] = state.vC >= 0 ? ["+", "−"] : ["−", "+"];
      let html = "";
      for (let n = 0; n < count; n++) {
        const x = (n - (count - 1) / 2) * 8.5;
        html += `<text class="dg-charge" data-sign="${topSign}" x="${fx(x)}" y="${D.plateTop + 13}">${topSign}</text><text class="dg-charge" data-sign="${bottomSign}" x="${fx(x)}" y="${D.plateBottom - 5}">${bottomSign}</text>`;
      }
      dgNodes.charges.innerHTML = html;
    }
    text(dgNodes.vC, `${state.vC.toFixed(1)} V`);
    text(dgNodes.vs, fillSide ? `${state.vs.toFixed(1)} V` : "switched out");
    // the arrows
    const runs = p.topo === "open" ? [] : dgRuns(p.topo, fillSide, p.topo === "parallel" ? state.iL : state.iS);
    let used = 0;
    runs.forEach((run, r) => {
      const length = runLength(run.pts);
      dgPhases[r] = (dgPhases[r] + DG_SPEED * state[run.key] * dt) % DG_GAP;
      const current = state[run.key];
      if (Math.abs(current) < 2e-4) return;
      for (let d = ((dgPhases[r] % DG_GAP) + DG_GAP) % DG_GAP; d < length; d += DG_GAP) {
        const node = dgPool[used] || dgDot();
        used++;
        const [x, y, angle] = runPoint(run.pts, d);
        const alpha = Math.min(smoothstep(0, 10, d), smoothstep(0, 10, length - d), smoothstep(2e-4, 1.5e-3, Math.abs(current)));
        const turn = (angle * 180) / Math.PI + (current < 0 ? 180 : 0);
        node.setAttribute("transform", `translate(${fx(x)} ${fx(y)}) rotate(${fx(turn)})`);
        node.setAttribute("opacity", fx(alpha));
      }
    });
    for (let n = used; n < dgPool.length; n++) dgPool[n].setAttribute("opacity", "0");
    text(dgNodes.status, diagramStatus());
  }
  function diagramStatus() {
    const { iS, iL, iC, vC } = state, small = 3e-4;
    if (p.topo === "open") return "Rewiring: the knife switch is between its clips, nothing flows";
    if (p.topo === "series") {
      if (iS > small) return "Filling: current goes → through the GREEN LED onto the capacitor";
      if (iS < -small) return "Emptying: the capacitor pushes current back ← through the RED LED";
      if (Math.abs(vC) > 0.5 && lever.at > 0.5) return "Full: no more current can flow, so both LEDs are off";
      if (Math.abs(vC) > 0.5) return "Stopped: the last charge is too weak to open the red LED";
      return "Empty and still: flip the switch to fill";
    }
    if (iC > small && iL < small) return "The capacitor fills first; the LED waits until it reaches 2 V";
    if (iC > small) return "The current splits: some lights the LED, some fills the capacitor";
    if (iC < -small && iL > small) return "No supply, but the capacitor empties through the LED and keeps it lit";
    if (iC < -small) return "The LED is off; the last charge drains back through the resistor";
    if (iL > small) return "The capacitor is full: all the current goes through the LED";
    return Math.abs(vC) > 0.5 ? "Waiting: the capacitor holds a little charge" : "Empty and still: flip the switch to fill";
  }
  $$(".dg-click", dg).forEach((node) => node.addEventListener("click", () => {
    if (node.dataset.dg === "fill") setFill(!(target.mode === "dc" && target.fill));
    else setTopo(target.topo === "series" ? "parallel" : "series");
  }));

  // drag the real parts: the wiper along y, the plate along x, the knobs up and down
  const unit = (axis) => { const [a, b] = axisVector(P, axis); return [a, b, a * a + b * b]; };
  const axisX = unit([1, 0, 0]), axisY = unit([0, 1, 0]);
  const viewScale = () => svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
  let drag = null;
  svg.addEventListener("pointerdown", (event) => {
    const grab = event.target.closest("[data-grab]");
    if (!grab) return;
    const what = grab.dataset.grab;
    touched();
    if (what === "switch") { setFill(!(target.mode === "dc" && target.fill)); return; }
    if (what === "topo") { setTopo(target.topo === "series" ? "parallel" : "series"); return; }
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
    else if (what === "C") setTarget("C", capacitanceAt(clamp(overlapOf(start.C) - along(axisX) / PLATE_W, 0.1, 1)));
    else if (what === "V") setTarget("V", start.V - (dy / 140) * 12);
    else if (what === "F") setTarget("f", fAt(clamp(fFrac(start.f) - dy / 140, 0, 1)));
  });
  const release = (event) => { if (drag && event.pointerId === drag.id) { drag = null; try { svg.releasePointerCapture(event.pointerId); } catch (e) {} } };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  syncInputs();
  // on a phone the card scrolls sideways: start with the board centred
  if (stage.scrollWidth > stage.clientWidth) stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
  // reduced motion: no autoplay. Show the board part way through filling, with the green LED lit.
  if (still.matches) {
    target.fill = true; p.fill = true;
    const n = Math.round((0.6 * derived(p).tau) / SAMPLE_DT);
    for (let k = 0; k < n; k++) { step(state, p, SAMPLE_DT); record(); }
    lever.at = 1;
    placeKnife(0);
    paused = autoPaused = true;
    syncInputs();
  }
  tick(performance.now());
  wake();

  window.__cap = { target, p, view, get state() { return state; }, preset: (name) => applyPreset(name, true), stopTour: () => takeOver() };
})();
