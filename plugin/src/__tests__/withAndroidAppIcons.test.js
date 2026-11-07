const { generateImageBackgroundAsync, getPngInfo } = require('@expo/image-utils');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { withAndroidAppIcons } = require('../../../build/plugin/withAndroidAppIcons');

let projectRoot;
let platformProjectRoot;
let iconSrc;

beforeAll(async () => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dai-and-'));
  platformProjectRoot = path.join(projectRoot, 'android');
  iconSrc = path.join(projectRoot, 'icon.png');
  const png = await generateImageBackgroundAsync({
    width: 512,
    height: 512,
    resizeMode: 'cover',
    backgroundColor: '#3366FF',
  });
  fs.writeFileSync(iconSrc, png);
});

afterAll(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

function freshManifest() {
  return {
    manifest: {
      $: {
        'xmlns:android': 'http://schemas.android.com/apk/res/android',
        package: 'com.example.app',
      },
      application: [
        {
          $: { 'android:name': '.MainApplication' },
          activity: [
            {
              $: { 'android:name': '.MainActivity' },
              'intent-filter': [
                {
                  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                  category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

function getMods(icons) {
  const config = withAndroidAppIcons({ mods: { android: {} } }, icons);
  return config.mods.android;
}

const modRequest = () => ({
  platformProjectRoot,
  projectRoot,
});

describe('withAndroidAppIcons manifest', () => {
  const icons = [
    { name: 'default', source: '' },
    { name: 'dark', source: '' },
  ];

  it('adds one launcher activity-alias per icon with correct attributes', async () => {
    const { manifest } = getMods(icons);
    const out = await manifest({ modResults: freshManifest(), modRequest: modRequest() });
    const app = out.modResults.manifest.application[0];
    const aliases = app['activity-alias'];

    expect(aliases).toHaveLength(2);
    expect(aliases.map((a) => a.$['android:name'])).toEqual([
      '.DynamicAppIconAlias_default',
      '.DynamicAppIconAlias_dark',
    ]);
    // Only the default alias is enabled.
    expect(aliases[0].$['android:enabled']).toBe('true');
    expect(aliases[1].$['android:enabled']).toBe('false');
    // Each alias references its own mipmap and targets the main activity.
    expect(aliases[0].$['android:icon']).toBe('@mipmap/ic_launcher_dai_default');
    expect(aliases[0].$['android:targetActivity']).toBe('.MainActivity');
    // Each alias carries a MAIN + LAUNCHER intent-filter.
    const cats = (aliases[0]['intent-filter'][0].category || []).map((c) => c.$['android:name']);
    expect(cats).toContain('android.intent.category.LAUNCHER');
  });

  it('strips the LAUNCHER category from the main activity', async () => {
    const { manifest } = getMods(icons);
    const out = await manifest({ modResults: freshManifest(), modRequest: modRequest() });
    const app = out.modResults.manifest.application[0];
    const cats = (app.activity[0]['intent-filter'][0].category || []).map(
      (c) => c.$['android:name']
    );
    expect(cats).not.toContain('android.intent.category.LAUNCHER');
  });

  it('records the icon names as application meta-data', async () => {
    const { manifest } = getMods(icons);
    const out = await manifest({ modResults: freshManifest(), modRequest: modRequest() });
    const app = out.modResults.manifest.application[0];
    const meta = app['meta-data'].find((m) => m.$['android:name'].endsWith('ICON_NAMES'));
    expect(meta.$['android:value']).toBe('default,dark');
  });

  it('is idempotent across repeated runs', async () => {
    const { manifest } = getMods(icons);
    let mr = { modResults: freshManifest(), modRequest: modRequest() };
    mr = await manifest(mr);
    mr = await manifest(mr);
    const app = mr.modResults.manifest.application[0];
    expect(app['activity-alias']).toHaveLength(2);
    const metas = app['meta-data'].filter((m) => m.$['android:name'].endsWith('ICON_NAMES'));
    expect(metas).toHaveLength(1);
  });
});

describe('withAndroidAppIcons adaptive icons', () => {
  it('generates adaptive layers, XML and color background drawable', async () => {
    const icons = [
      {
        name: 'adaptive',
        source: iconSrc,
        adaptive: {
          foreground: iconSrc,
          backgroundColor: '#112233',
          monochrome: iconSrc,
        },
      },
      {
        name: 'imgbg',
        source: iconSrc,
        adaptive: { foreground: iconSrc, backgroundImage: iconSrc },
      },
    ];
    const { dangerous } = getMods(icons);
    await dangerous({ modResults: {}, modRequest: modRequest() });

    const res = path.join(platformProjectRoot, 'app', 'src', 'main', 'res');
    const fg = path.join(res, 'mipmap-xxxhdpi', 'ic_launcher_dai_adaptive_foreground.png');
    const info = await getPngInfo(fg);
    expect(info.width).toBe(432);
    expect(
      fs.existsSync(path.join(res, 'mipmap-mdpi', 'ic_launcher_dai_adaptive_monochrome.png'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(res, 'mipmap-mdpi', 'ic_launcher_dai_imgbg_background.png'))
    ).toBe(true);

    const xml = fs.readFileSync(
      path.join(res, 'mipmap-anydpi-v26', 'ic_launcher_dai_adaptive.xml'),
      'utf8'
    );
    expect(xml).toContain('<monochrome');
    expect(xml).toContain('@drawable/ic_launcher_dai_adaptive_background');
    const bg = fs.readFileSync(
      path.join(res, 'drawable', 'ic_launcher_dai_adaptive_background.xml'),
      'utf8'
    );
    expect(bg).toContain('#112233');
    const xml2 = fs.readFileSync(
      path.join(res, 'mipmap-anydpi-v26', 'ic_launcher_dai_imgbg.xml'),
      'utf8'
    );
    expect(xml2).toContain('@mipmap/ic_launcher_dai_imgbg_background');
    expect(xml2).not.toContain('<monochrome');

    // Removing icons cleans up stale adaptive output.
    const only = getMods([{ name: 'default', source: iconSrc }]);
    await only.dangerous({ modResults: {}, modRequest: modRequest() });
    expect(fs.existsSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher_dai_adaptive.xml'))).toBe(
      false
    );
    expect(
      fs.existsSync(path.join(res, 'drawable', 'ic_launcher_dai_adaptive_background.xml'))
    ).toBe(false);
  }, 60000);
});

describe('withAndroidAppIcons mipmap generation', () => {
  it('generates correctly sized PNGs in every density bucket and is idempotent', async () => {
    const icons = [{ name: 'default', source: iconSrc }];
    const { dangerous } = getMods(icons);
    await dangerous({ modResults: {}, modRequest: modRequest() });

    const res = path.join(platformProjectRoot, 'app', 'src', 'main', 'res');
    const expected = {
      'mipmap-mdpi': 48,
      'mipmap-hdpi': 72,
      'mipmap-xhdpi': 96,
      'mipmap-xxhdpi': 144,
      'mipmap-xxxhdpi': 192,
    };
    for (const [folder, size] of Object.entries(expected)) {
      const file = path.join(res, folder, 'ic_launcher_dai_default.png');
      expect(fs.existsSync(file)).toBe(true);
      const info = await getPngInfo(file);
      expect(info.width).toBe(size);
      expect(info.height).toBe(size);
    }

    // Second run must not accumulate files.
    await dangerous({ modResults: {}, modRequest: modRequest() });
    const mdpi = fs.readdirSync(path.join(res, 'mipmap-mdpi'));
    expect(mdpi.filter((f) => f.startsWith('ic_launcher_dai_default'))).toHaveLength(1);
  }, 60000);
});
