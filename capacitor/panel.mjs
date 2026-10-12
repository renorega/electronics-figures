// The HTML beside and under the figure: controls, live numbers and a plain-language explanation.
// The page script finds everything by data-attributes, so the markup stays plain.

const slider = (key, label, hint, { min, max, step, value }, unit) => `
  <label class="cap-row" data-row="${key}">
    <span class="cap-row-top"><span class="cap-name">${label}</span><output class="cap-value" data-out="${key}"></output></span>
    <input type="range" data-in="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label} in ${unit}">
    <span class="cap-hint" data-hint="${key}">${hint}</span>
  </label>`;

export function panelHtml(M) {
  const { RANGE: R, DEFAULTS: D } = M;
  return `
<aside class="cap-side" aria-label="Circuit controls">
  <p class="cap-grip-note"><i aria-hidden="true"></i>Blue parts on the board can be clicked or dragged.</p>
  <div class="cap-card cap-controls">
    <h3 class="cap-h">Wiring <span>the knife switch on the board</span></h3>
    <div class="cap-row">
      <span class="cap-row-top"><span class="cap-name">LEDs and capacitor in</span><output class="cap-value" data-out="topo"></output></span>
      <div class="cap-seg cap-seg-2" role="group" aria-label="Wiring">
        <button type="button" data-topo="series">Series</button>
        <button type="button" data-topo="parallel">Parallel</button>
      </div>
      <span class="cap-hint" data-hint="topo"></span>
    </div>
  </div>

  <div class="cap-card cap-controls">
    <h3 class="cap-h">Supply <span>the knobs on the bench supply</span></h3>
    <div class="cap-row">
      <span class="cap-row-top"><span class="cap-name">Kind of supply</span><output class="cap-value" data-out="mode"></output></span>
      <div class="cap-seg" role="group" aria-label="Kind of supply">
        <button type="button" data-mode="dc">Battery</button>
        <button type="button" data-mode="pulse">Auto flip</button>
        <button type="button" data-mode="ac">AC</button>
      </div>
      <span class="cap-hint" data-hint="mode"></span>
    </div>
    <div class="cap-switch" data-row="switch">
      <button type="button" class="cap-big" data-act="fill" aria-pressed="false"><b>Fill</b><i>connect the supply</i></button>
      <button type="button" class="cap-big" data-act="empty" aria-pressed="true"><b>Empty</b><i>supply out, wires joined</i></button>
    </div>
    ${slider("V", "Voltage", "how hard the supply pushes", { min: R.V.min, max: R.V.max, step: 0.5, value: D.V }, "volts")}
    ${slider("f", "Flips per second", "for Auto flip and AC", { min: 0, max: 1, step: 0.005, value: M.fFrac(D.f) }, "hertz")}
  </div>

  <div class="cap-card cap-controls">
    <h3 class="cap-h">Parts <span>each slider moves the real part</span></h3>
    ${slider("C", "Capacitor size", "how much the two plates overlap", { min: R.C.min * 1e6, max: R.C.max * 1e6, step: 10, value: D.C * 1e6 }, "microfarads")}
    ${slider("R", "Resistor", "", { min: R.R.min, max: R.R.max, step: 10, value: D.R }, "ohms")}
  </div>

  <div class="cap-card cap-run">
    <div class="cap-actions">
      <button type="button" class="cap-btn" data-act="pause" aria-pressed="false">Pause</button>
      <button type="button" class="cap-btn" data-act="reset">Start empty</button>
    </div>
    ${slider("speed", "Playback speed", "1× is real time; slow it down to watch a fast flash", { min: 0.1, max: 1, step: 0.05, value: 1 }, "times")}
  </div>
</aside>
<section class="cap-panel" aria-label="Explanation and live numbers">
  <div class="cap-card cap-presets">
    <h3 class="cap-h">Try this <span>sets the parts for you</span></h3>
    <div class="cap-chips">
      <button type="button" class="cap-chip" data-preset="fill"><b>1 · Fill it</b><i>green flashes, then fades out</i></button>
      <button type="button" class="cap-chip" data-preset="empty"><b>2 · Empty it</b><i>the stored charge lights red</i></button>
      <button type="button" class="cap-chip" data-preset="big"><b>3 · Big capacitor</b><i>takes much longer to fill</i></button>
      <button type="button" class="cap-chip" data-preset="small"><b>4 · Small capacitor</b><i>full almost at once: a blink</i></button>
      <button type="button" class="cap-chip" data-preset="slow"><b>5 · Slow flipping</b><i>a flash at every flip</i></button>
      <button type="button" class="cap-chip" data-preset="fast"><b>6 · Fast AC</b><i>never full, so both LEDs glow</i></button>
      <button type="button" class="cap-chip" data-preset="unplug"><b>7 · Parallel: unplug</b><i>the capacitor keeps the LED lit</i></button>
      <button type="button" class="cap-chip" data-preset="smooth"><b>8 · Parallel: smoothing</b><i>a flipping supply, a steady LED</i></button>
    </div>
    <p class="cap-story" data-story></p>
  </div>

  <div class="cap-card cap-live" aria-live="off">
    <h3 class="cap-h">Right now <span>read from the same model that moves the parts</span></h3>
    <div class="cap-gauges">
      <div class="cap-gauge" data-gauge="fill">
        <span class="cap-gauge-top"><span>How full the capacitor is</span><output data-live="vC"></output></span>
        <div class="cap-tank" role="img" aria-label="Capacitor fill level"><i data-level></i><b data-mark style="left:100%"></b></div>
        <span class="cap-gauge-foot" data-live="fillNote"></span>
      </div>
      <div class="cap-gauge" data-gauge="flow">
        <span class="cap-gauge-top"><span>Current through the LEDs</span><output data-live="i"></output></span>
        <div class="cap-flow" role="img" aria-label="Current, green to the right and red to the left"><i data-flow></i></div>
        <span class="cap-gauge-foot" data-live="flowNote"></span>
      </div>
    </div>
    <dl class="cap-grid">
      <div><dt>From the supply</dt><dd data-live="iS"></dd></div>
      <div><dt>Into the capacitor</dt><dd data-live="iC"></dd></div>
      <div><dt>Green LED</dt><dd data-live="green"></dd></div>
      <div><dt>Red LED</dt><dd data-live="red"></dd></div>
      <div><dt>Charge stored, q = C·v</dt><dd data-live="q"></dd></div>
      <div><dt>Fill time, τ = R·C</dt><dd data-live="tau"></dd></div>
      <div><dt>First rush of current</dt><dd data-live="peak"></dd></div>
      <div><dt>Capacitor resists AC by</dt><dd data-live="xc"></dd></div>
    </dl>
    <p class="cap-law" data-live="law"></p>
  </div>

  <div class="cap-card cap-parts">
    <h3 class="cap-h">What each part does</h3>
    <article class="cap-part">
      <h4>The capacitor <code>q = C·v</code></h4>
      <p>Two metal plates with a gap between them. The supply pushes charge onto one plate and pulls the same amount off the other plate, but nothing can jump the gap. Watch the dots: they stop at the plates. As charge piles up, it pushes back against the supply. When it pushes back as hard as the supply pushes, the flow stops. The capacitor is full.</p>
      <p>Bigger plates (more overlap) have room for more charge, so they take longer to fill. That number is the capacitance, C, in microfarads (µF).</p>
    </article>
    <article class="cap-part">
      <h4>The LEDs <code>about 2 V to light</code></h4>
      <p>An LED lets current through one way only, and it lights while current flows. The green one faces the way the current goes while the capacitor fills. The red one faces the other way, so it only lights when the capacitor empties. Neither lights when nothing is flowing, even if the switch is on.</p>
      <p>An LED needs about 2 volts before any current flows. That is why the capacitor stops about 2 V short of the supply.</p>
    </article>
    <article class="cap-part">
      <h4>The resistor <code>i = v / R</code></h4>
      <p>A long, thin wire that slows the flow, like a narrow pipe into a bucket. A bigger resistor means a smaller current, a dimmer LED and a slower fill. It also protects the LED: without it, the first rush of current would be big enough to burn it out.</p>
      <p>The fill time is τ = R × C. After one τ the capacitor is about ⅔ full, and after five it is all but full.</p>
    </article>
    <article class="cap-part cap-together">
      <h4>Series or parallel?</h4>
      <p><b>Series</b> (knife switch lever back): the LEDs and the capacitor are in one line, so every bit of charge that reaches the capacitor has passed through an LED. The LED shows you the capacitor's current: it lights only while the capacitor is filling or emptying.</p>
      <p><b>Parallel</b> (lever forward): the capacitor sits across the LEDs, like a water tank beside a tap. It has to fill up past about 2 V before the LED gets anything, so the LED comes on late. Unplug the supply and the capacitor drains through the LED, which keeps glowing for a while with no supply at all. That is why capacitors are used to keep power steady. The LED board has its own 470 Ω resistor to protect the LEDs in this wiring.</p>
    </article>
    <article class="cap-part cap-together">
      <h4>Why AC seems to go "through" a capacitor</h4>
      <p>With AC the supply keeps changing direction, so the capacitor fills one way, empties, then fills the other way, again and again. It never gets the chance to be full, so current keeps flowing in the wires and both LEDs light by turns. Faster flipping or a bigger capacitor means it is even further from full each time, so more current flows and the LEDs glow brighter. Steady DC from a battery stops as soon as the capacitor is full. That is the main rule of a capacitor: <b>it blocks steady current but passes changing current.</b></p>
    </article>
  </div>
</section>`;
}

