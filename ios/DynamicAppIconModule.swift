import ExpoModulesCore

public class DynamicAppIconModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DynamicAppIcon")

    AsyncFunction("setValueAsync") { (value: String) in
    }
  }
}
