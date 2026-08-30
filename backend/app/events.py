EVENT_CATALOG = [
    {"id": "ideathon", "name": "Ideathon", "category": "tech", "duration_minutes": 90, "is_ctf": False, "fee": 200, "teamMin": 1, "teamMax": 1, "detailsComplete": True, "status": "open", "venue": "Main Auditorium", "date": "2026-09-26", "time": "09:00", "gate": "VEC Gate 1"},
    {"id": "cyber-heist-ctf", "name": "Cyber Heist CTF", "category": "tech", "duration_minutes": 180, "is_ctf": True, "fee": 200, "teamMin": 1, "teamMax": 1, "detailsComplete": True, "status": "open", "venue": "CSE Cyber Lab 1", "date": "2026-09-26", "time": "09:00", "gate": "VEC Gate 1"},
    {"id": "iot-exploit", "name": "IoT Exploit", "category": "tech", "duration_minutes": 90, "is_ctf": False, "fee": 200, "teamMin": 1, "teamMax": 1, "detailsComplete": True, "status": "open", "venue": "IoT Research Lab", "date": "2026-09-26", "time": "09:00", "gate": "VEC Gate 1"},
    {"id": "secure-x-vibecode", "name": "Secure X VibeCode", "category": "tech", "duration_minutes": 60, "is_ctf": False, "fee": 200, "teamMin": 1, "teamMax": 1, "detailsComplete": True, "status": "open", "venue": "Seminar Hall A", "date": "2026-09-26", "time": "09:00", "gate": "VEC Gate 1"},
    {"id": "mind-cage", "name": "Mind Cage", "category": "tech", "duration_minutes": 60, "is_ctf": False, "fee": 200, "teamMin": 1, "teamMax": 1, "detailsComplete": True, "status": "open", "venue": "Seminar Hall B", "date": "2026-09-26", "time": "09:00", "gate": "VEC Gate 1"},
    {"id": "mystery-hunt", "name": "Mystery Hunt", "category": "non-tech", "duration_minutes": 60, "is_ctf": False, "fee": 150, "teamMin": 1, "teamMax": 1, "detailsComplete": True, "status": "open", "venue": "Campus Grounds", "date": "2026-09-26", "time": "09:00", "gate": "VEC Gate 1"},
    {"id": "tune-trap", "name": "Tune Trap", "category": "non-tech", "duration_minutes": 60, "is_ctf": False, "fee": 150, "teamMin": 1, "teamMax": 1, "detailsComplete": True, "status": "open", "venue": "Open Air Theatre", "date": "2026-09-26", "time": "09:00", "gate": "VEC Gate 1"},
    {"id": "auction-arena", "name": "Auction Arena", "category": "non-tech", "duration_minutes": 90, "is_ctf": False, "fee": 150, "teamMin": 1, "teamMax": 1, "detailsComplete": True, "status": "open", "venue": "Mini Auditorium", "date": "2026-09-26", "time": "09:00", "gate": "VEC Gate 1"},
]

EVENTS_BY_ID = {event["id"]: event for event in EVENT_CATALOG}