export const PANEL_CSS = `
.cap-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:0 20px;align-items:start}
.cap-fig{min-width:0}
.cap-side{display:grid;gap:14px;position:sticky;top:12px;margin-top:32px;max-height:calc(100vh - 24px);overflow-y:auto;scrollbar-width:thin}
.cap-side .cap-card{padding:14px 16px 6px}
.cap-side .cap-h{margin-bottom:12px}
.cap-side .cap-row{margin-bottom:11px;gap:5px}
.cap-side .cap-hint{font-size:11.5px}
.cap-side .cap-run{padding-bottom:12px}
@media (max-width:1100px){.cap-layout{grid-template-columns:1fr}.cap-side{position:static;max-height:none;overflow:visible;margin-top:0;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}.cap-side .cap-card{padding:18px 20px 12px}}
.cap-panel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:20px}
.cap-card{background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-faint);padding:18px 20px 20px;min-width:0}
.cap-live,.cap-parts,.cap-presets{grid-column:1/-1}
.cap-h{margin:0 0 14px;font:600 11px/1 var(--anatomy-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--anatomy-strong)}
.cap-h span{margin-left:10px;color:var(--anatomy-muted);font-weight:400;letter-spacing:.04em;text-transform:none}
.cap-row{display:grid;gap:7px;margin:0 0 15px}
.cap-row-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.cap-name{color:var(--anatomy-strong);font-size:13px}
.cap-value{font:12px/1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.cap-hint{color:var(--anatomy-muted);font-size:12px;line-height:1.4}
.cap-row[data-off],.cap-switch[data-off]{opacity:.38;pointer-events:none}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:22px;margin:0;background:transparent;cursor:pointer;touch-action:pan-y}
input[type=range]:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:4px}
input[type=range]::-webkit-slider-runnable-track{height:2px;background:var(--anatomy-lo)}
input[type=range]::-moz-range-track{height:2px;background:var(--anatomy-lo)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;margin-top:-6px;border-radius:50%;background:var(--anatomy-card);border:1.5px solid var(--anatomy-hi);box-shadow:0 0 0 3px var(--anatomy-card)}
input[type=range]::-moz-range-thumb{width:11px;height:11px;border-radius:50%;background:var(--anatomy-card);border:1.5px solid var(--anatomy-hi)}
input[type=range]:active::-webkit-slider-thumb{background:var(--anatomy-hi)}
.cap-seg{display:grid;grid-template-columns:repeat(3,1fr);box-shadow:0 0 0 1px var(--anatomy-lo)}
.cap-seg-2{grid-template-columns:repeat(2,1fr)}
.cap-grip-note{display:flex;align-items:center;gap:10px;margin:0;padding:10px 14px;font-size:12.5px;color:var(--anatomy-strong);background:var(--anatomy-card);box-shadow:0 0 0 1px var(--grip)}
.cap-grip-note i{flex:none;width:12px;height:12px;border-radius:50%;background:var(--grip)}
.cap-seg button{font:12px/1 var(--anatomy-mono);padding:10px 6px;border:0;background:transparent;color:var(--anatomy-text);cursor:pointer;min-height:36px}
.cap-seg button+button{box-shadow:-1px 0 0 var(--anatomy-lo)}
.cap-seg button[aria-pressed=true]{background:var(--anatomy-hi);color:var(--anatomy-card)}
.cap-switch{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:2px 0 14px}
.cap-big{display:grid;gap:4px;text-align:left;padding:10px 12px;border:0;background:transparent;color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-lo);cursor:pointer;font:inherit}
.cap-big b{font:600 13px/1.1 var(--anatomy-mono);color:var(--anatomy-strong)}
.cap-big i{font-style:normal;font-size:11.5px;color:var(--anatomy-muted)}
.cap-big[data-act=fill][aria-pressed=true]{box-shadow:0 0 0 2px var(--led-green)}
.cap-big[data-act=empty][aria-pressed=true]{box-shadow:0 0 0 2px var(--led-red)}
.cap-seg button:focus-visible,.cap-btn:focus-visible,.cap-chip:focus-visible,.cap-big:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
.cap-actions{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
.cap-btn{font:12px/1 var(--anatomy-mono);padding:10px 13px;border:0;background:transparent;color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-lo);cursor:pointer;min-height:36px}
.cap-btn:hover,.cap-chip:hover,.cap-big:hover{box-shadow:0 0 0 1px var(--anatomy-mid)}
.cap-btn[aria-pressed=true]{background:var(--anatomy-hi);color:var(--anatomy-card)}
.cap-chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
.cap-chip{display:grid;gap:5px;text-align:left;padding:11px 13px;border:0;background:transparent;color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-faint);cursor:pointer;font:inherit}
.cap-chip b{font:600 12px/1.2 var(--anatomy-mono);color:var(--anatomy-strong)}
.cap-chip i{font-style:normal;font-size:12px;line-height:1.35;color:var(--anatomy-muted)}
.cap-chip[aria-pressed=true]{box-shadow:0 0 0 1px var(--anatomy-hi)}
.cap-story{margin:16px 0 0;font-size:15px;line-height:1.6;color:var(--anatomy-strong);min-height:3.2em;max-width:80ch}
.cap-gauges{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:20px}
.cap-gauge{display:grid;gap:8px}
.cap-gauge-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12.5px;color:var(--anatomy-muted)}
.cap-gauge-top output{font:16px/1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.cap-gauge-foot{font-size:12px;color:var(--anatomy-muted);min-height:1.4em}
.cap-tank{position:relative;height:16px;box-shadow:inset 0 0 0 1px var(--anatomy-lo);overflow:hidden}
.cap-tank i{position:absolute;left:0;top:0;bottom:0;width:100%;transform-origin:left;transform:scaleX(0);background:var(--anatomy-hi)}
.cap-tank i[data-neg]{background:var(--anatomy-mid)}
.cap-tank b{position:absolute;top:-2px;bottom:-2px;width:2px;margin-left:-1px;background:var(--anatomy-strong);opacity:.5}
.cap-flow{position:relative;height:16px;box-shadow:inset 0 0 0 1px var(--anatomy-lo);overflow:hidden}
.cap-flow:before{content:'';position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--anatomy-lo)}
.cap-flow i{position:absolute;top:0;bottom:0;left:50%;width:50%;transform-origin:left;transform:scaleX(0);background:var(--led-green)}
.cap-flow i[data-neg]{transform-origin:left;background:var(--led-red)}
.cap-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px 18px;margin:0;padding-top:16px;border-top:1px solid var(--anatomy-faint)}
.cap-grid div{display:grid;gap:5px}
.cap-grid dt{font-size:11.5px;color:var(--anatomy-muted)}
.cap-grid dd{margin:0;font:15px/1.1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.cap-law{margin:16px 0 0;font:12.5px/1.5 var(--anatomy-mono);color:var(--anatomy-text);font-variant-numeric:tabular-nums}
.cap-parts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
.cap-parts .cap-h,.cap-together{grid-column:1/-1}
.cap-part h4{margin:0 0 8px;font:600 13px/1.3 var(--anatomy-mono);color:var(--anatomy-strong)}
.cap-part h4 code{margin-left:8px;font-weight:400;color:var(--anatomy-muted)}
.cap-part p{margin:0 0 10px;font-size:13.5px;line-height:1.62;color:var(--anatomy-text)}
.cap-part p b{color:var(--anatomy-strong)}
.cap-together{padding-top:18px;border-top:1px solid var(--anatomy-faint)}
@media (max-width:760px){.cap-panel{grid-template-columns:1fr}.cap-parts{grid-template-columns:1fr}.cap-gauges{grid-template-columns:1fr}}
`;
