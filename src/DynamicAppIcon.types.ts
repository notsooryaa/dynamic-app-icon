export type AppIconName = string;

export const DEFAULT_APP_ICON_NAME = 'default';

export type AppIconConfig = {
  name: AppIconName;
  source: string;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type DynamicAppIconModuleEvents = {};

export enum DynamicAppIconErrorCode {
  IconNotConfigured = 'ERR_ICON_NOT_CONFIGURED',
  InvalidArgument = 'ERR_INVALID_ARGUMENT',
  Unsupported = 'ERR_UNSUPPORTED',
  SwitchFailed = 'ERR_SWITCH_FAILED',
}

export class DynamicAppIconError extends Error {
  readonly code: DynamicAppIconErrorCode;

  constructor(code: DynamicAppIconErrorCode, message: string) {
    super(message);
    this.name = 'DynamicAppIconError';
    this.code = code;

    // Restore the prototype chain when targeting ES5 / transpiled output.
    Object.setPrototypeOf(this, DynamicAppIconError.prototype);
  }
}
