// The HTML around the figure: controls, a big two-strip scope, live numbers and plain-language explanations.
// The page script finds everything by data-attributes, so the markup stays plain.

const slider = (key, label, hint, { min, max, step, value }, unit) => `
  <label class="ind-row" data-row="${key}">
    <span class="ind-row-top"><span class="ind-name">${label}</span><output class="ind-value" data-out="${key}"></output></span>
    <input type="range" data-in="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label} in ${unit}">
    <span class="ind-hint">${hint}</span>
  </label>`;

// one strip of the big scope: a plot area with gridlines, a zero line and labelled y ticks
const strip = (name, label, ticks) => `
  <figure class="ind-strip" data-strip="${name}">
    <figcaption>${label}</figcaption>
    <div class="ind-plotbox">
      <svg viewBox="0 0 600 120" preserveAspectRatio="none" class="ind-plot" aria-hidden="true">
        <g data-grid></g>
        <g data-traces></g>
        <line data-cross x1="0" x2="0" y1="0" y2="120" class="ind-cross"/>
      </svg>
      <div class="ind-yticks" data-yticks>${ticks}</div>
    </div>
  </figure>`;

export function panelHtml(M) {
  const { RANGE: R, DEFAULTS: D, PARTS } = M;
  // three pieces, placed by build.mjs: the monitor (left of the bench on wide screens),
  // the controls (right of the bench) and the presets and explanations (under it)
  return {
    monitor: `<aside class="ind-monitor" aria-label="What the circuit is doing">
  <div class="ind-card ind-now">
    <h3 class="ind-h">What's happening <span>updates as the circuit runs</span></h3>
    <p class="ind-story" data-story></p>
  </div>
  <div class="ind-card ind-scope">
    <h3 class="ind-h">Scope <span>the newest moment is on the right · <b data-scope-span></b></span></h3>
    <div class="ind-legend">
      <span><i class="ind-key ind-key-dash"></i>Supply voltage (push from the supply)</span>
      <span><i class="ind-key ind-key-mid"></i>Coil voltage (the coil pushing back)</span>
      <span><i class="ind-key ind-key-lit"></i>Current (the flow that lights the LED)</span>
    </div>
    ${strip("volts", "Voltage (volts)", "")}
    ${strip("amps", "Current (milliamps)", "")}
    <div class="ind-tip" data-tip hidden></div>
  </div>
  <div class="ind-card ind-live" aria-live="off">
    <h3 class="ind-h">Right now <span>read from the same model that moves the parts</span></h3>
    <div class="ind-meter">
      <span>LED brightness</span><i><b data-led-bar></b><u></u></i><em data-live="bright"></em>
    </div>
    <dl class="ind-grid">
      <div><dt>Current</dt><dd data-live="i"></dd></div>
      <div><dt>Supply gives</dt><dd data-live="vs"></dd></div>
      <div><dt>Resistor uses</dt><dd data-live="vR"></dd></div>
      <div><dt>LED uses</dt><dd data-live="vLED"></dd></div>
      <div><dt>Coil voltage (+ fights, − helps)</dt><dd data-live="vL"></dd></div>
      <div><dt>Energy in the coil</dt><dd data-live="E"></dd></div>
    </dl>
    <p class="ind-law" data-live="law"></p>
  </div>
</aside>`,
    controls: `<aside class="ind-side" aria-label="Circuit controls">
  <div class="ind-card ind-switch">
    <h3 class="ind-h">Switch <span>also on the board</span></h3>
    <button type="button" class="ind-big" data-act="switch" aria-pressed="false">Turn ON</button>
    <p class="ind-hint" data-hint="switch"></p>
  </div>

  <div class="ind-card ind-controls">
    <h3 class="ind-h">Coil <span>the inductor</span></h3>
    ${slider("L", "Inductance (iron core)", "Slide the iron core into the coil: the more iron, the stronger the coil fights change.", { min: R.L.min, max: R.L.max, step: 0.05, value: D.L }, "henries")}
  </div>

  <div class="ind-card ind-controls">
    <h3 class="ind-h">Supply <span>the knobs on the box</span></h3>
    ${slider("V", "Voltage (push)", "How hard the supply pushes.", { min: R.V.min, max: R.V.max, step: 0.1, value: D.V }, "volts")}
    ${slider("I", "Max current (limit)", "The supply never lets more than this flow. It protects the LED.", { min: R.I.min * 1e3, max: R.I.max * 1e3, step: 0.5, value: D.Ilim * 1e3 }, "milliamps")}
    <div class="ind-expect" data-expect></div>
    <div class="ind-row">
      <span class="ind-row-top"><span class="ind-name">What the supply does</span><output class="ind-value" data-out="mode"></output></span>
      <div class="ind-seg" role="group" aria-label="Supply mode">
        <button type="button" data-mode="dc">Steady</button>
        <button type="button" data-mode="square">Blink</button>
        <button type="button" data-mode="sine">Wave (AC)</button>
      </div>
      <span class="ind-hint" data-hint="mode"></span>
    </div>
    ${slider("f", "Frequency", "How many times a second it blinks or waves.", { min: R.f.min, max: R.f.max, step: 1, value: D.f }, "hertz")}
  </div>

  <div class="ind-card ind-run">
    <h3 class="ind-h">Slow motion <span>real coils are fast</span></h3>
    ${slider("speed", "Playback speed", "At 1×, one second on screen is 20 thousandths of a second in the real circuit.", { min: 0.25, max: 2, step: 0.05, value: 1 }, "times")}
    <div class="ind-actions">
      <button type="button" class="ind-btn" data-act="pause" aria-pressed="false">Pause</button>
      <button type="button" class="ind-btn" data-act="reset">Start over</button>
    </div>
  </div>
</aside>`,
    below: `<section class="ind-panel" aria-label="Presets and explanation">
  <div class="ind-card ind-presets">
    <h3 class="ind-h">Try this <span>each one sets the bench for you</span></h3>
    <div class="ind-chips">
      <button type="button" class="ind-chip" data-preset="weak"><b>1 · Weak coil</b><i>no iron: the LED snaps on and off</i></button>
      <button type="button" class="ind-chip" data-preset="strong"><b>2 · Strong coil</b><i>iron in: the LED fades on, and glows on after OFF</i></button>
      <button type="button" class="ind-chip" data-preset="blinkSlow"><b>3 · Slow blink</b><i>the coil keeps up: full blinks</i></button>
      <button type="button" class="ind-chip" data-preset="blinkFast"><b>4 · Fast blink</b><i>the coil can't keep up: the LED smooths out</i></button>
      <button type="button" class="ind-chip" data-preset="wave"><b>5 · AC wave</b><i>the current lags behind the push</i></button>
      <button type="button" class="ind-chip" data-preset="limit"><b>6 · Too much push</b><i>12 V: the supply's limit saves the LED</i></button>
    </div>
  </div>
  <div class="ind-card ind-parts">
    <h3 class="ind-h">How it works</h3>
    <article class="ind-part">
      <h4>1 · A coil is lazy about change</h4>
      <p>An inductor is wire wound into a coil. Current through it makes a magnetic field (watch the compass swing). Building that field takes energy and time, and once it is built, it wants to keep going. So the coil fights any <em>change</em> in current: it fights the current starting, and it fights it stopping. Think of a heavy cart: hard to get rolling, and hard to stop once it rolls.</p>
    </article>
    <article class="ind-part">
      <h4>2 · Switching ON</h4>
      <p>When you turn the switch ON, the coil pushes back against the supply (the right meter swings the other way), so the current can only grow little by little. The LED fades up instead of snapping on. The bigger the coil, the slower the fade. Once the current stops changing, the coil stops pushing back, and it acts like a plain wire.</p>
    </article>
    <article class="ind-part">
      <h4>3 · Switching OFF</h4>
      <p>OFF takes the supply out but keeps the loop closed. Now the coil does the pushing: its field collapses and keeps the current flowing in the same direction, so the LED keeps glowing for a moment with no supply at all. The coil's voltage flips sign, and the energy stored in its field is used up in the resistor and the LED.</p>
    </article>
    <article class="ind-part">
      <h4>4 · Blinking and waves</h4>
      <p>If the supply blinks slowly, the coil has time to catch up and the LED blinks fully. Blink faster and the coil never has time: the current only wiggles a little around its middle, so the LED glows steadily at about half brightness. With a wave, the current lags behind the push. Coils are used like this in real circuits to smooth out bumpy currents.</p>
    </article>
    <article class="ind-part ind-together">
      <h4>For grown-ups <code>v<sub>L</sub> = L · di/dt</code></h4>
      <p>The coil's voltage is its inductance times how fast the current changes. In this loop the supply's voltage is shared: <code>v<sub>supply</sub> = i·R + v<sub>LED</sub> + v<sub>L</sub></code>, with R = ${PARTS.R} Ω for the resistor plus ${PARTS.rL} Ω of coil wire, and a red LED that starts to glow at ${PARTS.Vknee} V. The current approaches its final value with time constant τ = L / R<sub>total</sub>: about 63 % after τ, and essentially all of it after 5τ. Inductive reactance X<sub>L</sub> = 2πfL is why fast changes get through so poorly.</p>
    </article>
  </div>
</section>`,
  };
}

