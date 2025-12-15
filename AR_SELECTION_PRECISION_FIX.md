# Map Selection Precision Upgrade

## 1. The "Small Street" Selection Problem
- **Issue**: When two large streets are selected (thick orange lines), they visually and interactively "bury" any small connector streets between them.
- **Cause**: Leaflet renders features in order. If a small street is rendered *before* a large one, the large one's hit area (especially with our 20px tolerance) covers the small one.
- **Symptom**: Clicking the small street actually registers as a click on the large neighbor, causing it to deselect.

## 2. The "Golden Standard" Solution: Smart Sorting
- **Strategy**: We now sort all street segments by **Length (Descending)** before rendering.
- **Result**: 
  1.  **Longest Streets** are drawn first (at the bottom).
  2.  **Shortest Streets** are drawn last (on top).
- **Benefit**: The small connector streets are now physically rendered *on top* of the larger ones. Their hit detection area takes precedence.

## 3. How to Test
1.  **Find a Junction**: Look for a T-junction or a small street connecting two main roads.
2.  **Select Neighbors**: Select the two large main roads. They will turn thick orange.
3.  **Select the Middle**: Try to tap the small street between them.
    -   **Before**: It would likely deselect one of the big roads.
    -   **Now**: It should correctly select the small street, turning it orange as well.

## 4. Technical Details
- **File**: `MissionMap.tsx`
- **Logic**: `sortedFeatures = [...data.features].sort((a, b) => b.length - a.length)`
- **Renderer**: Still using the high-tolerance Canvas renderer, but the sorting ensures the correct "layering" of hit targets.
