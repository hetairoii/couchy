"""High-level Gemma tasks used by the API and the watchdog."""
import json

from app.agent import prompts
from app.agent.ollama import AlertText, Messages, ReplyIntent, WeeklyReport, safe_chat
from app.companions import get_companion


def _csv(items) -> str:
    return ", ".join(items) if items else "none"


async def reminder_messages(med: dict, companion_id: str, profile: dict, time_of_day: str, count: int) -> list[str]:
    c = get_companion(companion_id)
    name = profile.get("preferred_name") or "friend"
    templates = [
        f"Good {time_of_day}, {name}. It's time for your {med['name']}.",
        f"[warmly] {name}, a gentle reminder to take your {med['name']} ({med['dosage']}).",
        f"Hello {name}! Your {med['name']} is waiting for you.",
    ]
    fallback = Messages(messages=templates[:count] or templates[:1])
    prompt = prompts.render(
        "COMPANION", companion_name=c["name"], personality=c["personality"], preferred_name=name,
        family_names=_csv(profile.get("family_names")), likes=_csv(profile.get("likes")),
        routine_notes=profile.get("routine_notes") or "none", count=count, medication_name=med["name"],
        dosage=med["dosage"], time_of_day=time_of_day, instructions=med.get("instructions") or "",
    )
    result = await safe_chat(prompt, Messages, fallback, temperature=0.8)
    return [m.strip() for m in result.messages if m.strip()][:count] or fallback.messages


async def interpret_reply(transcript: str, med: dict, companion_id: str, profile: dict,
                          scheduled_time: str, now: str) -> ReplyIntent:
    c = get_companion(companion_id)
    fallback = ReplyIntent(intent="unclear", reply="I didn't quite catch that. Could you tap a button for me?")
    prompt = prompts.render(
        "REPLY_INTENT", companion_name=c["name"], preferred_name=profile.get("preferred_name") or "friend",
        medication_name=med["name"], scheduled_time=scheduled_time, now=now, transcript=transcript,
    )
    return await safe_chat(prompt, ReplyIntent, fallback, temperature=0.2)


_ALERT_TEMPLATES = {
    "missed_dose": "{name} has not confirmed {medication} (due {scheduled_time}). Their phone may be offline. Please give them a call.",
    "inactivity": "No activity from {name} since {last_activity}. Their phone may be offline. Please check in.",
    "concern": "{name} told Couchy: \"{transcript}\". Please call them.",
    "help_request": "{name} pressed the help button and said: \"{transcript}\". Please call them right away.",
}


async def alert_text(alert_type: str, name: str, facts: dict) -> str:
    fallback = AlertText(text=_ALERT_TEMPLATES[alert_type].format(
        name=name,
        medication=facts.get("medication", ""),
        scheduled_time=facts.get("scheduled_time", ""),
        last_activity=facts.get("last_activity", ""),
        transcript=facts.get("transcript", ""),
    ))
    prompt = prompts.render("ALERT", preferred_name=name, alert_type=alert_type, facts_json=json.dumps(facts))
    return (await safe_chat(prompt, AlertText, fallback, temperature=0.4)).text


async def weekly_report(name: str, companion_id: str, metrics: dict) -> WeeklyReport:
    c = get_companion(companion_id)
    adherence = metrics.get("adherence_rate")
    fallback = WeeklyReport(
        headline=f"{name}'s week with Couchy",
        bullets=[f"Adherence: {adherence}%", f"Doses taken on time: {metrics.get('on_time_rate')}%"],
        suggestion="Give them a call to say hello.",
        spoken_version=f"Here is {name}'s weekly update. Adherence was {adherence} percent.",
    )
    prompt = prompts.render("WEEKLY_REPORT", preferred_name=name, companion_name=c["name"],
                            metrics_json=json.dumps(metrics))
    return await safe_chat(prompt, WeeklyReport, fallback, temperature=0.4)
