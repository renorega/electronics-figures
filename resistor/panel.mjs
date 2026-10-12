// The HTML around the figure: the control panel, the live numbers and a plain-language explanation.
// The page script finds everything by data-attributes, so the markup stays plain.

export function panelHtml(M, figure) {
  const { RANGE: R, DEFAULTS: D, STANDARD } = M;
  const rIndex = STANDARD.indexOf(D.R);
  const swatches = M.COLOURS.map((name, digit) => `<li><i class="rs-sw" style="--c:var(--band-${name})"></i><b>${digit}</b><span>${name}</span></li>`).join("");
  return `
<header class="rs-head">
  <h1>How does a resistor work?</h1>
  <p>An LED needs electricity to light up, but too much burns it out. A resistor makes it harder for electricity to flow, so only the right amount gets through. Turn the knobs and watch the dots: they are the electricity.</p>
</header>
<div class="rs-layout">
  <div class="rs-fig">${figure}</div>
  <aside class="rs-side" aria-label="Control panel">
    <div class="rs-card">
      <h3 class="rs-h">Control panel</h3>
      <div class="rs-row rs-power">
        <span class="rs-name">Power supply</span>
        <button type="button" class="rs-toggle" data-act="power" aria-pressed="true"><i></i><span>On</span></button>
      </div>

      <label class="rs-row">
        <span class="rs-top"><span class="rs-name">Push <em>voltage</em></span><output class="rs-value" data-out="V"></output></span>
        <input type="range" data-in="V" min="${R.V.min}" max="${R.V.max}" step="0.1" value="${D.V}" aria-label="Supply voltage in volts">
        <span class="rs-hint">How hard the supply pushes the electricity.</span>
      </label>

      <div class="rs-row">
        <span class="rs-name">What do you want to choose?</span>
        <div class="rs-seg" role="group" aria-label="What to choose">
          <button type="button" data-mode="resistor" aria-pressed="true">The resistor</button>
          <button type="button" data-mode="current" aria-pressed="false">The current</button>
        </div>
      </div>

      <label class="rs-row" data-row="R">
        <span class="rs-top"><span class="rs-name">Resistor <em>resistance</em></span><output class="rs-value" data-out="R"></output></span>
        <input type="range" data-in="R" min="0" max="${STANDARD.length - 1}" step="1" value="${rIndex}" aria-label="Resistor size in ohms">
        <span class="rs-hint">Bigger number = harder for electricity to get through.</span>
      </label>

      <label class="rs-row" data-row="I" data-off="">
        <span class="rs-top"><span class="rs-name">Current I want <em>flow</em></span><output class="rs-value" data-out="I"></output></span>
        <input type="range" data-in="I" min="${R.I.min}" max="${R.I.max}" step="1" value="${D.Iwant}" aria-label="Wanted current in milliamps">
        <span class="rs-hint" data-hint="I">The page works out which resistor you need.</span>
      </label>

      <div class="rs-bands" aria-label="The resistor's colour stripes">
        <span class="rs-name">Its stripes</span>
        <span class="rs-chipset" data-bands></span>
      </div>

      <button type="button" class="rs-btn rs-replace" data-act="replace" hidden>Take a spare LED from the tray</button>
    </div>

    <div class="rs-card rs-now" aria-live="polite">
      <h3 class="rs-h">Right now</h3>
      <p class="rs-status" data-status></p>
      <div class="rs-meter-row"><span>LED light</span><i class="rs-bar"><b data-bar="light"></b></i></div>
      <div class="rs-meter-row" data-heat-row><span>LED heat</span><i class="rs-bar rs-bar-heat"><b data-bar="heat"></b></i></div>
    </div>
  </aside>
</div>

<section class="rs-sum rs-card" aria-label="The sum">
  <h3 class="rs-h">The sum the circuit does</h3>
  <div class="rs-eq" aria-live="off">
    <div class="rs-term"><b data-live="V"></b><span>push from the supply</span></div>
    <div class="rs-op">−</div>
    <div class="rs-term"><b data-live="vLED"></b><span>the LED keeps for itself</span></div>
    <div class="rs-op">÷</div>
    <div class="rs-term"><b data-live="R"></b><span>the resistor</span></div>
    <div class="rs-op">=</div>
    <div class="rs-term rs-ans"><b data-live="I"></b><span>current through the loop</span></div>
  </div>
  <p class="rs-note" data-live="note"></p>
</section>

<section class="rs-try rs-card" aria-label="Try this">
  <h3 class="rs-h">Try this</h3>
  <div class="rs-chips">
    <button type="button" class="rs-chip" data-preset="slow"><b>Turn it up slowly</b><i>The LED stays dark until the push reaches about 2 volts.</i></button>
    <button type="button" class="rs-chip" data-preset="right"><b>Just right</b><i>9 volts and 470 ohms: a happy, bright LED.</i></button>
    <button type="button" class="rs-chip" data-preset="big"><b>A big resistor</b><i>10,000 ohms: only a trickle gets through.</i></button>
    <button type="button" class="rs-chip" data-preset="tiny"><b>A tiny resistor</b><i>56 ohms: watch the meter and the heat bar, then the LED.</i></button>
  </div>
</section>

<section class="rs-learn" aria-label="How it works">
  <article class="rs-card">
    <h4><span class="rs-num">1</span> The push: volts</h4>
    <p>The power supply is like a water pump. It pushes electricity out of the red post, around the loop, and back into the black post. More volts means a harder push.</p>
  </article>
  <article class="rs-card">
    <h4><span class="rs-num">2</span> The squeeze: the resistor</h4>
    <p>A resistor is like a narrow, rough bit of pipe. Electricity can get through, but not easily. The bigger its resistance (in ohms, Ω), the less electricity gets through each second.</p>
  </article>
  <article class="rs-card">
    <h4><span class="rs-num">3</span> The flow: current</h4>
    <p>Current is how much electricity goes past each second. We measure it in milliamps (mA). There is only one path, so the same current goes through everything: the dots move at the same speed everywhere.</p>
  </article>
  <article class="rs-card">
    <h4><span class="rs-num">4</span> Why the LED needs a resistor</h4>
    <p>An LED does not slow the flow down much once it lights. Without a resistor, the current rushes through, the LED gets hot and burns out. The resistor keeps the current small and safe, about 10 to 20 mA. The rest of the push is turned into a little warmth in the resistor.</p>
  </article>
  <article class="rs-card rs-code">
    <h4><span class="rs-num">5</span> Reading the stripes</h4>
    <p>Resistors are too small to print numbers on, so they wear coloured stripes. Stripe 1 and stripe 2 are digits. Stripe 3 says how many zeros to add. Gold means it is within 5%.</p>
    <ul class="rs-legend">${swatches}</ul>
    <p class="rs-decode" data-live="decode"></p>
  </article>
  <article class="rs-card rs-grown">
    <h4>For grown-ups</h4>
    <p>The model is a red LED with a diode curve (about 1.75 V at 1 mA, 2.0 V at 20 mA) in series with the resistor; the page solves V = I·R + V<sub>LED</sub>(I) for I. The dots show conventional current, from + to −; the electrons in the copper drift the other way. The dots' speed is in step with the current, and their spacing never changes, because the wire is always full of charge. Burnout is simplified: a real LED over its 30 mA rating may last a little longer, but it is overheating.</p>
  </article>
</section>`;
}

