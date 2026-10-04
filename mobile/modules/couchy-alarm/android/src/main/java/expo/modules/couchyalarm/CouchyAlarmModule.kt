package expo.modules.couchyalarm

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class AlarmItemRecord : Record {
  @Field var key: String = ""
  @Field var medId: String = ""
  @Field var medName: String = ""
  @Field var dosage: String = ""
  @Field var time: String = ""
  @Field var days: List<Int> = emptyList()

  fun toItem() = AlarmItem(key, medId, medName, dosage, time, days)
}

class CouchyAlarmModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("CouchyAlarm")

    // Replaces every recurring reminder with this list.
    AsyncFunction("schedule") { items: List<AlarmItemRecord> ->
      AlarmNotifications.ensureChannels(context)
      AlarmScheduler.replaceAll(context, items.map { it.toItem() })
    }

    // One extra alarm in `minutes` minutes (the snooze).
    AsyncFunction("scheduleOnce") { item: AlarmItemRecord, minutes: Int ->
      AlarmScheduler.scheduleOnce(context, item.toItem(), minutes)
    }

    AsyncFunction<Unit>("cancelAll") {
      AlarmScheduler.cancelAll(context)
    }

    // medId -> local audio file (the companion naming the medicine) and the generic "time to take your medicine" line.
    AsyncFunction("setAudio") { audio: Map<String, String>, fallback: String? ->
      AlarmStore.saveAudio(context, audio, fallback)
    }

    AsyncFunction<Unit>("stopRinging") {
      AlarmService.stop(context)
    }

    AsyncFunction<Map<String, Boolean>>("getStatus") {
      status()
    }

    AsyncFunction("openSettings") { kind: String ->
      openSettings(kind)
    }
  }

  private fun status(): Map<String, Boolean> {
    val ctx = context
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
    return mapOf(
      "notifications" to NotificationManagerCompat.from(ctx).areNotificationsEnabled(),
      "exactAlarm" to (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()),
      "fullScreen" to (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE || nm.canUseFullScreenIntent()),
      "dndAccess" to nm.isNotificationPolicyAccessGranted,
      "batteryUnrestricted" to pm.isIgnoringBatteryOptimizations(ctx.packageName),
    )
  }

  private fun openSettings(kind: String) {
    val ctx = context
    val pkg = Uri.parse("package:${ctx.packageName}")
    val intent = when (kind) {
      "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
      "exactAlarm" ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg) else null
      "fullScreen" ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg) else null
      "dnd" -> Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
      "battery" -> Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg)
      else -> null
    } ?: return
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { ctx.startActivity(intent) }.onFailure {
      // Some phones lack a specific screen: open the app's own settings page instead.
      runCatching {
        ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }
  }
}
