// Konda Sence front page. Front end only: all readings below are simulated.

// --- Mobile nav ---
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open);
});
navLinks.querySelectorAll('a').forEach((link) =>
    link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', false);
    })
);

// --- Floating bar tightens once the page is scrolled ---
const header = document.querySelector('.site-header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// --- Highlight the menu link for the section in view ---
const sectionLinks = new Map(
    [...navLinks.querySelectorAll('a')].map((a) => [a.getAttribute('href').slice(1), a])
);
const sectionObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            sectionLinks.forEach((a, id) => a.classList.toggle('active', id === entry.target.id));
        });
    },
    { rootMargin: '-45% 0px -50% 0px' }
);
sectionLinks.forEach((_, id) => sectionObserver.observe(document.getElementById(id)));

// --- Simulated live readings on the hero diagram ---
// min/max are the HSG274 limits each reading is checked against.
const sensors = {
    cwst:   { label: 'CWST inlet',       base: 16.2, max: 20 },
    hot:    { label: 'Hot outlet',       base: 55.0, min: 50 },
    cold:   { label: 'Cold outlet',      base: 17.8, max: 20 },
    flow:   { label: 'Calorifier flow',  base: 62.1, min: 60 },
    return: { label: 'Calorifier return', base: 53.4, min: 50 },
};

for (const key in sensors) sensors[key].value = sensors[key].base;

const hubReadout = document.getElementById('hub-readout');
const appStatus = document.getElementById('app-status');
const appTitle = document.getElementById('app-status-title');
const appSub = document.getElementById('app-status-sub');

let tick = 0;

function isOutOfRange(s) {
    return (s.min !== undefined && s.value < s.min) || (s.max !== undefined && s.value > s.max);
}

function update() {
    tick++;

    for (const key in sensors) {
        const s = sensors[key];
        // Small drift around the normal value
        s.value = s.base + (Math.random() - 0.5) * 0.8;
    }

    // Every ~20 seconds, show a demo alert: the floor 3 hot outlet drops below 50°C
    const phase = tick % 10;
    if (phase >= 6) sensors.hot.value = 48.2 + Math.random() * 0.8;

    let alertSensor = null;

    for (const key in sensors) {
        const s = sensors[key];
        const warn = isOutOfRange(s);
        if (warn && !alertSensor) alertSensor = s;

        const tag = document.querySelector(`.tag[data-tag="${key}"]`);
        const dot = document.querySelector(`.sensor[data-sensor="${key}"]`);
        tag.querySelector('.tag-temp').textContent = `${s.value.toFixed(1)}°C`;
        tag.classList.toggle('warn', warn);
        dot.classList.toggle('warn', warn);
    }

    hubReadout.textContent = `${sensors.cwst.value.toFixed(1)}°C`;

    appStatus.classList.toggle('warn', Boolean(alertSensor));
    if (alertSensor) {
        appTitle.textContent = `⚠ ${alertSensor.label}`;
        appSub.textContent = `${alertSensor.value.toFixed(1)}°C · min ${alertSensor.min}°C`;
    } else {
        appTitle.textContent = '✓ All compliant';
        appSub.textContent = '5 nodes · live';
    }
}

update();
setInterval(update, 2000);

// --- Insight charts ---
// Simulated data from a seeded generator, so the charts look the same on every load.
function seeded(seed) {
    return () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
}
function svgText(parent, x, y, text, cls, anchor = 'start') {
    const t = svgEl('text', { x, y, class: cls, 'text-anchor': anchor }, parent);
    t.textContent = text;
    return t;
}
const linePath = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

const DAY = 86400000;
const fmtDay = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtWeekday = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const today = new Date();
today.setHours(0, 0, 0, 0);

// A shared tooltip for a chart container
function makeTip(container) {
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    const strong = document.createElement('strong');
    const sub = document.createElement('span');
    tip.append(strong, sub);
    container.appendChild(tip);
    return {
        show(x, y, value, label) {
            strong.textContent = value;
            sub.textContent = label;
            const w = container.clientWidth;
            const half = tip.offsetWidth / 2;
            tip.style.left = `${Math.min(Math.max(x, half), w - half)}px`;
            tip.style.top = `${y}px`;
            tip.classList.add('show');
        },
        hide() { tip.classList.remove('show'); },
    };
}

