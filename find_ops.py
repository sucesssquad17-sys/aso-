import json
import os

log_file = r'C:\Users\rv941\.gemini\antigravity\brain\85c29f09-c107-4f72-a6f8-29f3b259a0ff\.system_generated\logs\overview.txt'

with open(log_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line in lines:
    try:
        data = json.loads(line)
        if data.get('type') == 'TOOL_CALL':
            call = data.get('tool_call', {})
            name = call.get('name')
            if name in ('write_to_file', 'replace_file_content', 'multi_replace_file_content', 'view_file'):
                args = call.get('arguments', {})
                target = args.get('TargetFile') or args.get('AbsolutePath')
                if target and ('LandingPage.tsx' in target or 'App.tsx' in target):
                    print(f"{data.get('created_at')} - {name} - {target}")
    except Exception as e:
        pass
