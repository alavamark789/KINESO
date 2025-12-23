/**
 * resources/js/kinematics.js
 * KINESO — Kinematics demo client-side module
 *
 * Contains functions to compute kinematic trajectories for constant acceleration,
 * render interactive charts (Chart.js) and a data table, and support dragging
 * chart points to update the dataset and keep charts and table in sync.
 *
 * Key helper functions:
 * - computeKinematics(x0, v0, a, t0, t1, dt)
 * - computeVFromX(xs, dt), computeAFromX(xs, dt), computeAFromV(vs, dt)
 * - integrateVToX(vs, x0, dt), integrateAToV(as, v0, dt)
 * - makeLineChart(ctx, datasets, labels, options)
 *
 * The module uses Chart.js and optionally chartjs-plugin-dragdata (loaded dynamically).
 * This file is annotated with JSDoc for better IDE support and documentation generation.
 */

import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend } from 'chart.js';
// Register only the components we need to avoid issues with multiple Chart copies
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend);

// Try to load chartjs drag plugin dynamically (non-fatal). If it fails we'll still proceed and surface the message.
// dragPluginLoaded will be true if successful.
let dragPluginLoaded = false;
import('chartjs-plugin-dragdata').then(mod => {
    try {
        Chart.register(mod && (mod.default || mod));
        dragPluginLoaded = true;
        if (typeof pageLog === 'function') pageLog('Drag plugin loaded');
    } catch (err) {
        console.warn('Failed to register drag plugin:', err);
        if (typeof pageLog === 'function') pageLog('Drag plugin registration failed: ' + (err && err.message ? err.message : String(err)));
    }
}).catch(err => {
    console.warn('Drag plugin import failed:', err);
    if (typeof pageLog === 'function') pageLog('Drag plugin import failed: ' + (err && err.message ? err.message : String(err)));
});

// --- kinematics helpers ---
/**
 * Compute kinematic trajectories (x, v, a) for constant acceleration.
 * @param {number} x0 - initial position (m)
 * @param {number} v0 - initial velocity (m/s)
 * @param {number} a - constant acceleration (m/s^2)
 * @param {number} t0 - start time (s)
 * @param {number} t1 - end time (s)
 * @param {number} dt - time step (s)
 * @param {number} [maxPoints=1000] - limit points to avoid huge arrays
 * @returns {{times:number[], xs:number[], vs:number[], as:number[]}} computed arrays
 */
function computeKinematics(x0, v0, a, t0, t1, dt, maxPoints = 1000) {
    const times = [];
    const xs = [];
    const vs = [];
    const as = [];

    if (dt <= 0) return { times, xs, vs, as };

    for (let t = t0; t <= t1 + 1e-12; t += dt) {
        const x = x0 + v0 * t + 0.5 * a * t * t;
        const v = v0 + a * t;
        times.push(Number(t.toFixed(8)));
        xs.push(Number(x.toFixed(8)));
        vs.push(Number(v.toFixed(8)));
        as.push(Number(a.toFixed(8)));
        if (times.length >= maxPoints) break;
    }
    return { times, xs, vs, as };
}

/**
 * Estimate velocity from position using central differences.
 * Boundary points use forward/backward differences.
 * @param {number[]} xs - position samples
 * @param {number} dt - time step
 * @returns {number[]} velocity estimates
 */
function computeVFromX(xs, dt) {
    const n = xs.length;
    const vs = new Array(n);
    for (let i = 0; i < n; i++) {
        if (i === 0) vs[i] = (xs[1] - xs[0]) / dt;
        else if (i === n - 1) vs[i] = (xs[n - 1] - xs[n - 2]) / dt;
        else vs[i] = (xs[i + 1] - xs[i - 1]) / (2 * dt);
    }
    return vs;
}

/**
 * Estimate acceleration from position using second differences.
 * @param {number[]} xs - position samples
 * @param {number} dt - time step
 * @returns {number[]} acceleration estimates
 */
function computeAFromX(xs, dt) {
    const n = xs.length;
    const as = new Array(n);
    for (let i = 0; i < n; i++) {
        if (i === 0) as[i] = (xs[2] - 2 * xs[1] + xs[0]) / (dt * dt);
        else if (i === n - 1) as[i] = (xs[n - 1] - 2 * xs[n - 2] + xs[n - 3]) / (dt * dt);
        else as[i] = (xs[i + 1] - 2 * xs[i] + xs[i - 1]) / (dt * dt);
    }
    return as;
}