// Crosshair hover for a line chart. points: [{ x, y, value, label }] in SVG units.
function addCrosshair(svg, container, plot, points, W) {
    const tip = makeTip(container);
    const cross = svgEl('line', { class: 'crosshair', y1: plot.top, y2: plot.bottom, visibility: 'hidden' }, svg);
    const dot = svgEl('circle', { class: 'hover-dot', r: 4.5, visibility: 'hidden' }, svg);
    const hit = svgEl('rect', { class: 'hit', x: plot.left, y: plot.top, width: plot.right - plot.left, height: plot.bottom - plot.top, tabindex: 0 }, svg);

    let focusIndex = points.length - 1;
    const show = (p) => {
        cross.setAttribute('x1', p.x);
        cross.setAttribute('x2', p.x);
        dot.setAttribute('cx', p.x);
        dot.setAttribute('cy', p.y);
        dot.style.fill = p.color || '';
        cross.setAttribute('visibility', 'visible');
        dot.setAttribute('visibility', 'visible');
        const k = container.clientWidth / W;
        tip.show(p.x * k, p.y * k, p.value, p.label);
    };
    const hide = () => {
        cross.setAttribute('visibility', 'hidden');
        dot.setAttribute('visibility', 'hidden');
        tip.hide();
    };
    const nearest = (sx) => points.reduce((best, p) => (Math.abs(p.x - sx) < Math.abs(best.x - sx) ? p : best));

    hit.addEventListener('pointermove', (e) => {
        const r = svg.getBoundingClientRect();
        show(nearest(((e.clientX - r.left) / r.width) * W));
    });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', () => show(points[focusIndex]));
    hit.addEventListener('blur', hide);
    hit.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        focusIndex = Math.min(points.length - 1, Math.max(0, focusIndex + (e.key === 'ArrowRight' ? 1 : -1)));
        show(points[focusIndex]);
    });
}

function drawYGrid(svg, plot, y, ticks, unit = '°') {
    const grid = svgEl('g', { class: 'grid' }, svg);
    const axis = svgEl('g', { class: 'axis' }, svg);
    ticks.forEach((t) => {
        svgEl('line', { x1: plot.left, x2: plot.right, y1: y(t), y2: y(t) }, grid);
        svgText(axis, plot.left - 8, y(t) + 3.5, `${t}${unit}`, '', 'end');
    });
    return axis;
}

// Callout box with a leader line to (tx, ty)
function drawCallout(svg, { x, y, w, title, sub, tx, ty, icon }) {
    const g = svgEl('g', { class: 'callout' }, svg);
    svgEl('line', { x1: tx, y1: ty, x2: Math.min(Math.max(tx, x + 10), x + w - 10), y2: y + 44, stroke: '#B9B5CC', 'stroke-width': 1 }, g);
    svgEl('rect', { x, y, width: w, height: 44, rx: 8 }, g);
    let tx0 = x + 12;
    if (icon) {
        svgEl('circle', { class: 'icon', cx: x + 19, cy: y + 22, r: 8 }, g);
        svgText(g, x + 19, y + 25.5, '!', 'icon-text', 'middle');
        tx0 = x + 34;
    }
    svgText(g, tx0, y + 19, title, 'title');
    svgText(g, tx0, y + 33, sub, 'sub');
}

