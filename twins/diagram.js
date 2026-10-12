  // ── Fig 2: the same circuit as a flat diagram, driven by the same state as the bench ──
  // Arrows on the wires move at the speed of the current; the lamps, the charges on the capacitor's
  // plates, the coil's field and the spark all follow the model. Blue parts can be clicked.
  const dg = $(".ct-diagram svg");
  const DG = {
    top: 80, bottom: 220, rail: 300, drainY: 20,
    supX: 100, supTop: 162, supBottom: 194,
    bus: 160, pivot: 190, contact: 230, tap: 260, lamp: 330, lampR: 15,
    plateL: 444, plateR: 476, plateH: 20, coil0: 430, coil1: 490, right: 630,
    button: [385, 415], bladeLen: 40, openDeg: 35,
  };
  {
    const { top, bottom, rail, drainY, supX, supTop, supBottom, bus, pivot, contact, tap, lamp, lampR, plateL, plateR, plateH, coil0, coil1, right, button } = DG;
    const lampSym = (lane, y) => `<circle class="dg-halo" data-lane="${lane}" cx="${lamp}" cy="${y}" r="36" fill="url(#ct-dg-halo)" opacity="0"/>
      <circle class="dg-lamp" data-lane="${lane}" cx="${lamp}" cy="${y}" r="${lampR}"/>
      <path class="dg-part" d="M${lamp - 10.6} ${y - 10.6}L${lamp + 10.6} ${y + 10.6}M${lamp + 10.6} ${y - 10.6}L${lamp - 10.6} ${y + 10.6}"/>`;
    let bumps = `M${coil0} ${bottom}`;
    const w = (coil1 - coil0) / 4;
    for (let n = 0; n < 4; n++) bumps += `a${w / 2} ${w / 2} 0 0 1 ${w} 0`;
    const sine = Array.from({ length: 25 }, (_, n) => `${n ? "L" : "M"}${fx(supX - 9 + (18 * n) / 24)} ${fx(178 - 6 * Math.sin((n / 24) * Math.PI * 2))}`).join("");
    const opt = (key, x, label) => `<g class="dg-click" data-dg="mode-${key}"><title>Push: ${label}</title><text class="dg-opt" data-opt="${key}" x="${x}" y="337">${label}</text></g>`;
    dg.innerHTML = `
    <defs><radialGradient id="ct-dg-halo"><stop offset="0" class="ct-g0"/><stop offset=".35" class="ct-g1"/><stop offset="1" class="ct-g2"/></radialGradient>
    <radialGradient id="ct-dg-spark"><stop offset="0" class="ct-s0"/><stop offset=".35" class="ct-s1"/><stop offset="1" class="ct-s2"/></radialGradient></defs>
    <g class="dg-field" opacity="0">
      <ellipse class="dg-loop" cx="${(coil0 + coil1) / 2}" cy="${bottom - 4}" rx="44" ry="20"/>
      <ellipse class="dg-loop" cx="${(coil0 + coil1) / 2}" cy="${bottom - 4}" rx="58" ry="31"/>
    </g>
    <path class="dg-wire" d="M${supX} ${supTop}V${top}H${pivot}M${bus} ${top}V${bottom}H${pivot}
      M${contact} ${top}H${lamp - lampR}M${lamp + lampR} ${top}H${plateL}M${plateR} ${top}H${right}
      M${contact} ${bottom}H${lamp - lampR}M${lamp + lampR} ${bottom}H${coil0}M${coil1} ${bottom}H${right}
      M${right} ${top}V${rail}H${supX}V${supBottom}
      M${tap} ${top}V${drainY}H${button[0]}M${button[1]} ${drainY}H${right}V${top}"/>
    ${lampSym("C", top)}${lampSym("L", bottom)}
    <path class="dg-plate" d="M${plateL} ${top - plateH}V${top + plateH}M${plateR} ${top - plateH}V${top + plateH}"/>
    <g class="dg-charges"></g>
    <path class="dg-part" d="${bumps}" style="stroke-width:3px"/>
    <g class="dg-supply-dc">
      <path class="dg-part" d="M${supX} ${supTop}V172M${supX} 184V${supBottom}"/>
      <path class="dg-part" d="M${supX - 16} 172H${supX + 16}" style="stroke-width:3px"/><path class="dg-part" d="M${supX - 8} 184H${supX + 8}" style="stroke-width:6px"/>
      <text class="dg-small" x="${supX + 20}" y="168">+</text><text class="dg-small" x="${supX + 14}" y="198">−</text>
    </g>
    <g class="dg-supply-ac" opacity="0">
      <circle class="dg-part dg-fill" cx="${supX}" cy="178" r="16"/><path class="dg-part" d="${sine}" style="stroke-width:2px"/>
    </g>
    <circle class="dg-node" cx="${bus}" cy="${top}" r="4"/><circle class="dg-node" cx="${tap}" cy="${top}" r="4"/>
    <circle class="dg-node" cx="${right}" cy="${top}" r="4"/><circle class="dg-node" cx="${right}" cy="${bottom}" r="4"/>
    <g class="dg-dots"></g>
    <circle class="dg-spark-glow" r="22" fill="url(#ct-dg-spark)" opacity="0"/><path class="dg-spark" d="" opacity="0"/>
    <g class="dg-click" data-dg="switch"><title>Switch: click to turn ON or OFF</title>
      <rect x="${pivot - 8}" y="${top - 34}" width="${contact - pivot + 16}" height="${bottom - top + 50}" fill="transparent"/>
      <line class="dg-gang" x1="0" y1="0" x2="0" y2="0"/>
      <line class="dg-lever" data-lane="C" x1="${pivot}" y1="${top}" x2="${contact}" y2="${top}"/>
      <line class="dg-lever" data-lane="L" x1="${pivot}" y1="${bottom}" x2="${contact}" y2="${bottom}"/>
      <circle class="dg-contact" cx="${contact}" cy="${top}" r="3.4"/><circle class="dg-contact" cx="${contact}" cy="${bottom}" r="3.4"/>
      <circle class="dg-node" cx="${pivot}" cy="${top}" r="4"/><circle class="dg-node" cx="${pivot}" cy="${bottom}" r="4"/>
    </g>
    <g class="dg-click" data-dg="drain"><title>EMPTY button: works only while the switch is OFF</title>
      <rect x="${button[0] - 12}" y="${drainY - 30}" width="${button[1] - button[0] + 24}" height="40" fill="transparent"/>
      <circle class="dg-contact" cx="${button[0] + 3}" cy="${drainY}" r="3.4"/><circle class="dg-contact" cx="${button[1] - 3}" cy="${drainY}" r="3.4"/>
      <g class="dg-push"><path class="dg-lever" d="M${button[0] - 2} ${drainY - 10}H${button[1] + 2}M${(button[0] + button[1]) / 2} ${drainY - 10}V${drainY - 22}"/></g>
    </g>
    <text class="dg-small" x="${(button[0] + button[1]) / 2}" y="${drainY - 30}" text-anchor="middle">EMPTY button</text>
    <text class="dg-text" x="${supX - 24}" y="176" text-anchor="end">power</text>
    <text class="dg-text" x="${supX - 24}" y="191" text-anchor="end">box</text>
    <text class="dg-small" data-dg="vs" x="${supX - 24}" y="208" text-anchor="end"></text>
    <text class="dg-text" x="${contact + 14}" y="146">switch</text>
    <text class="dg-small" x="${contact + 14}" y="161">both blades</text>
    <text class="dg-small" x="${contact + 14}" y="174">move together</text>
    <text class="dg-text" x="${lamp}" y="${top + 36}" text-anchor="middle">lamp</text><text class="dg-small" data-dg="bC" x="${lamp}" y="${top + 51}" text-anchor="middle"></text>
    <text class="dg-text" x="${lamp}" y="${bottom + 36}" text-anchor="middle">lamp</text><text class="dg-small" data-dg="bL" x="${lamp}" y="${bottom + 51}" text-anchor="middle"></text>
    <text class="dg-text" x="${(plateL + plateR) / 2}" y="${top + 42}" text-anchor="middle">capacitor</text>
    <text class="dg-small" data-dg="vC" x="${(plateL + plateR) / 2}" y="${top + 57}" text-anchor="middle"></text>
    <text class="dg-small" x="${(plateL + plateR) / 2}" y="${top + 70}" text-anchor="middle">nothing crosses the gap</text>
    <text class="dg-text" x="${(coil0 + coil1) / 2}" y="${bottom + 46}" text-anchor="middle">coil</text>
    <text class="dg-small" data-dg="field" x="${(coil0 + coil1) / 2}" y="${bottom + 61}" text-anchor="middle"></text>
    <text class="dg-status" x="360" y="-24" text-anchor="middle"></text>
    <rect class="dg-pill" x="300" y="318" width="384" height="28" rx="14"/>
    <text class="dg-small" x="316" y="337">push:</text>
    ${opt("steady", 362, "steady")}<text class="dg-small" x="424" y="337">|</text>
    ${opt("slow", 438, "slow wiggle")}<text class="dg-small" x="538" y="337">|</text>
    ${opt("fast", 552, "fast wiggle")}`;
  }
  const dgq = (sel) => $(sel, dg);
  const dgN = {
    charges: dgq(".dg-charges"), field: dgq(".dg-field"), dots: dgq(".dg-dots"), status: dgq(".dg-status"),
    gang: dgq(".dg-gang"), levers: { C: dgq('.dg-lever[data-lane="C"]'), L: dgq('.dg-lever[data-lane="L"]') },
    halo: { C: dgq('.dg-halo[data-lane="C"]'), L: dgq('.dg-halo[data-lane="L"]') },
    lamp: { C: dgq('.dg-lamp[data-lane="C"]'), L: dgq('.dg-lamp[data-lane="L"]') },
    dc: dgq(".dg-supply-dc"), ac: dgq(".dg-supply-ac"), push: dgq(".dg-push"), drain: dgq('[data-dg="drain"]'),
    sparkGlow: dgq(".dg-spark-glow"), spark: dgq(".dg-spark"), opts: $$("[data-opt]", dg),
    vs: dgq('[data-dg="vs"]'), vC: dgq('[data-dg="vC"]'), field2: dgq('[data-dg="field"]'), bC: dgq('[data-dg="bC"]'), bL: dgq('[data-dg="bL"]'),
  };
  // the runs the arrows follow, each with the current that drives it (positive = along the run)
  const DGR = (() => {
    const { top, bottom, rail, drainY, supX, supTop, supBottom, bus, contact, tap, plateL, plateR, right } = DG;
    return {
      plus: [[supX, supTop], [supX, top], [bus, top]],
      feedC: [[bus, top], [contact, top], [tap, top]],
      feedL: [[bus, top], [bus, bottom], [contact, bottom]],
      laneC: [[tap, top], [plateL - 5, top]],
      laneC2: [[plateR + 5, top], [right, top]],
      laneL: [[contact, bottom], [right, bottom]],
      drain: [[tap, top], [tap, drainY], [right, drainY], [right, top]],
      railB: [[right, top], [right, bottom]],
      railC: [[right, bottom], [right, rail], [supX, rail], [supX, supBottom]],
    };
  })();
  const dgLen = Object.fromEntries(Object.entries(DGR).map(([k, pts]) => [k, pts.slice(1).reduce((s, pt, n) => s + Math.hypot(pt[0] - pts[n][0], pt[1] - pts[n][1]), 0)]));
  function dgPoint(pts, d) {
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
  const DG_GAP = 30, DG_SPEED = 150; // diagram units per second per amp
  const dgPhase = Object.fromEntries(Object.keys(DGR).map((k) => [k, 0]));
  const dgPool = [];
  const dgArrow = () => {
    const node = document.createElementNS(NS, "path");
    node.setAttribute("class", "dg-dot");
    node.setAttribute("d", "M-4 -4.5L3 0L-4 4.5");
    dgN.dots.appendChild(node);
    dgPool.push(node);
    return node;
  };
  const dgLast = {};
  function placeDiagram(r, dt) {
    const { top, bottom, pivot, contact, bladeLen, openDeg, plateL, plateR, plateH } = DG;
    // the blades follow the bench's switch
    const a = ((sw.angle / OPEN_DEG) * openDeg * Math.PI) / 180;
    const tipOf = (y) => [pivot + bladeLen * Math.cos(a), y - bladeLen * Math.sin(a)];
    for (const [lane, y] of [["C", top], ["L", bottom]]) {
      const [x2, y2] = tipOf(y);
      dgN.levers[lane].setAttribute("x2", fx(x2)); dgN.levers[lane].setAttribute("y2", fx(y2));
    }
    const g0 = [pivot + 0.6 * bladeLen * Math.cos(a), top - 0.6 * bladeLen * Math.sin(a)];
    dgN.gang.setAttribute("x1", fx(g0[0])); dgN.gang.setAttribute("y1", fx(g0[1]));
    dgN.gang.setAttribute("x2", fx(g0[0])); dgN.gang.setAttribute("y2", fx(g0[1] + bottom - top));
    // the spark at the coil's blade, with the same flash as on the bench
    if (flash > 0.02) {
      const [tx, ty] = tipOf(bottom);
      let d = `M${fx(tx)} ${fx(ty)}`;
      for (let n = 1; n < 5; n++) d += `L${fx(tx + ((contact - tx) * n) / 5 + (Math.random() - 0.5) * 6)} ${fx(ty + ((bottom - ty) * n) / 5 + (Math.random() - 0.5) * 6)}`;
      dgN.spark.setAttribute("d", d + `L${contact} ${bottom}`);
      dgN.spark.setAttribute("opacity", fx(clamp(flash * 1.3, 0, 1)));
      dgN.sparkGlow.setAttribute("cx", fx((tx + contact) / 2)); dgN.sparkGlow.setAttribute("cy", fx((ty + bottom) / 2));
      dgN.sparkGlow.setAttribute("opacity", fx(clamp(flash, 0, 1)));
    } else if (dgN.spark.getAttribute("opacity") !== "0") { dgN.spark.setAttribute("opacity", "0"); dgN.sparkGlow.setAttribute("opacity", "0"); }
    // lamps glow as brightly as the bench's
    for (const [lane, b] of [["C", r.bC], ["L", r.bL]]) {
      const seen = Math.pow(clamp(b, 0, 1), 0.55);
      dgN.halo[lane].setAttribute("opacity", fx(seen));
      dgN.lamp[lane].style.fillOpacity = fx(seen);
    }
    // the supply's symbol: a battery for a steady push, a wave in a circle for a wiggle
    const ac = p.mode === "steady" ? 0 : 1;
    if (dgLast.ac !== ac) { dgLast.ac = ac; dgN.dc.setAttribute("opacity", 1 - ac); dgN.ac.setAttribute("opacity", ac); }
    const mk = modeKey();
    if (dgLast.mode !== mk) { dgLast.mode = mk; dgN.opts.forEach((n) => n.toggleAttribute("data-on", n.dataset.opt === mk)); }
    dgN.push.setAttribute("transform", p.drain ? "translate(0 7)" : "");
    if (dgLast.drainOff !== p.on) { dgLast.drainOff = p.on; dgN.drain.toggleAttribute("data-off", p.on); }
    // charge on the plates: + on the plate the push comes in on, − on the other
    const count = Math.round(clamp(Math.abs(r.full), 0, 1) * 5);
    const key = count + (r.vC >= 0 ? "+" : "−");
    if (dgLast.charge !== key) {
      dgLast.charge = key;
      const [left, rightSign] = r.vC >= 0 ? ["+", "−"] : ["−", "+"];
      let html = "";
      for (let n = 0; n < count; n++) {
        const y = top + (n - (count - 1) / 2) * ((plateH * 2 - 6) / 4);
        html += `<text class="dg-charge" data-sign="${left}" x="${plateL + 8}" y="${fx(y + 4)}">${left}</text><text class="dg-charge" data-sign="${rightSign}" x="${plateR - 8}" y="${fx(y + 4)}">${rightSign}</text>`;
      }
      dgN.charges.innerHTML = html;
    }
    // the coil's field loops, as strong as its field
    const fieldShare = Math.abs(r.flux) / ((PARTS.L * PARTS.V) / (PARTS.R + PARTS.rL));
    dgN.field.setAttribute("opacity", fx(clamp(fieldShare, 0, 1) * 0.9));
    text(dgN.vs, p.mode === "steady" ? `${PARTS.V.toFixed(1)} V steady` : `${PARTS.V.toFixed(0)} V, ${p.f < 10 ? p.f.toFixed(1) : p.f.toFixed(0)}/s`);
    text(dgN.vC, `${r.vC.toFixed(1)} V · ${pct(r.full)} full`);
    text(dgN.field2, `magnetic field ${pct(fieldShare)}`);
    text(dgN.bC, pct(r.bC) + " bright");
    text(dgN.bL, pct(r.bL) + " bright");
    // the arrows
    const cur = routeCurrents(r, p);
    cur.laneC2 = cur.laneC;
    let used = 0;
    for (const [name, pts] of Object.entries(DGR)) {
      const i = cur[name];
      dgPhase[name] = (dgPhase[name] + DG_SPEED * i * dt) % DG_GAP;
      if (Math.abs(i) < 0.004) continue;
      const length = dgLen[name];
      const shown = smoothstep(0.004, 0.03, Math.abs(i));
      for (let d = ((dgPhase[name] % DG_GAP) + DG_GAP) % DG_GAP; d < length; d += DG_GAP) {
        const node = dgPool[used] || dgArrow();
        used++;
        const [x, y, angle] = dgPoint(pts, d);
        const turn = (angle * 180) / Math.PI + (i < 0 ? 180 : 0);
        node.setAttribute("transform", `translate(${fx(x)} ${fx(y)}) rotate(${fx(turn)})`);
        node.setAttribute("opacity", fx(shown * Math.min(smoothstep(0, 8, d), smoothstep(0, 8, length - d))));
      }
    }
    for (let n = used; n < dgPool.length; n++) dgPool[n].setAttribute("opacity", "0");
    text(dgN.status, diagramStatus(r));
  }
  function diagramStatus(r) {
    if (p.on && p.mode !== "steady") {
      const s = wiggleShare(p.f);
      return s.shareC > s.shareL ? "Fast wiggle: the capacitor lets it through, the coil blocks it" : "Slow wiggle: the coil lets it through, the capacitor blocks it";
    }
    if (p.on) {
      if (r.bC > 0.05 && r.bL < 0.5) return "Switched ON: current rushes into the empty capacitor; the coil holds it back";
      if (r.bC > 0.02 || r.bL < 0.85) return "The capacitor fills and lets less through; the coil lets more and more through";
      return "Steady: the full capacitor blocks the flow; the coil lets it all through";
    }
    if (flash > 0.05) return "Switched OFF: the coil's current jumps the gap as a spark";
    if (p.drain && r.full > 0.005) return "Emptying: the capacitor pushes its charge back out through its lamp";
    if (r.full > 0.05) return `OFF: the capacitor keeps its charge (${r.vC.toFixed(1)} V). Press EMPTY`;
    return "OFF: nothing flows. Click the blue switch";
  }
  $$(".dg-click", dg).forEach((node) => node.addEventListener("click", () => {
    touched();
    const what = node.dataset.dg;
    if (what === "switch") setSwitch(!target.on);
    else if (what === "drain") startDrain();
    else if (what.startsWith("mode-")) setMode(what.slice(5));
  }));

