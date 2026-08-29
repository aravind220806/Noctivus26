import asyncio

from app.services.boarding_pass_service import validate_boarding_pass_layout


PASS_DATA = {
    "eventId": "cyber-heist-ctf",
    "eventName": "Cyber Security Capture The Flag Challenge",
    "date": "26 SEP 2026",
    "time": "09:00 AM",
    "gate": "VEC GATE",
    "venue": "Computer Science and Engineering Block - Advanced Cyber Security Laboratory",
    "terminal": "MAIN HALL",
    "seatType": "VIP",
}


CASES = [
    {
        "registrationId": "NOC26-SHORT",
        "participant": {
            "name": "Aravind Kumar",
            "college": "ABC College",
            "email": "aravind@example.com",
            "foodPreference": "Vegetarian",
        },
        "eventRegistrations": [{"eventId": "cyber-heist-ctf", "eventName": "Cyber Hunt", "category": "Technical", "feeSnapshot": 200}],
    },
    {
        "registrationId": "NOC26-LONG",
        "participant": {
            "name": "Mohammed Abdul Rahman Shafeeq",
            "college": "Sri Venkateswara College of Engineering and Technology",
            "email": "mohammed.abdulrahman.shafeeq.department2026@gmail.com",
            "foodPreference": "Special Vegetarian Dietary Requirement",
        },
        "eventRegistrations": [{"eventId": "cyber-heist-ctf", "eventName": "Cyber Security Capture The Flag Challenge", "category": "Technical", "feeSnapshot": 200}],
    },
    {
        "registrationId": "NOC26-EXTREME",
        "participant": {
            "name": "Venkata Sai Krishna Chaitanya Reddy",
            "college": "St. Joseph's Institute of Technology and Advanced Engineering Studies",
            "email": "student.computerscience.cybersecurity.department2026@examplecollege.ac.in",
            "foodPreference": "Special Dietary Requirement",
        },
        "eventRegistrations": [{"eventId": "cyber-heist-ctf", "eventName": "Artificial Intelligence and Cyber Security Innovation Challenge", "category": "Technical", "feeSnapshot": 200}],
    },
]


async def main() -> None:
    failures = []
    for case in CASES:
        case_failures = await validate_boarding_pass_layout(case, PASS_DATA)
        if case_failures:
            failures.append({"registrationId": case["registrationId"], "failures": case_failures})
    if failures:
        raise SystemExit(f"Boarding pass autofit failures: {failures}")
    print(f"Boarding pass layout checks passed for {len(CASES)} cases.")


if __name__ == "__main__":
    asyncio.run(main())
