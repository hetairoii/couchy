package expo.modules.couchyalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

/** Arms real alarm-clock alarms: exact, they fire in Doze, and Android shows the alarm icon in the status bar. */
object AlarmScheduler {
  private const val ONCE_PREFIX = "once_"

  /** Next moment this reminder is due after `from`, or null if it has no days selected. */
  fun nextTrigger(item: AlarmItem, from: Long = System.currentTimeMillis()): Long? {
    val parts = item.time.split(":")
    val hour = parts.getOrNull(0)?.toIntOrNull() ?: return null
    val minute = parts.getOrNull(1)?.toIntOrNull() ?: return null
    for (offset in 0..7) {
      val cal = Calendar.getInstance().apply {
        timeInMillis = from
        add(Calendar.DAY_OF_YEAR, offset)
        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      val day = cal.get(Calendar.DAY_OF_WEEK) - 1 // Calendar: Sunday = 1
      if (cal.timeInMillis > from + 1000 && day in item.days) return cal.timeInMillis
    }
    return null
  }

  private fun alarmManager(ctx: Context) = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun operation(ctx: Context, key: String): PendingIntent {
    val intent = Intent(ctx, AlarmReceiver::class.java).putExtra(AlarmReceiver.EXTRA_KEY, key)
    return PendingIntent.getBroadcast(
      ctx, key.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** Tapping the alarm icon in the status bar opens the app. */
  private fun showIntent(ctx: Context): PendingIntent {
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent()
    return PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun canExact(ctx: Context) =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager(ctx).canScheduleExactAlarms()

  private fun arm(ctx: Context, key: String, triggerAt: Long) {
    val am = alarmManager(ctx)
    val pi = operation(ctx, key)
    if (canExact(ctx)) {
      am.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, showIntent(ctx)), pi)
    } else {
      // Without the "Alarms & reminders" permission the system refuses exact alarms; ring as close as it allows.
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
    }
  }

  private fun disarm(ctx: Context, key: String) {
    alarmManager(ctx).cancel(operation(ctx, key))
  }

  private fun onceKey(item: AlarmItem) = ONCE_PREFIX + item.key

  /** Replaces every recurring alarm with `items`. */
  fun replaceAll(ctx: Context, items: List<AlarmItem>) {
    AlarmStore.items(ctx).forEach { disarm(ctx, it.key) }
    AlarmStore.saveItems(ctx, items)
    items.forEach { item -> nextTrigger(item)?.let { arm(ctx, item.key, it) } }
  }

  fun scheduleOnce(ctx: Context, item: AlarmItem, minutes: Int) {
    val once = item.copy(key = onceKey(item))
    val triggerAt = System.currentTimeMillis() + minutes * 60_000L
    val list = AlarmStore.once(ctx).filter { it.item.key != once.key } + OnceAlarm(once, triggerAt)
    AlarmStore.saveOnce(ctx, list)
    arm(ctx, once.key, triggerAt)
  }

  fun cancelAll(ctx: Context) {
    AlarmStore.items(ctx).forEach { disarm(ctx, it.key) }
    AlarmStore.once(ctx).forEach { disarm(ctx, it.item.key) }
    AlarmStore.saveItems(ctx, emptyList())
    AlarmStore.saveOnce(ctx, emptyList())
  }

  /** Called when an alarm fires: arm the next occurrence of a recurring reminder, forget a one-off. */
  fun onFired(ctx: Context, key: String) {
    if (key.startsWith(ONCE_PREFIX)) {
      AlarmStore.saveOnce(ctx, AlarmStore.once(ctx).filter { it.item.key != key })
    } else {
      AlarmStore.items(ctx).firstOrNull { it.key == key }?.let { item ->
        nextTrigger(item)?.let { arm(ctx, item.key, it) }
      }
    }
  }

  /** After a reboot, an app update or a clock/time-zone change: arm everything again. */
  fun rearmAll(ctx: Context) {
    val now = System.currentTimeMillis()
    AlarmStore.items(ctx).forEach { item -> nextTrigger(item)?.let { arm(ctx, item.key, it) } }
    val live = AlarmStore.once(ctx).filter { it.triggerAt > now }
    AlarmStore.saveOnce(ctx, live)
    live.forEach { arm(ctx, it.item.key, it.triggerAt) }
  }
}
