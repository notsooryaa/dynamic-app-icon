import {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  type ConfigPlugin,
} from '@expo/config-plugins';
import { generateImageAsync } from '@expo/image-utils';
import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_APP_ICON_NAME, type AppIconConfig } from './types';

const { getMainApplicationOrThrow, getMainActivityOrThrow } = AndroidConfig.Manifest;

type AndroidManifest = AndroidConfig.Manifest.AndroidManifest;
type ManifestActivityAlias = AndroidConfig.Manifest.ManifestActivityAlias;
type ManifestIntentFilter = AndroidConfig.Manifest.ManifestIntentFilter;

/**
 * Prefix for every launcher resource + alias this plugin generates. Used to
 * identify and clean up our own output on each run (idempotency) without
 * touching resources owned by the app or other plugins.
 */
const RESOURCE_PREFIX = 'ic_launcher_dai_';

/** Name of the `<meta-data>` entry that lists configured icon names. */
const ICONS_METADATA_NAME = 'com.barberaa.dynamicappicon.ICON_NAMES';

/**
 * Android launcher icon densities. Values are the target square size in px for
 * a legacy (non-adaptive) launcher icon at each density bucket.
 */
const MIPMAP_DENSITIES: { folder: string; size: number }[] = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

/**
 * Configure Android launcher icons + activity aliases for runtime switching.
 *
 * Generates one legacy mipmap resource set per configured icon and one
 * `<activity-alias>` per icon (with the launcher intent filter), moving the
 * launcher entry off the main activity so exactly one alias is active at a
 * time. Fully idempotent across repeated `expo prebuild` runs.
 */
export const withAndroidAppIcons: ConfigPlugin<AppIconConfig[]> = (config, icons) => {
  if (icons.length === 0) {
    return config;
  }

  config = withGeneratedMipmaps(config, icons);
  config = withActivityAliases(config, icons);
  return config;
};

/** Resource name (no extension) for a given icon. */
function resourceNameFor(icon: AppIconConfig): string {
  return `${RESOURCE_PREFIX}${icon.name}`;
}

/** Alias class name for a given icon. */
function aliasNameFor(icon: AppIconConfig): string {
  return `.DynamicAppIconAlias_${icon.name}`;
}

/**
 * Generate density-scaled PNGs into the res/mipmap-* folders, first removing
 * any previously generated ones so removed icons don't linger.
 */
function withGeneratedMipmaps(
  config: ExpoConfigWithMods,
  icons: AppIconConfig[]
): ExpoConfigWithMods {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const resPath = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');

      for (const { folder, size } of MIPMAP_DENSITIES) {
        const dir = path.join(resPath, folder);
        removeGeneratedFiles(dir);
        await fs.promises.mkdir(dir, { recursive: true });

        for (const icon of icons) {
          const { source } = await generateImageAsync(
            {
              projectRoot: config.modRequest.projectRoot,
              cacheType: 'dynamic-app-icon',
            },
            {
              src: icon.source,
              // The cache is keyed by src/resizeMode/backgroundColor and the
              // returned file name — NOT by dimensions. Encode the size into
              // the name so each density gets its own cache entry instead of
              // reusing the first (smallest) generated image.
              name: `${resourceNameFor(icon)}_${size}.png`,
              width: size,
              height: size,
              resizeMode: 'cover',
              backgroundColor: '#FFFFFF',
            }
          );
          await fs.promises.writeFile(path.join(dir, `${resourceNameFor(icon)}.png`), source);
        }
      }

      return config;
    },
  ]);
}

/** Delete this plugin's previously generated PNGs from a directory. */
function removeGeneratedFiles(dir: string): void {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith(RESOURCE_PREFIX)) {
      fs.rmSync(path.join(dir, file), { force: true });
    }
  }
}

/**
 * Add one `<activity-alias>` per icon to the manifest, move the LAUNCHER
 * category off the main activity, and record the icon-name list as meta-data.
 */
function withActivityAliases(
  config: ExpoConfigWithMods,
  icons: AppIconConfig[]
): ExpoConfigWithMods {
  return withAndroidManifest(config, (config) => {
    config.modResults = applyAliases(config.modResults, icons);
    return config;
  });
}

