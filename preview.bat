@echo off
echo Opening the profile at http://localhost:8000  (close this window to stop)
start "" http://localhost:8000
python -m http.server 8000
