export type DiceColour = number;

export interface DiceMaterialTheme {
  colour: DiceColour;
  roughness: number;
  metalness: number;
  emissive: DiceColour;
  emissiveIntensity: number;
}

export interface DiceEdgeTheme {
  bevelRadius: number;
  bevelSegments: number;
}

export interface DicePipTheme extends DiceMaterialTheme {
  styleId: string;
  radius: number;
  depth: number;
  spacing: number;
  surfaceOffset: number;
}

export interface DiceTrayTheme {
  backgroundColour: DiceColour;
  floorColour: DiceColour;
  floorRoughness: number;
  floorMetalness: number;
}

export interface DiceTheme {
  id: string;
  body: DiceMaterialTheme;
  edge: DiceEdgeTheme;
  pips: DicePipTheme;
  tray: DiceTrayTheme;
}

/**
 * The accepted BG12G-R2A appearance. Later settings/cosmetics may select a
 * different theme, but this remains the baseline and gameplay never depends
 * on the selected cosmetic values.
 */
export const DEFAULT_DICE_THEME: DiceTheme = {
  id: 'r2a-accepted',
  body: {
    colour: 0xe9dfc9,
    roughness: 0.38,
    metalness: 0.02,
    emissive: 0x000000,
    emissiveIntensity: 0
  },
  edge: {
    bevelRadius: 0.18,
    bevelSegments: 8
  },
  pips: {
    styleId: 'classic-round',
    colour: 0x171317,
    roughness: 0.52,
    metalness: 0.02,
    emissive: 0x000000,
    emissiveIntensity: 0,
    radius: 0.112,
    depth: 0.026,
    spacing: 0.47,
    surfaceOffset: 1.012
  },
  tray: {
    backgroundColour: 0x171014,
    floorColour: 0x3a2020,
    floorRoughness: 0.82,
    floorMetalness: 0.02
  }
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));

/**
 * Keeps future player-facing cosmetic inputs inside geometry/material ranges
 * that remain readable and physically plausible. This function is cosmetic
 * only and deliberately has no game-state, combat or RNG dependency.
 */
export function normaliseDiceTheme(theme: DiceTheme): DiceTheme {
  return {
    ...theme,
    body: {
      ...theme.body,
      roughness: clamp(theme.body.roughness, 0.08, 1),
      metalness: clamp(theme.body.metalness, 0, 0.35),
      emissiveIntensity: clamp(theme.body.emissiveIntensity, 0, 0.4)
    },
    edge: {
      bevelRadius: clamp(theme.edge.bevelRadius, 0.08, 0.28),
      bevelSegments: Math.round(clamp(theme.edge.bevelSegments, 3, 12))
    },
    pips: {
      ...theme.pips,
      roughness: clamp(theme.pips.roughness, 0.08, 1),
      metalness: clamp(theme.pips.metalness, 0, 0.35),
      emissiveIntensity: clamp(theme.pips.emissiveIntensity, 0, 0.4),
      radius: clamp(theme.pips.radius, 0.07, 0.18),
      depth: clamp(theme.pips.depth, 0.012, 0.06),
      spacing: clamp(theme.pips.spacing, 0.35, 0.55),
      surfaceOffset: clamp(theme.pips.surfaceOffset, 1.001, 1.04)
    },
    tray: {
      ...theme.tray,
      floorRoughness: clamp(theme.tray.floorRoughness, 0.1, 1),
      floorMetalness: clamp(theme.tray.floorMetalness, 0, 0.25)
    }
  };
}
