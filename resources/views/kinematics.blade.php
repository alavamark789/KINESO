<!--
    resources/views/kinematics.blade.php
    KINESO — Kinematics demo UI
    This Blade view contains the input panel, data table, and charts area.
    Keep interactive logic in `resources/js/kinematics.js` and styling in `resources/css/app.css`.
-->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>KINESO</title>
    @if (file_exists(public_path('build/manifest.json')) || file_exists(public_path('hot')))
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    @endif
    <style>
        :root { --brand:#2c3e50; --muted:#6c7a89; --accent:#27ae60; --card:#ffffff; --panel-border:#e6e9ef; }
        /* Full-viewport layout, no outer scrollbars */
        html, body { height:100%; margin:0; padding:0; }
        body { background:#f5f7fa; color:#22303f; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; height:100vh; overflow:hidden; }

        /* Container spans the full viewport and uses flex to layout header + main area */
        .container { width:100vw; max-width:none; margin:0; padding:20px; box-sizing:border-box; display:flex; flex-direction:column; gap:12px; height:calc(100vh - 20px); }

        /* Header kept at natural height; main area expands to fill remaining space */
        .container > div[style] { /* the top title/readout row */ }

        /* Make the main content stretch vertically and avoid pushing beyond viewport */
        .main-content { display:flex; gap:1rem; align-items:stretch; height:100%; min-height:0; }

        /* Panels should fill vertically and allow internal scrolling where needed */
        .panel { background:var(--card); border:1px solid var(--panel-border); padding:14px; border-radius:8px; box-shadow:0 1px 3px rgba(33,47,60,0.03); display:flex; flex-direction:column; }
        .left { width:360px; flex:0 0 360px; height:100%; overflow:auto; }
        .right { flex:1; height:100%; overflow:hidden; display:flex; flex-direction:column; }

        .generate-btn { display:block; width:100%; padding:12px 14px; background:linear-gradient(180deg,var(--accent), #1e8745); color:#fff; border:none; border-radius:6px; font-weight:700; letter-spacing:0.6px; cursor:pointer; box-shadow:0 6px 18px rgba(39,174,96,0.12); }
        .input-row { display:flex; justify-content:space-between; gap:10px; align-items:center; }
        .input-row label { flex:1; font-size:13px; color:var(--muted); }
        .input-row input { width:100px; padding:6px 8px; border:1px solid #e8eef4; border-radius:6px; background:#fbfcfd; }

        /* Charts area: let it fill and keep internal scrolling inside table only */
        .smallcharts { display:flex; gap:12px; margin-bottom:12px; align-items:flex-end; }
        .smallcharts > div { flex:1; height:120px; display:flex; flex-direction:column; justify-content:flex-end; }
        #chartsContainer { display:flex; gap:16px; align-items:stretch; min-height:360px; height:100%; }
        #chartsContainer > div:first-child { display:flex; flex-direction:column; justify-content:flex-end; }
        #chartsContainer > div:last-child { display:flex; align-items:stretch; }
        #chartsContainer canvas { display:block; width:100%; height:100%; }

        #resultsTable { width:100%; border-collapse:collapse; font-family:monospace; font-size:13px; }
        #resultsTable th { background:#fbfcfd; text-align:left; padding:8px; color:var(--muted); border-bottom:1px solid #f0f3f6; }
        #resultsTable td { padding:8px; text-align:right; border-bottom:1px dashed #eef2f5; }
        .readout { margin-bottom:10px; padding:8px 10px; background:#fff; border-radius:6px; display:flex; gap:12px; font-family:monospace; color:var(--muted); }
    </style>
</head>
<body>
<div class="container">
    <div style="display:flex; align-items:center; gap:16px; justify-content:space-between; margin-bottom:12px;">
        <div>
            <h1 style="margin:0; font-size:20px;">KINESO</h1>
            <div style="margin-top:6px; color:var(--muted);">Interactive physics demo with live draggable charts and CSV export</div>
        </div>
        <div class="readout" style="font-family:monospace;">
            <div>t = <strong id="ro-t">-</strong> s</div>
            <div>x = <strong id="ro-x">-</strong> m</div>
            <div>v = <strong id="ro-v">-</strong> m/s</div>
            <div>a = <strong id="ro-a">-</strong> m/s²</div>
        </div>
    </div>

    <!-- Debug panel -->
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
        <button id="toggleDebug" class="btn">Show debug</button>
        <div id="uiDebug" style="display:none; background:#fff; border:1px solid #eef2f5; padding:8px; border-radius:6px; width:100%; max-height:120px; overflow:auto; font-family:monospace; font-size:12px;"></div>
    </div>

    <div class="main-content">
        <section class="panel left" style="display:flex; flex-direction:column; flex:0 0 320px; width:320px;">
            <h3 style="margin-top:0; margin-bottom:8px">1. ENTER PARAMETERS</h3>
            <form id="kinForm">
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <div class="input-row"><label>Initial Velocity (v0):</label><input class="input-field" type="number" step="any" name="v0" value="5"></div>
                    <div class="input-row"><label>Acceleration (a):</label><input class="input-field" type="number" step="any" name="a" value="2"></div>
                    <div class="input-row"><label>Time Interval (t1 - t0):</label><input class="input-field" type="number" step="any" name="t1" value="10"></div>
                </div>

                <div style="margin-top:12px;"><button type="submit" class="generate-btn">GENERATE MOTION DATA</button></div>

                <div style="margin-top:12px;">
                    <h4 style="margin:6px 0 10px 0; font-size:14px; color:var(--muted)">2. DATA TABLE</h4>
                    <div style="max-height:260px; overflow:auto; border:1px solid #f0f3f6; padding:6px; background:#fbfcfd;">
                        <table id="resultsTable">
                            <thead>
                                <tr><th style="text-align:left">Time (s)</th><th style="text-align:right">Vel (m/s)</th><th style="text-align:right">Dist (m)</th></tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>

                <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">
                    <button id="exportCsv" type="button" class="btn">Export CSV</button>
                    <button id="downloadCharts" type="button" class="btn">Download Charts</button>
                    <label style="margin-left:8px; font-size:13px; color:var(--muted)"><input id="enableDrag" type="checkbox"> Enable drag</label>
                </div>
            </form>
        </section>

        <section class="panel right">
            <h3 style="margin-top:0; margin-bottom:8px">3. DYNAMIC GRAPHS</h3>
            <div id="chartsContainer" style="display:flex; gap:16px; align-items:stretch; min-height:360px;">
                <div style="flex:1; min-width:0; display:flex; flex-direction:column; justify-content:flex-end;">
                    <div class="smallcharts" style="display:flex; gap:12px; align-items:flex-end;">
                        <div style="flex:1; height:120px; display:flex; flex-direction:column; align-items:stretch; justify-content:flex-end;">
                            <canvas id="smallPositionChartTop" aria-label="position chart" role="img" style="width:100%; height:100%; display:block;"></canvas>
                            <div class="smallchart-title" style="margin-top:8px;"><span class="pill pill-orange"></span> x(t) — Displacement (m)</div>
                        </div>
                        <div style="flex:1; height:120px; display:flex; flex-direction:column; align-items:stretch; justify-content:flex-end;">
                            <canvas id="smallVelocityChartTop" aria-label="velocity chart" role="img" style="width:100%; height:100%; display:block;"></canvas>
                            <div class="smallchart-title" style="margin-top:8px;"><span class="pill pill-blue"></span> v(t) — Velocity (m/s)</div>
                        </div>
                        <div style="flex:1; height:120px; display:flex; flex-direction:column; align-items:stretch; justify-content:flex-end;">
                            <canvas id="smallAccelerationChartTop" aria-label="acceleration chart" role="img" style="width:100%; height:100%; display:block;"></canvas>
                            <div class="smallchart-title" style="margin-top:8px;"><span class="pill pill-red"></span> a(t) — Acceleration (m/s²)</div>
                        </div>
                    </div>
                </div>
                <div style="flex:3; min-width:0; display:flex; align-items:stretch;">
                    <div style="flex:1; min-height:360px; padding:12px; background:linear-gradient(180deg,#ffffff,#fbfdff); border-radius:6px; display:flex;">
                        <canvas id="mainChart" style="width:100%; height:100%; display:block;"></canvas>
                    </div>
                </div>
            </div>
            <div id="chartPlaceholder" style="margin-top:12px; padding:8px; background:#fbfcfd; border:1px dashed #e6eef4; color:var(--muted); border-radius:6px;">Click <strong>GENERATE MOTION DATA</strong> to populate charts.</div>
            <div id="chartError" style="display:none; margin-top:10px; padding:8px; border-radius:6px; background:#fff; border:1px solid #fee; color:#900;">Chart rendering error</div>
        </section>
    </div>

</div>

<!-- the compiled JS will import & run kinematics logic -->
</body>
</html>