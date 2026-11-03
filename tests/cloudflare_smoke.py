"""Exercise the actual Workers runtime and D1 locally; never connects to a cloud account."""
import base64
import hashlib
import concurrent.futures
import json
import re
import os
from pathlib import Path
import secrets
import signal
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:4206"
WRANGLER = ["node", str(ROOT / "node_modules/wrangler/bin/wrangler.js")]


def request(path, body=None, cookie=None, method=None):
    headers = {"Content-Type": "application/json", "Origin": BASE}
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers=headers, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    data = response.read()
    parsed = json.loads(data) if "application/json" in response.headers.get("Content-Type", "") else data
    return response.status, parsed, response.headers


def stop(process):
    if process and process.poll() is None:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=20)


def main():
    token, password = secrets.token_urlsafe(32), secrets.token_urlsafe(24)
    env = os.environ.copy()
    env.update(WRANGLER_SEND_METRICS="false", BROWSER="none")
    with tempfile.TemporaryDirectory(prefix="midway-worker-test-") as temporary:
        temp = Path(temporary)
        config = json.loads(re.sub(r",(\s*[}\]])",r"\1",(ROOT / "wrangler.jsonc").read_text()))
        config["main"] = str(ROOT / config["main"])
        config["assets"]["directory"] = str(ROOT / config["assets"]["directory"])
        config["d1_databases"][0]["migrations_dir"] = str(ROOT / "cloudflare/migrations")
        config["vars"]["MIDWAY_SECURE_COOKIES"] = "false"
        config_path = temp / "wrangler.json"
        config_path.write_text(json.dumps(config))
        secret_file = temp / ".dev.vars"
        secret_file.write_text('MIDWAY_SETUP_TOKEN="' + token + '"\n')
        secret_file.chmod(0o600)
        common = ["--config", str(config_path), "--persist-to", str(temp / "state")]
        migration = subprocess.run(WRANGLER + ["d1", "migrations", "apply", "midway-workspace", "--local"] + common,
                                   cwd=ROOT, env=env, capture_output=True, text=True)
        if migration.returncode:
            raise RuntimeError("D1 migration failed: " + (migration.stdout + migration.stderr).replace(token, "[redacted]")[-2500:])
        print("PASS: D1 migration on an isolated temporary database", flush=True)
        log = open(temp / "worker.log", "w+")
        process = None

        def start():
            process = subprocess.Popen(WRANGLER + ["dev", "--local", "--ip", "127.0.0.1", "--port", "4206"] + common,
                                       cwd=ROOT, env=env, stdout=log, stderr=log, start_new_session=True)
            for _ in range(100):
                if process.poll() is not None:
                    break
                try:
                    if request("/api/health")[0] == 200:
                        return process
                except OSError:
                    pass
                time.sleep(.2)
            stop(process)
            log.flush()
            log.seek(0)
            raise RuntimeError("Worker failed: " + log.read().replace(token, "[redacted]").replace(password, "[redacted]")[-3000:])

        try:
            process = start()
            status, state, _ = request("/api/workspace/session")
            assert status == 200 and state["needsSetup"] and state["setupTokenRequired"]
            assert state["uploadLimits"]["attachmentBytes"] == 1024 * 1024
            assert state["demoMode"] is False
            assert request("/api/workspace/operations")[0] == 401
            browser_env = env.copy()
            browser_env.update(MIDWAY_TEST_BASE_URL=BASE, MIDWAY_TEST_SETUP_TOKEN=token, MIDWAY_TEST_PASSWORD=password,
                               MIDWAY_ARTIFACTS=str(ROOT / ".cache/cloudflare-browser"), MIDWAY_DEMO_MODE="false")
            subprocess.run(["python", "tests/browser_smoke.py"], cwd=ROOT, env=browser_env, check=True)
            print("PASS: real Worker/D1 desktop/mobile browser workflow", flush=True)

            def credential(secret,salt):
                proof=hashlib.pbkdf2_hmac("sha256",secret.encode(),bytes.fromhex(salt),600000).hex()
                return "p2$600000$"+salt+"$"+proof

            def login(email,secret=password):
                challenge=request("/api/workspace/login-challenge",{"email":email})[1]
                wire=credential(secret,challenge['salt'])
                status, _, headers = request("/api/workspace/login", {"email": email, "password": wire})
                assert status == 200
                return headers["set-cookie"].split(";")[0]

            branch = login("branch-ui@example.invalid")
            flight = login("flight-ui@example.invalid")
            sales = login("sales-ui@example.invalid")
            employee = login("employee-ui@example.invalid")
            other = login("other-ui@example.invalid")
            users = request("/api/workspace/users", cookie=branch)[1]
            other_id = next(u["id"] for u in users if u["email"] == "other-ui@example.invalid")
            assert request("/api/workspace/users", cookie=flight)[0] == 403
            assert request("/api/workspace/operations", cookie=other)[1]["requests"] == []
            state = request("/api/workspace/operations", cookie=branch)[1]
            record = state["requests"][0]
            attachment = record["attachmentIds"][0]
            assert request("/api/workspace/attachments/" + attachment, cookie=employee)[1] == b"Integration browser attachment"
            assert request("/api/workspace/attachments/" + attachment, cookie=other)[0] == 403
            payload = {"revision": state["revision"], "requests": [{**record, "notes": "unauthorized"}], "companies": [], "files": []}
            assert request("/api/workspace/operations", payload, other)[0] == 403
            assert request("/api/workspace/operations", payload, sales)[0] == 403
            print("PASS: shared records, employee isolation, managerial restrictions and private attachments", flush=True)
            assert request('/api/workspace/login',{'email':'branch-ui@example.invalid','password':password})[0]==401
            old_employee=employee
            challenge=request('/api/workspace/password-challenge',cookie=employee)[1]
            replacement=secrets.token_urlsafe(24)
            new_wire=credential(replacement,secrets.token_hex(16))
            assert request('/api/workspace/password',{'current':'incorrect','password':new_wire},employee)[0]==403
            status,_,headers=request('/api/workspace/password',{'current':credential(password,challenge['salt']),'password':new_wire},employee)
            assert status==200
            employee=headers['set-cookie'].split(';')[0]
            assert request('/api/workspace/operations',cookie=old_employee)[0]==401
            assert request('/api/workspace/operations',cookie=employee)[0]==200
            employee=login('employee-ui@example.invalid',replacement)
            print('PASS: Worker rejects plaintext login; PBKDF2 password change revokes earlier sessions',flush=True)


            def concurrent_save(note):
                payload = {"revision": state["revision"], "requests": [{**record, "notes": note}], "companies": [], "files": []}
                return request("/api/workspace/operations", payload, flight)[0]

            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                codes = list(pool.map(concurrent_save, ["Concurrent A", "Concurrent B"]))
            assert sorted(codes) == [200, 409], codes
            after = request("/api/workspace/operations", cookie=branch)[1]
            assert after["revision"] == state["revision"] + 1
            assert after["requests"][0]["notes"] in ["Concurrent A", "Concurrent B"]
            assert len(after["requests"][0]["history"]) == len(record["history"]) + 1
            print("PASS: concurrent D1 saves commit exactly once without losing updates", flush=True)

            # A failure midway through a D1 batch must roll back its earlier writes too.
            duplicate_id = secrets.token_hex(16)
            file = {"id": duplicate_id, "requestId": record["id"], "name": "rollback.txt", "type": "text/plain",
                    "size": 5, "data": "aGVsbG8=", "createdAt": record["createdAt"]}
            broken = {**after["requests"][0], "notes": "must not commit", "attachmentIds": record["attachmentIds"] + [duplicate_id]}
            status = request("/api/workspace/operations", {"revision": after["revision"], "requests": [broken], "companies": [], "files": [file, file]}, flight)[0]
            assert status == 500
            assert request("/api/workspace/operations", cookie=branch)[1] == after
            assert request("/api/workspace/attachments/" + duplicate_id, cookie=branch)[0] == 404
            oversized = {**file, "id": secrets.token_hex(16), "size": 1024 * 1024 + 1}
            assert request("/api/workspace/operations", {"revision": after["revision"], "requests": [], "companies": [], "files": [oversized]}, flight)[0] == 400
            print("PASS: atomic rollback and server-enforced D1 attachment size", flush=True)
            large_bytes=bytes(range(256))*4096
            large_id=secrets.token_hex(16)
            large_file={'id':large_id,'requestId':record['id'],'name':'large.txt','type':'text/plain','size':len(large_bytes),'data':base64.b64encode(large_bytes).decode(),'createdAt':record['createdAt']}
            large_record={**after['requests'][0],'attachmentIds':after['requests'][0]['attachmentIds']+[large_id]}
            assert request('/api/workspace/operations',{'revision':after['revision'],'requests':[large_record],'companies':[],'files':[large_file]},flight)[0]==200
            assert request('/api/workspace/attachments/'+large_id,cookie=branch)[1]==large_bytes
            after=request('/api/workspace/operations',cookie=branch)[1]
            print('PASS: full 1 MiB binary attachment round-trips through D1 without corruption',flush=True)


            for _ in range(10):
                assert request("/api/workspace/login", {"email": "rate@example.invalid", "password": "invalid"})[0] == 401
            assert request("/api/workspace/login", {"email": "rate@example.invalid", "password": "invalid"})[0] == 429
            stop(process)
            process = start()
            assert request("/api/workspace/session")[1]["needsSetup"] is False
            assert request("/api/workspace/login", {"email": "rate@example.invalid", "password": "invalid"})[0] == 429
            assert request("/api/workspace/operations", cookie=branch)[1] == after
            assert request("/api/workspace/attachments/" + attachment, cookie=employee)[1] == b"Integration browser attachment"
            print("PASS: accounts, sessions, records, attachments and login limits persist across Worker restarts", flush=True)
            assert request("/api/workspace/users/" + other_id, {"active": False, "role": "employee"}, branch, "PATCH")[0] == 200
            assert request("/api/workspace/operations", cookie=other)[0] == 401
            print("PASS: account suspension revokes an existing Worker session", flush=True)
        finally:
            stop(process)
            log.close()


if __name__ == "__main__":
    main()
