import json
import re

log_file = r'C:\Users\rv941\.gemini\antigravity\brain\85c29f09-c107-4f72-a6f8-29f3b259a0ff\.system_generated\logs\overview.txt'

target_time_found = False

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        if '13:58:54' in line:
            target_time_found = True
        
        if not target_time_found:
            continue
            
        try:
            data = json.loads(line)
            if data.get('type') == 'TOOL_CALL':
                call = data.get('tool_call', {})
                print(f"{data.get('created_at')} - {call.get('name')}")
                if call.get('name') == 'run_command':
                    print("  Cmd:", call.get('arguments', {}).get('CommandLine'))
                if call.get('name') in ('write_to_file', 'replace_file_content', 'multi_replace_file_content'):
                    print("  File:", call.get('arguments', {}).get('TargetFile'))
        except Exception:
            pass