export const PANEL_CSS = `
.iso{--band-black:#1d1d1d;--band-brown:#7b4a24;--band-red:#d2302a;--band-orange:#ef7d1a;--band-yellow:#f0cc20;--band-green:#2f9b48;--band-blue:#2f6fd0;--band-violet:#8a4fc4;--band-grey:#8f8f8f;--band-white:#f3f3f1;--band-gold:#c9a23a}
.rs-head{margin:0 0 6px}.rs-head h1{margin:0 0 8px;font:600 22px/1.25 var(--anatomy-mono);letter-spacing:.01em;color:var(--anatomy-strong)}
.rs-head p{margin:0;max-width:70ch;color:var(--anatomy-text);font-size:16px;line-height:1.6}
.rs-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:0 20px;align-items:start}
.rs-fig{min-width:0}
.rs-side{display:grid;gap:14px;position:sticky;top:12px;margin-top:32px}
@media (max-width:1060px){.rs-layout{grid-template-columns:1fr}.rs-side{position:static;margin-top:0;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}}
.rs-card{background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-faint);padding:16px 18px;min-width:0}
.rs-h{margin:0 0 14px;font:600 11px/1 var(--anatomy-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--anatomy-strong)}
.rs-row{display:grid;gap:6px;margin:0 0 16px}
.rs-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.rs-name{color:var(--anatomy-strong);font-size:14px;font-weight:600}
.rs-name em{font-style:normal;font-weight:400;color:var(--anatomy-muted);margin-left:6px;font-size:12px}
.rs-value{font:600 15px/1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.rs-hint{color:var(--anatomy-muted);font-size:12.5px;line-height:1.4}
.rs-row[data-off]{opacity:.4}
.rs-row[data-off] input{pointer-events:none}
.rs-power{grid-template-columns:1fr auto;align-items:center}
.rs-toggle{display:flex;align-items:center;gap:8px;padding:7px 12px 7px 8px;border:0;background:transparent;color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-lo);font:600 12px/1 var(--anatomy-mono);cursor:pointer;min-height:36px}
.rs-toggle i{width:28px;height:16px;border-radius:8px;background:var(--anatomy-faint);position:relative;transition:background .2s}
.rs-toggle i:after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--anatomy-mid);transition:transform .2s,background .2s}
.rs-toggle[aria-pressed=true] i{background:var(--rs-green)}
.rs-toggle[aria-pressed=true] i:after{transform:translateX(12px);background:#fff}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:28px;margin:0;background:transparent;cursor:pointer;touch-action:pan-y}
input[type=range]:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:4px}
input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:var(--anatomy-lo)}
input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:var(--anatomy-lo)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;margin-top:-8px;border-radius:50%;background:var(--anatomy-card);border:2px solid var(--anatomy-hi)}
input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--anatomy-card);border:2px solid var(--anatomy-hi)}
input[type=range]:active::-webkit-slider-thumb{background:var(--anatomy-hi)}
.rs-seg{display:grid;grid-template-columns:1fr 1fr;box-shadow:0 0 0 1px var(--anatomy-lo)}
.rs-seg button{font:12px/1.2 var(--anatomy-mono);padding:10px 6px;border:0;background:transparent;color:var(--anatomy-text);cursor:pointer;min-height:40px}
.rs-seg button+button{box-shadow:-1px 0 0 var(--anatomy-lo)}
.rs-seg button[aria-pressed=true]{background:var(--anatomy-hi);color:var(--anatomy-card)}
.rs-seg button:focus-visible,.rs-btn:focus-visible,.rs-chip:focus-visible,.rs-toggle:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
.rs-bands{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 0 4px;padding-top:12px;border-top:1px solid var(--anatomy-faint)}
.rs-chipset{display:flex;gap:5px}
.rs-chipset i{display:block;width:22px;height:22px;background:var(--c);box-shadow:inset 0 0 0 1px rgba(127,127,127,.45)}
.rs-chipset i:last-child{margin-left:8px}
.rs-btn{width:100%;margin-top:14px;font:600 13px/1 var(--anatomy-mono);padding:12px;border:0;background:var(--anatomy-hi);color:var(--anatomy-card);cursor:pointer}
.rs-status{margin:0 0 14px;font-size:15px;line-height:1.5;color:var(--anatomy-strong);min-height:6.5em}
.rs-status span{display:block}
/* the state badge: big, coloured, impossible to miss */
.rs-now{--st-bg:var(--anatomy-faint);--st-fg:var(--anatomy-strong);box-shadow:0 0 0 2px var(--st-bg);transition:box-shadow .3s}
.rs-now[data-state=dim]{--st-bg:#f2b632;--st-fg:#2a1d00}
.rs-now[data-state=good]{--st-bg:#1f7a36;--st-fg:#fff}
.rs-now[data-state=hot]{--st-bg:#c2410c;--st-fg:#fff}
.rs-now[data-state=burned]{--st-bg:#a51d14;--st-fg:#fff}
.rs-badge{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;margin:0 0 12px;padding:12px 14px;border-radius:6px;background:var(--st-bg);color:var(--st-fg);font:700 20px/1.15 var(--anatomy-mono);letter-spacing:.02em;text-transform:uppercase}
.rs-badge i{flex:none;width:14px;height:14px;border-radius:50%;background:currentColor;opacity:.9}
.rs-now[data-state=hot] .rs-badge{animation:rs-alarm .7s ease-in-out infinite alternate}
.rs-now[data-state=hot] .rs-badge i,.rs-now[data-state=burned] .rs-badge i{border-radius:2px;transform:rotate(45deg)}
@keyframes rs-alarm{from{background:#c2410c}to{background:#e8590c}}
@media (prefers-reduced-motion:reduce){.rs-now[data-state=hot] .rs-badge{animation:none}}
.rs-meter-row{display:grid;grid-template-columns:70px 1fr;align-items:center;gap:10px;font-size:12.5px;color:var(--anatomy-muted);margin-top:8px}
.rs-bar{display:block;height:8px;background:var(--anatomy-faint);position:relative;overflow:hidden;border-radius:4px}
.rs-bar b{position:absolute;inset:0;transform-origin:left;transform:scaleX(0);background:var(--rs-glow);border-radius:4px}
.rs-bar-heat b{background:linear-gradient(90deg,var(--band-yellow),var(--band-orange) 50%,var(--rs-red))}
.rs-sum{margin-top:20px}
.rs-eq{display:flex;flex-wrap:wrap;align-items:flex-start;gap:10px 14px}
.rs-term{display:grid;gap:6px;min-width:96px}
.rs-term b{font:600 24px/1.1 var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.rs-term span{font-size:12.5px;color:var(--anatomy-muted);line-height:1.3;max-width:15ch}
.rs-op{font:400 24px/1.1 var(--anatomy-mono);color:var(--anatomy-mid);padding-top:0}
.rs-ans b{color:var(--rs-state,var(--anatomy-strong))}
.rs-note{margin:14px 0 0;font-size:14px;line-height:1.55;color:var(--anatomy-text)}
.rs-try{margin-top:16px}
.rs-chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.rs-chip{display:grid;gap:6px;text-align:left;padding:12px 14px;border:0;background:transparent;color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-faint);cursor:pointer;font:inherit}
.rs-chip:hover{box-shadow:0 0 0 1px var(--anatomy-mid)}
.rs-chip b{font:600 13px/1.2 var(--anatomy-mono);color:var(--anatomy-strong)}
.rs-chip i{font-style:normal;font-size:13px;line-height:1.4;color:var(--anatomy-muted)}
.rs-learn{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:16px}
.rs-learn h4{margin:0 0 10px;font:600 14px/1.3 var(--anatomy-mono);color:var(--anatomy-strong);display:flex;align-items:center;gap:10px}
.rs-num{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;box-shadow:0 0 0 1px var(--anatomy-mid);font-size:12px}
.rs-learn p{margin:0;font-size:14.5px;line-height:1.62;color:var(--anatomy-text)}
.rs-code{grid-column:span 2}
@media (max-width:640px){.rs-code{grid-column:auto}}
.rs-legend{list-style:none;padding:0;margin:14px 0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.rs-legend li{display:grid;grid-template-columns:18px auto;grid-template-rows:auto auto;column-gap:7px;align-items:center;font-size:12px;color:var(--anatomy-muted)}
.rs-legend .rs-sw{grid-row:span 2;width:18px;height:28px;background:var(--c);box-shadow:inset 0 0 0 1px rgba(127,127,127,.45)}
.rs-legend b{font:600 13px/1 var(--anatomy-mono);color:var(--anatomy-strong)}
.rs-legend li[data-on] b{text-decoration:underline;text-underline-offset:3px}
.rs-decode{font:13px/1.5 var(--anatomy-mono)!important;color:var(--anatomy-strong)!important}
.rs-grown p{font-size:13px;color:var(--anatomy-muted)}
@media (max-width:640px){.rs-legend{grid-template-columns:repeat(2,minmax(0,1fr))}.rs-term{min-width:72px}.rs-term b{font-size:20px}}
`;
