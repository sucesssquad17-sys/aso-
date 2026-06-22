import json

def try_read(filename):
    for enc in ['utf-8', 'utf-16', 'utf-16le']:
        try:
            with open(filename, encoding=enc) as f:
                return json.load(f)
        except Exception:
            pass
    return {}

data = try_read('env.json')
envs = data.get('spec', {}).get('template', {}).get('spec', {}).get('containers', [{}])[0].get('env', [])
for e in envs:
    print(f"{e.get('name')}={e.get('value')}")
