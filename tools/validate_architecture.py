"""Lightweight architecture validation for ADHDashboard.

Checks source annotations and basic ownership boundaries.
"""
from pathlib import Path
import re, json

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
HEADER = "MODULE:"
failures=[]

for path in SRC.rglob("*.js"):
    text=path.read_text(encoding="utf-8", errors="ignore")
    if HEADER not in text[:500]:
        failures.append(f"missing module header: {path.relative_to(ROOT)}")
    if path.name.startswith("render"):
        if re.search(r"\b(setState|dispatchAction|saveState)\s*\(", text):
            failures.append(f"render may mutate state: {path.relative_to(ROOT)}")

result={"passed": not failures, "failures": failures}
print(json.dumps(result, indent=2))
raise SystemExit(1 if failures else 0)
