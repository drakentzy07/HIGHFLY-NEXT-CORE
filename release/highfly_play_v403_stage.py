#!/usr/bin/env python3
"""Publish-only staging; PRESERVES legacy NEXT-CORE Pages via GET and sha256.

Never touch drakentzy07/cobalt-hollow-lab Pages.  This script operates inside
the NEXT-CORE Actions runner on a pinned already-tested HIGHFLY P10 dist.
All existing NEXT-CORE site files are copied, public legacy dynamic Unity
files are snapshotted, and the new V4-03 gets its own subpath. If legacy
snapshots, save isolation, or 1GB Pages budget fail, abort BEFORE deploy.
"""
from __future__ import annotations
import hashlib
import json
import re
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

LIVE="https://drakentzy07.github.io/HIGHFLY-NEXT-CORE/"
OLD=b"/cobalt-hollow-lab/"
NEW=b"/HIGHFLY-NEXT-CORE/play-v403/"
SOURCE=Path("upstream/dist")
OUT=Path("../pages_payload/HIGHFLY-NEXT-CORE")
LEGACY_SITE=Path("../site-base/site")
TEXT={".html",".js",".mjs",".css",".json",".webmanifest",".xml",".svg",".txt",".map"}
MAX_SITE_BYTES=985_000_000
class HrefParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs=set()
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if k in ("href","src") and v and not v.startswith(("#","data:","javascript:")):
                self.refs.add(v)

def fetch(path,required=True):
    if path.startswith("/") or ".." in Path(path).parts or "\\" in path:
        raise RuntimeError("UNSAFE_PUBLIC_SNAPSHOT_PATH:"+path)
    url=LIVE+path
    req=urllib.request.Request(url,headers={"User-Agent":"HIGHFLY-play-v403-preservation/1.0","Cache-Control":"no-cache"})
    try:
        with urllib.request.urlopen(req,timeout=90) as response:
            if response.status!=200:raise RuntimeError("PUBLIC_SNAPSHOT_NOT_200:"+path)
            data=response.read(150_000_000)
    except urllib.error.HTTPError as e:
        if not required and e.code==404:return None
        raise RuntimeError("PUBLIC_SNAPSHOT_HTTP_"+str(e.code)+":"+path) from e
    if not data and required:raise RuntimeError("EMPTY_PUBLIC_SNAPSHOT:"+path)
    return data

