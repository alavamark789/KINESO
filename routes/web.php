<?php
/**
 * routes/web.php
 *
 * Simple routes for the KINESO demo application. Keep routes small and
 * focused on returning the appropriate Blade views for local development.
 */

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    // Redirect root to the kinematics demo for convenience
    return redirect('/kinematics');
});

// Kinematics UI: constant acceleration
/**
 * Route: GET /kinematics
 * Renders the KINESO kinematics demo Blade view which contains the
 * input panel, data table and interactive Chart.js graphs.
 */
Route::get('/kinematics', function () {
    return view('kinematics');
});
