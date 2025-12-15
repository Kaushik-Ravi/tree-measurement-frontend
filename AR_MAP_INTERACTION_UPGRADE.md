# Map Interaction & Selection Upgrade

## 1. Multi-Select Capability
- **Problem**: Users could only select one street at a time, making it impossible to plan routes or assign multiple segments.
- **Solution**: 
  - Upgraded `MissionsView` state to track an array of `selectedSegments`.
  - Clicking a street now toggles it (select/deselect) instead of replacing the selection.
  - `MissionControlPanel` now aggregates data:
    - Shows "X Segments Selected"
    - Calculates **Total Distance** (sum of all segments).
    - Calculates **Total Estimated Time**.
    - Lists individual streets in a scrollable view.

## 2. "Fat Finger" Touch Fix
- **Problem**: Thin street lines were hard to tap on mobile devices, requiring multiple attempts.
- **Solution**: 
  - Implemented a custom **Leaflet Canvas Renderer** with `tolerance: 20`.
  - This increases the invisible "hit area" around the lines by 20 pixels, making them much easier to grab without affecting the visual thickness.
  - `L.canvas({ padding: 0.5, tolerance: 20 })`

## 3. Visual Feedback
- **Selection State**: Selected segments now stay highlighted in **Orange** (`#f59e0b`) with increased thickness (`weight: 12`).
- **Hover Effects**: Hovering still works for unselected segments but doesn't override the selection style.

## How to Test
1. **Touch Selection**: Try tapping slightly *near* a street line (not exactly on it). It should still register the click.
2. **Multi-Select**: Tap multiple streets. They should all turn orange.
3. **Panel Stats**: Check the right-side panel. It should show the total meters and time for all selected streets.
