# UI/UX & Responsiveness Upgrade

## 1. "Locate Me" Button Overhaul
- **Problem**: The previous button was hidden in the bottom corner, looked outdated, and zoomed out too far (state level) instead of focusing on the user.
- **Solution**:
  - **Placement**: Moved to **Top Right** (below the Layers control). This ensures it's always visible and doesn't conflict with the bottom panel on mobile.
  - **Design**: Replaced the generic Leaflet bar with a modern, rounded-square button using Tailwind CSS (`bg-white`, `shadow-md`, `rounded-lg`).
  - **Icon**: Used the `Crosshair` icon from `lucide-react` for a standard GIS look.
  - **Feedback**: Added a spinning animation to the icon while the location is being fetched.

## 2. Zoom Logic Fix
- **Problem**: `map.locate({ setView: true })` was respecting the accuracy radius, often zooming out to show a huge blue circle (state/city level).
- **Solution**:
  - Disabled auto-view setting (`setView: false`).
  - Implemented a custom `locationfound` handler.
  - **Action**: When location is found, the map now **Flies To** the user's coordinates at **Zoom Level 18** (Street Level).
  - **Visual**: A blue accuracy circle is still drawn, but the view is focused on the user.

## 3. Mobile Responsiveness
- **Layout**: The Top-Right position is safe on mobile devices as it avoids the bottom sheet area where mission details appear.
- **Touch Targets**: The button is sized at `34x34px` with padding, making it easy to tap.

## How to Test
1. **Click "Locate Me"**: Look for the crosshair icon in the top-right.
2. **Observe Animation**: The icon should spin briefly.
3. **Check Zoom**: The map should smoothly animate (fly) to your current location and zoom in very close (level 18), allowing you to see individual streets immediately.
