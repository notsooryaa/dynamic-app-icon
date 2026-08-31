import { registerWebModule, NativeModule } from 'expo';

// DynamicAppIconModule is not available on the web platform.
class DynamicAppIconModule extends NativeModule<{}> {}

export default registerWebModule(DynamicAppIconModule, 'DynamicAppIconModule');
