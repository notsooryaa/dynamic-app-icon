import {
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
  type ConfigPlugin,
} from '@expo/config-plugins';
import { generateImageAsync } from '@expo/image-utils';
import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_APP_ICON_NAME, type AppIconConfig } from './types';

/**
 * Prefix applied to every generated `.appiconset` name (and thus to the
 * alternate-icon names used at runtime), so the plugin can recognize and clean
 * up its own asset catalog entries idempotently.
 */
const ICON_SET_PREFIX = 'DAIAppIcon_';

/** Custom Info.plist key holding the configured icon names (for native use). */
const ICON_NAMES_PLIST_KEY = 'DAIIconNames';

/** Xcode build setting listing the alternate app-icon asset names. */
const ALTERNATE_ICON_NAMES_BUILD_SETTING = 'ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES';

/**
 * Size of the single universal icon written into each `.appiconset`. Xcode's
 * asset compiler derives every device size from this 1024px master, which is
 * the modern (single-size) app-icon workflow.
 */
const UNIVERSAL_ICON_SIZE = 1024;

/**
 * Configure iOS alternate app icons for runtime switching via
 * `UIApplication.setAlternateIconName`.
 *
 * Uses the asset-catalog approach: each configured icon becomes a
 * `<prefix><name>.appiconset` inside `Images.xcassets`, and the non-default
 * icons are registered through the `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`
 * build setting so Xcode compiles them as selectable alternate icons. This is
 * more reliable than loose bundle PNGs because the asset compiler guarantees
 * the icons are present in the built app. Fully idempotent.
 */
export const withIosAppIcons: ConfigPlugin<AppIconConfig[]> = (config, icons) => {
  if (icons.length === 0) {
    return config;
  }

  config = withGeneratedIconSets(config, icons);
  config = withAlternateIconBuildSetting(config, icons);
  config = withIconNamesPlist(config, icons);
  return config;
};

/** Asset-catalog set name (also the runtime alternate-icon name) for an icon. */
function iconSetNameFor(icon: AppIconConfig): string {
  return `${ICON_SET_PREFIX}${icon.name}`;
}

/**
 * Write one `.appiconset` per icon into the app target's `Images.xcassets`,
 * removing any this plugin previously generated first.
 */
function withGeneratedIconSets(
  config: ExpoConfigWithMods,
  icons: AppIconConfig[]
): ExpoConfigWithMods {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const xcassetsDir = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName!,
        'Images.xcassets'
      );

      removeGeneratedIconSets(xcassetsDir);

      for (const icon of icons) {
        const setName = iconSetNameFor(icon);
        const setDir = path.join(xcassetsDir, `${setName}.appiconset`);
        await fs.promises.mkdir(setDir, { recursive: true });

        const fileName = `${setName}.png`;
        const { source } = await generateImageAsync(
          {
            projectRoot: config.modRequest.projectRoot,
            cacheType: 'dynamic-app-icon-ios',
          },
          {
            src: icon.source,
            name: fileName,
            width: UNIVERSAL_ICON_SIZE,
            height: UNIVERSAL_ICON_SIZE,
            resizeMode: 'cover',
            // App icons must be fully opaque (no alpha) on iOS.
            backgroundColor: '#FFFFFF',
            removeTransparency: true,
          }
        );
        await fs.promises.writeFile(path.join(setDir, fileName), source);
        await fs.promises.writeFile(
          path.join(setDir, 'Contents.json'),
          JSON.stringify(buildContentsJson(fileName), null, 2)
        );
      }

      return config;
    },
  ]);
}

/** Remove `.appiconset` directories this plugin previously generated. */
function removeGeneratedIconSets(xcassetsDir: string): void {
  if (!fs.existsSync(xcassetsDir)) {
    return;
  }
  for (const entry of fs.readdirSync(xcassetsDir)) {
    if (entry.startsWith(ICON_SET_PREFIX) && entry.endsWith('.appiconset')) {
      fs.rmSync(path.join(xcassetsDir, entry), { recursive: true, force: true });
    }
  }
}

/** Asset catalog `Contents.json` for a single universal 1024px app icon. */
function buildContentsJson(fileName: string): unknown {
  return {
    images: [
      {
        filename: fileName,
        idiom: 'universal',
        platform: 'ios',
        size: `${UNIVERSAL_ICON_SIZE}x${UNIVERSAL_ICON_SIZE}`,
      },
    ],
    info: {
      author: 'expo',
      version: 1,
    },
  };
}

/**
 * Register the non-default icons as alternate app icons via the Xcode build
 * setting, so the asset compiler makes them selectable at runtime.
 */
function withAlternateIconBuildSetting(
  config: ExpoConfigWithMods,
  icons: AppIconConfig[]
): ExpoConfigWithMods {
  return withXcodeProject(config, (config) => {
    const alternateNames = icons
      .filter((icon) => icon.name !== DEFAULT_APP_ICON_NAME)
      .map(iconSetNameFor);

    // Wrap each name in quotes for the pbxproj array literal.
    config.modResults.updateBuildProperty(
      ALTERNATE_ICON_NAMES_BUILD_SETTING,
      alternateNames.map((name) => `"${name}"`)
    );

    return config;
  });
}

/**
 * Record the configured icon names (including the default) in Info.plist so the
 * native module can expose them as the `icons` constant. Overwrites any prior
 * value for idempotency.
 */
function withIconNamesPlist(
  config: ExpoConfigWithMods,
  icons: AppIconConfig[]
): ExpoConfigWithMods {
  return withInfoPlist(config, (config) => {
    (config.modResults as Record<string, unknown>)[ICON_NAMES_PLIST_KEY] = icons.map(
      (icon) => icon.name
    );
    return config;
  });
}

// Narrow config type carrying the mods we use, to avoid `any`.
type ExpoConfigWithMods = Parameters<ConfigPlugin<AppIconConfig[]>>[0];
