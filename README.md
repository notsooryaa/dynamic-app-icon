# @barberaa/dynamic-app-icon

Change your Expo / React Native app's launcher icon at runtime — on both
Android and iOS — from a single, platform-independent JavaScript API.

Icons are declared at build time through an Expo config plugin, bundled into the
native app, and selected at runtime. No manual editing of the native `android/`
or `ios/` projects is required, and everything is reconstructed automatically on
`expo prebuild --clean`.

```ts
import { setAppIcon } from "@barberaa/dynamic-app-icon";

await setAppIcon("dark");
```

---

## Features

- One JS API for both platforms — no `Platform.OS` branching.
- Expo config plugin generates all native icon configuration at build time.
- Survives `expo prebuild` and `expo prebuild --clean`.
- Reads the active icon from the OS, so it is correct after an app restart.
- Clear, coded errors for invalid or unconfigured icons.

## Requirements

- Expo SDK 57+ (uses Expo Modules).
- A prebuild / bare workflow (`expo prebuild`, `expo run:*`, or EAS Build).
  Icons must be bundled at build time, so this does not run in Expo Go.

---

## Installation

```bash
npx expo install @barberaa/dynamic-app-icon
```

## Configuration

Add the plugin to your app config (`app.json` / `app.config.js`) and declare
your icons. Each value is a path to a source PNG, relative to the project root.

```json
{
  "expo": {
    "plugins": [
      [
        "@barberaa/dynamic-app-icon",
        {
          "icons": {
            "default": "./assets/icon-default.png",
            "dark": "./assets/icon-dark.png",
            "christmas": "./assets/icon-christmas.png"
          }
        }
      ]
    ]
  }
}
```

Then regenerate the native projects and build:

```bash
npx expo prebuild --clean
npx expo run:ios      # or run:android
```

### Icon rules

- **`default`** is your app's primary icon. `resetAppIcon()` returns to it.
- Icon **names** must match `^[a-z][a-z0-9_]*$` — lowercase, starting with a
  letter, and containing only lowercase letters, digits, and underscores
  (e.g. `default`, `dark`, `winter_2025`).
- **Source images** should be square PNGs; a large master (e.g. 1024×1024) gives
  the best results. The plugin resizes them for every required density.
- Source files must exist, or `prebuild` fails with a descriptive error.

> Adding a **new** icon to the config requires a native rebuild (the image must
> be bundled). Switching between already-bundled icons does not.

---

## API

All functions are async and platform-independent.

### `setAppIcon(name)`

```ts
await setAppIcon("dark");
```

Selects the icon with the given name. The name must be one of the configured
icons (see [`getAvailableIcons`](#getavailableicons)); otherwise it throws a
[`DynamicAppIconError`](#errors) with code `ERR_ICON_NOT_CONFIGURED`.

### `getAppIcon()`

```ts
const current = await getAppIcon(); // e.g. "dark"
```

Returns the name of the currently active icon, queried from the OS. Returns
`"default"` when the primary icon is active.

### `resetAppIcon()`

```ts
await resetAppIcon();
```

Restores the default icon. Equivalent to `setAppIcon("default")`.

### `getAvailableIcons()`

```ts
const icons = await getAvailableIcons(); // ["default", "dark", "christmas"]
```

Returns the names of every icon bundled into the app. Always includes
`"default"`.

### Errors

Failures throw a `DynamicAppIconError` carrying a machine-readable `code`:

```ts
import { DynamicAppIconError, DynamicAppIconErrorCode } from "@barberaa/dynamic-app-icon";

try {
  await setAppIcon("does-not-exist");
} catch (e) {
  if (e instanceof DynamicAppIconError) {
    console.warn(e.code, e.message);
    // e.code === DynamicAppIconErrorCode.IconNotConfigured
  }
}
```

| Code                       | Meaning                                        |
| -------------------------- | ---------------------------------------------- |
| `ERR_ICON_NOT_CONFIGURED`  | The requested icon was not configured.         |
| `ERR_INVALID_ARGUMENT`     | The icon name was empty or not a string.       |
| `ERR_UNSUPPORTED`          | Alternate icons are unsupported on the device. |
| `ERR_ICON_SWITCH_FAILED`   | The OS failed to apply the icon change.        |

---

## Example

```tsx
import { useEffect, useState } from "react";
import { Button, Text, View } from "react-native";
import {
  getAppIcon,
  getAvailableIcons,
  resetAppIcon,
  setAppIcon,
} from "@barberaa/dynamic-app-icon";

export function IconSwitcher() {
  const [icons, setIcons] = useState<string[]>([]);
  const [current, setCurrent] = useState("default");

  useEffect(() => {
    (async () => {
      setIcons(await getAvailableIcons());
      setCurrent(await getAppIcon());
    })();
  }, []);

  return (
    <View>
      <Text>Active: {current}</Text>
      {icons.map((icon) => (
        <Button
          key={icon}
          title={icon}
          onPress={async () => {
            await setAppIcon(icon);
            setCurrent(await getAppIcon());
          }}
        />
      ))}
      <Button title="Reset" onPress={resetAppIcon} />
    </View>
  );
}
```

---

## Platform behavior

The two platforms apply icon changes differently:

- **iOS** — the icon changes immediately via `UIApplication.setAlternateIconName`.
  iOS shows a system alert ("You have changed the icon for …") that cannot be
  suppressed by a normal app.
- **Android** — Android has no live icon-change API; icons are implemented with
  launcher `activity-alias` entries. To avoid tearing down the running app, the
  change is applied when the app next enters the **background**, so the new icon
  is in place by the time the user returns to the home screen. Exact refresh
  timing can vary by device and launcher.

---

## How it works

- **Build time (config plugin):** reads your `icons` map and generates the
  native configuration — Android launcher resources + `activity-alias` entries,
  and an iOS asset catalog + the `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`
  build setting. The configured icon names are recorded natively (Android
  `meta-data`, iOS `Info.plist`) so the runtime module can report them.
- **Runtime (native module):** `setAppIcon` toggles the active Android alias or
  calls `setAlternateIconName` on iOS; `getAppIcon` reads the active icon back
  from the OS.

The generated native projects are treated as build artifacts — the source of
truth is your Expo config plus this package.

---

## License

MIT © [Sooryaa VR](https://github.com/notsooryaa)
