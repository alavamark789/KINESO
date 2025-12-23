# resources/js/kinematics.js

Overview

`kinematics.js` is the client-side module that powers the KINESO kinematics demo. It performs physics computations for constant acceleration motion, renders charts via Chart.js, and synchronises a data table and charts when the user drags points.

Key responsibilities
- Compute kinematics arrays (time, position, velocity, acceleration).
- Render small summary charts and a main combined chart (x and v).
- Provide drag handlers that update all datasets consistently when a point is moved.
- Export CSV and chart PNG images.

Public functions (in-file use)
- `computeKinematics(x0, v0, a, t0, t1, dt)` — compute arrays of times, xs, vs, as.
- `computeVFromX(xs, dt)` — estimate velocity from position using finite differences.
- `computeAFromX(xs, dt)` — estimate acceleration from position using second differences.
- `computeAFromV(vs, dt)` — estimate acceleration from velocity using finite differences.
- `integrateVToX(vs, x0, dt)` — integrate velocities to positions (trapezoidal rule).
- `integrateAToV(as, v0, dt)` — integrate accelerations to velocities (Euler step).
- `makeLineChart(ctx, datasets, labels, options)` — safe Chart.js line chart creator (destroys previous chart instance if present).
- `updateFromForm()` — read form inputs, compute data, render table and charts.

Usage
- The script runs on DOMContentLoaded and attaches handlers to the form controls and charts.
- Toggle "Enable drag" to allow chartjs-plugin-dragdata to update points interactively.

Notes
- Chart.js components are explicitly registered to avoid issues when multiple versions or bundle boundary exist.
- `chartjs-plugin-dragdata` is dynamically imported and registered at runtime when available.

