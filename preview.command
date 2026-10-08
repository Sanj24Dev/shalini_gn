#!/bin/bash
cd "$(dirname "$0")"
echo "Opening http://localhost:8000  (close this window to stop)"
(sleep 1; open http://localhost:8000) &
python3 -m http.server 8000
