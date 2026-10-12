// The live page. The kit, world.mjs and model.mjs are inlined above this, and DATA gives P and LED_FILL.
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
  const text = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
  const mA = (i) => (i * 1e3).toFixed(1) + " mA";
  const signed = (v, digits) => (v > 0.0005 ? "+" : v < -0.0005 ? "−" : "") + Math.abs(v).toFixed(digits);

  // ── the circuit ──
  // `target` is where the controls want the parts; `p` is where the parts are right now, eased
  // toward the target, and it is what the model sees.
  const target = { ...DEFAULTS };
  const p = { ...DEFAULTS };
  const view = { speed: 1 };
  let state = initial();
  let paused = false;

  const KAPPA = 1 / 50; // seconds of circuit time per second on the page, at speed 1
  const WINDOW = 0.2; // the scopes show 200 ms of circuit time
  const SAMPLES = 600;
  const SAMPLE_DT = WINDOW / SAMPLES;
  const hist = { vs: new Float32Array(SAMPLES), vL: new Float32Array(SAMPLES), i: new Float32Array(SAMPLES), count: 0, head: 0, version: 0 };
  let acc = 0;
  const record = () => {
    const at = hist.head;
    hist.vs[at] = state.vterm; hist.vL[at] = state.vL; hist.i[at] = state.i;
    hist.head = (at + 1) % SAMPLES;
    hist.count = Math.min(SAMPLES, hist.count + 1);
    hist.version++;
  };
  const sampleAt = (array, k) => array[(hist.head - hist.count + k + SAMPLES * 2) % SAMPLES];

  // ── pieces of the drawing the loop moves ──
  const part = (name) => $(`[data-part="${name}"]`, svg);
  const slotOf = (name) => $(`[data-slot="${name}"]`, svg);
  const layers = Object.fromEntries($$("[data-layer]", svg).map((node) => [node.dataset.layer, node]));
  const coreGroup = part("core");
  coreGroup.dataset.grab = "L";
  const ledLit = part("led-lit"), glow = part("glow"), pool = part("pool"), cellLit = part("cell-lit");

  // ── current dots: four routes, each with its own pool and its own drift ──
  const SPACING = 9, DOT_R = Math.max(1.3, 0.72 * P.scale), DRIFT = 1800;
  const ROUTES = routes();
  const pools = {}, drift = { feed: 0, loop: 0, back: 0, bypass: 0 };
  for (const [name, route] of Object.entries(ROUTES)) {
    pools[name] = [];
    for (let n = 0; n < Math.floor(route.length / SPACING) + 1; n++) {
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("class", "ind-carrier");
      dot.setAttribute("r", DOT_R.toFixed(2));
      dot.setAttribute("opacity", "0");
      layers.front.appendChild(dot);
      dot.layerName = "front";
      pools[name].push(dot);
    }
  }
  const facing = (normal) => depthOf(normal, P);
  function driveDots(i, dt, bladeAt) {
    const flow = DRIFT * i * dt * view.speed;
    drift.loop += flow;
    if (p.on) { drift.feed += flow; drift.back += flow; } else drift.bypass += flow;
    for (const [name, route] of Object.entries(ROUTES)) {
      const pool = pools[name];
      const count = Math.floor(route.length / SPACING);
      for (let n = 0; n < pool.length; n++) {
        const dot = pool[n];
        if (n >= count) { if (dot.on) { dot.setAttribute("opacity", "0"); dot.on = false; } continue; }
        const distance = (((drift[name] + n * SPACING) % route.length) + route.length) % route.length;
        const here = carrierAt(route, distance, facing);
        const ends = Math.min(smoothstep(0, 5, distance), smoothstep(0, 5, route.length - distance));
        // a dot on the blade only shows while the blade is actually seated in that pair of jaws
        const seated = here.blade === "on" ? smoothstep(0.85, 1, 1 - bladeAt) : here.blade === "off" ? smoothstep(0.85, 1, bladeAt) : 1;
        const carrying = name === "loop" || (name === "bypass" ? !p.on : p.on);
        const alpha = here.alpha * ends * seated * (carrying ? 1 : 0.3);
        if (alpha < 0.02) { if (dot.on) { dot.setAttribute("opacity", "0"); dot.on = false; } continue; }
        if (dot.layerName !== here.layer) { layers[here.layer].appendChild(dot); dot.layerName = here.layer; }
        const [sx, sy] = toScreen(here.point);
        dot.setAttribute("cx", fx(sx)); dot.setAttribute("cy", fx(sy));
        dot.setAttribute("opacity", alpha.toFixed(2));
        dot.on = true;
      }
    }
  }

  // ── the switch blade: rebuilt whenever it turns ──
  const bladeSlot = slotOf("blade"), handleSlot = slotOf("handle");
  bladeSlot.dataset.grab = "switch"; handleSlot.dataset.grab = "switch";
  // the blade and its handle are one lever: hovering either lights both
  for (const node of [bladeSlot, handleSlot]) {
    node.addEventListener("pointerenter", () => { bladeSlot.classList.add("ind-hot"); handleSlot.classList.add("ind-hot"); });
    node.addEventListener("pointerleave", () => { bladeSlot.classList.remove("ind-hot"); handleSlot.classList.remove("ind-hot"); });
  }
  let blade = { at: 0, drawn: -1 }; // at: 0 = ON (in the supply's jaws), 1 = OFF (in the bypass jaws)
  function placeBlade(dt) {
    const want = p.on ? 0 : 1;
    blade.at = still.matches ? want : follow(blade.at, want, dt, 0.05);
    if (Math.abs(blade.at - blade.drawn) < 0.002) return;
    blade.drawn = blade.at;
    const angle = ANGLE_ON + (ANGLE_OFF - ANGLE_ON) * blade.at;
    const [dx, dy] = bladeDir(angle);
    const [nx, ny] = [-dy, dx];
    const [px, py] = PIVOT;
    const half = BLADE.width / 2;
    const ring = [];
    for (let n = 0; n <= 10; n++) {
      // round end around the pivot
      const a = Math.PI / 2 + (n / 10) * Math.PI;
      ring.push([px + Math.cos(a) * half * nx - Math.sin(a) * half * dx + 0, py + Math.cos(a) * half * ny - Math.sin(a) * half * dy]);
    }
    const reach = BLADE.length + 1;
    ring.push([px + dx * reach - nx * half, py + dy * reach - ny * half]);
    ring.push([px + dx * (reach + 0.9) - nx * (half - 0.9), py + dy * (reach + 0.9) - ny * (half - 0.9)]);
    ring.push([px + dx * (reach + 0.9) + nx * (half - 0.9), py + dy * (reach + 0.9) + ny * (half - 0.9)]);
    ring.push([px + dx * reach + nx * half, py + dy * reach + ny * half]);
    const z = BLADE.z, top = z + BLADE.t;
    let html = solidSvg(extrude(ring, z, BLADE.t, P), { tone: "hi" });
    html += solidSvg(cylinder(px, py, 2, top, 1.3, P, 6, 0.2), { tone: "mid" });
    html += dotsSvg([toScreen([px, py, top + 1.3])], { size: 0.45 });
    bladeSlot.innerHTML = html;
    const hx = px + dx * BLADE.handleAt, hy = py + dy * BLADE.handleAt;
    handleSlot.innerHTML =
      solidSvg(cylinder(hx, hy, 2.6, top, 1, P, 20), { tone: "mid" }) +
      solidSvg(cylinder(hx, hy, 2.1, top + 1, 7, P, 24, 0.4), { tone: "lo" }) +
      solidSvg(cylinder(hx, hy, 2.7, top + 8, 2.2, P, 24, 0.5), { tone: "lo" });
  }

  // ── needles ──
  const needles = {};
  for (const key of ["A", "V"]) {
    const slot = slotOf("needle" + key);
    slot.innerHTML = stroke("", "lit", ' data-free="end" style="stroke-width:1.1"') + stroke("", "mid", ' data-free="end" style="stroke-width:1.1"') + `<circle class="ind-hub" r="1.5"/>`;
    needles[key] = { tip: slot.children[0], tail: slot.children[1], hub: slot.children[2], angle: key === "A" ? -METER_SWEEP : 0 };
  }
  const METER_PIVOT = METER.z - 8;
  function placeNeedle(key, unit, dt) {
    const needle = needles[key];
    const want = clamp(unit, -1.06, 1.06) * METER_SWEEP;
    needle.angle = still.matches ? want : follow(needle.angle, want, dt, 0.06);
    const a = (needle.angle * Math.PI) / 180;
    const u = key === "A" ? METER.ammeter : METER.voltmeter;
    const sx = Math.sin(a), cz = Math.cos(a);
    needle.tip.setAttribute("d", `M${u} ${-METER_PIVOT}L${fx(u + 17 * sx)} ${fx(-METER_PIVOT - 17 * cz)}`);
    needle.tail.setAttribute("d", `M${u} ${-METER_PIVOT}L${fx(u - 5.5 * sx)} ${fx(-METER_PIVOT + 5.5 * cz)}`);
    needle.hub.setAttribute("cx", u); needle.hub.setAttribute("cy", -METER_PIVOT);
  }

  // the supply's display
  const displaySlot = slotOf("display");
  displaySlot.innerHTML = `<text class="ind-lcd" x="1" y="-1.6" font-size="6.2"></text><text class="ind-lcd" x="1" y="8.4" font-size="6.2"></text>`;
  const lcd = $$("text", displaySlot);

  // knobs: the pointer is a line from near the middle to the rim
  const knobDefs = { V: [KNOB_V, "pointerV"], I: [KNOB_I, "pointerI"], F: [KNOB_F, "pointerF"] };
  const pointers = {}, lastKnob = {};
  for (const [key, [, slot]] of Object.entries(knobDefs)) {
    slotOf(slot).innerHTML = stroke("", "hi", ' style="stroke-width:1.2"');
    pointers[key] = slotOf(slot).firstChild;
  }
  function placeKnob(key, angle) {
    if (Math.abs((lastKnob[key] ?? 1e9) - angle) < 0.05) return;
    lastKnob[key] = angle;
    const [def] = knobDefs[key];
    const a = (angle * Math.PI) / 180;
    const z = SUP_TOP + 1 + def.h;
    const [x, y] = def.at;
    pointers[key].setAttribute("d", lineOnTop([x + Math.sin(a) * def.r * 0.18, y - Math.cos(a) * def.r * 0.18], [x + Math.sin(a) * def.r, y - Math.cos(a) * def.r], z, P));
  }
  const lamps = { cv: $(".iso-solid", part("lamp-cv")), cc: $(".iso-solid", part("lamp-cc")) };
  const light = (node, on) => { if (node.lit !== on) { node.lit = on; node.toggleAttribute("data-lit", on); } };

  // ── compass and field loops, both driven by the coil's magnetic field (its flux, L·i) ──
  const compassSlot = slotOf("compass");
  compassSlot.innerHTML = stroke("", "mid", ' data-free="end" style="stroke-width:1.5"') + stroke("", "hi", ' data-free="end" style="stroke-width:1.7"') + `<circle class="ind-hub" r="1.3"/>`;
  const compassNodes = { south: compassSlot.children[0], north: compassSlot.children[1], hub: compassSlot.children[2] };
  let compassAngle = 0;
  function placeCompass(flux, dt) {
    const want = (Math.atan(17 * flux) * 180) / Math.PI;
    compassAngle = still.matches ? want : follow(compassAngle, want, dt, 0.09);
    const a = ((-90 + compassAngle) * Math.PI) / 180;
    const [cx, cy] = COMPASS.at, z = COMPASS.h + 0.25;
    const dir = [Math.sin(a), -Math.cos(a)];
    compassNodes.north.setAttribute("d", lineOnTop([cx, cy], [cx + dir[0] * 9.2, cy + dir[1] * 9.2], z, P));
    compassNodes.south.setAttribute("d", lineOnTop([cx, cy], [cx - dir[0] * 7, cy - dir[1] * 7], z, P));
    const hub = toScreen([cx, cy, z]);
    compassNodes.hub.setAttribute("cx", fx(hub[0])); compassNodes.hub.setAttribute("cy", fx(hub[1]));
  }
  const fluxSlot = slotOf("flux");
  fluxSlot.innerHTML = FLUX_LOOPS.map(() => stroke("", "mid", ' style="opacity:0"')).join("") + FLUX_LOOPS.map(() => [0, 1, 2].map(() => stroke("", "hi", ' data-free="" style="opacity:0;stroke-width:.9px"')).join("")).join("");
  const fluxArcs = $$("path", fluxSlot).slice(0, FLUX_LOOPS.length);
  const fluxChevrons = $$("path", fluxSlot).slice(FLUX_LOOPS.length);
  fluxArcs.forEach((node, n) => node.setAttribute("d", pathOf(Array.from({ length: 31 }, (_, k) => toScreen(fluxPoint(FLUX_LOOPS[n], k / 30))))));
  let fluxTime = 0;
  function placeFlux(flux, dt, i) {
    const strength = clamp(Math.sqrt(Math.abs(flux) / 0.1), 0, 1);
    fluxTime += dt * view.speed * clamp(i * 25, 0, 0.6);
    fluxArcs.forEach((node) => (node.style.opacity = (0.1 + 0.8 * strength).toFixed(2)));
    FLUX_LOOPS.forEach((loop, n) => {
      for (let j = 0; j < 3; j++) {
        const node = fluxChevrons[n * 3 + j];
        const t = (((j / 3 + fluxTime) % 1) + 1) % 1;
        const fade = smoothstep(0.04, 0.2, t) * smoothstep(0.04, 0.2, 1 - t) * strength;
        if (fade < 0.03) { node.style.opacity = "0"; continue; }
        const c = fluxPoint(loop, t), a = fluxPoint(loop, Math.max(0, t - 0.01)), b = fluxPoint(loop, Math.min(1, t + 0.01));
        const len = Math.hypot(b[1] - a[1], b[2] - a[2]) || 1;
        const ty = (b[1] - a[1]) / len, tz = (b[2] - a[2]) / len;
        const tip = [c[0], c[1] + ty * 1.9, c[2] + tz * 1.9];
        const w1 = [c[0], c[1] - ty * 1.1 - tz * 1.5, c[2] - tz * 1.1 + ty * 1.5];
        const w2 = [c[0], c[1] - ty * 1.1 + tz * 1.5, c[2] - tz * 1.1 - ty * 1.5];
        node.setAttribute("d", pathOf([toScreen(w1), toScreen(tip), toScreen(w2)]));
        node.style.opacity = fade.toFixed(2);
      }
    });
  }

  // ── the LED: its light follows the current at once (an LED has no lag of its own) ──
  let lastGlow = -1;
  function placeLED(brightness) {
    const b = clamp(brightness, 0, 1.25);
    if (Math.abs(b - lastGlow) < 0.004) return;
    lastGlow = b;
    const seen = Math.pow(b, 0.6); // the eye sees dim light as brighter than it is
    ledLit.style.opacity = clamp(seen * 1.1, 0, 1).toFixed(3);
    glow.style.opacity = clamp(seen * 0.95, 0, 1.15).toFixed(3);
    pool.style.opacity = clamp(seen, 0, 1.1).toFixed(3);
    cellLit.style.opacity = clamp(seen * 0.8, 0, 1).toFixed(3);
  }

  // the light meter's needle reads the LED's light, 0 at the left stop, 125 % at the right
  const luxSlot = slotOf("lux");
  luxSlot.innerHTML = stroke("", "lit", ' data-free="end" style="stroke-width:1.1"') + `<circle class="ind-hub" r="1.4"/>`;
  let luxAngle = LUX_SWEEP;
  function placeLux(brightness, dt) {
    const want = LUX_SWEEP - 2 * LUX_SWEEP * clamp(brightness / 1.25, 0, 1.03);
    luxAngle = still.matches ? want : follow(luxAngle, want, dt, 0.08);
    const a = (luxAngle * Math.PI) / 180;
    const [px, py] = LUX_PIVOT;
    luxSlot.firstChild.setAttribute("d", lineOnTop([px, py], [px - Math.cos(a) * (LUX_R + 1), py + Math.sin(a) * (LUX_R + 1)], LUX.h + 0.2, P));
    const hub = toScreen([px, py, LUX.h + 0.2]);
    luxSlot.lastChild.setAttribute("cx", fx(hub[0])); luxSlot.lastChild.setAttribute("cy", fx(hub[1]));
  }

  // ── the scope on the backboard: a strip chart, fixed scales so changes compare ──
  const sc = SCOPE, scW = sc.u1 - sc.u0, scMid = (sc.z0 + sc.z1) / 2, scAmp = (sc.z1 - sc.z0) / 2 - 0.8;
  const V_FULL = 12, I_FULL = 0.045; // 4 V and 15 mA per division
  const scopeSlot = slotOf("scope");
  scopeSlot.innerHTML =
    stroke("", "lo", ' data-dashed="" data-free="start" style="stroke-width:.8px"') +
    stroke("", "mid", ' data-free="start" style="stroke-width:1px"') +
    stroke("", "lit", ' data-free="start" style="stroke-width:1.25px"') +
    `<text class="iso-face-text" data-tone="lo" x="${sc.u0 + 2.5}" y="${-(sc.z0 + 2.2)}" font-size="3.1">4 V/div  15 mA/div  20 ms/div</text>`;
  const traceNodes = $$("path", scopeSlot);
  let lastVersion = -1;
  function drawScope() {
    if (hist.version === lastVersion) return;
    lastVersion = hist.version;
    const build = (array, scale) => {
      let d = "";
      for (let k = hist.count - 1, first = true; k >= 0; k -= 3) {
        const u = sc.u1 - (scW * (hist.count - 1 - k)) / (SAMPLES - 1);
        const z = scMid + scAmp * clamp(sampleAt(array, k) / scale, -1.04, 1.04);
        d += (first ? "M" : "L") + fx(u) + " " + fx(-z);
        first = false;
      }
      return d;
    };
    traceNodes[0].setAttribute("d", build(hist.vs, V_FULL));
    traceNodes[1].setAttribute("d", build(hist.vL, V_FULL));
    traceNodes[2].setAttribute("d", build(hist.i, I_FULL));
    drawBigScope();
  }

  // ── the big two-strip scope in the panel ──
  const strips = Object.fromEntries($$("[data-strip]").map((node) => [node.dataset.strip, node]));
  const VR = [4, 8, 12, 16], IR = [8, 20, 40, 48]; // volts either side of zero, and milliamps full scale
  const big = { vr: 12, ir: 30 };
  for (const [name, node] of Object.entries(strips)) {
    const traces = $("[data-traces]", node);
    const kinds = name === "volts" ? ["vs", "vl"] : ["ok", "i"];
    traces.innerHTML = kinds.map((kind) => `<path class="ind-tr ind-tr-${kind}" d=""/>`).join("");
  }
  const bigPaths = { vs: $(".ind-tr-vs", strips.volts), vl: $(".ind-tr-vl", strips.volts), ok: $(".ind-tr-ok", strips.amps), i: $(".ind-tr-i", strips.amps) };
  const pickRange = (list, current, peak) => {
    const want = list.find((r) => r * 0.95 >= peak) ?? list[list.length - 1];
    if (want > current) return want;
    if (want < current && peak < 0.6 * want) return want;
    return current;
  };
  let bigKey = "";
  function setAxes() {
    const key = big.vr + "|" + big.ir;
    if (key === bigKey) return;
    bigKey = key;
    // volts: symmetric about zero, a line every quarter
    const vg = $("[data-grid]", strips.volts), vt = $("[data-yticks]", strips.volts);
    vg.innerHTML = [0, 1, 2, 3, 4].map((n) => `<line x1="0" x2="600" y1="${n * 30}" y2="${n * 30}" class="${n === 2 ? "ind-zero" : "ind-grid-line"}"/>`).join("");
    vt.innerHTML = [big.vr, big.vr / 2, 0, -big.vr / 2, -big.vr].map((v, n) => `<span style="top:${(n * 25).toFixed(0)}%">${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)} V</span>`).join("");
    const ag = $("[data-grid]", strips.amps), at = $("[data-yticks]", strips.amps);
    ag.innerHTML = [0, 1, 2, 3].map((n) => `<line x1="0" x2="600" y1="${n * 30}" y2="${n * 30}" class="ind-grid-line"/>`).join("") + `<line x1="0" x2="600" y1="120" y2="120" class="ind-zero"/>`;
    at.innerHTML = [0, 1, 2, 3, 4].map((n) => `<span style="top:${n * 25}%">${fxNum(big.ir * (1 - n / 4))} mA</span>`).join("");
    const ok = 120 - (20 / big.ir) * 120;
    bigPaths.ok.setAttribute("d", ok > 2 ? `M0 ${fx(ok)}H600` : "");
  }
  const fxNum = (n) => (Math.round(n * 10) / 10).toString();
  function drawBigScope() {
    let peakV = 0, peakI = 0;
    for (let k = 0; k < hist.count; k++) {
      peakV = Math.max(peakV, Math.abs(sampleAt(hist.vs, k)), Math.abs(sampleAt(hist.vL, k)));
      peakI = Math.max(peakI, sampleAt(hist.i, k) * 1e3);
    }
    big.vr = pickRange(VR, big.vr, Math.max(peakV, target.V));
    big.ir = pickRange(IR, big.ir, Math.max(peakI, 8));
    setAxes();
    const line = (array, toY) => {
      let d = "";
      for (let k = hist.count - 1, first = true; k >= 0; k -= 2) {
        const x = 600 - (600 * (hist.count - 1 - k)) / (SAMPLES - 1);
        d += (first ? "M" : "L") + fx(x) + " " + fx(toY(sampleAt(array, k)));
        first = false;
      }
      return d;
    };
    const vy = (v) => 60 - 60 * clamp(v / big.vr, -1.02, 1.02);
    const iy = (i) => 120 - 120 * clamp((i * 1e3) / big.ir, -0.02, 1.02);
    bigPaths.vs.setAttribute("d", line(hist.vs, vy));
    bigPaths.vl.setAttribute("d", line(hist.vL, vy));
    bigPaths.i.setAttribute("d", line(hist.i, iy));
    if (hover.on) showTip();
  }
  text($("[data-scope-span]"), `${WINDOW * 1000} ms of real time (${(WINDOW / KAPPA).toFixed(0)} s on screen)`);

  // hover: a crosshair through both strips and a tooltip with the three values at that moment
  const tip = $("[data-tip]"), scopeCard = $(".ind-scope");
  const hover = { on: false, frac: 0 };
  function showTip() {
    const k = Math.round(hover.frac * (SAMPLES - 1)) - (SAMPLES - hist.count);
    for (const node of Object.values(strips)) {
      const cross = $("[data-cross]", node);
      cross.setAttribute("x1", fx(hover.frac * 600)); cross.setAttribute("x2", fx(hover.frac * 600));
      cross.style.opacity = "1";
    }
    if (k < 0 || k >= hist.count) { tip.hidden = true; return; }
    const ago = (1 - hover.frac) * WINDOW * 1000;
    tip.innerHTML = `<b>${ago < 0.5 ? "now" : ago.toFixed(0) + " ms ago"}</b><br>supply ${signed(sampleAt(hist.vs, k), 2)} V<br>coil ${signed(sampleAt(hist.vL, k), 2)} V<br>current <b>${(sampleAt(hist.i, k) * 1e3).toFixed(1)} mA</b>`;
    tip.hidden = false;
  }
  for (const node of Object.values(strips)) {
    const plot = $(".ind-plot", node);
    plot.addEventListener("pointermove", (event) => {
      const box = plot.getBoundingClientRect(), card = scopeCard.getBoundingClientRect();
      hover.on = true;
      hover.frac = clamp((event.clientX - box.left) / box.width, 0, 1);
      showTip();
      const left = event.clientX - card.left, top = event.clientY - card.top;
      tip.style.left = Math.min(left + 14, card.width - 170) + "px";
      tip.style.top = top + 14 + "px";
    });
    plot.addEventListener("pointerleave", () => {
      hover.on = false; tip.hidden = true;
      $$("[data-cross]").forEach((c) => (c.style.opacity = "0"));
    });
  }

  // ── the panel ──
  const inputs = Object.fromEntries($$("[data-in]").map((node) => [node.dataset.in, node]));
  const outs = Object.fromEntries($$("[data-out]").map((node) => [node.dataset.out, node]));
  const live = Object.fromEntries($$("[data-live]").map((node) => [node.dataset.live, node]));
  const story = $("[data-story]"), expectBox = $("[data-expect]"), ledBar = $("[data-led-bar]");
  const modeButtons = $$("[data-mode]"), chips = $$("[data-preset]");
  const switchButton = $('[data-act="switch"]'), pauseButton = $('[data-act="pause"]');
  const MODE_NAME = { dc: "steady", square: "blinking", sine: "AC wave" };
  const MODE_HINT = {
    dc: "A steady push. Use the switch to turn it on and off.",
    square: "The supply turns itself on and off again and again (0 V, then full voltage).",
    sine: "The push swings smoothly forward and backward, like the power from a wall socket. The LED only lets current through one way.",
  };
  const ranges = { L: [RANGE.L.min, RANGE.L.max], V: [RANGE.V.min, RANGE.V.max], Ilim: [RANGE.I.min, RANGE.I.max], f: [RANGE.f.min, RANGE.f.max] };
  const toInput = { L: (v) => v, V: (v) => v, Ilim: (v) => v * 1e3, f: (v) => v };
  const fromInput = { L: (v) => v, V: (v) => v, Ilim: (v) => v / 1e3, f: (v) => v };
  const inputKey = { L: "L", V: "V", Ilim: "I", f: "f" };

  function syncInputs() {
    for (const key of Object.keys(ranges)) {
      const input = inputs[inputKey[key]];
      if (document.activeElement !== input) input.value = toInput[key](target[key]);
    }
    inputs.speed.value = view.speed;
    text(outs.L, target.L.toFixed(2) + " H");
    text(outs.V, target.V.toFixed(1) + " V");
    text(outs.I, (target.Ilim * 1e3).toFixed(1) + " mA");
    text(outs.f, target.f.toFixed(0) + " Hz");
    text(outs.speed, view.speed.toFixed(2) + "×");
    text(outs.mode, MODE_NAME[target.mode]);
    text($('[data-hint="mode"]'), MODE_HINT[target.mode]);
    modeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === target.mode)));
    $('[data-row="f"]').toggleAttribute("data-off", target.mode === "dc");
    inputs.f.disabled = target.mode === "dc";
    switchButton.setAttribute("aria-pressed", String(target.on));
    text(switchButton, target.on ? "Turn OFF" : "Turn ON");
    text($('[data-hint="switch"]'), target.on ? "ON: the supply is in the loop and pushes current round it." : "OFF: the supply is taken out, but the loop stays closed, so the coil can keep the current going on its own.");
    pauseButton.setAttribute("aria-pressed", String(paused));
    text(pauseButton, paused ? "Resume" : "Pause");
    const e = expected(target);
    const realMs = e.settle * 1000, screenS = e.settle / KAPPA / view.speed;
    expectBox.innerHTML = e.I <= 0
      ? `With only ${target.V.toFixed(1)} V the LED can't light: it needs at least <b>${PARTS.Vknee} V</b> before any current flows.`
      : `When it settles, the current will be <b>${(e.I * 1e3).toFixed(1)} mA</b>${e.limited ? " (held there by the max-current limit)" : ""}. The LED is made for 20 mA. The coil makes it take about <b>${realMs.toFixed(0)} ms</b> to get there: <b>${screenS.toFixed(1)} s</b> on screen.${e.I > PARTS.Imax ? " That is more than the LED can take for long; turn the limit down." : ""}`;
  }

  const announce = (() => {
    const region = document.createElement("div");
    region.setAttribute("aria-live", "polite");
    region.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden";
    document.body.appendChild(region);
    let timer = 0;
    return (message) => { clearTimeout(timer); timer = setTimeout(() => (region.textContent = message), 600); };
  })();

  const setTarget = (key, value) => {
    const [lo, hi] = ranges[key];
    target[key] = clamp(value, lo, hi);
    syncInputs();
    wake();
  };

  const PRESETS = {
    weak: { L: 0.5, V: 6.5, Ilim: 0.03, mode: "dc", f: 8 },
    strong: { L: 5, V: 6.5, Ilim: 0.03, mode: "dc", f: 8 },
    blinkSlow: { L: 2, V: 6.5, Ilim: 0.03, mode: "square", f: 4 },
    blinkFast: { L: 5, V: 8, Ilim: 0.03, mode: "square", f: 40 },
    wave: { L: 5, V: 9, Ilim: 0.04, mode: "sine", f: 12 },
    limit: { L: 2, V: 12, Ilim: 0.02, mode: "dc", f: 8 },
  };
  let onTimer = 0;
  function resetCircuit() {
    state = initial();
    hist.count = 0; hist.head = 0; hist.version++;
    acc = 0;
  }
  function applyPreset(name, quiet) {
    Object.assign(target, PRESETS[name]);
    target.on = false;
    p.L = target.L; // the core jumps with a preset, so the run starts with the right coil
    resetCircuit();
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.preset === name)));
    syncInputs();
    clearTimeout(onTimer);
    onTimer = setTimeout(() => { target.on = true; syncInputs(); wake(); }, 700);
    wake();
    if (!quiet) announce(`${name} preset. Switching on.`);
  }

  // ── what the circuit is doing, in words a ten-year-old can follow ──
  let lastOn = false, offAt = -1, onAt = -1;
  function storyText(r) {
    const e = expected(p);
    const strong = p.L >= 2.5;
    if (p.mode === "dc") {
      if (!p.on) {
        if (r.i > 0.0005) return `The supply is out of the loop, but the LED is still glowing! The coil's magnetic field is collapsing, and as it goes it keeps pushing the current round the loop (the coil meter has swung the other way). The energy stored in the coil, ${(r.energy * 1e6).toFixed(0)} microjoules, is being used up by the resistor and the LED.`;
        return offAt > 0 ? `All the energy in the coil is used up, so the current has stopped. ${strong ? "A strong coil kept the LED going for a while after OFF." : "With no iron, the coil stored very little energy, so the LED went out almost at once. Slide the iron core in and try again."}` : "The switch is OFF, so nothing is pushing. Turn it ON (or press a preset) and watch how fast the LED lights.";
      }
      const rising = Math.abs(state.didt) > 0.02 && r.i < e.I * 0.97;
      if (rising) return `The supply is pushing, but the coil pushes back (${Math.abs(r.vL).toFixed(1)} V against it), so the current can only grow bit by bit while the coil builds its magnetic field. The LED is getting brighter. ${strong ? "With the iron core in, this takes a while." : ""}`;
      if (state.cc) return `The current hit the supply's limit of ${(p.Ilim * 1e3).toFixed(0)} mA, so the supply turned its own voltage down to ${state.vterm.toFixed(1)} V to hold it there. The LED is safe. Without the limit, ${p.V.toFixed(0)} V would push ${((p.V - PARTS.Vknee) / R_LOOP * 1e3).toFixed(0)} mA, more than the LED can take.`;
      return `The current is steady at ${(r.i * 1e3).toFixed(1)} mA. Now that it isn't changing, the coil stops pushing back: it acts like a plain piece of wire, and the LED shines at ${Math.round(Math.min(1, r.brightness) * 100)}%. Turn the switch OFF and watch the coil keep the LED glowing.`;
    }
    const halfMs = 500 / p.f;
    if (!p.on) return "The switch is OFF. Turn it ON to let the supply blink or wave.";
    if (p.mode === "square") {
      const ratio = e.tau * 1000 / halfMs;
      if (ratio < 0.25) return `The supply blinks ${p.f.toFixed(0)} times a second. Each on-time lasts ${halfMs.toFixed(0)} ms, and this coil only needs about ${(e.tau * 1000).toFixed(0)} ms to catch up, so the current follows the push and the LED blinks fully on and fully off.`;
      if (ratio > 1) return `The supply blinks ${p.f.toFixed(0)} times a second: on for only ${halfMs.toFixed(0)} ms at a time. The coil needs about ${(e.tau * 1000).toFixed(0)} ms just to get going, so the current never has time to rise or fall far. It wiggles around the middle, and the LED glows almost steadily at partial brightness. The coil is smoothing the current.`;
      return `The supply blinks ${p.f.toFixed(0)} times a second. The coil needs about ${(e.tau * 1000).toFixed(0)} ms to catch up, close to the ${halfMs.toFixed(0)} ms each blink lasts, so the current rises and falls in curves instead of jumping. Try a faster blink or more iron.`;
    }
    const XL = 2 * Math.PI * p.f * p.L;
    const lag = Math.atan(XL / R_LOOP) * 180 / Math.PI;
    return `The push swings forward and back ${p.f.toFixed(0)} times a second. The coil fights the swinging (at this speed it acts like ${XL.toFixed(0)} Ω of extra "resistance"), so the current is smaller than a steady push would give, and it lags behind the push by about ${lag.toFixed(0)}° of each swing: watch the current peak after the supply does. The LED only lets current through one way, so it lights on the forward swings.`;
  }

  function updatePanel(r) {
    text(live.i, mA(r.i));
    text(live.vs, state.vterm.toFixed(2) + " V");
    text(live.vR, r.vR.toFixed(2) + " V");
    text(live.vLED, r.vLED.toFixed(2) + " V");
    text(live.vL, signed(r.vL, 2) + " V");
    text(live.E, (r.energy * 1e6).toFixed(0) + " µJ");
    text(live.bright, Math.round(r.brightness * 100) + "%");
    ledBar.style.transform = `scaleX(${clamp(r.brightness / 1.25, 0, 1).toFixed(3)})`;
    text(live.law, `supply ${state.vterm.toFixed(2)} V  =  resistor ${(r.vR + PARTS.rL * 0).toFixed(2)}  +  LED ${r.vLED.toFixed(2)}  +  coil ${signed(r.vL, 2)}`);
  }

  // ── the loop ──
  let frame = 0, last = 0, visible = true, keepAlive = 0, lastStory = 0;
  const wake = () => { keepAlive = performance.now() + 2500; run(); };
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    const calm = still.matches;
    tourStep(dt);
    for (const key of ["L", "V", "Ilim", "f"]) p[key] = calm ? target[key] : follow(p[key], target[key], dt, 0.14);
    p.mode = target.mode;
    if (p.on !== target.on) { p.on = target.on; if (p.on) onAt = now; else offAt = now; }
    if (!paused) {
      acc += dt * KAPPA * view.speed;
      let n = 0;
      while (acc >= SAMPLE_DT && n < 24) { step(state, p, SAMPLE_DT); record(); acc -= SAMPLE_DT; n++; }
      if (n === 24) acc = 0;
    }
    const r = readings(state, p);
    coreGroup.setAttribute("transform", translateAlong(P, [0, coreShift(coreOf(p.L)), 0]));
    placeBlade(dt);
    if (!paused) driveDots(r.i, dt, blade.at);
    placeFlux(p.L * r.i, dt, r.i);
    placeCompass(p.L * r.i, dt);
    placeLED(r.brightness);
    placeLux(r.brightness, dt);
    placeNeedle("A", (r.i / (FULL_SCALE.mA / 1000)) * 2 - 1, dt);
    placeNeedle("V", r.vL / FULL_SCALE.coil, dt);
    placeKnob("V", KNOB.V(p.V)); placeKnob("I", KNOB.I(p.Ilim)); placeKnob("F", KNOB.F(p.f));
    $$("[data-part^=btn-]", svg).forEach((node) => {
      const on = node.dataset.part === "btn-" + p.mode;
      if (node.on !== on) { node.on = on; node.toggleAttribute("data-on", on); $("[data-key]", node).setAttribute("transform", on ? translateAlong(P, [0, 0, -0.9]) : ""); }
    });
    light(lamps.cc, state.cc && p.on);
    light(lamps.cv, !(state.cc && p.on));
    drawScope();
    text(lcd[0], (p.on ? state.vterm : p.mode === "sine" ? 0 : p.V).toFixed(2) + " V");
    text(lcd[1], (p.on ? r.i * 1e3 : 0).toFixed(1) + " mA");
    updatePanel(r);
    text(readout, `${p.on ? "ON" : "OFF"} · ${mA(r.i)} · LED ${Math.round(r.brightness * 100)}%`);
    if (now - lastStory > 350) { lastStory = now; text(story, storyText(r)); }
    const quiet = (calm || paused) && r.i < 1e-5 && (p.mode === "dc" || !p.on) && Math.abs(compassAngle) < 0.05;
    if (quiet) { if (now > keepAlive) { frame = 0; return; } } else keepAlive = now + 1500;
    frame = visible ? requestAnimationFrame(tick) : 0;
  }
  function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
  // keep running while the figure or the big scope is on screen: both are fed by the same loop
  const seen = new Set();
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.isIntersecting ? seen.add(entry.target) : seen.delete(entry.target);
    visible = seen.size > 0;
    if (visible) run();
  }, { rootMargin: "120px 0px" });
  watcher.observe(stage);
  watcher.observe(document.querySelector(".ind-scope"));

  // ── the idle tour: it drives the same targets a reader would ──
  const TOUR = [
    { preset: "weak", length: 6.5, off: 3.6 },
    { preset: "strong", length: 9.5, off: 5.2 },
    { preset: "blinkSlow", length: 9 },
    { preset: "blinkFast", length: 9 },
    { preset: "wave", length: 10 },
    { preset: "limit", length: 8, off: 5.4 },
  ];
  const tour = { on: false, index: -1, clock: 0, offDone: false, idle: 0, after: 1.4 };
  function tourStep(dt) {
    if (!tour.on) {
      if (!still.matches && !paused) { tour.idle += dt; if (tour.idle > tour.after) { tour.on = true; tour.index = -1; tour.clock = 99; } }
      return;
    }
    tour.clock += dt;
    const current = TOUR[tour.index];
    if (current && current.off && !tour.offDone && tour.clock > current.off) { tour.offDone = true; target.on = false; syncInputs(); }
    if (!current || tour.clock > current.length) {
      tour.index = (tour.index + 1) % TOUR.length;
      tour.clock = 0; tour.offDone = false;
      applyPreset(TOUR[tour.index].preset, true);
    }
  }
  function takeOver() {
    tour.on = false; tour.idle = 0; tour.after = 20;
    if (!still.matches) wake();
    chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
  }
  const touched = () => { if (tour.on) takeOver(); else { tour.idle = 0; tour.after = 20; } wake(); };

  // ── controls ──
  for (const key of Object.keys(ranges)) {
    inputs[inputKey[key]].addEventListener("input", (event) => { touched(); setTarget(key, fromInput[key](parseFloat(event.target.value))); });
  }
  inputs.speed.addEventListener("input", (event) => { touched(); view.speed = parseFloat(event.target.value); syncInputs(); });
  modeButtons.forEach((b) => b.addEventListener("click", () => { touched(); target.mode = b.dataset.mode; syncInputs(); }));
  const toggleSwitch = () => { touched(); clearTimeout(onTimer); target.on = !target.on; syncInputs(); announce(target.on ? "Switch on." : "Switch off."); };
  switchButton.addEventListener("click", toggleSwitch);
  pauseButton.addEventListener("click", () => { touched(); paused = !paused; syncInputs(); wake(); });
  $('[data-act="reset"]').addEventListener("click", () => { touched(); clearTimeout(onTimer); target.on = false; p.on = false; resetCircuit(); syncInputs(); wake(); announce("Started over."); });
  chips.forEach((chip) => chip.addEventListener("click", () => { touched(); applyPreset(chip.dataset.preset); }));
  stage.addEventListener("keydown", (event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); toggleSwitch(); } });
  document.addEventListener("pointerdown", (event) => { if (event.target.closest(".ind-panel, .ind-side")) touched(); }, true);

  // drag the real parts: the iron core along y, the knobs up and down; click the switch or the mode keys
  const unit = (axis) => { const [a, b] = axisVector(P, axis); return [a, b, a * a + b * b]; };
  const axisY = unit([0, 1, 0]);
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
    if (what === "L") setTarget("L", inductanceAt(clamp(coreOf(start.L) - along(axisY) / CORE_TRAVEL, 0, 1)));
    else if (what === "V") setTarget("V", start.V - (dy / 140) * 12);
    else if (what === "I") setTarget("Ilim", start.Ilim - (dy / 140) * 0.035);
    else if (what === "F") setTarget("f", start.f - (dy / 140) * 48);
  });
  const release = (event) => { if (drag && event.pointerId === drag.id) { drag = null; try { svg.releasePointerCapture(event.pointerId); } catch (e) {} } };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  syncInputs();
  // on a phone the card scrolls sideways: start with the LED, coil and switch in view
  if (stage.scrollWidth > stage.clientWidth) stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) * 0.24;
  // reduced motion: no tour. Show the bench switched on and settled, then wait for the reader.
  if (still.matches) {
    target.on = true; p.on = true;
    for (let n = 0; n < SAMPLES; n++) { step(state, p, SAMPLE_DT); record(); }
    blade.at = 0;
  }
  tick(performance.now());
  wake();

  window.__ind = { target, p, view, get state() { return state; }, applyPreset, toggle: toggleSwitch, set paused(v) { paused = v; } };
})();