function drawTrendChart(container) {
    // Draw at the card's real width (up to 600) so labels stay readable on phones
    const W = Math.max(320, Math.min(600, container.clientWidth)), H = 290;
    const plot = { left: 40, right: W - 12, top: 14, bottom: H - 30 };
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' }, container);
    const rand = seeded(7);

    // Daily average return temperature: a slow decline with day-to-day noise
    const days = [];
    for (let d = -29; d <= 0; d++) {
        days.push({ d, v: 51.9 - 0.155 * d + (rand() - 0.5) * 0.7 + Math.sin(d / 2.3) * 0.18 });
    }
    // Least-squares fit, projected forward to the 50°C limit
    const n = days.length;
    const mx = days.reduce((s, p) => s + p.d, 0) / n;
    const my = days.reduce((s, p) => s + p.v, 0) / n;
    const slope = days.reduce((s, p) => s + (p.d - mx) * (p.v - my), 0) / days.reduce((s, p) => s + (p.d - mx) ** 2, 0);
    const fit = (d) => my + slope * (d - mx);
    const crossDay = (50 - my) / slope + mx;

    const x = scale(-29, 15, plot.left, plot.right);
    const y = scale(47, 59, plot.bottom, plot.top);

    // Risk zone below 50°C
    svgEl('rect', { class: 'risk-zone', x: plot.left, y: y(50), width: plot.right - plot.left, height: plot.bottom - y(50) }, svg);
    const axis = drawYGrid(svg, plot, y, [48, 50, 52, 54, 56, 58]);
    [-28, -21, -14, -7, 0, 7, 14].forEach((d) => {
        svgText(axis, x(d), H - 10, d === 0 ? 'Today' : fmtDay(new Date(today.getTime() + d * DAY)), '', 'middle');
    });
    svgEl('line', { class: 'limit', x1: plot.left, x2: plot.right, y1: y(50), y2: y(50) }, svg);
    svgText(svg, plot.left + 8, y(50) + 16, 'Below 50°C: legionella growth risk', 'label');
    svgEl('line', { class: 'today', x1: x(0), x2: x(0), y1: 76, y2: plot.bottom }, svg);

    const pts = days.map((p) => [x(p.d), y(p.v)]);
    svgEl('path', { class: 'series-area', d: `${linePath(pts)}L${x(0)} ${y(50)}L${x(-29)} ${y(50)}Z` }, svg);
    svgEl('path', { class: 'projection', d: linePath([[x(0), y(fit(0))], [x(crossDay), y(50)]]) }, svg);
    svgEl('path', { class: 'series', d: linePath(pts) }, svg);

    const last = days[n - 1];
    svgEl('circle', { class: 'marker teal', cx: x(0), cy: y(last.v), r: 4.5 }, svg);
    svgText(svg, x(0) - 8, y(last.v) - 10, `${last.v.toFixed(1)}°C`, 'label strong', 'end');
    svgEl('circle', { class: 'marker warn', cx: x(crossDay), cy: y(50), r: 5 }, svg);

    const daysLeft = Math.round(crossDay);
    drawCallout(svg, {
        x: W - 232, y: 26, w: 218,
        title: `Forecast: below 50°C in ~${daysLeft} days`,
        sub: 'Time to book a calorifier service',
        tx: x(crossDay), ty: y(50) - 6, icon: true,
    });

    const hover = days.map((p) => ({
        x: x(p.d), y: y(p.v), value: `${p.v.toFixed(1)}°C`,
        label: `${p.d === 0 ? 'Today' : fmtWeekday(new Date(today.getTime() + p.d * DAY))} · daily average`,
    }));
    for (let d = 1; d <= Math.floor(crossDay); d++) {
        hover.push({ x: x(d), y: y(fit(d)), value: `${fit(d).toFixed(1)}°C`, label: `${fmtWeekday(new Date(today.getTime() + d * DAY))} · projected` });
    }
    addCrosshair(svg, container, plot, hover, W);
}