def write(path,data):
    dest=OUT/path
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes(data)
    return {"path":path,"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data)}

def legacy():
    # Copy all versioned original sources first, then overlay the EXACT live
    # published index/WorldLab/Unity build so these pages never regress.
    shutil.copytree(LEGACY_SITE,OUT,dirs_exist_ok=False)
    snapshot=[]
    for p in ("index.html","world-lab/index.html"):
        data=fetch(p)
        snapshot.append(write(p,data))
    for p in ("data/world.json",):
        data=fetch(p,required=False)
        if data is not None:snapshot.append(write(p,data))
    unity=fetch("claudecraft-unity/index.html",required=False)
    if unity is not None:
        snapshot.append(write("claudecraft-unity/index.html",unity))
        paths={
            "claudecraft-unity/Build/HIGHFLY-WORLD-LAB.loader.js",
            "claudecraft-unity/Build/HIGHFLY-WORLD-LAB.framework.js",
            "claudecraft-unity/Build/HIGHFLY-WORLD-LAB.wasm",
            "claudecraft-unity/Build/HIGHFLY-WORLD-LAB.data",
        }
        parser=HrefParser()
        parser.feed(unity.decode("utf8",errors="ignore"))
        for link in parser.refs:
            resolved=urllib.parse.urljoin(LIVE+"claudecraft-unity/",link)
            if not resolved.startswith(LIVE+"claudecraft-unity/"):continue
            rel=resolved[len(LIVE):].split("?",1)[0]
            if rel.endswith("/") or ".." in Path(rel).parts:continue
            paths.add(rel)
        html=unity.decode("utf8",errors="ignore")
        for rel in re.findall(r"(?:Build|TemplateData)/[\w.\-]+\.(?:js|css|png|ico|svg|wasm|data)",html):
            paths.add("claudecraft-unity/"+rel)
        for p in sorted(paths):
            snapshot.append(write(p,fetch(p)))
    return snapshot

def main():
    if not SOURCE.joinpath("index.html").exists() or not LEGACY_SITE.joinpath("index.html").exists():
        raise RuntimeError("P10_DIST_OR_LEGACY_SOURCE_MISSING")
    if OUT.exists():raise RuntimeError("STAGE_OUTPUT_ALREADY_EXISTS")
    snapshot=legacy()
    if len(snapshot)<2:raise RuntimeError("LEGACY_SNAPSHOT_TOO_SMALL")
    static=0; bytes_written=0; rebased=0
    for src in SOURCE.rglob("*"):
        if src.is_symlink():raise RuntimeError("SYMLINK_DISALLOWED:"+str(src))
        if not src.is_file():continue
        rel=src.relative_to(SOURCE)
        if ".." in rel.parts:raise RuntimeError("PATH_ESCAPE")
        dest=OUT/"play-v403"/rel
        dest.parent.mkdir(parents=True,exist_ok=True)
        if src.suffix.lower() in TEXT:
            data=src.read_bytes()
            rewritten=data.replace(OLD,NEW)
            if OLD in rewritten:raise RuntimeError("UNREBASED_COBALT_ASSET_PATH:"+str(rel))
            if data!=rewritten:rebased+=1
            dest.write_bytes(rewritten)
        else:
            shutil.copyfile(src,dest)
        static+=1
        bytes_written+=dest.stat().st_size
    index=(OUT/"play-v403/index.html").read_bytes()
    if NEW not in index or OLD in index:raise RuntimeError("WRONG_PAGES_SUBPATH")
    if static<6000 or bytes_written<800_000_000:
        raise RuntimeError("SUSPICIOUS_WEBGL_BUILD:"+str((static,bytes_written)))
    if not (OUT/"play-v403/media").is_dir():
        raise RuntimeError("WEBGL_MEDIA_MISSING")
    total=sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    if total>=MAX_SITE_BYTES:
        raise RuntimeError(f"PAGES_SIZE_BUDGET_BLOCKED:{total}/{MAX_SITE_BYTES}")
    for entry in snapshot:
        p=OUT/entry["path"]
        if hashlib.sha256(p.read_bytes()).hexdigest()!=entry["sha256"]:
            raise RuntimeError("LEGACY_SITE_MUTATION:"+str(p))
        # Protect against a concurrent publish while P10 is rebuilding.
        fresh=fetch(entry["path"])
        if hashlib.sha256(fresh).hexdigest()!=entry["sha256"]:
            raise RuntimeError("LEGACY_PAGES_CHANGED_DURING_BUILD_ABORT:"+entry["path"])
    (OUT/".nojekyll").write_text("",encoding="utf8")
    metadata={
        "candidate":"HIGHFLY_V403_P10_GREEN",
        "source_sha":"fc74d3ba8638aa3bee263c710b5be28da81c6710",
        "target":LIVE+"play-v403/",
        "play_save_namespace":"highfly-play-v403",
        "old_save_namespace_remains_untouched":"highfly-offline",
        "preexisting_entries":snapshot,
        "new_files":static,
        "new_bytes":bytes_written,
        "total_bytes":total,
        "rebased_text_files":rebased,
        "preservation":True,
        "physical_s23_certified":False,
    }
    Path("../highfly_play_v403_release_manifest.json").write_text(json.dumps(metadata,indent=2)+"\n",encoding="utf8")
    print("HF_PLAY_V403_PAGES_LEGACY_PRESERVED_AND_STAGE_READY="+json.dumps({
        "site_bytes":total,"new_files":static,"legacy_assets":len(snapshot),
        "rebase_count":rebased,"url":metadata["target"]}))
if __name__=="__main__":
    try:main()
    except Exception as e:
        print("HF_PLAY_V403_FAIL_CLOSED_NO_DEPLOY="+str(e),file=sys.stderr)
        raise
