#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python scripts/generate-event-migration.py
python scripts/finalize-event-migration.py
python scripts/patch-event-validation.py