function drawAnomalyChart(container) {
    // Draw at the card's real width (up to 600) so labels stay readable on phones
    const W = Math.max(320, Math.min(600, container.clientWidth)), H = 290;
    const plot = { left: 40, right: W - 12, top: 14, bottom: H - 30 };
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' }, container);
    const rand = seeded(21);

    // Three full days ending yesterday, sampled every 15 minutes.
    // Each tap use heats the pipe to its peak, then it cools back towards room temperature.
    const start = today.getTime() - 3 * DAY;
    const ambient = 22, tau = 50, usualPeak = 56, anomalyPeak = 51.4;
    const anomalyFrom = 2 * 1440 + 12 * 60; // day 3, from midday
    const uses = [];
    for (let day = 0; day < 3; day++) {
        [7.5, 9, 10.75, 12.5, 14, 15.5, 17.25, 19].forEach((h) => {
            const t = day * 1440 + Math.round((h * 60 + (rand() - 0.5) * 30) / 15) * 15;
            const peak = t >= anomalyFrom ? anomalyPeak + (rand() - 0.5) * 0.6 : usualPeak + (rand() - 0.5) * 1.2;
            uses.push({ t, peak });
        });
    }
    const tempAt = (t, peakOf) => uses.reduce((v, u) => (t < u.t ? v : Math.max(v, ambient + (peakOf(u) - ambient) * Math.exp(-(t - u.t) / tau))), ambient);

    const samples = [];
    for (let t = 0; t <= 3 * 1440; t += 15) {
        samples.push({ t, v: tempAt(t, (u) => u.peak) + (rand() - 0.5) * 0.3, usual: tempAt(t, () => usualPeak) });
    }

    const x = scale(0, 3 * 1440, plot.left, plot.right);
    const y = scale(15, 70, plot.bottom, plot.top);

    const axis = drawYGrid(svg, plot, y, [20, 30, 40, 50, 60]);
    for (let day = 0; day < 3; day++) {
        const date = new Date(start + day * DAY);
        svgText(axis, x(day * 1440 + 720), H - 10, date.toLocaleDateString('en-GB', { weekday: 'long' }), '', 'middle');
        if (day) svgEl('line', { class: 'today', x1: x(day * 1440), x2: x(day * 1440), y1: plot.top, y2: plot.bottom, opacity: .4 }, svg);
    }

    // Usual range band, learned from previous weeks
    const upper = samples.map((s) => [x(s.t), y(s.usual + 2)]);
    const lower = samples.map((s) => [x(s.t), y(Math.max(ambient - 1.5, s.usual - 3.5))]).reverse();
    svgEl('path', { class: 'band', d: `${linePath(upper)}${linePath(lower).replace('M', 'L')}Z` }, svg);
    svgEl('line', { class: 'limit', x1: plot.left, x2: plot.right, y1: y(50), y2: y(50), opacity: .6 }, svg);
    svgText(svg, plot.left + 6, y(50) - 6, '50°C limit', 'label');

    svgEl('path', { class: 'series', d: linePath(samples.map((s) => [x(s.t), y(s.v)])) }, svg);

    const anomalies = uses.filter((u) => u.t >= anomalyFrom);
    anomalies.forEach((u) => {
        svgEl('circle', { class: 'marker warn', cx: x(u.t), cy: y(u.peak), r: 5 }, svg);
    });
    const first = anomalies[0];
    const firstAt = new Date(start + first.t * 60000);
    const alertAt = new Date(firstAt.getTime() + 2 * 60000);
    drawCallout(svg, {
        x: W - 262, y: 2, w: 258,
        title: `Anomaly · ${firstAt.toLocaleDateString('en-GB', { weekday: 'short' })} ${fmtTime(firstAt)}`,
        sub: `Peaked at ${first.peak.toFixed(1)}°C, usually ${usualPeak}°C · alert sent ${fmtTime(alertAt)}`,
        tx: x(first.t), ty: y(first.peak) - 7, icon: true,
    });

    const anomalyTimes = new Set(anomalies.map((u) => u.t));
    addCrosshair(svg, container, plot, samples.map((s) => {
        const at = new Date(start + s.t * 60000);
        const flagged = anomalyTimes.has(s.t);
        return {
            x: x(s.t), y: y(s.v), value: `${s.v.toFixed(1)}°C`,
            label: `${fmtWeekday(at)} ${fmtTime(at)} · ${flagged ? 'anomaly' : `usual ${Math.round(s.usual - 3.5)}–${Math.round(s.usual + 2)}°C`}`,
            color: flagged ? 'var(--anomaly)' : '',
        };
    }), W);
}

// --- Little-used outlets: usage grid ---
const DAYS_SHOWN = 28;
const FLUSH_AFTER_DAYS = 7;
const weekday = (i) => new Date(today.getTime() - (DAYS_SHOWN - 1 - i) * DAY).getDay();
const isWeekday = (i) => weekday(i) > 0 && weekday(i) < 6;

