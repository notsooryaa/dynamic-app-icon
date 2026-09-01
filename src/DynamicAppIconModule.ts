import { NativeModule, requireNativeModule } from 'expo';

import type { DynamicAppIconModuleEvents } from './DynamicAppIcon.types';

export declare class DynamicAppIconModule extends NativeModule<DynamicAppIconModuleEvents> {
  readonly icons: string[];

  setAppIcon(name: string): Promise<void>;

  getAppIcon(): Promise<string>;
}

export default requireNativeModule<DynamicAppIconModule>('DynamicAppIcon');