export const PANEL_CSS = `
/* Medium screens: bench on the left with the monitor under it, controls pinned on the right. */
.ind-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;grid-template-areas:"fig side" "mon side";gap:0 20px;align-items:start}
.ind-fig{grid-area:fig;min-width:0}
.ind-side{grid-area:side}
.ind-monitor{grid-area:mon;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-areas:"scope live" "scope now";gap:16px;margin-top:20px;align-items:start;min-width:0}
.ind-monitor .ind-scope{grid-area:scope}.ind-monitor .ind-live{grid-area:live}.ind-monitor .ind-now{grid-area:now}
.ind-now .ind-story{margin:0;min-height:0}
/* Wide screens: monitor | bench | controls, both side columns pinned while the page scrolls. */
@media (min-width:1400px){
.ind-layout{grid-template-columns:clamp(300px,21vw,350px) minmax(0,1fr) clamp(290px,20vw,330px);grid-template-areas:"mon fig side";gap:0 22px}
.ind-monitor{grid-template-columns:1fr;grid-template-areas:"scope" "live" "now";gap:12px;position:sticky;top:12px;margin-top:32px;max-height:calc(100vh - 24px);overflow-y:auto;scrollbar-width:thin}
.ind-monitor .ind-card{padding:14px 16px 14px}
.ind-monitor .ind-h{margin-bottom:12px}
.ind-monitor .ind-h span{display:block;margin:6px 0 0}
.ind-monitor .ind-legend{display:grid;gap:4px;margin-bottom:10px;font-size:11.5px}
.ind-monitor .ind-plot{height:84px}
.ind-monitor .ind-strip{margin-bottom:10px}
.ind-monitor .ind-meter{grid-template-columns:1fr 54px;row-gap:6px;margin-bottom:14px}.ind-monitor .ind-meter span{grid-column:1/-1}
.ind-monitor .ind-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px}
.ind-monitor .ind-grid dd{font-size:15px}
.ind-monitor .ind-law{font-size:11.5px;margin-top:12px}
.ind-monitor .ind-story{font-size:13px;line-height:1.58}
}
.ind-side{display:grid;gap:14px;position:sticky;top:12px;margin-top:32px;max-height:calc(100vh - 24px);overflow-y:auto;scrollbar-width:thin}
.ind-side .ind-card{padding:14px 16px 8px}
.ind-side .ind-h{margin-bottom:12px}
.ind-side .ind-row{margin-bottom:11px;gap:5px}
.ind-side .ind-hint{font-size:11.5px}
@media (max-width:1100px){.ind-layout{grid-template-columns:1fr;grid-template-areas:"fig" "side" "mon"}.ind-side{position:static;max-height:none;overflow:visible;margin-top:0;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}.ind-side .ind-card{padding:16px 18px 10px}}
.ind-panel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:20px}
.ind-card{background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-faint);padding:18px 20px 20px;min-width:0}
.ind-presets,.ind-parts{grid-column:1/-1}
.ind-h{margin:0 0 14px;font:600 11px/1 var(--anatomy-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--anatomy-strong)}
.ind-h span{margin-left:10px;color:var(--anatomy-muted);font-weight:400;letter-spacing:.04em;text-transform:none}
.ind-h b{font-weight:400;color:var(--anatomy-text)}
.ind-row{display:grid;gap:7px;margin:0 0 15px}
.ind-row-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.ind-name{color:var(--anatomy-strong);font-size:13px}
.ind-value{font:12px/1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.ind-hint{color:var(--anatomy-muted);font-size:12px;line-height:1.4;margin:0}
.ind-row[data-off]{opacity:.38;pointer-events:none}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:24px;margin:0;background:transparent;cursor:pointer;touch-action:pan-y}
input[type=range]:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:4px}
input[type=range]::-webkit-slider-runnable-track{height:2px;background:var(--anatomy-lo)}
input[type=range]::-moz-range-track{height:2px;background:var(--anatomy-lo)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-7px;border-radius:50%;background:var(--anatomy-card);border:1.5px solid var(--anatomy-hi);box-shadow:0 0 0 3px var(--anatomy-card)}
input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:var(--anatomy-card);border:1.5px solid var(--anatomy-hi)}
input[type=range]:active::-webkit-slider-thumb{background:var(--anatomy-hi)}
.ind-seg{display:grid;grid-template-columns:repeat(3,1fr);box-shadow:0 0 0 1px var(--anatomy-lo)}
.ind-seg button{font:12px/1 var(--anatomy-mono);padding:11px 4px;border:0;background:transparent;color:var(--anatomy-text);cursor:pointer}
.ind-seg button+button{box-shadow:-1px 0 0 var(--anatomy-lo)}
.ind-seg button[aria-pressed=true]{background:var(--anatomy-hi);color:var(--anatomy-card)}
.ind-seg button:focus-visible,.ind-btn:focus-visible,.ind-chip:focus-visible,.ind-big:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
.ind-big{display:block;width:100%;font:600 15px/1 var(--anatomy-mono);letter-spacing:.06em;padding:15px 12px;margin:0 0 10px;border:0;background:transparent;color:var(--anatomy-strong);box-shadow:0 0 0 1.5px var(--anatomy-hi);cursor:pointer}
.ind-big[aria-pressed=true]{background:var(--anatomy-hi);color:var(--anatomy-card)}
.ind-switch{padding-bottom:12px!important}
.ind-expect{margin:-2px 0 14px;padding:10px 12px;font-size:12.5px;line-height:1.5;color:var(--anatomy-text);box-shadow:inset 0 0 0 1px var(--anatomy-faint)}
.ind-expect b{font:600 12.5px/1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.ind-actions{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 8px}
.ind-btn{font:12px/1 var(--anatomy-mono);padding:10px 14px;border:0;background:transparent;color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-lo);cursor:pointer}
.ind-btn:hover,.ind-chip:hover,.ind-big:hover{box-shadow:0 0 0 1px var(--anatomy-mid)}
.ind-big:hover{box-shadow:0 0 0 1.5px var(--anatomy-strong)}
.ind-btn[aria-pressed=true]{background:var(--anatomy-hi);color:var(--anatomy-card)}
.ind-chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.ind-chip{display:grid;gap:5px;text-align:left;padding:11px 13px;border:0;background:transparent;color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-faint);cursor:pointer;font:inherit}
.ind-chip b{font:600 12px/1.2 var(--anatomy-mono);color:var(--anatomy-strong)}
.ind-chip i{font-style:normal;font-size:12px;line-height:1.35;color:var(--anatomy-muted)}
.ind-chip[aria-pressed=true]{box-shadow:0 0 0 1px var(--anatomy-hi)}
.ind-story{margin:14px 0 0;font-size:14px;line-height:1.62;color:var(--anatomy-text);min-height:4.8em}
.ind-scope{position:relative}
.ind-legend{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 12px;font-size:12px;color:var(--anatomy-text)}
.ind-legend span{display:inline-flex;align-items:center;gap:8px}
.ind-key{display:inline-block;width:22px;height:0;border-top:2px solid var(--anatomy-hi)}
.ind-key-dash{border-top:1.5px dashed var(--anatomy-muted)}
.ind-key-mid{border-top-color:var(--anatomy-mid)}
.ind-key-lit{border-top:2.5px solid var(--anatomy-strong)}
.ind-strip{margin:0 0 14px}
.ind-strip figcaption{margin:0 0 10px;font:600 11px/1 var(--anatomy-mono);color:var(--anatomy-text)}
.ind-plotbox{position:relative;padding-left:50px}
.ind-plot{display:block;width:100%;height:120px;overflow:visible;cursor:crosshair}
.ind-yticks{position:absolute;left:0;top:0;bottom:0;width:42px;font:10.5px/1 var(--anatomy-mono);color:var(--anatomy-muted);font-variant-numeric:tabular-nums}
.ind-yticks span{position:absolute;right:0;transform:translateY(-50%)}
.ind-grid-line{stroke:var(--anatomy-faint);stroke-width:1;vector-effect:non-scaling-stroke}
.ind-zero{stroke:var(--anatomy-lo);stroke-width:1;vector-effect:non-scaling-stroke}
.ind-tr{fill:none;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
.ind-tr-vs{stroke:var(--anatomy-muted);stroke-width:1.5;stroke-dasharray:5 4}
.ind-tr-vl{stroke:var(--anatomy-mid);stroke-width:2}
.ind-tr-i{stroke:var(--anatomy-strong);stroke-width:2.5}
.ind-tr-ok{stroke:var(--anatomy-lo);stroke-width:1;stroke-dasharray:2 4}
.ind-cross{stroke:var(--anatomy-mid);stroke-width:1;vector-effect:non-scaling-stroke;opacity:0}
.ind-tip{position:absolute;pointer-events:none;padding:8px 10px;background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-lo),0 4px 14px rgba(0,0,0,.18);font:11.5px/1.55 var(--anatomy-mono);color:var(--anatomy-text);white-space:nowrap;font-variant-numeric:tabular-nums}
.ind-tip b{color:var(--anatomy-strong);font-weight:600}
.ind-meter{display:grid;grid-template-columns:120px 1fr 70px;align-items:center;gap:12px;margin:0 0 18px;font-size:12.5px;color:var(--anatomy-text)}
.ind-meter i{display:block;height:10px;position:relative;background:var(--anatomy-faint);overflow:hidden}
.ind-meter b{position:absolute;inset:0;transform-origin:left;transform:scaleX(0);background:var(--ind-led,#e8321e)}
.ind-meter u{position:absolute;top:0;bottom:0;left:80%;width:1px;background:var(--anatomy-strong)}
.ind-meter em{font:12px/1 var(--anatomy-mono);font-style:normal;text-align:right;color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.ind-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:14px 18px;margin:0}
.ind-grid div{display:grid;gap:5px}
.ind-grid dt{font-size:11.5px;color:var(--anatomy-muted)}
.ind-grid dd{margin:0;font:16px/1.1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.ind-law{margin:16px 0 0;font:12.5px/1.5 var(--anatomy-mono);color:var(--anatomy-text);font-variant-numeric:tabular-nums}
.ind-parts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 28px}
.ind-parts .ind-h,.ind-together{grid-column:1/-1}
.ind-part h4{margin:0 0 8px;font:600 13px/1.3 var(--anatomy-mono);color:var(--anatomy-strong)}
.ind-part h4 code{margin-left:8px;font-weight:400;color:var(--anatomy-muted)}
.ind-part p{margin:0;font-size:14px;line-height:1.65;color:var(--anatomy-text)}
.ind-part em{font-style:normal;color:var(--anatomy-strong)}
.ind-together{padding-top:18px;border-top:1px solid var(--anatomy-faint)}
.ind-together code{font-size:12.5px}
.iso[data-theme="dark"]{--ind-led:#ff4a30}.iso[data-theme="light"]{--ind-led:#d8281a}
@media (max-width:760px){.ind-monitor{grid-template-columns:1fr;grid-template-areas:"scope" "live" "now"}.ind-panel{grid-template-columns:1fr}.ind-parts{grid-template-columns:1fr}.ind-meter{grid-template-columns:1fr 60px;row-gap:6px}.ind-meter span{grid-column:1/-1}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
`;