/**
 * Estimate acceleration from velocity using finite differences.
 * @param {number[]} vs - velocity samples
 * @param {number} dt - time step
 * @returns {number[]} acceleration estimates
 */
function computeAFromV(vs, dt) {
    const n = vs.length;
    const as = new Array(n);
    for (let i = 0; i < n; i++) {
        if (i === 0) as[i] = (vs[1] - vs[0]) / dt;
        else if (i === n - 1) as[i] = (vs[n - 1] - vs[n - 2]) / dt;
        else as[i] = (vs[i + 1] - vs[i - 1]) / (2 * dt);
    }
    return as;
}

/**
 * Integrate velocity to produce position using trapezoidal rule.
 * @param {number[]} vs - velocity samples
 * @param {number} x0 - initial position
 * @param {number} dt - time step
 * @returns {number[]} integrated positions
 */
function integrateVToX(vs, x0, dt) {
    const n = vs.length;
    const xs = new Array(n);
    xs[0] = x0;
    for (let k = 1; k < n; k++) {
        xs[k] = xs[k - 1] + 0.5 * (vs[k - 1] + vs[k]) * dt;
    }
    return xs;
}

/**
 * Integrate acceleration to produce velocity using simple Euler integration.
 * @param {number[]} as - acceleration samples
 * @param {number} v0 - initial velocity
 * @param {number} dt - time step
 * @returns {number[]} integrated velocities
 */
function integrateAToV(as, v0, dt) {
    const n = as.length;
    const vs = new Array(n);
    vs[0] = v0;
    for (let k = 1; k < n; k++) {
        vs[k] = vs[k - 1] + as[k - 1] * dt;
    }
    return vs;
}

/**
 * Render the data rows into the provided tbody element.
 * @param {HTMLTableSectionElement} tbody - table body element to populate
 * @param {number[]} times
 * @param {number[]} xs
 * @param {number[]} vs
 * @param {number[]} as
 */
