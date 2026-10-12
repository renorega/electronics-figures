// The HTML under the figure: controls, live numbers and a plain-language explanation of each part.
// The page script finds everything by data-attributes, so the markup stays plain.

const slider = (key, label, hint, { min, max, step, value }, unit) => `
  <label class="rlc-row" data-row="${key}">
    <span class="rlc-row-top"><span class="rlc-name">${label}</span><output class="rlc-value" data-out="${key}"></output></span>
    <input type="range" data-in="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label} in ${unit}">
    <span class="rlc-hint">${hint}</span>
  </label>`;

export function panelHtml(M) {
  const { RANGE: R, DEFAULTS: D } = M;
  return `
<aside class="rlc-side" aria-label="Circuit controls">
  <div class="rlc-card rlc-controls">
    <h3 class="rlc-h">Parts <span>each slider moves the real part on the board</span></h3>
    ${slider("R", "Resistance", "wiper along the winding", { min: R.R.min, max: R.R.max, step: 0.5, value: D.R }, "ohms")}
    ${slider("L", "Inductance", "ferrite slug into the coil", { min: R.L.min * 1e3, max: R.L.max * 1e3, step: 0.5, value: D.L * 1e3 }, "millihenries")}
    ${slider("C", "Capacitance", "overlap of the two plates", { min: R.C.min * 1e6, max: R.C.max * 1e6, step: 1, value: D.C * 1e6 }, "microfarads")}
    <div class="rlc-row rlc-damp" aria-hidden="true">
      <span class="rlc-row-top"><span class="rlc-name">Damping ratio \u03B6 = R / 2\u221A(L/C)</span><output class="rlc-value" data-live="zeta2"></output></span>
      <div class="rlc-damp-track"><i data-damp-marker></i><b style="left:50%"></b></div>
      <span class="rlc-damp-labels"><span>rings</span><span>critical</span><span>creeps</span></span>
    </div>
  </div>

  <div class="rlc-card rlc-controls">
    <h3 class="rlc-h">Supply <span>the knobs on the bench supply</span></h3>
    ${slider("V", "Voltage", "knob on the supply", { min: R.V.min, max: R.V.max, step: 0.5, value: D.V }, "volts")}
    ${slider("I", "Current limit", "the supply holds the current here", { min: R.I.min, max: R.I.max, step: 0.05, value: D.Ilim }, "amps")}
    <div class="rlc-row">
      <span class="rlc-row-top"><span class="rlc-name">Source</span><output class="rlc-value" data-out="mode"></output></span>
      <div class="rlc-seg" role="group" aria-label="Source type">
        <button type="button" data-mode="dc">DC step</button>
        <button type="button" data-mode="square">Square</button>
        <button type="button" data-mode="sine">Sine</button>
      </div>
      <span class="rlc-hint" data-hint="mode"></span>
    </div>
    ${slider("f", "Frequency", "for the square and sine source", { min: R.f.min, max: R.f.max, step: 1, value: D.f }, "hertz")}
  </div>

  <div class="rlc-card rlc-run">
    <h3 class="rlc-h">Run <span>the main switch connects the supply to the loop</span></h3>
    <div class="rlc-run-row">
      <div class="rlc-actions">
        <button type="button" class="rlc-btn" data-act="switch" aria-pressed="false">Close switch</button>
        <button type="button" class="rlc-btn" data-act="reset">Discharge</button>
        <button type="button" class="rlc-btn" data-act="pause" aria-pressed="false">Pause</button>
      </div>
      ${slider("speed", "Playback speed", "slow motion: the real circuit rings hundreds of times faster", { min: 0.25, max: 2, step: 0.05, value: 1 }, "times")}
    </div>
  </div>

</aside>
<section class="rlc-panel" aria-label="Explanation and live numbers">
  <div class="rlc-card rlc-presets">
    <h3 class="rlc-h">Try this <span>sets the parts for you</span></h3>
    <div class="rlc-chips">
      <button type="button" class="rlc-chip" data-preset="under"><b>Ringing</b><i>low R: the energy swaps back and forth</i></button>
      <button type="button" class="rlc-chip" data-preset="critical"><b>Critical</b><i>just enough R to stop the ringing</i></button>
      <button type="button" class="rlc-chip" data-preset="over"><b>Sluggish</b><i>high R: it creeps up and never rings</i></button>
      <button type="button" class="rlc-chip" data-preset="resonance"><b>Resonance</b><i>sine source at the natural frequency</i></button>
      <button type="button" class="rlc-chip" data-preset="limit"><b>Current limit</b><i>the supply clamps the current</i></button>
    </div>
    <p class="rlc-story" data-story></p>
  </div>

  <div class="rlc-card rlc-live" aria-live="off">
    <h3 class="rlc-h">Right now <span>read from the same model that moves the parts</span></h3>
    <dl class="rlc-grid">
      <div><dt>Current i</dt><dd data-live="i"></dd></div>
      <div><dt>Resistor vR = i·R</dt><dd data-live="vR"></dd></div>
      <div><dt>Inductor vL = L·di/dt</dt><dd data-live="vL"></dd></div>
      <div><dt>Capacitor vC = q/C</dt><dd data-live="vC"></dd></div>
      <div><dt>Source vs</dt><dd data-live="vs"></dd></div>
      <div><dt>Heat in R, i²R</dt><dd data-live="p"></dd></div>
    </dl>
    <p class="rlc-law" data-live="law"></p>
    <div class="rlc-energy" role="img" aria-label="Where the energy is">
      <div class="rlc-bar" data-bar="magnetic"><span>magnetic field in L</span><i><b></b></i><em></em></div>
      <div class="rlc-bar" data-bar="electric"><span>electric field in C</span><i><b></b></i><em></em></div>
      <div class="rlc-bar" data-bar="heat"><span>heat made by R so far</span><i><b></b></i><em></em></div>
    </div>
    <dl class="rlc-grid rlc-grid-small">
      <div><dt>Natural frequency f₀</dt><dd data-live="f0"></dd></div>
      <div><dt>Damping ratio ζ</dt><dd data-live="zeta"></dd></div>
      <div><dt>Critical R</dt><dd data-live="rcrit"></dd></div>
      <div><dt>Quality Q</dt><dd data-live="q"></dd></div>
    </dl>
  </div>

  <div class="rlc-card rlc-parts">
    <h3 class="rlc-h">What each part does</h3>
    <article class="rlc-part" data-part-card="R">
      <h4>Resistor <code>v = i·R</code></h4>
      <p>A narrow path that resists the flow. The more wire the current has to pass through, the more voltage it takes to push the same current: Ohm's law. The energy it takes does not come back; it leaves as heat. Slide the wiper along the winding and watch the thermometer.</p>
      <p class="rlc-now" data-now="R"></p>
    </article>
    <article class="rlc-part" data-part-card="L">
      <h4>Inductor <code>v = L·di/dt</code></h4>
      <p>A coil makes a magnetic field when current runs through it, and the field holds energy. A steady current is fine, but changing it means changing the field, and the coil pushes back against the change. That is why current cannot jump: it has to build up. A ferrite slug concentrates the field, so pushing it in raises L. The compass beside the coil swings with the field.</p>
      <p class="rlc-now" data-now="L"></p>
    </article>
    <article class="rlc-part" data-part-card="C">
      <h4>Capacitor <code>i = C·dv/dt</code></h4>
      <p>Two plates with a gap. Charge piles onto one plate and is drawn off the other, but nothing crosses the gap, so the carriers on the wire stop at the plates. The charge sets up an electric field across the gap, and the voltage is v = q/C. More overlap means more room for charge, so more C. Its voltage follows the charge, so it cannot jump either.</p>
      <p class="rlc-now" data-now="C"></p>
    </article>
    <article class="rlc-part rlc-together">
      <h4>All three in one loop <code>vs = vR + vL + vC</code></h4>
      <p>The same current flows through all three, and their voltages add up to the source. The coil and the capacitor trade energy: the current builds the magnetic field, the field keeps the current going and charges the capacitor, then the capacitor pushes it back. The resistor drains a bit each swing. Raise R until the ringing stops: that is critical damping, at R = 2·√(L/C).</p>
    </article>
  </div>
</section>`;
}

