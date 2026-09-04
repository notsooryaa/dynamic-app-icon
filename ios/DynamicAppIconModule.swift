import ExpoModulesCore
import UIKit

private let defaultIconName = "default"

private let iconSetPrefix = "DAIAppIcon_"


private let iconNamesPlistKey = "DAIIconNames"

private class IconNotConfiguredException: GenericException<(String, [String])>, @unchecked Sendable {
  override var reason: String {
    let (name, available) = param
    let list = available.map { "\"\($0)\"" }.joined(separator: ", ")
    return "Icon \"\(name)\" is not configured. Available icons: \(list)."
  }
}

private class UnsupportedException: Exception, @unchecked Sendable {
  override var reason: String {
    "Alternate app icons are not supported on this device."
  }
}

private class IconSwitchFailedException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    "Unable to switch application icon: \(param)"
  }
}

public class DynamicAppIconModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DynamicAppIcon")

    Property("icons") {
      configuredIconNames()
    }

    AsyncFunction("getAppIcon") { () -> String in
      currentIconName()
    }
    .runOnQueue(.main)

    AsyncFunction("setAppIcon") { (name: String, promise: Promise) in
      setIcon(name: name, promise: promise)
    }
    .runOnQueue(.main)
  }

  private func configuredIconNames() -> [String] {
    let raw = Bundle.main.object(forInfoDictionaryKey: iconNamesPlistKey) as? [String] ?? []

    var ordered: [String] = [defaultIconName]
    for name in raw where !ordered.contains(name) {
      ordered.append(name)
    }
    return ordered
  }

  private func setName(for name: String) -> String {
    return iconSetPrefix + name
  }


  private func setIcon(name: String, promise: Promise) {
    let configured = configuredIconNames()

    guard configured.contains(name) else {
      promise.reject(IconNotConfiguredException((name, configured)))
      return
    }

    guard UIApplication.shared.supportsAlternateIcons else {
      promise.reject(UnsupportedException())
      return
    }

    let alternateName: String? = (name == defaultIconName) ? nil : setName(for: name)

    if UIApplication.shared.alternateIconName == alternateName {
      promise.resolve()
      return
    }

    UIApplication.shared.setAlternateIconName(alternateName) { error in
      if let error = error {
        promise.reject(IconSwitchFailedException(error.localizedDescription))
      } else {
        promise.resolve()
      }
    }
  }

  private func currentIconName() -> String {
    guard let active = UIApplication.shared.alternateIconName else {
      return defaultIconName
    }

    if active.hasPrefix(iconSetPrefix) {
      return String(active.dropFirst(iconSetPrefix.count))
    }
    return active
  }
}