function renderTable(tbody, times, xs, vs, as) { 
    tbody.innerHTML = '';
    for (let i = 0; i < times.length; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="padding:6px 8px">${times[i].toFixed(3)}</td><td style="padding:6px 8px; text-align:right">${vs[i].toFixed(3)}</td><td style="padding:6px 8px; text-align:right">${xs[i].toFixed(3)}</td>`;
        tbody.appendChild(tr);
    }
}

/**
 * Convert arrays to CSV string suitable for download.
 * @param {number[]} times
 * @param {number[]} xs
 * @param {number[]} vs
 * @param {number[]} as
 * @returns {string} CSV content
 */
function csvFromData(times, xs, vs, as) { 
    const lines = [['t (s)', 'x (m)', 'v (m/s)', 'a (m/s^2)']];
    for (let i = 0; i < times.length; i++) lines.push([times[i].toFixed(6), xs[i].toFixed(6), vs[i].toFixed(6), as[i].toFixed(6)]);
    return lines.map(r => r.join(',')).join('\n');
}

/**
 * Trigger download of a text file using a temporary blob link.
 * @param {string} filename
 * @param {string} text
 */
function downloadText(filename, text) { 
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/**
 * Download a Chart.js chart as a PNG image (base64 export).
 * @param {Chart} chart - Chart.js instance
 * @param {string} filename - suggested filename
 */
function downloadChartImage(chart, filename) { 
    const a = document.createElement('a');
    a.href = chart.toBase64Image(); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}

const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'top', labels: { boxWidth: 14, padding: 12, usePointStyle: true, pointStyle: 'rectRounded', color: '#22303f', font: { size: 12 } } },
        tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(15,23,36,0.95)', titleColor: '#fff', bodyColor: '#fff', padding: 10 },
    },
    layout: { padding: { top: 6, right: 6, bottom: 6, left: 6 } },
    elements: { line: { borderWidth: 3, tension: 0.3 }, point: { radius: 2, hoverRadius: 5 } },
    scales: {
        x: { title: { display: true, text: 't (s)', color: '#263238', font: { size: 12 } }, grid: { color: 'rgba(8,12,24,0.06)' }, ticks: { color: '#3b4a59', maxRotation: 0 } },
        y: { title: { display: false }, grid: { color: 'rgba(8,12,24,0.06)', borderDash: [4,4] }, ticks: { color: '#3b4a59' } }
    }
};

/**
 * Create a new Chart.js line chart with safe lifecycle handling.
 * Ensures any existing Chart on the canvas is destroyed first.
 * @param {CanvasRenderingContext2D|HTMLCanvasElement|string} ctx - canvas context or element or id
 * @param {Array<Object>} datasets - Chart.js dataset configurations
 * @param {Array<number|string>} labels
 * @param {Object} [options={}] Chart.js configuration overrides
 * @returns {Chart} created Chart.js instance
 */
function makeLineChart(ctx, datasets, labels, options = {}) { 
    const cfg = Object.assign({}, baseChartOptions, options);
    // Ensure we're creating a line chart (explicit controller)
    cfg.type = cfg.type || 'line';
    // Ensure each dataset has a type to avoid controller lookup issues
    cfg.data = { labels, datasets: datasets.map(ds => Object.assign({ type: 'line' }, ds)) };

    // If a Chart already exists on this canvas, destroy it first to prevent "canvas already in use" errors
    try {
        let canvas = ctx && ctx.canvas ? ctx.canvas : ctx;
        if (typeof canvas === 'string') canvas = document.getElementById(canvas);
        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();
    } catch (e) { console.warn('makeLineChart destroy existing error', e); }

    return new Chart(ctx, cfg);
}

/**
 * Create a debounced version of a function.
 * @template T
 * @param {(...args: T[]) => void} fn
 * @param {number} [wait=250]
 * @returns {(...args: T[]) => void}
 */
function debounce(fn, wait = 250) { 
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

let smallPosChart = null, smallVelChart = null, smallAccChart = null, mainChart = null;

/**
 * Destroy a Chart instance if one exists on the canvas/context provided.
 * @param {CanvasRenderingContext2D|HTMLCanvasElement|string} ctxOrCanvas
 */
function destroyChartIfExists(ctxOrCanvas) { 
    try {
        let canvas = ctxOrCanvas && ctxOrCanvas.canvas ? ctxOrCanvas.canvas : ctxOrCanvas;
        if (typeof canvas === 'string') canvas = document.getElementById(canvas);
        if (!canvas) return;
        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();
    } catch (e) { console.warn('destroyChartIfExists error', e); }
}

/**
 * Append a timestamped message to the debug panel (if present) and the console.
 * @param {string} msg
 */
function pageLog(msg) { 
    try {
        console.log(msg);
        const el = document.getElementById('uiDebug');
        if (!el) return;
        const p = document.createElement('div');
        p.innerText = (new Date()).toLocaleTimeString() + ' - ' + String(msg);
        el.appendChild(p);
        // keep scroll at bottom
        el.scrollTop = el.scrollHeight;
    } catch (e) { console.log('pageLog error', e); }
}

// Global error / rejection handlers — show messages in UI to aid debugging
window.addEventListener('error', (e) => {
    try {
        console.error('Unhandled error:', e.error || e);
        const el = document.getElementById && document.getElementById('chartError');
        if (el) { el.style.display = 'block'; el.innerText = 'Unhandled JS error: ' + (e.error && e.error.message ? e.error.message : String(e.message || e)); }
        if (typeof pageLog === 'function') pageLog('Unhandled error: ' + (e.error && e.error.message ? e.error.message : String(e.message || e)));
    } catch (err) { console.warn('Error in global error handler:', err); }
});

window.addEventListener('unhandledrejection', (e) => {
    try {
        console.error('Unhandled promise rejection:', e.reason);
        const el = document.getElementById && document.getElementById('chartError');
        if (el) { el.style.display = 'block'; el.innerText = 'Unhandled promise rejection: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)); }
        if (typeof pageLog === 'function') pageLog('Unhandled rejection: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
    } catch (err) { console.warn('Error in rejection handler:', err); }
});

function updateReadoutElements(t, x, v, a) {
    const el = (id) => document.getElementById(id);
    el('ro-t').innerText = typeof t === 'number' ? t.toFixed(3) : '-';
    el('ro-x').innerText = typeof x === 'number' ? x.toFixed(3) : '-';
    el('ro-v').innerText = typeof v === 'number' ? v.toFixed(3) : '-';
    el('ro-a').innerText = typeof a === 'number' ? a.toFixed(3) : '-';
}

/**
 * Apply a drag update to the shared state and recompute derived arrays.
 * - If position changed: recompute velocity and acceleration from positions
 * - If velocity changed: integrate to get new positions and recompute acceleration
 * - If acceleration changed: integrate to velocities and positions
 * @param {'position'|'velocity'|'acceleration'} chartType
 * @param {number} index - data index changed
 * @param {number} newValue - new numeric value after drag
 * @param {{times:number[], xs:number[], vs:number[], as:number[], x0:number, v0:number, dt:number}} state
 */
function applyDragSync(chartType, index, newValue, state) {
    // state: { times, xs, vs, as, x0, v0, dt }
    const { times, xs, vs, as, x0, v0, dt } = state;
    if (chartType === 'position') {
        xs[index] = newValue;
        const newV = computeVFromX(xs, dt);
        const newA = computeAFromX(xs, dt);
        state.vs.splice(0, state.vs.length, ...newV);
        state.as.splice(0, state.as.length, ...newA);
    } else if (chartType === 'velocity') {
        vs[index] = newValue;
        const newX = integrateVToX(vs, x0, dt);
        const newA = computeAFromV(vs, dt);
        state.xs.splice(0, state.xs.length, ...newX);
        state.as.splice(0, state.as.length, ...newA);
    } else if (chartType === 'acceleration') {
        as[index] = newValue;
        const newV = integrateAToV(as, v0, dt);
        const newX = integrateVToX(newV, x0, dt);
        state.vs.splice(0, state.vs.length, ...newV);
        state.xs.splice(0, state.xs.length, ...newX);
    }
    // Update charts and table
    refreshChartsAndTable(state);
}

/**
 * Redraw table and all charts using the supplied state object.
 * This function performs minimal updates to charts to avoid full re-creation when possible.
 * @param {{times:number[], xs:number[], vs:number[], as:number[], tbody:HTMLElement}} state
 */
function refreshChartsAndTable(state) {
    const { times, xs, vs, as, tbody } = state;
    // update table
    renderTable(tbody, times, xs, vs, as);

    // update small charts
    if (smallPosChart) {
        smallPosChart.data.datasets[0].data = xs.slice();
        smallPosChart.update('none');
    }
    if (smallVelChart) {
        smallVelChart.data.datasets[0].data = vs.slice();
        smallVelChart.update('none');
    }
    if (smallAccChart) {
        smallAccChart.data.datasets[0].data = as.slice();
        smallAccChart.update('none');
    }

    // main chart (x & v)
    if (mainChart) {
        mainChart.data.datasets[0].data = xs.slice();
        mainChart.data.datasets[1].data = vs.slice();
        mainChart.update('none');
    }


}

// --- main wiring ---
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('kinForm');
    const tbody = document.querySelector('#resultsTable tbody');
    const resetBtn = document.getElementById('resetBtn');
    const exportBtn = document.getElementById('exportCsv');
    const downloadBtn = document.getElementById('downloadCharts');

    // Live update when typing form parameters (debounced)
    const debouncedUpdate = debounce(updateFromForm, 250);
    const liveInputs = form.querySelectorAll('input[name="x0"], input[name="v0"], input[name="a"], input[name="t0"], input[name="t1"], input[name="dt"]');
    liveInputs.forEach(inp => inp.addEventListener('input', debouncedUpdate));

    // debug panel toggle
    const toggleDebugBtn = document.getElementById('toggleDebug');
    const uiDebug = document.getElementById('uiDebug');
    if (toggleDebugBtn && uiDebug) {
        toggleDebugBtn.addEventListener('click', () => {
            if (uiDebug.style.display === 'none') { uiDebug.style.display = 'block'; toggleDebugBtn.innerText = 'Hide debug'; }
            else { uiDebug.style.display = 'none'; toggleDebugBtn.innerText = 'Show debug'; }
        });
    }

    // small summary charts (top of right panel)
    const smallPosCtx = document.getElementById('smallPositionChartTop').getContext('2d');
    const smallVelCtx = document.getElementById('smallVelocityChartTop').getContext('2d');
    const smallAccCtx = document.getElementById('smallAccelerationChartTop').getContext('2d');

    // main combined chart (right side)
    const mainCtx = document.getElementById('mainChart').getContext('2d');


    let state = { times: [], xs: [], vs: [], as: [], x0: 0, v0: 0, dt: 0.1, tbody, dragEnabled: false };

    // Chart instances
    let mainChart = null;

    /**
 * Return drag plugin options for the given chart type.
 * When `state.dragEnabled` is false, returns a no-op config preventing movement.
 * @param {'position'|'velocity'|'acceleration'} chartType
 * @returns {Object} configuration accepted by chartjs-plugin-dragdata
 */
function setupDragOptions(chartType) {
        // If dragging is disabled, return a no-op config so points aren't movable
        if (!state.dragEnabled) {
            return {
                round: 6,
                dragX: false,
                dragY: false,
                showTooltip: false,
                onDragStart: () => {},
                onDrag: () => {},
                onDragEnd: () => {}
            };
        }

        return {
            round: 6,
            dragX: false,
            dragY: true,
            showTooltip: true,
            onDragStart: () => {},
            onDrag: (e, datasetIndex, index, value) => {
                const t = state.times[index];
                // temporary update readout
                if (chartType === 'position') {
                    updateReadoutElements(t, value, state.vs[index], state.as[index]);
                    // quick visual sync for this dataset
                    if (chartType === 'position' && smallPosChart) {
                        smallPosChart.data.datasets[0].data[index] = value;
                        smallPosChart.update('none');
                    }
                } else if (chartType === 'velocity') {
                    updateReadoutElements(t, state.xs[index], value, state.as[index]);
                    if (smallVelChart) { smallVelChart.data.datasets[0].data[index] = value; smallVelChart.update('none'); }
                } else if (chartType === 'acceleration') {
                    updateReadoutElements(t, state.xs[index], state.vs[index], value);
                    if (smallAccChart) { smallAccChart.data.datasets[0].data[index] = value; smallAccChart.update('none'); }
                }
            },
            onDragEnd: (e, datasetIndex, index, value) => {
                // apply sync changes and update all charts
                applyDragSync(chartType, index, value, state);
                // update readout for final values
                updateReadoutElements(state.times[index], state.xs[index], state.vs[index], state.as[index]);
                // update form initial values if index == 0
                if (index === 0) {
                    // update x0/v0 fields
                    if (chartType === 'position') document.querySelector('input[name="x0"]').value = state.xs[0].toFixed(6);
                    if (chartType === 'velocity') document.querySelector('input[name="v0"]').value = state.vs[0].toFixed(6);
                    if (chartType === 'acceleration') document.querySelector('input[name="a"]').value = state.as[0].toFixed(6);
                }
            }
        };
    }

    /**
 * Read form inputs, compute kinematic data, render the table and charts.
 * Validates inputs and surfaces helpful messages when no data can be computed.
 */
function updateFromForm() {
        const f = new FormData(form);
        const x0 = parseFloat(f.get('x0')) || 0;
        const v0 = parseFloat(f.get('v0')) || 0;
        const a = parseFloat(f.get('a')) || 0;
        const t0 = parseFloat(f.get('t0')) || 0;
        const t1 = parseFloat(f.get('t1')) || 0;
        const dt = parseFloat(f.get('dt')) || 0.1;

        if (dt <= 0) { alert('Time step dt must be > 0'); return; }
        if (t1 < t0) { alert('End time must be >= start time'); return; }

        state.x0 = x0; state.v0 = v0; state.dt = dt;
        const maxPoints = 1000;
        const { times, xs, vs, as } = computeKinematics(x0, v0, a, t0, t1, dt, maxPoints);
        state.times = times; state.xs = xs; state.vs = vs; state.as = as;

        pageLog('Form params:', { x0, v0, a, t0, t1, dt, maxPoints });
        pageLog('Computed points: ' + times.length);

        // If there are no points, show a helpful placeholder
        const placeholder = document.getElementById('chartPlaceholder');
        const chartErrorEl = document.getElementById('chartError');
        if (!times.length) {
            pageLog('No points generated.');
            if (placeholder) placeholder.style.display = 'block';
            if (chartErrorEl) { chartErrorEl.style.display = 'block'; chartErrorEl.innerText = 'No data points generated – check time interval and dt.'; }
            return;
        }
        if (placeholder) placeholder.style.display = 'none';
        if (chartErrorEl) chartErrorEl.style.display = 'none';

        renderTable(tbody, times, xs, vs, as);

        // Destroy old charts (use Chart.getChart to avoid "canvas already in use" errors)
        try {
            destroyChartIfExists(smallPosCtx);
            destroyChartIfExists(smallVelCtx);
            destroyChartIfExists(smallAccCtx);
            destroyChartIfExists(mainCtx);
            smallPosChart = smallVelChart = smallAccChart = mainChart = null;
        } catch (err) { console.warn('Error destroying charts:', err); }

        console.log('Creating charts — lengths:', { times: times.length, xs: xs.length, vs: vs.length, as: as.length });

        try {
            // Create small charts with drag
            pageLog('Creating small summary charts');
            smallPosChart = makeLineChart(smallPosCtx, [{ label: 'x (m)', data: xs.slice(), borderColor: 'rgba(255,152,0,1)', backgroundColor: 'rgba(255,152,0,0.08)', pointRadius: 4, borderWidth:2, fill:false }], times, { plugins: { legend: { display: false }, dragData: setupDragOptions('position') }, elements: { point: { radius: 4 } } });
            smallVelChart = makeLineChart(smallVelCtx, [{ label: 'v (m/s)', data: vs.slice(), borderColor: 'rgba(33,150,243,1)', backgroundColor: 'rgba(33,150,243,0.08)', pointRadius: 4, borderWidth:2, fill:false }], times, { plugins: { legend: { display: false }, dragData: setupDragOptions('velocity') }, elements: { point: { radius: 4 } } });
            smallAccChart = makeLineChart(smallAccCtx, [{ label: 'a (m/s^2)', data: as.slice(), borderColor: 'rgba(244,67,54,1)', backgroundColor: 'rgba(244,67,54,0.08)', pointRadius: 4, borderWidth:2, fill:false }], times, { plugins: { legend: { display: false }, dragData: setupDragOptions('acceleration') }, elements: { point: { radius: 4 } } });
            // Force layout/resize and render for visibility
            try { smallPosChart.resize(); smallPosChart.update(); smallVelChart.resize(); smallVelChart.update(); smallAccChart.resize(); smallAccChart.update(); } catch(e) { pageLog('Small chart resize error: ' + (e && e.message ? e.message : String(e))); }
            pageLog('Small charts created');
        } catch (err) { console.error('Small chart creation failed:', err); if (chartErrorEl) { chartErrorEl.style.display = 'block'; chartErrorEl.innerText = 'Small chart error: ' + (err && err.message ? err.message : String(err)); } pageLog('Small chart error: ' + (err && err.message ? err.message : String(err))); }
        // Large professional charts (three side-by-side)
        // Create main combined chart (x & v) on the right
        if (mainChart) mainChart.destroy();
        mainChart = makeLineChart(mainCtx, [
            { label: 'x(t) — Displacement (m)', data: xs.slice(), borderColor: 'rgba(255,152,0,1)', yAxisID: 'y', borderWidth: 3, pointRadius: 0, tension: 0.25 },
            { label: 'v(t) — Velocity (m/s)', data: vs.slice(), borderColor: 'rgba(33,150,243,1)', yAxisID: 'y1', borderWidth: 3, pointRadius: 0, tension: 0.25 }
        ], times, { plugins: { legend: { position: 'top' } }, scales: { y: { type: 'linear', position: 'left', title: { display: true, text: 'x (m)' } }, y1: { type: 'linear', position: 'right', title: { display: true, text: 'v (m/s)' }, grid: { drawOnChartArea: false } } } });
        try { mainChart.resize(); mainChart.update(); pageLog('Main chart created and rendered'); } catch (e) { pageLog('Main chart render error: ' + (e && e.message ? e.message : String(e))); }

        // show/hide error
        if (chartErrorEl) { chartErrorEl.style.display = 'none'; }

        // (download wiring set later)

        // Export
        exportBtn.onclick = () => { const csv = csvFromData(state.times, state.xs, state.vs, state.as); downloadText('kinematics.csv', csv); };
        downloadBtn.onclick = () => { try { if (mainChart) downloadChartImage(mainChart, 'main-chart.png'); if (smallPosChart) downloadChartImage(smallPosChart, 'small-pos.png'); if (smallVelChart) downloadChartImage(smallVelChart, 'small-vel.png'); if (smallAccChart) downloadChartImage(smallAccChart, 'small-acc.png'); } catch (err) { console.error(err); alert('Download failed: ' + err.message); } };

        // enable drag checkbox
        const enableDragChk = document.getElementById('enableDrag');
        if (enableDragChk) {
            state.dragEnabled = enableDragChk.checked;
            enableDragChk.addEventListener('change', () => { state.dragEnabled = enableDragChk.checked; updateFromForm(); });
        }

        // initial readout
        if (state.times.length) updateReadoutElements(state.times[0], state.xs[0], state.vs[0], state.as[0]);
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); updateFromForm(); });

    // populate charts immediately with form defaults so UI shows data on page load
    updateFromForm();
    resetBtn.addEventListener('click', () => { form.reset(); updateFromForm(); });

    // initial render
    updateFromForm();
});
