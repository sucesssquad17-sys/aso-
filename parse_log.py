import re
import os
import sys

log_file = r'C:\Users\rv941\.gemini\antigravity\brain\85c29f09-c107-4f72-a6f8-29f3b259a0ff\.system_generated\logs\overview.txt'

if not os.path.exists(log_file):
    print("Log file not found.")
    sys.exit(1)

with open(log_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the log at 13:58:54
idx = content.find("13:58:54")
if idx == -1:
    print("Timestamp not found")
else:
    print("Found timestamp at index", idx)
    print("Context around it:")
    print(content[max(0, idx-1000):idx+1000])

