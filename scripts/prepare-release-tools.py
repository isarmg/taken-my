#!/usr/bin/env python3
"""Fetch the exact public build-tool source declared by this repository."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parents[1]
REPOSITORY='https://github.com/isarmg/xssi.git'


def environment():
    return {key:value for key,value in os.environ.items()
            if not any(part in key.upper() for part in ('TOKEN','SECRET','SIGNING','PASSWORD','PRIVATE_KEY'))}


def identity():
    value=json.loads((ROOT/'build-tools-source.json').read_text())
    if set(value)!={'repository','revision'} or value['repository']!=REPOSITORY or not isinstance(value['revision'],str) or not re.fullmatch('[0-9a-f]{40}',value['revision']):
        raise ValueError('release build tools require their exact public Git revision')
    return value


def run(arguments,cwd,env):
    result=subprocess.run(arguments,cwd=cwd,env=env,stdin=subprocess.DEVNULL,
                          capture_output=True,text=True,timeout=600)
    if result.returncode:
        raise RuntimeError('release build-tool operation failed: '+arguments[0])
    return result.stdout.strip()


def verify(directory):
    value=identity();directory=Path(directory).resolve(strict=True);env=environment()
    if run(['git','rev-parse','HEAD'],directory,env)!=value['revision'] or run(['git','status','--porcelain','--untracked-files=all'],directory,env):
        raise ValueError('release tool source differs from its exact clean declared revision')
    return directory


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();value=identity();env=environment()
    if not args.output.is_absolute() or args.output.exists():
        raise ValueError('release tools need a new absolute checkout directory')
    run(['git','init','--quiet',str(args.output)],ROOT,env)
    run(['git','remote','add','origin',value['repository']],args.output,env)
    run(['git','-c','credential.helper=','-c','core.hooksPath=/dev/null','fetch','--depth=1','origin',value['revision']],args.output,env)
    run(['git','-c','core.hooksPath=/dev/null','checkout','--quiet','--detach','FETCH_HEAD'],args.output,env)
    verify(args.output)


if __name__=='__main__':main()