function applyAliases(manifest: AndroidManifest, icons: AppIconConfig[]): AndroidManifest {
  const application = getMainApplicationOrThrow(manifest);
  const mainActivity = getMainActivityOrThrow(manifest);

  const mainActivityName = mainActivity.$['android:name'];

  // Snapshot the launcher intent-filter as an independent copy BEFORE we strip
  // the LAUNCHER category off the main activity — otherwise stripping would
  // also empty the filter we hand to the aliases.
  const launcherFilter = cloneIntentFilter(extractLauncherIntentFilter(mainActivity));

  // The launcher entry now lives on the aliases; keep MAIN on the activity but
  // drop its LAUNCHER category so we don't get a duplicate launcher icon.
  stripLauncherCategory(mainActivity);

  // Remove any aliases we generated on a previous run before re-adding, so the
  // result is deterministic and stale icons disappear.
  application['activity-alias'] = (application['activity-alias'] ?? []).filter(
    (alias) => !isGeneratedAlias(alias)
  );

  for (const icon of icons) {
    const isDefault = icon.name === DEFAULT_APP_ICON_NAME;
    const alias: ManifestActivityAlias = {
      $: {
        'android:name': aliasNameFor(icon),
        'android:targetActivity': mainActivityName,
        'android:enabled': isDefault ? 'true' : 'false',
        'android:exported': 'true',
        'android:icon': `@mipmap/${resourceNameFor(icon)}`,
      },
      'intent-filter': [cloneIntentFilter(launcherFilter)],
    };
    application['activity-alias']!.push(alias);
  }

  setIconNamesMetaData(
    application,
    icons.map((icon) => icon.name)
  );

  return manifest;
}

/** True when an alias was generated by this plugin (safe to replace). */
function isGeneratedAlias(alias: ManifestActivityAlias): boolean {
  return (alias.$?.['android:name'] ?? '').startsWith('.DynamicAppIconAlias_');
}

/**
 * Find the LAUNCHER intent-filter on the main activity so aliases can reuse it.
 * Falls back to a synthesized MAIN/LAUNCHER filter when none is present.
 */
function extractLauncherIntentFilter(
  mainActivity: AndroidConfig.Manifest.ManifestActivity
): ManifestIntentFilter {
  const filters = mainActivity['intent-filter'] ?? [];
  const launcher = filters.find(isLauncherFilter);
  if (launcher) {
    return launcher;
  }
  return {
    action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
    category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
  };
}

function isLauncherFilter(filter: ManifestIntentFilter): boolean {
  return (filter.category ?? []).some(
    (c) => c.$['android:name'] === 'android.intent.category.LAUNCHER'
  );
}

/** Remove the LAUNCHER category from the main activity's intent filters. */
function stripLauncherCategory(mainActivity: AndroidConfig.Manifest.ManifestActivity): void {
  for (const filter of mainActivity['intent-filter'] ?? []) {
    if (filter.category) {
      filter.category = filter.category.filter(
        (c) => c.$['android:name'] !== 'android.intent.category.LAUNCHER'
      );
    }
  }
}

/** Deep-clone an intent filter so each owner has an independent copy. */
function cloneIntentFilter(filter: ManifestIntentFilter): ManifestIntentFilter {
  return JSON.parse(JSON.stringify(filter)) as ManifestIntentFilter;
}

/**
 * Record the configured icon names as an application `<meta-data>` value so the
 * native module can expose them as the `icons` constant without re-reading the
 * plugin config. Stored as a comma-separated list.
 */
function setIconNamesMetaData(
  application: AndroidConfig.Manifest.ManifestApplication,
  iconNames: string[]
): void {
  application['meta-data'] = (application['meta-data'] ?? []).filter(
    (item) => item.$['android:name'] !== ICONS_METADATA_NAME
  );
  application['meta-data'].push({
    $: {
      'android:name': ICONS_METADATA_NAME,
      'android:value': iconNames.join(','),
    },
  });
}

// Narrow config type carrying the mods we use, to avoid `any`.
type ExpoConfigWithMods = Parameters<ConfigPlugin<AppIconConfig[]>>[0];
