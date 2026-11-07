/**
 * The reserved name representing the app's primary/default launcher icon.
 * Kept in sync with `DEFAULT_APP_ICON_NAME` in the runtime `src/` package.
 */
export const DEFAULT_APP_ICON_NAME = 'default';

/**
 * Raw props passed to the config plugin from `app.json` / `app.config.*`.
 *
 * @example
 * ```json
 * ["@barberaa/dynamic-app-icon", {
 *   "icons": {
 *     "default": "./assets/icon-default.png",
 *     "dark": "./assets/icon-dark.png"
 *   }
 * }]
 * ```
 */
export type DynamicAppIconPluginProps = {
  /**
   * Map of icon name -> icon definition. May be omitted or empty, in which
   * case the plugin is a no-op and the app keeps its normal icon.
   *
   * A definition is either a path to a single image (relative to the project
   * root), or an object with adaptive icon layers for Android.
   */
  icons?: Record<string, IconDefinition>;
};

/**
 * Object form of an icon definition. Paths are relative to the project root.
 *
 * - `source`: full square icon. Used by iOS and as the legacy Android icon
 *   (Android 7 and below). Defaults to `foreground` when omitted.
 * - `foreground`: Android adaptive foreground layer (transparent PNG, keep the
 *   artwork inside the central ~66% safe zone).
 * - `background`: Android adaptive background, an image path or a `#RRGGBB`
 *   color. Defaults to white.
 * - `monochrome`: Android 13+ themed icon layer (single-color PNG).
 */
export type AdaptiveIconDefinition = {
  source?: string;
  foreground?: string;
  background?: string;
  monochrome?: string;
};

export type IconDefinition = string | AdaptiveIconDefinition;

/** Resolved Android adaptive icon layers. */
export type AdaptiveLayers = {
  /** Absolute path to the foreground image. */
  foreground: string;
  /** Absolute path to a background image, when the background is an image. */
  backgroundImage?: string;
  /** `#RRGGBB` background color, when the background is a color. */
  backgroundColor?: string;
  /** Absolute path to the monochrome (themed icon) image. */
  monochrome?: string;
};

/**
 * A single named icon after normalization + validation. This is the shape the
 * platform plugins consume.
 */
export type AppIconConfig = {
  /** The unique name used to select this icon at runtime. */
  name: string;
  /** Absolute path to the icon source image on disk (iOS + legacy Android). */
  source: string;
  /** Android adaptive icon layers, when configured. */
  adaptive?: AdaptiveLayers;
};
