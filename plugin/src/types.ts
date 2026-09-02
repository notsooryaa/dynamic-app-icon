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
   * Map of icon name -> path to the icon source image (relative to the
   * project root). May be omitted or empty, in which case the plugin is a
   * no-op and the app keeps its normal icon.
   */
  icons?: Record<string, string>;
};

/**
 * A single named icon after normalization + validation. This is the shape the
 * platform plugins consume.
 */
export type AppIconConfig = {
  /** The unique name used to select this icon at runtime. */
  name: string;
  /** Absolute path to the icon source image on disk. */
  source: string;
};