export const PANEL_CSS = `
.rlc-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:0 20px;align-items:start}
.rlc-fig{min-width:0}
.rlc-side{display:grid;gap:14px;position:sticky;top:12px;margin-top:32px;max-height:calc(100vh - 24px);overflow-y:auto;scrollbar-width:thin}
.rlc-side .rlc-card{padding:14px 16px 6px}
.rlc-side .rlc-h{margin-bottom:12px}
.rlc-side .rlc-row{margin-bottom:11px;gap:5px}
.rlc-side .rlc-hint{font-size:11.5px}
.rlc-side .rlc-actions{margin:0}
.rlc-side .rlc-run{padding-bottom:14px}
@media (max-width:1100px){.rlc-layout{grid-template-columns:1fr}.rlc-side{position:static;max-height:none;overflow:visible;margin-top:0}.rlc-side .rlc-card{padding:18px 20px 12px}}
.rlc-panel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:20px}
.rlc-card{background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-faint);padding:18px 20px 20px;min-width:0}
.rlc-live,.rlc-parts,.rlc-presets{grid-column:1/-1}
.rlc-run-row{display:grid;grid-template-columns:1fr;gap:16px}.rlc-run-row .rlc-row{margin:0}.rlc-run-row .rlc-actions{margin:0}
.rlc-damp{margin-top:6px;padding-top:16px;border-top:1px solid var(--anatomy-faint)}
.rlc-damp-track{position:relative;height:22px}.rlc-damp-track:before{content:'';position:absolute;left:0;right:0;top:10px;height:2px;background:var(--anatomy-lo)}
.rlc-damp-track b{position:absolute;top:5px;width:1px;height:12px;background:var(--anatomy-mid)}
.rlc-damp-track i{position:absolute;top:4px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:var(--anatomy-hi);box-shadow:0 0 0 3px var(--anatomy-card)}
.rlc-damp-labels{display:flex;justify-content:space-between;font:11px/1 var(--anatomy-mono);color:var(--anatomy-muted)}
.rlc-h{margin:0 0 14px;font:600 11px/1 var(--anatomy-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--anatomy-strong)}
.rlc-h span{margin-left:10px;color:var(--anatomy-muted);font-weight:400;letter-spacing:.04em;text-transform:none}
.rlc-row{display:grid;gap:7px;margin:0 0 15px}
.rlc-row-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.rlc-name{color:var(--anatomy-strong);font-size:13px}
.rlc-value{font:12px/1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.rlc-hint{color:var(--anatomy-muted);font-size:12px;line-height:1.4}
.rlc-row[data-off]{opacity:.38;pointer-events:none}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:22px;margin:0;background:transparent;cursor:pointer;touch-action:pan-y}
input[type=range]:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:4px}
input[type=range]::-webkit-slider-runnable-track{height:2px;background:var(--anatomy-lo)}
input[type=range]::-moz-range-track{height:2px;background:var(--anatomy-lo)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;margin-top:-6px;border-radius:50%;background:var(--anatomy-card);border:1.5px solid var(--anatomy-hi);box-shadow:0 0 0 3px var(--anatomy-card)}
input[type=range]::-moz-range-thumb{width:11px;height:11px;border-radius:50%;background:var(--anatomy-card);border:1.5px solid var(--anatomy-hi)}
input[type=range]:active::-webkit-slider-thumb{background:var(--anatomy-hi)}
.rlc-seg{display:grid;grid-template-columns:repeat(3,1fr);box-shadow:0 0 0 1px var(--anatomy-lo)}
.rlc-seg button{font:12px/1 var(--anatomy-mono);padding:9px 6px;border:0;background:transparent;color:var(--anatomy-text);cursor:pointer}
.rlc-seg button+button{box-shadow:-1px 0 0 var(--anatomy-lo)}
.rlc-seg button[aria-pressed=true]{background:var(--anatomy-hi);color:var(--anatomy-card)}
.rlc-seg button:focus-visible,.rlc-btn:focus-visible,.rlc-chip:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
.rlc-actions{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 16px}
.rlc-btn{font:12px/1 var(--anatomy-mono);padding:9px 13px;border:0;background:transparent;color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-lo);cursor:pointer}
.rlc-btn:hover,.rlc-chip:hover{box-shadow:0 0 0 1px var(--anatomy-mid)}
.rlc-btn[aria-pressed=true]{background:var(--anatomy-hi);color:var(--anatomy-card)}
.rlc-chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.rlc-chip{display:grid;gap:5px;text-align:left;padding:11px 13px;border:0;background:transparent;color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-faint);cursor:pointer;font:inherit}
.rlc-chip b{font:600 12px/1.2 var(--anatomy-mono);color:var(--anatomy-strong)}
.rlc-chip i{font-style:normal;font-size:12px;line-height:1.35;color:var(--anatomy-muted)}
.rlc-chip[aria-pressed=true]{box-shadow:0 0 0 1px var(--anatomy-hi)}
.rlc-story{margin:14px 0 0;font-size:13.5px;line-height:1.6;color:var(--anatomy-text);min-height:3.2em}
.rlc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:14px 18px;margin:0}
.rlc-grid div{display:grid;gap:5px}
.rlc-grid dt{font-size:11.5px;color:var(--anatomy-muted)}
.rlc-grid dd{margin:0;font:16px/1.1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.rlc-grid-small{margin-top:18px;padding-top:16px;border-top:1px solid var(--anatomy-faint)}
.rlc-grid-small dd{font-size:14px}
.rlc-law{margin:16px 0 0;font:12.5px/1.5 var(--anatomy-mono);color:var(--anatomy-text);font-variant-numeric:tabular-nums}
.rlc-energy{display:grid;gap:9px;margin-top:18px}
.rlc-bar{display:grid;grid-template-columns:150px 1fr 74px;align-items:center;gap:12px;font-size:12px;color:var(--anatomy-muted)}
.rlc-bar i{display:block;height:6px;background:var(--anatomy-faint);position:relative;overflow:hidden}
.rlc-bar b{position:absolute;inset:0;transform-origin:left;transform:scaleX(0);background:var(--anatomy-hi)}
.rlc-bar[data-bar=heat] b{background:var(--anatomy-mid)}
.rlc-bar em{font:11.5px/1 var(--anatomy-mono);font-style:normal;color:var(--anatomy-text);text-align:right;font-variant-numeric:tabular-nums}
.rlc-parts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
.rlc-parts .rlc-h,.rlc-together{grid-column:1/-1}
.rlc-part h4{margin:0 0 8px;font:600 13px/1.3 var(--anatomy-mono);color:var(--anatomy-strong)}
.rlc-part h4 code{margin-left:8px;font-weight:400;color:var(--anatomy-muted)}
.rlc-part p{margin:0 0 10px;font-size:13.5px;line-height:1.62;color:var(--anatomy-text)}
.rlc-part .rlc-now{font:12px/1.5 var(--anatomy-mono);color:var(--anatomy-strong);padding-top:10px;border-top:1px solid var(--anatomy-faint);font-variant-numeric:tabular-nums}
.rlc-together{padding-top:18px;border-top:1px solid var(--anatomy-faint)}
@media (max-width:760px){.rlc-run-row{grid-template-columns:1fr;gap:16px}.rlc-panel{grid-template-columns:1fr}.rlc-parts{grid-template-columns:1fr}.rlc-bar{grid-template-columns:1fr 64px;row-gap:5px}.rlc-bar span{grid-column:1/-1}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
`;
