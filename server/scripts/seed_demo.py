"""Creates a demo device with 14 days of realistic history (evening doses are often late).

    python -m scripts.seed_demo            # run from the server/ directory
"""
import random
from datetime import datetime, timedelta

from sqlmodel import Session

from app.models import Device, DoseEvent, Medication, get_engine

random.seed(7)
DEVICE_ID, API_KEY = "demo-device", "demo-key"


def main() -> None:
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    with Session(get_engine()) as s:
        if s.get(Device, DEVICE_ID):
            print("Demo device already exists")
            return
        s.add(Device(id=DEVICE_ID, api_key=API_KEY, preferred_name="Rose", companion_id="grace",
                     family_names=["Leo", "Maria"], likes=["gardening", "tea"], link_code="DEMO42"))
        s.add(Medication(id="metformin", device_id=DEVICE_ID, name="Metformin", dosage="500 mg",
                         times=["08:00", "20:00"]))
        for day in range(14, 0, -1):
            for hour in (8, 20):
                sched = (now - timedelta(days=day)).replace(hour=hour)
                late_bias = 35 if hour == 20 else 5
                roll = random.random()
                if roll < 0.08 + (0.07 if hour == 20 else 0):
                    status, taken = "missed", None
                else:
                    status, taken = "taken", sched + timedelta(minutes=max(0, int(random.gauss(late_bias, 15))))
                s.add(DoseEvent(id=f"demo_{day}_{hour}", device_id=DEVICE_ID, medication_id="metformin",
                                scheduled_at=sched, reminded_at=sched, taken_at=taken, status=status,
                                snooze_count=random.choice([0, 0, 1, 2]) if status == "taken" else 3))
        s.commit()
    print(f"Seeded. device_id={DEVICE_ID} api_key={API_KEY}")


if __name__ == "__main__":
    main()
