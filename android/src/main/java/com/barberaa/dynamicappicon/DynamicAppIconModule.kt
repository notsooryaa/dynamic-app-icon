package com.barberaa.dynamicappicon

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DynamicAppIconModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DynamicAppIcon")

    AsyncFunction("setValueAsync") { value: String ->
    }
  }
}
