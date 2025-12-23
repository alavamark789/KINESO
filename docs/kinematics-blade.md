# resources/views/kinematics.blade.php

Overview

The Blade view `kinematics.blade.php` contains the UI for the KINESO demo. It includes the parameter input form (left column) and the charts area (right column). The page is intentionally lightweight: all computation and charting logic lives in `resources/js/kinematics.js` so the Blade view focuses on structure and accessibility.

Notes
- The page uses a full-viewport layout to avoid outer scrollbars — charts and the data table scroll internally if content overflows.
- The small summary charts are bottom-aligned to match the main chart vertical size for a clean layout.

Quick edits
- To change labels, update the header and the `smallchart-title` elements.
- To add server-side features, create a controller and route rather than embedding logic in the view.

