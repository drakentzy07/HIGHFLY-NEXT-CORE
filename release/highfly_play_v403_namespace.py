#!/usr/bin/env python3
"""Isolate experimental PLAY offline RPG saves from all cobalt-hollow-lab URLs.
Only the already-authoritative CLEAN offline save module is edited. Preserve
class+name identity, Training, native CharacterState and same Sim. No data copy.
"""
from pathlib import Path
p=Path('upstream/src/game/highfly_offline_save.ts')
if not p.is_file():raise SystemExit('CLEAN_ORIGINAL_OFFLINE_SAVE_MODULE_ABSENT')
s=p.read_text('utf8')
pairs={
    "const DB_NAME = 'highfly-offline';":"const DB_NAME = 'highfly-play-v403';",
    "const LOCAL_KEY = 'highfly.offline.primary.v1';":"const LOCAL_KEY = 'highfly.play-v403.primary.v1';",
}
for old,new in pairs.items():
    if s.count(old)!=1:raise SystemExit('OFFLINE_SAVE_SCHEMA_NAMESPACE_DRIFT:'+old)
    s=s.replace(old,new,1)
if "'highfly-offline'" in s or "'highfly.offline.primary.v1'" in s:
    raise SystemExit('UNNAMESPACED_SAVE_KEY_REMAINS')
p.write_text(s,'utf8')
print('HF_PLAY_V403_OFFLINE_SAVE_AND_TRAINING_NAMESPACED=1')
