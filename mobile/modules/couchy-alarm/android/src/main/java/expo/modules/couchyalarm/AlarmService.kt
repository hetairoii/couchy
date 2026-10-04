package expo.modules.couchyalarm

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import org.json.JSONObject
import java.io.File

/**
 * Foreground service that rings like an alarm clock: the companion's voice on the alarm audio stream
 * (audible when the phone is muted or in Do Not Disturb), vibration, screen wake-up, repeated until the person
 * answers in the app (stopService) or five minutes pass.
 */
class AlarmService : Service() {
  companion object {
    const val EXTRA_ITEM = "item"
    private const val MAX_RING_MS = 5 * 60_000L
    private const val REPLAY_DELAY_MS = 12_000L

    fun stop(ctx: Context) {
      ctx.stopService(Intent(ctx, AlarmService::class.java))
      (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(AlarmNotifications.ID_RINGING)
    }
  }

  private val handler = Handler(Looper.getMainLooper())
  private var player: MediaPlayer? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var current: AlarmItem? = null

  private val replay = Runnable {
    runCatching { player?.let { it.seekTo(0); it.start() } }
  }

  private val giveUp = Runnable {
    current?.let { item ->
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.notify(AlarmNotifications.ID_MISSED, AlarmNotifications.missed(this, item))
    }
    stopForegroundCompat()
    stopSelf()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val item = intent?.getStringExtra(EXTRA_ITEM)?.let { runCatching { AlarmItem.fromJson(JSONObject(it)) }.getOrNull() }
    if (item == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    current = item
    val notification = AlarmNotifications.ringing(this, item)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(AlarmNotifications.ID_RINGING, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(AlarmNotifications.ID_RINGING, notification)
    }
    ring(item)
    return START_NOT_STICKY
  }

  private fun ring(item: AlarmItem) {
    stopSound()
    acquireWakeLock()
    raiseAlarmVolume()
    startVibration()

    val voice = listOfNotNull(AlarmStore.audio(this)[item.medId], AlarmStore.fallbackAudio(this)).firstOrNull(::exists)
    if (!playVoice(voice)) playRingtone() // never silent: last resort is the system alarm tone (not a voice)

    handler.removeCallbacks(giveUp)
    handler.postDelayed(giveUp, MAX_RING_MS)
  }

  private fun exists(path: String): Boolean = runCatching { File(Uri.parse(path).path ?: path).exists() }.getOrDefault(false)

  private val alarmAttributes: AudioAttributes =
    AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()

  private fun playVoice(path: String?): Boolean {
    if (path == null) return false
    return runCatching {
      MediaPlayer().apply {
        setAudioAttributes(alarmAttributes)
        setDataSource(applicationContext, Uri.parse(path))
        setOnCompletionListener { handler.postDelayed(replay, REPLAY_DELAY_MS) }
        prepare()
        start()
        player = this
      }
    }.isSuccess
  }

  private fun playRingtone() {
    runCatching {
      MediaPlayer().apply {
        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        setDataSource(applicationContext, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
        isLooping = true
        prepare()
        start()
        player = this
      }
    }
  }

  /** The alarm stream has its own volume: if it was turned down to zero the alarm would be silent. */
  private fun raiseAlarmVolume() {
    runCatching {
      val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
      val floor = (max * 0.7).toInt().coerceAtLeast(1)
      if (am.getStreamVolume(AudioManager.STREAM_ALARM) < floor) am.setStreamVolume(AudioManager.STREAM_ALARM, floor, 0)
    }
  }

  private fun vibrator(): Vibrator =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }

  @Suppress("DEPRECATION")
  private fun startVibration() {
    runCatching {
      val pattern = longArrayOf(0, 700, 400, 700, 400, 700, 2500)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrator().vibrate(VibrationEffect.createWaveform(pattern, 0), alarmAttributes)
      } else {
        vibrator().vibrate(pattern, 0)
      }
    }
  }

  private fun acquireWakeLock() {
    runCatching {
      if (wakeLock?.isHeld == true) return
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "couchy:alarm").apply { acquire(MAX_RING_MS + 10_000L) }
    }
  }

  private fun stopSound() {
    handler.removeCallbacks(replay)
    runCatching { player?.stop() }
    runCatching { player?.release() }
    player = null
  }

  private fun stopForegroundCompat() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
    else @Suppress("DEPRECATION") stopForeground(true)
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    stopSound()
    runCatching { vibrator().cancel() }
    runCatching { if (wakeLock?.isHeld == true) wakeLock?.release() }
    super.onDestroy()
  }
}