const outlets = [
    { name: 'Kitchen sink', where: 'Ground floor', used: (i) => i % 9 !== 4 },
    { name: 'Staff WC basin', where: 'Ground floor', used: isWeekday },
    { name: 'Reception WC basin', where: 'Ground floor', used: (i) => isWeekday(i) && i % 6 !== 2 },
    { name: 'Shower room 2', where: 'Floor 1', used: (i) => i % 3 === 0 || i % 5 === 1 },
    { name: 'Accessible WC basin', where: 'Floor 1', used: (i) => i <= 11 && i % 4 === 1 },
    { name: "Cleaner's sink", where: 'Floor 2', used: (i) => i <= 18 && weekday(i) === 1 },
    { name: 'Tea point', where: 'Floor 2', used: (i) => isWeekday(i) && i % 7 !== 3 },
    { name: 'Guest shower 4', where: 'Floor 3', used: () => false },
    { name: 'Basin 3, hot outlet', where: 'Floor 3', used: isWeekday },
    { name: 'Hand basin', where: 'Plant room', used: (i) => i === 3 || i === 20 },
];

function drawUsageGrid(container) {
    const tip = makeTip(container);

    outlets.forEach((o) => {
        const days = Array.from({ length: DAYS_SHOWN }, (_, i) => o.used(i));
        const lastUsed = days.lastIndexOf(true);
        const idle = lastUsed === -1 ? null : DAYS_SHOWN - 1 - lastUsed;
        const needsFlush = idle === null || idle >= FLUSH_AFTER_DAYS;

        const row = document.createElement('div');
        row.className = `usage-row${needsFlush ? ' needs-flush' : ''}`;
        row.setAttribute('role', 'row');

        const name = document.createElement('div');
        name.className = 'usage-name';
        name.setAttribute('role', 'rowheader');
        name.textContent = o.name;
        const where = document.createElement('small');
        where.textContent = o.where;
        name.appendChild(where);

        const cells = document.createElement('div');
        cells.className = 'usage-cells';
        cells.setAttribute('role', 'cell');
        cells.setAttribute('aria-label', `Used on ${days.filter(Boolean).length} of the last ${DAYS_SHOWN} days`);
        days.forEach((used, i) => {
            const cell = document.createElement('span');
            cell.className = `cell${used ? ' used' : ''}`;
            cell.addEventListener('pointerenter', () => {
                const date = new Date(today.getTime() - (DAYS_SHOWN - 1 - i) * DAY);
                const cr = cell.getBoundingClientRect();
                const pr = container.getBoundingClientRect();
                tip.show(cr.left - pr.left + cr.width / 2, cr.top - pr.top, used ? 'Flow detected' : 'No flow', `${o.name} · ${fmtWeekday(date)}`);
            });
            cell.addEventListener('pointerleave', tip.hide);
            cells.appendChild(cell);
        });

        const status = document.createElement('div');
        status.className = 'usage-status';
        status.setAttribute('role', 'cell');
        const ago = document.createElement('span');
        ago.className = 'ago';
        ago.textContent = idle === null ? '28+ days' : idle === 0 ? 'Today' : `${idle}d ago`;
        const badge = document.createElement('span');
        badge.className = `badge ${needsFlush ? 'flush' : 'ok'}`;
        badge.textContent = needsFlush ? '⚑ Flush' : '✓ In use';
        status.append(ago, badge);

        row.append(name, cells, status);
        container.appendChild(row);
    });

    const axis = document.createElement('div');
    axis.className = 'usage-row usage-axis';
    axis.setAttribute('aria-hidden', 'true');
    axis.innerHTML = '<span></span><div class="usage-cells"><span>28 days ago</span><span>Today</span></div><span class="usage-status">Last used</span>';
    container.appendChild(axis);
}

// --- Little-used outlets: savings calculator ---
const MINUTES_PER_FLUSH = 3;
const COST_PER_HOUR = 15;
const LITRES_PER_FLUSH = 12;
const HOURS_PER_FTE = 1650;

