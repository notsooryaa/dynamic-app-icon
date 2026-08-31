import { NativeModule, requireNativeModule } from 'expo';

declare class DynamicAppIconModule extends NativeModule<{}> {
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<DynamicAppIconModule>('DynamicAppIcon');
