package expo.modules.couchyalarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** One reminder: a medication at a time of day on some days of the week (0 = Sunday ... 6 = Saturday). */
data class AlarmItem(
  val key: String,
  val medId: String,
  val medName: String,
  val dosage: String,
  val time: String, // "HH:MM", device-local
  val days: List<Int>,
) {
  fun toJson() = JSONObject()
    .put("key", key).put("medId", medId).put("medName", medName)
    .put("dosage", dosage).put("time", time).put("days", JSONArray(days))

  companion object {
    fun fromJson(o: JSONObject) = AlarmItem(
      key = o.getString("key"),
      medId = o.getString("medId"),
      medName = o.optString("medName"),
      dosage = o.optString("dosage"),
      time = o.getString("time"),
      days = o.optJSONArray("days")?.let { a -> List(a.length()) { a.getInt(it) } } ?: emptyList(),
    )
  }
}

/** A single extra alarm (the 10 minute snooze). */
data class OnceAlarm(val item: AlarmItem, val triggerAt: Long)

/**
 * Everything the alarm needs lives in SharedPreferences so it works when the JS app is closed
 * (the alarm fires from a broadcast receiver, long after the React Native process died).
 */
object AlarmStore {
  private const val PREFS = "couchy_alarm"

  private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun items(ctx: Context): List<AlarmItem> {
    val raw = prefs(ctx).getString("items", null) ?: return emptyList()
    return runCatching {
      JSONArray(raw).let { a -> List(a.length()) { AlarmItem.fromJson(a.getJSONObject(it)) } }
    }.getOrDefault(emptyList())
  }

  fun saveItems(ctx: Context, items: List<AlarmItem>) {
    val a = JSONArray()
    items.forEach { a.put(it.toJson()) }
    prefs(ctx).edit().putString("items", a.toString()).apply()
  }

  fun once(ctx: Context): List<OnceAlarm> {
    val raw = prefs(ctx).getString("once", null) ?: return emptyList()
    return runCatching {
      JSONArray(raw).let { a ->
        List(a.length()) {
          val o = a.getJSONObject(it)
          OnceAlarm(AlarmItem.fromJson(o.getJSONObject("item")), o.getLong("triggerAt"))
        }
      }
    }.getOrDefault(emptyList())
  }

  fun saveOnce(ctx: Context, list: List<OnceAlarm>) {
    val a = JSONArray()
    list.forEach { a.put(JSONObject().put("item", it.item.toJson()).put("triggerAt", it.triggerAt)) }
    prefs(ctx).edit().putString("once", a.toString()).apply()
  }

  /** medId -> local file of the companion's voice naming that medicine. */
  fun audio(ctx: Context): Map<String, String> {
    val raw = prefs(ctx).getString("audio", null) ?: return emptyMap()
    return runCatching {
      JSONObject(raw).let { o -> o.keys().asSequence().associateWith { o.getString(it) } }
    }.getOrDefault(emptyMap())
  }

  fun fallbackAudio(ctx: Context): String? = prefs(ctx).getString("fallback", null)?.takeIf { it.isNotEmpty() }

  fun saveAudio(ctx: Context, audio: Map<String, String>, fallback: String?) {
    val o = JSONObject()
    audio.forEach { (k, v) -> o.put(k, v) }
    prefs(ctx).edit().putString("audio", o.toString()).putString("fallback", fallback ?: "").apply()
  }

  /** Looks a key up in both the recurring items and the one-off (snooze) alarms. */
  fun find(ctx: Context, key: String): AlarmItem? =
    items(ctx).firstOrNull { it.key == key } ?: once(ctx).firstOrNull { it.item.key == key }?.item
}