const inOutlets = document.getElementById('in-outlets');
const inShare = document.getElementById('in-share');
const num = (v) => Math.round(v).toLocaleString('en-GB');
const compact = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}k` : num(v));

function updateCalc() {
    const total = Number(inOutlets.value);
    const share = Number(inShare.value) / 100;
    const toFlush = Math.round(total * share);
    const hoursAll = (total * 52 * MINUTES_PER_FLUSH) / 60;
    const hoursKonda = (toFlush * 52 * MINUTES_PER_FLUSH) / 60;
    const saved = hoursAll - hoursKonda;
    const litres = (total - toFlush) * 52 * LITRES_PER_FLUSH;

    [inOutlets, inShare].forEach((el) => el.style.setProperty('--fill', `${((el.value - el.min) / (el.max - el.min)) * 100}%`));
    document.getElementById('out-outlets').textContent = num(total);
    document.getElementById('out-share').textContent = `${inShare.value}%`;
    document.getElementById('bar-all').style.width = '100%';
    document.getElementById('bar-konda').style.width = `${(hoursKonda / hoursAll) * 100}%`;
    document.getElementById('val-all').textContent = `${num(hoursAll)} h/yr`;
    document.getElementById('val-konda').textContent = `${num(hoursKonda)} h/yr`;
    document.getElementById('t-hours').textContent = `${num(saved)} h`;
    document.getElementById('t-fte').textContent = `≈ ${(saved / HOURS_PER_FTE).toFixed(1)} full-time staff`;
    document.getElementById('t-money').textContent = `£${compact(saved * COST_PER_HOUR)}`;
    document.getElementById('t-water').textContent = `${compact(litres)} L`;
    document.getElementById('t-water-sub').textContent = `≈ ${num(litres / 80)} baths a year`;
}

drawTrendChart(document.getElementById('trend-chart'));
drawAnomalyChart(document.getElementById('anomaly-chart'));
drawUsageGrid(document.getElementById('usage-grid'));
inOutlets.addEventListener('input', updateCalc);
inShare.addEventListener('input', updateCalc);
updateCalc();

// --- Hardware: hotspots and cards highlight each other ---
document.querySelectorAll('#hardware [data-hw]').forEach((el) => {
    const pair = document.querySelectorAll(`#hardware [data-hw="${el.dataset.hw}"]`);
    el.addEventListener('pointerenter', () => pair.forEach((p) => p.classList.add('active')));
    el.addEventListener('pointerleave', () => pair.forEach((p) => p.classList.remove('active')));
});

// --- Demo form: posts to the shared konda-enquiries relay, which writes to Airtable ---
const ENQUIRY_ENDPOINT = 'https://konda-enquiries.daniel-10c.workers.dev';
const ENQUIRY_TYPE = 'Remote Monitoring';

const form = document.getElementById('demo-form');
const note = document.getElementById('form-note');
const submitBtn = form.querySelector('button[type="submit"]');

const formatPostcode = (value) => {
    const pc = value.toUpperCase().replace(/\s+/g, '');
    return pc.length > 3 ? `${pc.slice(0, -3)} ${pc.slice(-3)}` : pc;
};

const setNote = (text, isError) => {
    note.textContent = text;
    note.classList.toggle('error', Boolean(isError));
};

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let valid = true;
    form.querySelectorAll('[required]').forEach((field) => {
        const ok = field.value.trim() !== '' && field.checkValidity();
        field.classList.toggle('invalid', !ok);
        if (!ok) valid = false;
    });

    if (!valid) {
        setNote('Please add your name, a valid email, your phone number and a UK postcode.', true);
        return;
    }

    const f = form.elements;
    const company = f.company.value.trim();
    const details = [
        company && `Company: ${company}`,
        `Number of sites: ${f.sites.value}`,
    ].filter(Boolean).join('\n');
    const message = f.message.value.trim();

    const payload = {
        name: f.name.value.trim().slice(0, 120),
        email: f.email.value.trim().slice(0, 200),
        phone: f.phone.value.trim().slice(0, 40),
        postcode: formatPostcode(f.postcode.value).slice(0, 12),
        message: `Demo request\n${details}${message ? `\n\n${message}` : ''}`.slice(0, 5000),
        enquiryType: ENQUIRY_TYPE,
        company_website: f.company_website.value,
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    setNote('');

    try {
        const res = await fetch(ENQUIRY_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const firstName = payload.name.split(' ')[0];
        setNote(`Thanks ${firstName}! We'll be in touch shortly to arrange your demo.`);
        form.reset();
    } catch (err) {
        setNote("Sorry, that didn't send. Please check your connection and try again in a moment.", true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Request a demo';
    }
});

document.getElementById('year').textContent = new Date().getFullYear();
