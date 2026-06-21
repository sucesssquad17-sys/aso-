import os
import json
import urllib.parse

history_dir = os.path.join(os.environ.get('APPDATA', ''), 'Code', 'User', 'History')
if not os.path.exists(history_dir):
    print("No history dir", history_dir)
    exit(0)

for d in os.listdir(history_dir):
    entries_path = os.path.join(history_dir, d, 'entries.json')
    if os.path.exists(entries_path):
        with open(entries_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                if 'resource' in data:
                    res = data['resource']
                    if 'App.tsx' in res or 'app.tsx' in res.lower():
                        print(res, d)
            except json.JSONDecodeError:
                pass
