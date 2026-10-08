"""Merge workbench/rounds/<id>/critique.json into workbench/progress.json.
python3 tools/record-round.py <round-id> ["builder response text"]"""
import json, sys
rid = sys.argv[1]
crit = json.load(open(f'workbench/rounds/{rid}/critique.json'))
prog = json.load(open('workbench/progress.json'))
prog['rounds'] = [r for r in prog['rounds'] if r['id'] != rid] + [crit]
if len(sys.argv) > 2:
    for r in prog['rounds']:
        if r['id'] == rid:
            r['fixes'] = sys.argv[2]
prog['rounds'].sort(key=lambda r: r['id'])
json.dump(prog, open('workbench/progress.json', 'w'), indent=1)
scores = crit['scores']
print(rid, 'mean', round(sum(s['score'] for s in scores) / len(scores), 2), {s['id']: s['score'] for s in scores})
