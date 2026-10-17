#!/usr/bin/env python3
"""Prepared only. One reviewed A/B run, no retries; Darwin resident-size monitor."""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import resource
import signal
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
CPU, WALL, OUTER, RSS = 20, 30, 40, 384 * 1024 * 1024


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def ignored(path):
    lib = ctypes.CDLL("/usr/lib/libSystem.B.dylib", use_errno=True)
    call = lib.getxattr
    call.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_void_p,
                     ctypes.c_size_t, ctypes.c_uint32, ctypes.c_int]
    call.restype = ctypes.c_ssize_t
    value = ctypes.create_string_buffer(64)
    count = call(os.fsencode(path), b"com.apple.fileprovider.ignore#P", value, len(value), 0, 0)
    if count < 0:
        raise OSError(ctypes.get_errno(), "getxattr failed")
    return value.raw[:count] == b"1"


class RusageV0(ctypes.Structure):
    # SDK sys/resource.h: rusage_info_v0. Resident/footprint fields are bytes.
    _fields_ = [("uuid", ctypes.c_uint8 * 16)] + [
        (name, ctypes.c_uint64) for name in (
            "user_time", "system_time", "pkg_idle_wkups", "interrupt_wkups",
            "pageins", "wired_size", "resident_size", "phys_footprint",
            "proc_start_abstime", "proc_exit_abstime")]


def main():
    own_before = resource.getrusage(resource.RUSAGE_SELF)
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute-reviewed", action="store_true")
    parser.add_argument("--freeze-sha256", required=True)
    args = parser.parse_args()
    if not args.execute_reviewed or sys.platform != "darwin":
        raise SystemExit("Not launched: requires reviewed flag and Darwin")
    started = time.monotonic()
    if digest(HERE / "FREEZE.json") != args.freeze_sha256:
        raise SystemExit("Freeze SHA mismatch")
    freeze = json.loads((HERE / "FREEZE.json").read_text())
    for row in freeze["files"]:
        p = HERE / row["path"]
        if p.stat().st_size != row["bytes"] or digest(p) != row["sha256"]:
            raise SystemExit("Frozen input changed: " + row["path"])
    pins = json.loads((HERE / "input-pins.json").read_text())
    if (HERE / "node_modules").resolve() != Path(pins["dependencyRoot"]).resolve():
        raise SystemExit("Dependency link changed")
    if not ignored(pins["dependencyRoot"]):
        raise SystemExit("Existing Dropbox dependency directory is not protected")
    for dep in pins["dependencies"]:
        p = Path(dep["path"])
        if str(p.resolve()) != dep["realPath"] or p.stat().st_size != dep["bytes"] or digest(p) != dep["sha256"]:
            raise SystemExit("Dependency changed: " + dep["kind"])
    node = next(d["path"] for d in pins["dependencies"] if d["kind"] == "nodeExecutable")
    dest = HERE / "run"
    dest.mkdir(exist_ok=False)  # No accidental replay or replacement of evidence.
    lib = ctypes.CDLL("/usr/lib/libproc.dylib", use_errno=True)
    read_rusage = lib.proc_pid_rusage
    read_rusage.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_void_p]
    read_rusage.restype = ctypes.c_int
    child_before = resource.getrusage(resource.RUSAGE_CHILDREN)
    launch_time = time.monotonic()
    reason = None
    polled_peak = 0
    heartbeat = launch_time
    command = [node, str(HERE / "section64.mjs"), "--execute-once-reviewed"]
    with (dest / "result.json").open("w") as output, (dest / "stderr.log").open("w") as errors:
        proc = subprocess.Popen(command, cwd=HERE, stdout=output, stderr=errors,
                                preexec_fn=lambda: resource.setrlimit(resource.RLIMIT_CPU, (CPU, CPU)))
        print(json.dumps({"phase": "child-started", "wrapperPID": os.getpid(), "childPID": proc.pid, "command": command}), flush=True)
        while proc.poll() is None:
            now = time.monotonic()
            usage = RusageV0()
            if read_rusage(proc.pid, 0, ctypes.byref(usage)) == 0:
                polled_peak = max(polled_peak, usage.resident_size)
                if usage.resident_size > RSS:
                    reason = "CHILD_RSS_LIMIT"
            elif proc.poll() is None:
                reason = "RSS_MONITOR_UNAVAILABLE"
            if now - launch_time > WALL:
                reason = "CHILD_WALL_LIMIT"
            if now - started > OUTER:
                reason = "OUTER_WALL_LIMIT"
            if reason:
                try:
                    proc.send_signal(signal.SIGKILL)
                except ProcessLookupError:
                    pass  # Child may have terminated between poll and the kill.
                break
            if now - heartbeat >= 5:
                print(json.dumps({"phase": "heartbeat", "childPID": proc.pid,
                                  "childWallSeconds": now - launch_time, "polledChildPeakRssBytes": polled_peak}), flush=True)
                heartbeat = now
            time.sleep(.05)
        code = proc.wait()
    ended = time.monotonic()
    child = resource.getrusage(resource.RUSAGE_CHILDREN)
    own = resource.getrusage(resource.RUSAGE_SELF)
    child_cpu = child.ru_utime + child.ru_stime - child_before.ru_utime - child_before.ru_stime
    own_cpu = own.ru_utime + own.ru_stime - own_before.ru_utime - own_before.ru_stime
    # On Darwin Python's ru_maxrss is bytes; this fresh launcher has one child.
    rss_bound = child.ru_maxrss + own.ru_maxrss
    complete = False
    try:
        result = json.loads((dest / "result.json").read_text())
        complete = result["status"] == "COMPLETE_DIAGNOSTIC_ONLY" and len(result["variants"]) == 2
    except (ValueError, KeyError):
        pass
    budget_ok = (child_cpu + own_cpu <= CPU and ended - launch_time <= WALL
                 and ended - started <= OUTER and rss_bound <= RSS)
    passed = code == 0 and complete and reason is None and budget_ok
    execution = {"status": "COMPLETE_WITHIN_BUDGET" if passed else "FAIL_OR_INCOMPLETE",
                 "terminalKnown": True, "exitCode": code, "terminationReason": reason,
                 "command": command, "childPID": proc.pid, "freezeSHA256": args.freeze_sha256,
                 "childCpuSeconds": child_cpu, "wrapperCpuSecondsFromReviewedEntry": own_cpu,
                 "childWallSeconds": ended - launch_time, "outerWallSeconds": ended - started,
                 "polledChildPeakRssBytes": polled_peak, "terminalChildPeakRssBytes": child.ru_maxrss,
                 "wrapperPeakRssBytes": own.ru_maxrss, "sumPeakRssUpperBoundBytes": rss_bound,
                 "budgetPassed": budget_ok, "diagnosticOnly": True}
    (dest / "execution.json").write_text(json.dumps(execution, indent=2) + "\n")
    print(json.dumps(execution), flush=True)
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
