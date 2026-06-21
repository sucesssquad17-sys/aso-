import json

log_file = r'C:\Users\rv941\.gemini\antigravity\brain\85c29f09-c107-4f72-a6f8-29f3b259a0ff\.system_generated\logs\overview.txt'

target_files = ['App.tsx', 'index.css', 'ReportsWorkspace.tsx', 'AuthenticatedWorkspace.tsx', 'SplashScreen.tsx', 'LandingPage.tsx', 'workspacePrimitives.tsx']

views = {f: None for f in target_files}

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'TOOL_CALL_RESULT':
                # The result of view_file
                pass
            if data.get('type') == 'TOOL_CALL':
                call = data.get('tool_call', {})
                if call.get('name') == 'view_file':
                    args = call.get('arguments', {})
                    path = args.get('AbsolutePath', '')
                    for tf in target_files:
                        if tf in path:
                            print("Viewed", tf, "at", data.get('created_at'))
        except Exception:
            pass

