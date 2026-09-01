import { registerWebModule, NativeModule } from 'expo';

import {
  DynamicAppIconError,
  DynamicAppIconErrorCode,
  DEFAULT_APP_ICON_NAME,
  type DynamicAppIconModuleEvents,
} from './DynamicAppIcon.types';

class DynamicAppIconModule extends NativeModule<DynamicAppIconModuleEvents> {
  readonly icons: string[] = [DEFAULT_APP_ICON_NAME];

  async setAppIcon(_name: string): Promise<void> {
    throw new DynamicAppIconError(
      DynamicAppIconErrorCode.Unsupported,
      'Changing the app icon is not supported on web.'
    );
  }

  async getAppIcon(): Promise<string> {
    return DEFAULT_APP_ICON_NAME;
  }
}

export default registerWebModule(DynamicAppIconModule, 'DynamicAppIcon');
