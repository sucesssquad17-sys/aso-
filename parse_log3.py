import json

log_file = r'C:\Users\rv941\.gemini\antigravity\brain\85c29f09-c107-4f72-a6f8-29f3b259a0ff\.system_generated\logs\overview.txt'

with open(log_file, 'r', encoding='utf-8') as f:
    for i in range(10):
        line = f.readline()
        try:
            data = json.loads(line)
            print(f"type: {data.get('type')}, source: {data.get('source')}")
            if data.get('type') == 'PLANNER_RESPONSE':
                pass # print(data.get('content'))
        except Exception as e:
            print("Error parsing line:", e)
