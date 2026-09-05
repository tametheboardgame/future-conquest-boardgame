# BG12I — Map Information Reduction and Board Tokens

Status: **ACTIVE**  
Started: 5 September 2026  
Base: `833d72caba49963cb736899450e9762066f7678c`

## Purpose

Reduce permanent map UI and move important, already-authoritative state onto physical board pieces, markers and restrained labels.

BG12I is a presentation package. It does not add rules, rewrite map geography or introduce a second token/state model.

The intended board-reading model is:

1. the map remains the dominant surface;
2. formations carry the state needed to judge them at a glance;
3. territory/objective/control state is represented on the board rather than repeated in permanent side panels;
4. threats, operations, contacts and strategic nodes continue to read as board markers;
5. camera, layers, strategic views, legend and accessible fallback remain available through compact on-demand utilities rather than large persistent chrome.

## Locked authority boundaries

BG12I must reuse the existing authoritative/render seams:

- `BoardGameState` remains the rules/state authority;
- `projectBoardStateForRenderer` remains the board-to-render projection seam;
- formation token state comes from existing `readiness`, `damage` and `supply` projection fields;
- territory control comes from existing `spaceControllers` projection state;
- existing enemy-contact, threat, operation and strategic-node marker projection remains authoritative for presentation;
- existing strategic overlay helpers remain the source of strategic-view/resource colouring and legend copy;
- MapLibre retains map lifecycle, camera, terrain, DEM and geographic projection ownership.

BG12I must not:

- invent new readiness, damage, supply, control or objective rules;
- create presentation RNG;
- mutate authoritative board state from marker rendering;
- create a parallel map-token data model;
- move or reinterpret formation geography;
- replace MapLibre camera or terrain ownership;
- implement the later BG12K secondary-drawer architecture.

## Presentation contract

### Formation pieces

Friendly formations should expose useful at-a-glance state directly on the piece without becoming miniature dashboards.

Allowed projected state is limited to existing board projection values such as:

- formation identity;
- readiness;
- damage;
- supply state.

The visual hierarchy should favour identity first, then exceptional state. Healthy/default state should be quiet. Strained, isolated or damaged formations should be recognisable without opening a panel.

### Territory, control and objective markers

- Existing `spaceControllers` state may be represented through restrained territory/control tokens.
- Scenario/objective status must be derived from existing authoritative scenario/campaign data. BG12I must not create new victory conditions.
- Control/contested/objective meaning must not rely on colour alone.
- Labels/tokens must remain sparse enough that the board still reads as a physical map.

### Existing operational markers

BG12I should strengthen rather than replace the current marker system:

- friendly formations;
- enemy contacts and confidence state;
- threat markers;
- operation markers;
- strategic nodes;
- movement/supply routes where enabled.

Existing marker declutter, zoom thresholds and presentation-only offsets remain in use.

### Map utilities

The current large permanent map chrome should be reduced.

Camera presets, layer visibility, strategic-view/resource selection, legend information and the accessible 2D fallback must remain reachable, but ordinary play should not reserve large persistent boxes for them.

Target normal state:

- one compact map utility surface at most;
- no permanent large strategic mode/legend panel;
- no permanent symbol-key panel competing with the map;
- utilities reveal details only when requested or contextually necessary.

BG12K remains responsible for the later general secondary-drawer architecture.

## Visual budgets

Use the accepted BG12C constraints:

### Desktop

- status strip: at most 48 px;
- navigation: at most 72 px;
- rail: at most 320 px;
- idle map: at least 70% viewport width;
- at most three persistent chrome surfaces;
- at most one contextual surface;
- horizontal overflow: at most 2 px.

### Compact

- status strip: at most 64 px;
- navigation: at most 56 px;
- rail collapsed by default;
- an opened drawer/surface should not exceed 46% viewport height;
- idle map: at least 60% viewport height;
- horizontal overflow: at most 2 px.

## Accessibility

- Token meaning uses shape/glyph/text in addition to colour.
- Formation state is available through ARIA/title copy.
- Direct map use retains accessible fallback controls.
- Compact utilities remain keyboard operable.
- Strategic overlay legend information remains available even when not permanently visible.
- Reduced-motion behaviour is unchanged.

## Validation

Required before manual acceptance:

1. source contracts proving no rules/RNG/MapLibre ownership duplication;
2. full project regression suite;
3. production build;
4. desktop browser evidence at approximately 1900×829 and 1366×768;
5. compact browser evidence at approximately 640×900;
6. normal play has no large permanent strategic mode/legend or symbol-key box;
7. formation state is visible on physical board tokens using authoritative projection fields;
8. territory/control/objective information, where present, is board-projected rather than repeated in permanent chrome;
9. camera/layers/strategic view and accessible 2D map remain reachable through compact controls;
10. MapLibre pan, zoom, selection and BG12H contextual formation interaction remain functional;
11. no new browser errors, renderer leaks or more than 2 px horizontal overflow;
12. exact-head screenshots/video are manually reviewed before merge.

## Manual gate

BG12I does not merge until the user confirms that the board now communicates more of its state through pieces and markers while feeling materially less like a simulation UI.

A technically green implementation fails this package if important state has merely been hidden rather than transferred cleanly onto the board or compact on-demand utilities.
