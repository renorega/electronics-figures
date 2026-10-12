// The HTML around the figure: controls, a two-lane scope, live numbers and plain-language explanations.
// The page script finds everything by data-attributes, so the markup stays plain.

const strip = (name, label) => `
  <figure class="ct-strip" data-strip="${name}">
    <figcaption>${label}</figcaption>
    <div class="ct-plotbox">
      <svg viewBox="0 0 600 120" preserveAspectRatio="none" class="ct-plot" aria-hidden="true">
        <g data-grid></g>
        <g data-traces></g>
        <line data-cross x1="0" x2="0" y1="0" y2="120" class="ct-cross"/>
      </svg>
      <div class="ct-yticks" data-yticks></div>
    </div>
  </figure>`;

const bar = (key, label, cls) => `
    <div class="ct-meter">
      <span>${label}</span><i><b class="${cls}" data-bar="${key}"></b></i><em data-live="${key}"></em>
    </div>`;

export function panelHtml(M) {
  const { PARTS, WIGGLE, RANGE, TAU_C, TAU_L, KAPPA } = M;
  return {
    monitor: `<aside class="ct-monitor" aria-label="What the circuit is doing">
  <div class="ct-card ct-now">
    <h3 class="ct-h">What's happening <span>updates as it runs</span></h3>
    <p class="ct-story" data-story></p>
  </div>
  <div class="ct-card ct-live" aria-live="off">
    <h3 class="ct-h">Right now <span>from the same model that moves the parts</span></h3>
    ${bar("bC", "Back lamp (capacitor)", "ct-b-lamp")}
    ${bar("bL", "Front lamp (coil)", "ct-b-lamp")}
    ${bar("full", "Capacitor: how full", "ct-b-full")}
    ${bar("field", "Coil: magnetic field", "ct-b-field")}
    <dl class="ct-grid">
      <div><dt>Current, back lane</dt><dd data-live="iC"></dd></div>
      <div><dt>Current, front lane</dt><dd data-live="iL"></dd></div>
      <div><dt>Capacitor voltage</dt><dd data-live="vC"></dd></div>
      <div><dt>Coil voltage (pushing back)</dt><dd data-live="vL"></dd></div>
      <div><dt>Energy in the capacitor</dt><dd data-live="eC"></dd></div>
      <div><dt>Energy in the coil</dt><dd data-live="eL"></dd></div>
    </dl>
  </div>
  <div class="ct-card ct-scope">
    <h3 class="ct-h">Scope <span>newest on the right · last <b data-scope-span></b></span></h3>
    <div class="ct-legend">
      <span><i class="ct-key ct-key-dash"></i>The push from the power box</span>
      <span><i class="ct-key ct-key-lit"></i>Current through the lamp</span>
    </div>
    ${strip("C", "Back lane: capacitor")}
    ${strip("L", "Front lane: coil")}
    <div class="ct-tip" data-tip hidden></div>
  </div>
</aside>`,
    controls: `<aside class="ct-side" aria-label="Controls">
  <div class="ct-card ct-switch">
    <h3 class="ct-h">Switch <span>also on the board</span></h3>
    <button type="button" class="ct-big" data-act="switch" aria-pressed="false">Turn ON</button>
    <p class="ct-hint" data-hint="switch"></p>
  </div>
  <div class="ct-card ct-controls">
    <h3 class="ct-h">Power box <span>the keys on the box</span></h3>
    <div class="ct-row">
      <span class="ct-row-top"><span class="ct-name">How it pushes</span><output class="ct-value" data-out="mode"></output></span>
      <div class="ct-seg" role="group" aria-label="How the power box pushes">
        <button type="button" data-mode="steady">Steady</button>
        <button type="button" data-mode="slow">Slow wiggle</button>
        <button type="button" data-mode="fast">Fast wiggle</button>
      </div>
      <span class="ct-hint" data-hint="mode"></span>
    </div>
    <label class="ct-row" data-row="f">
      <span class="ct-row-top"><span class="ct-name">Wiggle speed</span><output class="ct-value" data-out="f"></output></span>
      <input type="range" data-in="f" min="0" max="1" step="0.001" value="0" aria-label="Wiggle speed">
      <span class="ct-hint">Wiggles per second in the real circuit. Also the blue knob on the box.</span>
    </label>
  </div>
  <div class="ct-card ct-drain">
    <h3 class="ct-h">Capacitor <span>the blue button by the back lane</span></h3>
    <button type="button" class="ct-btn ct-wide" data-act="drain">Empty the capacitor</button>
    <p class="ct-hint" data-hint="drain"></p>
  </div>
  <div class="ct-card ct-run">
    <h3 class="ct-h">Slow motion <span data-slowmo></span></h3>
    <p class="ct-hint ct-slowhint">Real capacitors and coils do all this in thousandths of a second, so the bench plays in slow motion.</p>
    <div class="ct-actions">
      <button type="button" class="ct-btn" data-act="pause" aria-pressed="false">Pause</button>
      <button type="button" class="ct-btn" data-act="reset">Start over</button>
    </div>
  </div>
</aside>`,
    below: `<section class="ct-panel" aria-label="Things to try and how it works">
  <div class="ct-card ct-presets">
    <h3 class="ct-h">Try this <span>each one sets up the bench and runs it</span></h3>
    <div class="ct-chips">
      <button type="button" class="ct-chip" data-preset="on"><b>1 · Switch ON</b><i>one lamp flashes and fades, the other slowly wakes up</i></button>
      <button type="button" class="ct-chip" data-preset="off"><b>2 · Switch OFF</b><i>the capacitor keeps its charge; the coil makes a spark</i></button>
      <button type="button" class="ct-chip" data-preset="empty"><b>3 · Empty it</b><i>the capacitor gives its stored energy back to its lamp</i></button>
      <button type="button" class="ct-chip" data-preset="slow"><b>4 · Slow wiggle</b><i>the coil's lamp wins</i></button>
      <button type="button" class="ct-chip" data-preset="fast"><b>5 · Fast wiggle</b><i>the capacitor's lamp wins</i></button>
    </div>
  </div>
  <div class="ct-card ct-parts">
    <h3 class="ct-h">How it works</h3>
    <article class="ct-part">
      <h4>The capacitor is a tank <code>it stores charge</code></h4>
      <p>A capacitor is two metal sheets with a thin gap between them. Current can't jump the gap, but charge can pile up on one sheet, like water filling a tank. While the tank fills, current flows and the lamp shines. When it is full, the flow stops. So a capacitor <em>lets changes through and blocks a steady push</em>.</p>
    </article>
    <article class="ct-part">
      <h4>The coil is a heavy wheel <code>it stores a magnetic field</code></h4>
      <p>A coil is a long wire wound round and round, here on an iron core. Current through it builds a magnetic field (watch the compass turn). The field is like a heavy wheel: hard to get spinning, and hard to stop once it spins. So a coil <em>blocks changes and lets a steady push through</em>.</p>
    </article>
    <article class="ct-part">
      <h4>Switching ON and OFF</h4>
      <p>ON: the capacitor's lamp flashes bright at once, then fades as the tank fills; the coil's lamp starts dark and slowly gets bright as its wheel spins up. OFF: the capacitor keeps its charge, so the gauge stays lit. The coil's current can't stop at once, so it jumps across the opening switch as a spark, hundreds of volts for a split second.</p>
    </article>
    <article class="ct-part">
      <h4>Wiggles</h4>
      <p>A wiggling push keeps changing direction. A slow wiggle is almost steady: the capacitor fills and blocks it, the coil keeps up and lets it through. A fast wiggle is all change: the capacitor never gets full, so it lets it through, and the coil's heavy wheel can't turn round fast enough, so it blocks it. The two parts are opposites.</p>
    </article>
    <article class="ct-part ct-uses">
      <h4>Where real circuits use this</h4>
      <ul>
        <li><b>Capacitor holds voltage steady.</b> Next to every chip in a phone or computer, a tiny capacitor gives a quick sip of charge when the chip suddenly needs it. Big ones smooth the bumpy power inside chargers.</li>
        <li><b>Capacitor passes wiggles, blocks steady.</b> In speakers it sends only the fast, high notes to the small tweeter. In amplifiers it passes the music and blocks the steady voltage.</li>
        <li><b>Capacitor stores a burst.</b> A camera flash fills a capacitor slowly, then dumps it all at once into the flash tube.</li>
        <li><b>Coil holds current steady.</b> Phone chargers and LED drivers switch on and off thousands of times a second; a coil keeps the current smooth between switches.</li>
        <li><b>Coil passes steady, blocks wiggles.</b> In speakers a coil sends only the slow, low notes to the big woofer. The lump on a laptop cable is a coil that blocks fast electrical noise.</li>
        <li><b>Coil's kick when switched off.</b> A car's ignition coil uses that spark on purpose to fire the spark plug. Every relay coil in a circuit has a diode beside it to soak up the kick so it can't damage anything.</li>
        <li><b>Both together.</b> A capacitor and a coil pass energy back and forth like a swing, at one special speed. Radios use this to pick a single station.</li>
      </ul>
    </article>
    <article class="ct-part ct-together">
      <h4>For grown-ups <code>i = C·dv/dt &nbsp; v = L·di/dt</code></h4>
      <p>Back lane: a ${PARTS.R} Ω lamp in series with ${PARTS.C * 1e6} µF, time constant τ = RC = ${(TAU_C * 1000).toFixed(0)} ms. Front lane: the same lamp with ${PARTS.L * 1000} mH (${PARTS.rL} Ω of wire), τ = L/R = ${(TAU_L * 1000).toFixed(1)} ms. Supply ${PARTS.V} V. Reactances X<sub>C</sub> = 1/(2πfC) and X<sub>L</sub> = 2πfL cross at about ${(1 / (2 * Math.PI * Math.sqrt(PARTS.L * PARTS.C))).toFixed(0)} Hz; "slow" is ${WIGGLE.slow} Hz and "fast" is ${WIGGLE.fast} Hz. The lamps are treated as fixed resistors that light instantly (a real filament takes a few tens of milliseconds to warm). The spark is modelled as a ${PARTS.Rarc} Ω arc. A steady push plays ${Math.round(1 / KAPPA)}× slower than real time; a wiggle is slowed until one wiggle takes about 1.5–3 s (the factor is shown live). The wiggle range is ${RANGE.f.min}–${RANGE.f.max} Hz.</p>
    </article>
  </div>
  <div class="ct-card ct-summary">
    <h3 class="ct-h">In short: slow and fast wiggles <span>one picture each</span></h3>
    <div class="ct-sum-grid">
      <article class="ct-part">
        <h4>Capacitor = a small balloon in the pipe</h4>
        <p>Current flows only while the balloon is filling up or emptying.</p>
        <ul>
          <li><b>Slow wiggle:</b> each push lasts a long time, so the balloon fills up completely and then stops the flow. Most of the time nothing moves, so the lamp is <em>dim</em>.</li>
          <li><b>Fast wiggle:</b> the push flips before the balloon gets full. Air keeps rushing in and out, so the lamp is <em>bright</em>.</li>
        </ul>
      </article>
      <article class="ct-part">
        <h4>Coil = a heavy wheel in the pipe</h4>
        <p>It's hard to speed up and hard to slow down.</p>
        <ul>
          <li><b>Slow wiggle:</b> the wheel has time to get going and turn round with each push. Current flows freely, so the lamp is <em>bright</em>.</li>
          <li><b>Fast wiggle:</b> the push flips before the heavy wheel gets moving. It barely turns, so the lamp is <em>dim</em>.</li>
        </ul>
      </article>
    </div>
    <div class="ct-sum-rule">
      <p><b>Slow wiggle → the coil's lamp wins.</b> <b>Fast wiggle → the capacitor's lamp wins.</b></p>
      <p>They're opposites because a capacitor likes change and a coil hates change. A fast wiggle is lots of change; a slow wiggle is almost no change.</p>
    </div>
  </div>
</section>`,
  };
}

