package com.barberaa.dynamicappicon

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val DEFAULT_ICON_NAME = "default"

private const val ALIAS_PREFIX = ".DynamicAppIconAlias_"

private const val ICON_NAMES_METADATA = "com.barberaa.dynamicappicon.ICON_NAMES"

private class MissingContextException :
  CodedException("Unable to access the Android application context.")

private class IconNotConfiguredException(name: String, available: List<String>) :
  CodedException(
    "Icon \"$name\" is not configured. Available icons: " +
      available.joinToString(", ") { "\"$it\"" } + "."
  )

private class IconSwitchFailedException(cause: Throwable) :
  CodedException("Unable to switch application icon.", cause)

class DynamicAppIconModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DynamicAppIcon")

    Property("icons") {
      getConfiguredIconNames()
    }

    AsyncFunction("getAppIcon") {
      getCurrentIconName()
    }

    AsyncFunction("setAppIcon") { name: String ->
      setCurrentIcon(name)
    }
  }


  private val context: Context
    get() = appContext.reactContext ?: throw MissingContextException()

  private val packageName: String
    get() = context.packageName

  private val packageManager: PackageManager
    get() = context.packageManager

  private fun getConfiguredIconNames(): List<String> {
    val applicationInfo = packageManager.getApplicationInfo(
      packageName,
      PackageManager.GET_META_DATA
    )
    val raw = applicationInfo.metaData?.getString(ICON_NAMES_METADATA)

    val names = raw
      ?.split(",")
      ?.map { it.trim() }
      ?.filter { it.isNotEmpty() }
      ?: emptyList()

    val ordered = LinkedHashSet<String>()
    ordered.add(DEFAULT_ICON_NAME)
    ordered.addAll(names)
    return ordered.toList()
  }

  private fun aliasComponentFor(name: String): ComponentName {
    return ComponentName(packageName, packageName + ALIAS_PREFIX + name)
  }

  private fun setCurrentIcon(name: String) {
    val configured = getConfiguredIconNames()
    if (!configured.contains(name)) {
      throw IconNotConfiguredException(name, configured)
    }

    try {
      for (iconName in configured) {
        val component = aliasComponentFor(iconName)
        val newState = if (iconName == name) {
          PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        } else {
          PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        }

        if (packageManager.getComponentEnabledSetting(component) == newState) {
          continue
        }

        packageManager.setComponentEnabledSetting(
          component,
          newState,
          PackageManager.DONT_KILL_APP
        )
      }
    } catch (error: Throwable) {
      throw IconSwitchFailedException(error)
    }
  }
  private fun getCurrentIconName(): String {
    val configured = getConfiguredIconNames()

    for (iconName in configured) {
      if (iconName == DEFAULT_ICON_NAME) {
        continue
      }
      val state = packageManager.getComponentEnabledSetting(aliasComponentFor(iconName))
      if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
        return iconName
      }
    }

    return DEFAULT_ICON_NAME
  }
}
