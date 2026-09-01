import {
  DEFAULT_APP_ICON_NAME,
  DynamicAppIconError,
  DynamicAppIconErrorCode,
  type AppIconName,
} from './DynamicAppIcon.types';
import DynamicAppIconModule from './DynamicAppIconModule';

export {
  DEFAULT_APP_ICON_NAME,
  DynamicAppIconError,
  DynamicAppIconErrorCode,
} from './DynamicAppIcon.types';
export type {
  AppIconName,
  AppIconConfig,
  DynamicAppIconModuleEvents,
} from './DynamicAppIcon.types';

export async function getAvailableIcons(): Promise<AppIconName[]> {
  return [...DynamicAppIconModule.icons];
}

export async function getAppIcon(): Promise<AppIconName> {
  return DynamicAppIconModule.getAppIcon();
}

export async function setAppIcon(iconName: AppIconName): Promise<void> {
  const name = assertValidIconName(iconName);

  if (!DynamicAppIconModule.icons.includes(name)) {
    throw new DynamicAppIconError(
      DynamicAppIconErrorCode.IconNotConfigured,
      `Icon "${name}" is not configured. Available icons: ${formatIconList(
        DynamicAppIconModule.icons
      )}.`
    );
  }

  await DynamicAppIconModule.setAppIcon(name);
}

export async function resetAppIcon(): Promise<void> {
  await DynamicAppIconModule.setAppIcon(DEFAULT_APP_ICON_NAME);
}

function assertValidIconName(iconName: AppIconName): string {
  if (typeof iconName !== 'string' || iconName.trim().length === 0) {
    throw new DynamicAppIconError(
      DynamicAppIconErrorCode.InvalidArgument,
      `Expected a non-empty icon name string, received: ${describe(iconName)}.`
    );
  }
  return iconName;
}

function formatIconList(icons: readonly string[]): string {
  return icons.map((icon) => `"${icon}"`).join(', ');
}

function describe(value: unknown): string {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  return String(value);
}
