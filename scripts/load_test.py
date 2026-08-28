import concurrent.futures
import os
import time
import urllib.request


URL = os.getenv("LOAD_TEST_URL", "http://127.0.0.1:4000/api/health")
REQUESTS = int(os.getenv("LOAD_TEST_REQUESTS", "300"))


def request(_index: int) -> int:
    with urllib.request.urlopen(URL, timeout=10) as response:
        response.read()
        return response.status


started = time.perf_counter()
with concurrent.futures.ThreadPoolExecutor(max_workers=min(REQUESTS, 50)) as executor:
    statuses = list(executor.map(request, range(REQUESTS)))
elapsed = time.perf_counter() - started
successful = sum(status == 200 for status in statuses)
print(f"{successful}/{REQUESTS} successful in {elapsed:.2f}s ({REQUESTS / elapsed:.1f} requests/s)")
if successful != REQUESTS:
    raise SystemExit(1)
