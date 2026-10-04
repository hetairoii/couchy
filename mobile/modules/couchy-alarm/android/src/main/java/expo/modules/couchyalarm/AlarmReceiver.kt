package expo.modules.couchyalarm

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** The alarm manager wakes the app here at the exact minute, even if the app is closed. */
class AlarmReceiver : BroadcastReceiver() {
  companion object {
    const val EXTRA_KEY = "key"
  }

  override fun onReceive(ctx: Context, intent: Intent) {
    val key = intent.getStringExtra(EXTRA_KEY) ?: return
    val item = AlarmStore.find(ctx, key) ?: return
    AlarmScheduler.onFired(ctx, key) // arm tomorrow's (or next week's) occurrence first

    val service = Intent(ctx, AlarmService::class.java).putExtra(AlarmService.EXTRA_ITEM, item.toJson().toString())
    try {
      ContextCompat.startForegroundService(ctx, service)
    } catch (e: Exception) {
      // The system refused the service: still ring, with a full-screen notification that has the alarm sound.
      val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.notify(
        AlarmNotifications.ID_RINGING,
        AlarmNotifications.ringing(ctx, item, AlarmNotifications.CHANNEL_FALLBACK),
      )
    }
  }
}
