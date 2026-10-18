#!/bin/bash
cd "/Users/chaoliu/Documents/Ai/Games/IdleGames/JianghuIdle" || exit 1
LOG=.audit/logs-evidence
echo "=== npm test ==="
/usr/bin/time -p npm test > "$LOG/npm-test.log" 2>&1
echo "exit=$? duration-marker" >> "$LOG/npm-test.log"
echo "=== tsc ==="
/usr/bin/time -p npx tsc --noEmit > "$LOG/tsc.log" 2>&1
echo "exit=$?" >> "$LOG/tsc.log"
echo "=== content:check ==="
/usr/bin/time -p npm run content:check > "$LOG/content-check.log" 2>&1
echo "exit=$?" >> "$LOG/content-check.log"
echo "=== sim:v1 ==="
/usr/bin/time -p npm run sim:v1 > "$LOG/sim-v1.log" 2>&1
echo "exit=$?" >> "$LOG/sim-v1.log"
echo "=== sim:idle ==="
/usr/bin/time -p npm run sim:idle > "$LOG/sim-idle.log" 2>&1
echo "exit=$?" >> "$LOG/sim-idle.log"
git status --porcelain > "$LOG/git-after.txt"
echo DONE
