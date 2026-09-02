const { generateImageBackgroundAsync, getPngInfo } = require('@expo/image-utils');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { withIosAppIcons } = require('../../../build/plugin/withIosAppIcons');

let projectRoot;
let platformProjectRoot;
let xcassetsDir;
let iconSrc;

const PROJECT_NAME = 'MyApp';

beforeAll(async () => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dai-ios-'));
  platformProjectRoot = path.join(projectRoot, 'ios');
  xcassetsDir = path.join(platformProjectRoot, PROJECT_NAME, 'Images.xcassets');
  fs.mkdirSync(xcassetsDir, { recursive: true });
  iconSrc = path.join(projectRoot, 'icon.png');
  const png = await generateImageBackgroundAsync({
    width: 512,
    height: 512,
    resizeMode: 'cover',
    backgroundColor: '#FF3366',
  });
  fs.writeFileSync(iconSrc, png);
});

afterAll(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

function getMods(icons) {
  const config = withIosAppIcons({ mods: { ios: {} } }, icons);
  return config.mods.ios;
}

function fakeXcodeProject() {
  const store = {};
  return {
    updateBuildProperty(key, value) {
      store[key] = value;
    },
    _store: store,
  };
}

const modRequest = () => ({
  platformProjectRoot,
  projectName: PROJECT_NAME,
  projectRoot,
});

describe('withIosAppIcons', () => {
  const icons = [
    { name: 'default', source: '' },
    { name: 'dark', source: '' },
    { name: 'christmas', source: '' },
  ];
  const iconsWithSrc = (names) => names.map((name) => ({ name, source: iconSrc }));

  it('generates an appiconset with a 1024px universal icon per configured icon', async () => {
    const { dangerous } = getMods(iconsWithSrc(['default', 'dark', 'christmas']));
    await dangerous({ modResults: {}, modRequest: modRequest() });

    for (const name of ['default', 'dark', 'christmas']) {
      const setDir = path.join(xcassetsDir, `DAIAppIcon_${name}.appiconset`);
      expect(fs.existsSync(setDir)).toBe(true);

      const contents = JSON.parse(fs.readFileSync(path.join(setDir, 'Contents.json'), 'utf8'));
      expect(contents.images[0]).toMatchObject({
        filename: `DAIAppIcon_${name}.png`,
        idiom: 'universal',
        platform: 'ios',
        size: '1024x1024',
      });

      const info = await getPngInfo(path.join(setDir, `DAIAppIcon_${name}.png`));
      expect(info.width).toBe(1024);
      expect(info.height).toBe(1024);
    }
  }, 60000);

  it('registers only non-default icons in the alternate-icons build setting', () => {
    const { xcodeproj } = getMods(icons);
    const xcode = fakeXcodeProject();
    xcodeproj({ modResults: xcode, modRequest: modRequest() });
    expect(xcode._store.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES).toEqual([
      '"DAIAppIcon_dark"',
      '"DAIAppIcon_christmas"',
    ]);
  });

  it('records all icon names (including default) in Info.plist', async () => {
    const { infoPlist } = getMods(icons);
    const out = await infoPlist({
      modResults: { CFBundleName: PROJECT_NAME },
      modRequest: modRequest(),
    });
    expect(out.modResults.DAIIconNames).toEqual(['default', 'dark', 'christmas']);
  });

  it('removes stale appiconsets and build-setting entries when an icon is dropped', async () => {
    // First run with three icons.
    let mods = getMods(iconsWithSrc(['default', 'dark', 'christmas']));
    await mods.dangerous({ modResults: {}, modRequest: modRequest() });

    // Second run dropping christmas.
    mods = getMods(iconsWithSrc(['default', 'dark']));
    await mods.dangerous({ modResults: {}, modRequest: modRequest() });
    const xcode = fakeXcodeProject();
    mods.xcodeproj({ modResults: xcode, modRequest: modRequest() });

    const sets = fs
      .readdirSync(xcassetsDir)
      .filter((e) => e.endsWith('.appiconset'))
      .sort();
    expect(sets).toEqual(['DAIAppIcon_dark.appiconset', 'DAIAppIcon_default.appiconset']);
    expect(xcode._store.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES).toEqual([
      '"DAIAppIcon_dark"',
    ]);
  }, 60000);
});