export const PANEL_CSS = `
/* Medium screens: bench on the left with the monitor under it, controls pinned on the right. */
.ct-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;grid-template-areas:"fig side" "mon side";gap:0 20px;align-items:start}
.ct-fig{grid-area:fig;min-width:0}
.ct-side{grid-area:side}
.ct-monitor{grid-area:mon;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-areas:"now live" "scope live";gap:16px;margin-top:20px;align-items:start;min-width:0}
.ct-monitor .ct-scope{grid-area:scope}.ct-monitor .ct-live{grid-area:live}.ct-monitor .ct-now{grid-area:now}
.ct-now .ct-story{margin:0;min-height:0}
/* Wide screens: monitor | bench | controls, both side columns pinned while the page scrolls. */
@media (min-width:1400px){
.ct-layout{grid-template-columns:clamp(300px,21vw,350px) minmax(0,1fr) clamp(290px,20vw,330px);grid-template-areas:"mon fig side";gap:0 22px}
.ct-monitor{grid-template-columns:1fr;grid-template-areas:"now" "live" "scope";gap:12px;position:sticky;top:12px;margin-top:32px;max-height:calc(100vh - 24px);overflow-y:auto;scrollbar-width:thin}
.ct-monitor .ct-card{padding:14px 16px 14px}
.ct-monitor .ct-h{margin-bottom:12px}
.ct-monitor .ct-h span{display:block;margin:6px 0 0}
.ct-monitor .ct-legend{display:grid;gap:4px;margin-bottom:10px;font-size:11.5px}
.ct-monitor .ct-plot{height:84px}
.ct-monitor .ct-strip{margin-bottom:10px}
.ct-monitor .ct-meter{grid-template-columns:1fr 54px;row-gap:6px;margin-bottom:14px}.ct-monitor .ct-meter span{grid-column:1/-1}
.ct-monitor .ct-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px}
.ct-monitor .ct-grid dd{font-size:15px}
.ct-monitor .ct-law{font-size:11.5px;margin-top:12px}
.ct-monitor .ct-story{font-size:13px;line-height:1.58}
}
.ct-side{display:grid;gap:14px;position:sticky;top:12px;margin-top:32px;max-height:calc(100vh - 24px);overflow-y:auto;scrollbar-width:thin}
.ct-side .ct-card{padding:14px 16px 8px}
.ct-side .ct-h{margin-bottom:12px}
.ct-side .ct-row{margin-bottom:11px;gap:5px}
.ct-side .ct-hint{font-size:11.5px}
@media (max-width:1100px){.ct-layout{grid-template-columns:1fr;grid-template-areas:"fig" "side" "mon"}.ct-side{position:static;max-height:none;overflow:visible;margin-top:0;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}.ct-side .ct-card{padding:16px 18px 10px}}
.ct-panel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:20px}
.ct-card{background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-faint);padding:18px 20px 20px;min-width:0}
.ct-presets,.ct-parts{grid-column:1/-1}
.ct-h{margin:0 0 14px;font:600 11px/1 var(--anatomy-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--anatomy-strong)}
.ct-h span{margin-left:10px;color:var(--anatomy-muted);font-weight:400;letter-spacing:.04em;text-transform:none}
.ct-h b{font-weight:400;color:var(--anatomy-text)}
.ct-row{display:grid;gap:7px;margin:0 0 15px}
.ct-row-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.ct-name{color:var(--anatomy-strong);font-size:13px}
.ct-value{font:12px/1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.ct-hint{color:var(--anatomy-muted);font-size:12px;line-height:1.4;margin:0}
.ct-row[data-off]{opacity:.38;pointer-events:none}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:24px;margin:0;background:transparent;cursor:pointer;touch-action:pan-y}
input[type=range]:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:4px}
input[type=range]::-webkit-slider-runnable-track{height:2px;background:var(--anatomy-lo)}
input[type=range]::-moz-range-track{height:2px;background:var(--anatomy-lo)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-7px;border-radius:50%;background:var(--anatomy-card);border:1.5px solid var(--anatomy-hi);box-shadow:0 0 0 3px var(--anatomy-card)}
input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:var(--anatomy-card);border:1.5px solid var(--anatomy-hi)}
input[type=range]:active::-webkit-slider-thumb{background:var(--anatomy-hi)}
.ct-seg{display:grid;grid-template-columns:repeat(3,1fr);box-shadow:0 0 0 1px var(--anatomy-lo)}
.ct-seg button{font:12px/1 var(--anatomy-mono);padding:11px 4px;border:0;background:transparent;color:var(--anatomy-text);cursor:pointer}
.ct-seg button+button{box-shadow:-1px 0 0 var(--anatomy-lo)}
.ct-seg button[aria-pressed=true]{background:var(--anatomy-hi);color:var(--anatomy-card)}
.ct-seg button:focus-visible,.ct-btn:focus-visible,.ct-chip:focus-visible,.ct-big:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
.ct-big{display:block;width:100%;font:600 15px/1 var(--anatomy-mono);letter-spacing:.06em;padding:15px 12px;margin:0 0 10px;border:0;background:transparent;color:var(--anatomy-strong);box-shadow:0 0 0 1.5px var(--anatomy-hi);cursor:pointer}
.ct-big[aria-pressed=true]{background:var(--anatomy-hi);color:var(--anatomy-card)}
.ct-switch{padding-bottom:12px!important}
.ct-expect{margin:-2px 0 14px;padding:10px 12px;font-size:12.5px;line-height:1.5;color:var(--anatomy-text);box-shadow:inset 0 0 0 1px var(--anatomy-faint)}
.ct-expect b{font:600 12.5px/1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.ct-actions{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 8px}
.ct-btn{font:12px/1 var(--anatomy-mono);padding:10px 14px;border:0;background:transparent;color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-lo);cursor:pointer}
.ct-btn:hover,.ct-chip:hover,.ct-big:hover{box-shadow:0 0 0 1px var(--anatomy-mid)}
.ct-big:hover{box-shadow:0 0 0 1.5px var(--anatomy-strong)}
.ct-btn[aria-pressed=true]{background:var(--anatomy-hi);color:var(--anatomy-card)}
.ct-chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.ct-chip{display:grid;gap:5px;text-align:left;padding:11px 13px;border:0;background:transparent;color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-faint);cursor:pointer;font:inherit}
.ct-chip b{font:600 12px/1.2 var(--anatomy-mono);color:var(--anatomy-strong)}
.ct-chip i{font-style:normal;font-size:12px;line-height:1.35;color:var(--anatomy-muted)}
.ct-chip[aria-pressed=true]{box-shadow:0 0 0 1px var(--anatomy-hi)}
.ct-story{margin:14px 0 0;font-size:14px;line-height:1.62;color:var(--anatomy-text);min-height:4.8em}
.ct-scope{position:relative}
.ct-legend{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 12px;font-size:12px;color:var(--anatomy-text)}
.ct-legend span{display:inline-flex;align-items:center;gap:8px}
.ct-key{display:inline-block;width:22px;height:0;border-top:2px solid var(--anatomy-hi)}
.ct-key-dash{border-top:1.5px dashed var(--anatomy-muted)}
.ct-key-mid{border-top-color:var(--anatomy-mid)}
.ct-key-lit{border-top:2.5px solid var(--anatomy-strong)}
.ct-strip{margin:0 0 14px}
.ct-strip figcaption{margin:0 0 10px;font:600 11px/1 var(--anatomy-mono);color:var(--anatomy-text)}
.ct-plotbox{position:relative;padding-left:50px}
.ct-plot{display:block;width:100%;height:120px;overflow:visible;cursor:crosshair}
.ct-yticks{position:absolute;left:0;top:0;bottom:0;width:42px;font:10.5px/1 var(--anatomy-mono);color:var(--anatomy-muted);font-variant-numeric:tabular-nums}
.ct-yticks span{position:absolute;right:0;transform:translateY(-50%)}
.ct-grid-line{stroke:var(--anatomy-faint);stroke-width:1;vector-effect:non-scaling-stroke}
.ct-zero{stroke:var(--anatomy-lo);stroke-width:1;vector-effect:non-scaling-stroke}
.ct-tr{fill:none;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
.ct-tr-vs{stroke:var(--anatomy-muted);stroke-width:1.5;stroke-dasharray:5 4}
.ct-tr-vl{stroke:var(--anatomy-mid);stroke-width:2}
.ct-tr-i{stroke:var(--anatomy-strong);stroke-width:2.5}
.ct-tr-ok{stroke:var(--anatomy-lo);stroke-width:1;stroke-dasharray:2 4}
.ct-cross{stroke:var(--anatomy-mid);stroke-width:1;vector-effect:non-scaling-stroke;opacity:0}
.ct-tip{position:absolute;pointer-events:none;padding:8px 10px;background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-lo),0 4px 14px rgba(0,0,0,.18);font:11.5px/1.55 var(--anatomy-mono);color:var(--anatomy-text);white-space:nowrap;font-variant-numeric:tabular-nums}
.ct-tip b{color:var(--anatomy-strong);font-weight:600}
.ct-meter{display:grid;grid-template-columns:120px 1fr 70px;align-items:center;gap:12px;margin:0 0 18px;font-size:12.5px;color:var(--anatomy-text)}
.ct-meter i{display:block;height:10px;position:relative;background:var(--anatomy-faint);overflow:hidden}
.ct-meter b{position:absolute;inset:0;transform-origin:left;transform:scaleX(0);background:var(--ct-led,#e8321e)}
.ct-meter em{font:12px/1 var(--anatomy-mono);font-style:normal;text-align:right;color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.ct-meter{grid-template-columns:150px 1fr 54px;margin-bottom:10px}
.ct-meter b.ct-b-lamp{background:var(--ct-lamp)}
.ct-meter b.ct-b-full{background:var(--ct-full)}
.ct-meter b.ct-b-field{background:var(--anatomy-hi)}
.ct-grid{margin-top:14px}
.ct-wide{width:100%;padding:12px 14px;margin:0 0 10px}
.ct-btn[disabled]{opacity:.4;cursor:not-allowed}
.ct-uses{grid-column:1/-1}
.ct-slowhint{margin:-4px 0 12px}
.ct-summary{grid-column:1/-1}
.ct-sum-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 28px}
.ct-summary ul{margin:10px 0 0;padding-left:18px;display:grid;gap:8px;font-size:14px;line-height:1.6;color:var(--anatomy-text)}
.ct-summary li b{color:var(--anatomy-strong);font-weight:600}
.ct-sum-rule{margin-top:20px;padding-top:16px;border-top:1px solid var(--anatomy-faint)}
.ct-sum-rule p{margin:0 0 8px;font-size:14px;line-height:1.65;color:var(--anatomy-text)}
.ct-sum-rule b{font:600 13.5px/1.6 var(--anatomy-mono);color:var(--anatomy-strong);margin-right:14px}
@media (max-width:760px){.ct-sum-grid{grid-template-columns:1fr}}
.ct-uses ul{margin:0;padding-left:18px;display:grid;gap:8px;font-size:14px;line-height:1.6;color:var(--anatomy-text)}
.ct-uses b{color:var(--anatomy-strong);font-weight:600}
.iso[data-theme="dark"]{--ct-lamp:#ffc24a;--ct-full:#5ee08a}.iso[data-theme="light"]{--ct-lamp:#e8a020;--ct-full:#17a34a}
.ct-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:14px 18px;margin:0}
.ct-grid div{display:grid;gap:5px}
.ct-grid dt{font-size:11.5px;color:var(--anatomy-muted)}
.ct-grid dd{margin:0;font:16px/1.1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.ct-law{margin:16px 0 0;font:12.5px/1.5 var(--anatomy-mono);color:var(--anatomy-text);font-variant-numeric:tabular-nums}
.ct-parts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 28px}
.ct-parts .ct-h,.ct-together{grid-column:1/-1}
.ct-part h4{margin:0 0 8px;font:600 13px/1.3 var(--anatomy-mono);color:var(--anatomy-strong)}
.ct-part h4 code{margin-left:8px;font-weight:400;color:var(--anatomy-muted)}
.ct-part p{margin:0;font-size:14px;line-height:1.65;color:var(--anatomy-text)}
.ct-part em{font-style:normal;color:var(--anatomy-strong)}
.ct-together{padding-top:18px;border-top:1px solid var(--anatomy-faint)}
.ct-together code{font-size:12.5px}
.iso[data-theme="dark"]{--ct-led:#ff4a30}.iso[data-theme="light"]{--ct-led:#d8281a}
@media (max-width:760px){.ct-monitor{grid-template-columns:1fr;grid-template-areas:"now" "live" "scope"}.ct-panel{grid-template-columns:1fr}.ct-parts{grid-template-columns:1fr}.ct-meter{grid-template-columns:1fr 60px;row-gap:6px}.ct-meter span{grid-column:1/-1}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
`;
