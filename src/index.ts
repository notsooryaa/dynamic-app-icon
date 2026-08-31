// Reexport the native module. On web, it will be resolved to DynamicAppIconModule.web.ts
// and on native platforms to DynamicAppIconModule.ts
export { default } from './DynamicAppIconModule';
export * from './DynamicAppIcon.types';
