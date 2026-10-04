package expo.modules.couchyalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build

object AlarmNotifications {
  /** Used by the ringing service: it plays its own sound, so this channel is silent. */
  const val CHANNEL_RINGING = "couchy-alarm"

  /** Used only if the service cannot start: the system itself plays the alarm sound. */
  const val CHANNEL_FALLBACK = "couchy-alarm-fallback"

  const val ID_RINGING = 4242
  const val ID_MISSED = 4243

  fun ensureChannels(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    nm.createNotificationChannel(NotificationChannel(CHANNEL_RINGING, "Pill alarm", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "The alarm that reminds you to take your pills"
      setSound(null, null)
      enableVibration(false)
      setBypassDnd(true)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setShowBadge(false)
    })

    nm.createNotificationChannel(NotificationChannel(CHANNEL_FALLBACK, "Pill alarm (backup)", NotificationManager.IMPORTANCE_HIGH).apply {
      setSound(
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build(),
      )
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 600, 300, 600, 300, 600)
      setBypassDnd(true)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    })
  }

  /** couchy://alarm?medId=...&time=HH:MM opens the dose screen through expo-router. */
  fun openAppIntent(ctx: Context, item: AlarmItem): PendingIntent {
    val uri = Uri.parse("couchy://alarm").buildUpon()
      .appendQueryParameter("medId", item.medId)
      .appendQueryParameter("time", item.time)
      .build()
    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
      setPackage(ctx.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    return PendingIntent.getActivity(
      ctx, item.key.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** The alarm notification: full screen over the lock screen, cannot be swiped away while it rings. */
  fun ringing(ctx: Context, item: AlarmItem, channel: String = CHANNEL_RINGING): Notification {
    ensureChannels(ctx)
    val open = openAppIntent(ctx, item)
    val text = listOf(item.dosage, "Tap to open").filter { it.isNotBlank() }.joinToString(" - ")
    return builder(ctx, channel)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle("Time for your ${item.medName}")
      .setContentText(text)
      .setCategory(Notification.CATEGORY_ALARM)
      .setPriority(Notification.PRIORITY_MAX)
      .setOngoing(true)
      .setAutoCancel(false)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(open)
      .setFullScreenIntent(open, true)
      .build()
  }

  /** Left behind when nobody answered after the alarm gave up. */
  fun missed(ctx: Context, item: AlarmItem): Notification {
    ensureChannels(ctx)
    return builder(ctx, CHANNEL_RINGING)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle("You have not taken your ${item.medName}")
      .setContentText("Tap to open Couchy")
      .setCategory(Notification.CATEGORY_REMINDER)
      .setAutoCancel(true)
      .setContentIntent(openAppIntent(ctx, item))
      .build()
  }

  @Suppress("DEPRECATION")
  private fun builder(ctx: Context, channel: String): Notification.Builder =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(ctx, channel) else Notification.Builder(ctx)
}
