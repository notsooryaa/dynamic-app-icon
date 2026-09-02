const { generateImageBackgroundAsync } = require('@expo/image-utils');
const fs = require('fs');
const os = require('os');
const path = require('path');

const plugin = require('../../../build/plugin');

const withDynamicAppIcon = plugin.default || plugin;

let projectRoot;

beforeAll(async () => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dai-idx-'));
  fs.mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
  const png = await generateImageBackgroundAsync({
    width: 128,
    height: 128,
    resizeMode: 'cover',
    backgroundColor: '#0099FF',
  });
  fs.writeFileSync(path.join(projectRoot, 'assets', 'icon.png'), png);
});

afterAll(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

function baseConfig() {
  return { name: 'x', slug: 'x', _internal: { projectRoot }, mods: {} };
}

describe('withDynamicAppIcon (entry)', () => {
  it('exports a plugin function', () => {
    expect(typeof withDynamicAppIcon).toBe('function');
  });

  it('is a no-op when no icons are configured', () => {
    const out = withDynamicAppIcon(baseConfig(), undefined);
    expect(out.mods.android).toBeUndefined();
    expect(out.mods.ios).toBeUndefined();
  });

  it('is a no-op when the icons map is empty', () => {
    const out = withDynamicAppIcon(baseConfig(), { icons: {} });
    expect(out.mods.android).toBeUndefined();
    expect(out.mods.ios).toBeUndefined();
  });

  it('registers Android and iOS mods for a valid configuration', () => {
    const out = withDynamicAppIcon(baseConfig(), {
      icons: { default: './assets/icon.png', dark: './assets/icon.png' },
    });
    expect(Object.keys(out.mods.android).sort()).toEqual(['dangerous', 'manifest']);
    expect(Object.keys(out.mods.ios).sort()).toEqual(['dangerous', 'infoPlist', 'xcodeproj']);
  });

  it('surfaces a clear error for an invalid icon name', () => {
    expect(() => withDynamicAppIcon(baseConfig(), { icons: { Bad: './assets/icon.png' } })).toThrow(
      /Invalid icon name/
    );
  });

  it('surfaces a clear error for a missing icon file', () => {
    expect(() =>
      withDynamicAppIcon(baseConfig(), { icons: { default: './assets/missing.png' } })
    ).toThrow(/Icon file does not exist/);
  });

  it('runs only once per config (createRunOncePlugin)', () => {
    const config = withDynamicAppIcon(baseConfig(), {
      icons: { default: './assets/icon.png' },
    });
    expect(config._internal.pluginHistory['@barberaa/dynamic-app-icon']).toBeDefined();
  });
});
