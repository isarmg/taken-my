#!/usr/bin/env python3
"""Package the tested static site with exact source and per-file identities."""
import gzip
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import tempfile
import zipfile


def tools_module():
    spec=importlib.util.spec_from_file_location('taken_release_tools',Path(__file__).with_name('prepare-release-tools.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def load_tool(name,directory):
    spec=importlib.util.spec_from_file_location('taken_'+name,directory/'scripts'/(name+'.py'))
    module=importlib.util.module_from_spec(spec)
    sys.path.insert(0,str(directory/'scripts'))
    try:spec.loader.exec_module(module)
    finally:sys.path.pop(0)
    return module


def archive_files(source,output,archive,verify=None):
    entries=sorted(source.rglob('*'))
    if any(path.is_symlink() or not (path.is_file() or path.is_dir()) for path in entries):
        raise ValueError('Production output contains a linked or special entry')
    files=[path for path in entries if path.is_file()]
    hashes={path.relative_to(source).as_posix():hashlib.sha256(path.read_bytes()).hexdigest() for path in files}
    with (output/(archive+'.tar.gz')).open('xb') as raw:
        with gzip.GzipFile(filename='',fileobj=raw,mode='wb',mtime=0) as compressed:
            with tarfile.open(fileobj=compressed,mode='w') as tar:
                for path in files:
                    data=path.read_bytes();item=tarfile.TarInfo(path.relative_to(source).as_posix())
                    item.size=len(data);item.mode=0o644;item.mtime=0
                    tar.addfile(item,io.BytesIO(data))
    with zipfile.ZipFile(output/(archive+'.zip'),'x',compression=zipfile.ZIP_DEFLATED) as archive_:
        for path in files:
            item=zipfile.ZipInfo(path.relative_to(source).as_posix(),date_time=(1980,1,1,0,0,0))
            item.compress_type=zipfile.ZIP_DEFLATED;item.create_system=3;item.external_attr=0o100644<<16
            archive_.writestr(item,path.read_bytes())
    with tarfile.open(output/(archive+'.tar.gz')) as tar:
        if {member.name:hashlib.sha256(tar.extractfile(member).read()).hexdigest() for member in tar.getmembers()}!=hashes:
            raise ValueError('Final static tar differs from its exact file inventory')
    with zipfile.ZipFile(output/(archive+'.zip')) as archive_:
        if {name:hashlib.sha256(archive_.read(name)).hexdigest() for name in archive_.namelist()}!=hashes:
            raise ValueError('Final static ZIP differs from its exact file inventory')
    if verify is not None:
        with tempfile.TemporaryDirectory(prefix='taken-final-static-') as temporary:
            folder=Path(temporary)
            with tarfile.open(output/(archive+'.tar.gz')) as archive_:
                archive_.extractall(folder/'tar',filter='data')
            verify(folder/'tar')
            with zipfile.ZipFile(output/(archive+'.zip')) as archive_:
                if any(item.create_system!=3 or item.external_attr>>16!=0o100644 for item in archive_.infolist()):
                    raise ValueError('Final static ZIP mode differs from its declared files')
                archive_.extractall(folder/'zip')
            for path in (folder/'zip').rglob('*'):
                path.chmod(0o755 if path.is_dir() else 0o644)
            verify(folder/'zip')
    return hashes


def main():
    root = Path(__file__).resolve().parents[1]
    version = json.loads((root / 'package.json').read_text())['version']
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version):
        raise ValueError('Package version must be major.minor.patch')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    if os.environ.get('GITHUB_SHA') != commit or os.environ.get('GITHUB_REF_NAME') != 'v' + version:
        raise ValueError('Release event does not match source and package version')
    if subprocess.check_output(['git','status','--porcelain','--untracked-files=all'],cwd=root,text=True).strip():
        raise ValueError('Release packaging requires the exact clean current source')
    helper=tools_module()
    tools_value=os.environ.get('XSSI_BUILD_TOOLS_DIR');metadata_value=os.environ.get('XSSI_FRONTEND_METADATA_FILE')
    if not tools_value or not metadata_value:
        raise ValueError('Release packaging requires exact build tools and actual frontend build evidence')
    tools=helper.verify(Path(tools_value))
    source = root / 'dist'
    if source.is_symlink() or not source.is_dir() or not (source / 'index.html').is_file():
        raise ValueError('Production dist/index.html is required')
    producer=load_tool('static_web_receipt',tools)
    finalizer=load_tool('release_sbom',tools)
    checksums_=load_tool('release_manifest',tools)
    components=producer.generate(root,source,Path(metadata_value),product='taken-my',revision=commit)
    for path in [source,*source.rglob('*')]:
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError('Static delivery contains an uncontrolled filesystem object')
        path.chmod(0o755 if path.is_dir() else 0o644)
    with tempfile.TemporaryDirectory(prefix='taken-static-inventory-') as temporary:
        external=Path(temporary)/'external.json'
        external.write_text(json.dumps({'format_version':1,'runtime_roots':[],'components':components}))
        finalizer.finalize(source,[],external,'taken-my',version,commit,'static-web',build_input_root=root)
        checksums_.finalize(source,'taken-my',version,commit,'static-web')
        checksums_.verify(source)
    output = root / 'release-dist'
    output.mkdir(exist_ok=False)
    archive = f'taken-my-{version}-static'
    hashes=archive_files(source,output,archive,checksums_.verify)
    identity = {'product': 'taken-my', 'version': version, 'source_revision': commit,
                'target': 'static-web', 'files': hashes}
    (output / 'release-identity.json').write_text(json.dumps(identity, indent=2) + '\n')
    checksums = ''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in sorted(output.iterdir()))
    (output / 'SHA256SUMS').write_text(checksums, encoding='ascii')
    checksums_.verify(source)
    if subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()!=commit or subprocess.check_output(['git','status','--porcelain','--untracked-files=all'],cwd=root,text=True).strip():
        raise ValueError('Source changed during static release packaging')
    print(f'Packaged {len(hashes)} files for taken-my {version} from {commit}')


if __name__ == '__main__':
    main()
