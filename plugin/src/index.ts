import { createRunOncePlugin, type ConfigPlugin } from '@expo/config-plugins';

import { resolveIcons } from './support/iconConfig';
import type { DynamicAppIconPluginProps } from './types';
import { withAndroidAppIcons } from './withAndroidAppIcons';
import { withIosAppIcons } from './withIosAppIcons';

const pkg = require('../../package.json') as { name: string; version: string };

/**
 * Config plugin for `@barberaa/dynamic-app-icon`.
 *
 * Reads the `icons` map from the plugin props, validates it once, then applies
 * the Android and iOS platform plugins that generate all native icon
 * configuration during `expo prebuild`. When no icons are configured the plugin
 * is a no-op, leaving the app's normal icon untouched.
 */
const withDynamicAppIcon: ConfigPlugin<DynamicAppIconPluginProps | undefined> = (config, props) => {
  // Plugins run before mods, so the project root comes from the config's
  // internal metadata (falling back to the current working directory).
  const projectRoot = config._internal?.projectRoot ?? process.cwd();

  // Validate + normalize once. resolveIcons throws DynamicAppIconConfigError
  // with a clear message on any invalid configuration, which surfaces to the
  // developer during prebuild.
  const icons = resolveIcons(props, projectRoot);

  if (icons.length === 0) {
    return config;
  }

  config = withAndroidAppIcons(config, icons);
  config = withIosAppIcons(config, icons);
  return config;
};

export default createRunOncePlugin(withDynamicAppIcon, pkg.name, pkg.version);
