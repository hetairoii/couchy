package expo.modules.couchyalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Alarms do not survive a reboot, an app update or a clock change by themselves: arm them again. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    AlarmScheduler.rearmAll(ctx)
  }
}
