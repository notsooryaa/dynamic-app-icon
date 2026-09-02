const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  resolveIcons,
  DynamicAppIconConfigError,
} = require('../../../build/plugin/support/iconConfig');

let projectRoot;

beforeAll(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dai-cfg-'));
  fs.mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'assets', 'a.png'), Buffer.from('\x89PNG\r\n\x1a\n'));
  fs.writeFileSync(path.join(projectRoot, 'assets', 'b.png'), Buffer.from('\x89PNG\r\n\x1a\n'));
});

afterAll(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

describe('resolveIcons', () => {
  it('returns [] when no icons are configured', () => {
    expect(resolveIcons(undefined, projectRoot)).toEqual([]);
    expect(resolveIcons({}, projectRoot)).toEqual([]);
    expect(resolveIcons({ icons: {} }, projectRoot)).toEqual([]);
  });

  it('normalizes multiple icons to absolute sources in order', () => {
    const result = resolveIcons(
      { icons: { default: './assets/a.png', dark: './assets/b.png' } },
      projectRoot
    );
    expect(result.map((i) => i.name)).toEqual(['default', 'dark']);
    expect(result.every((i) => path.isAbsolute(i.source))).toBe(true);
  });

  it('throws on a missing icon file', () => {
    expect(() => resolveIcons({ icons: { default: './assets/nope.png' } }, projectRoot)).toThrow(
      DynamicAppIconConfigError
    );
    expect(() => resolveIcons({ icons: { default: './assets/nope.png' } }, projectRoot)).toThrow(
      /Icon file does not exist/
    );
  });

  it('throws on an invalid icon name', () => {
    expect(() => resolveIcons({ icons: { Default: './assets/a.png' } }, projectRoot)).toThrow(
      /Invalid icon name/
    );
    expect(() => resolveIcons({ icons: { '2x': './assets/a.png' } }, projectRoot)).toThrow(
      /Invalid icon name/
    );
  });

  it('throws on a non-string source', () => {
    expect(() => resolveIcons({ icons: { default: 123 } }, projectRoot)).toThrow(
      /non-empty image path/
    );
  });

  it('throws when icons is not an object', () => {
    expect(() => resolveIcons({ icons: [] }, projectRoot)).toThrow(/must be an object/);
  });
});
