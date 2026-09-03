# BG12D — Legacy Presentation Quarantine

## Goal

Make the authoritative board game the only normal play presentation while preserving the old simulation shell temporarily for diagnostics and historical renderer/browser validation.

BG12D is a presentation quarantine, not a legacy-engine deletion package. BG12O remains responsible for extracting and deleting old simulation dependencies after the board-only presentation has proved stable.

## Normal route

The ordinary application route installs `bg12d-board-ui` on the document root before React renders.

Normal play hides:

- the legacy `More` gateway;
- the old Operations / Combat destination;
- Regions, Engineer, Logistics and Intel navigation through the hidden `More` gateway;
- the simulation-era command topbar and global day resolver;
- the old permanent map heading / legend;
- the old operational map context / selected-formation sidebar;
- legacy operational, adviser, enemy-action and combat-report alert strips;
- the duplicate legacy campaign outcome banner.

The command-map workspace collapses to one map column so the accepted terrain board reclaims the width previously reserved for the operational sidebar.

The transitional Board / Forces / Cards / Rules & Save controls remain. Cards are intentionally retained until BG12F and Forces / Rules & Save remain transitional routes until BG12K.

## Diagnostics route

`?legacy-ui=1` is the only supported route that installs `bg12d-legacy-ui`.

No BG12D hiding rules apply in diagnostics mode. The old Operations, Regions, Engineer, Logistics and Intel workspaces, command topbar and map context remain available there while historical validation still needs them.

The query is deliberately not exposed through normal-player navigation.

## Historical probe quarantine

WP6, WP6.5 and WP9 historical browser probes are rewritten inside their validation jobs to append `legacy-ui=1` before they inspect simulation-era workspaces. Their existing compatibility adaptations remain scoped to those diagnostics runs.

WP9 also runs `scripts/probe-bg12d-legacy-quarantine.mjs` against the unmodified production build. That probe independently proves:

1. normal `?terrain=1` hides the legacy gateway, legacy destinations, topbar, map context, permanent map heading and simulation alert surfaces;
2. the map reclaims the quarantined sidebar width and has no material horizontal overflow;
3. `?terrain=1&legacy-ui=1` restores the legacy gateway, Operations route, topbar and map context;
4. a legacy specialist route can still be revealed deliberately from diagnostics mode.

## Rules and renderer boundary

BG12D does not change:

- authoritative board state;
- action preview or dispatch;
- movement legality or movement animation;
- deterministic D20 combat;
- cards, support or escalation rules;
- AI;
- save/reload state;
- board-to-renderer projection;
- MapLibre lifecycle, terrain setup, camera, cities, landmarks or retained formation rendering.

The only runtime addition is a pre-render presentation-mode class determined by the explicit query string.

## Acceptance

BG12D passes when:

- ordinary Board play exposes no normal-player gateway to the legacy simulation workspaces;
- old operational map chrome no longer occupies the normal Board view;
- the accepted map remains the same protected renderer and fills the reclaimed workspace;
- historical validation uses the diagnostics route deliberately rather than keeping obsolete UI visible;
- diagnostics compatibility remains available until BG12O;
- full regression, browser continuity and exact-head validation remain green.
