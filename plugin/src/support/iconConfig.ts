import * as fs from 'fs';
import * as path from 'path';

import type { AppIconConfig, DynamicAppIconPluginProps } from '../types';

/**
 * Allowed icon-name pattern.
 *
 * Names must be usable both as Android resource identifiers (which are limited
 * to lowercase letters, digits and underscores, and must not start with a
 * digit) and as stable keys on iOS. We enforce the stricter Android rule so a
 * single name works unchanged on both platforms.
 */
const VALID_ICON_NAME = /^[a-z][a-z0-9_]*$/;

/**
 * Thrown when the plugin configuration is invalid. Carries a human-readable
 * message matching the wording documented in the architecture spec.
 */
export class DynamicAppIconConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DynamicAppIconConfigError';
    Object.setPrototypeOf(this, DynamicAppIconConfigError.prototype);
  }
}

/**
 * Normalize and validate the plugin props into a list of {@link AppIconConfig}.
 *
 * @param props The raw plugin props from app config.
 * @param projectRoot Absolute path to the consuming project's root, used to
 *   resolve relative icon source paths.
 * @returns A validated, order-stable list of icons. Empty when no icons are
 *   configured (the plugin is then a no-op).
 * @throws {DynamicAppIconConfigError} On any invalid configuration.
 */
export function resolveIcons(
  props: DynamicAppIconPluginProps | undefined,
  projectRoot: string
): AppIconConfig[] {
  const icons = props?.icons;

  // No icons configured is valid: the plugin simply does nothing.
  if (icons === undefined) {
    return [];
  }

  if (typeof icons !== 'object' || icons === null || Array.isArray(icons)) {
    throw new DynamicAppIconConfigError(
      'Icon configuration must be an object mapping icon names to image paths.'
    );
  }

  const entries = Object.entries(icons);
  if (entries.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: AppIconConfig[] = [];

  for (const [name, source] of entries) {
    validateName(name);

    // Object keys are already unique in JS, but guard against case-folding or
    // whitespace collisions producing the same normalized resource name.
    if (seen.has(name)) {
      throw new DynamicAppIconConfigError(`Duplicate icon name "${name}".`);
    }
    seen.add(name);

    validateSourceValue(name, source);

    const absoluteSource = path.isAbsolute(source) ? source : path.resolve(projectRoot, source);

    if (!fs.existsSync(absoluteSource)) {
      throw new DynamicAppIconConfigError(`Icon file does not exist:\n${source}`);
    }

    if (!fs.statSync(absoluteSource).isFile()) {
      throw new DynamicAppIconConfigError(`Icon "${name}" source is not a file:\n${source}`);
    }

    result.push({ name, source: absoluteSource });
  }

  return result;
}

function validateName(name: string): void {
  if (typeof name !== 'string' || name.length === 0) {
    throw new DynamicAppIconConfigError('Icon names must be non-empty strings.');
  }

  if (!VALID_ICON_NAME.test(name)) {
    throw new DynamicAppIconConfigError(
      `Invalid icon name "${name}". Icon names must start with a lowercase ` +
        'letter and contain only lowercase letters, digits, and underscores ' +
        '(e.g. "default", "dark", "christmas_2025").'
    );
  }
}

function validateSourceValue(name: string, source: unknown): asserts source is string {
  if (typeof source !== 'string' || source.trim().length === 0) {
    throw new DynamicAppIconConfigError(
      `Icon "${name}" must map to a non-empty image path string.`
    );
  }
}
