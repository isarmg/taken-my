#!/usr/bin/env python3
"""Package the tested static site with exact source and per-file identities."""
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import zipfile


def main():
    root = Path(__file__).resolve().parents[1]
    version = json.loads((root / 'package.json').read_text())['version']
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version):
        raise ValueError('Package version must be major.minor.patch')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    if os.environ.get('GITHUB_SHA') != commit or os.environ.get('GITHUB_REF_NAME') != 'v' + version:
        raise ValueError('Release event does not match source and package version')
    source = root / 'dist'
    if source.is_symlink() or not source.is_dir() or not (source / 'index.html').is_file():
        raise ValueError('Production dist/index.html is required')
    entries = sorted(source.rglob('*'))
    if any(p.is_symlink() or not (p.is_file() or p.is_dir()) for p in entries):
        raise ValueError('Production output contains a linked or special entry')
    files = [p for p in entries if p.is_file()]
    output = root / 'release-dist'
    output.mkdir(exist_ok=False)
    archive = f'taken-my-{version}-static'
    hashes = {p.relative_to(source).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    with (output / (archive + '.tar.gz')).open('xb') as raw:
        with gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode='w') as tar:
                for p in files:
                    data = p.read_bytes()
                    item = tarfile.TarInfo(p.relative_to(source).as_posix())
                    item.size = len(data)
                    item.mode = 0o644
                    item.mtime = 0
                    tar.addfile(item, io.BytesIO(data))
    with zipfile.ZipFile(output / (archive + '.zip'), 'x', compression=zipfile.ZIP_DEFLATED) as z:
        for p in files:
            item = zipfile.ZipInfo(p.relative_to(source).as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
            item.compress_type = zipfile.ZIP_DEFLATED
            item.external_attr = 0o100644 << 16
            z.writestr(item, p.read_bytes())
    identity = {'product': 'taken-my', 'version': version, 'source_revision': commit,
                'target': 'static-web', 'files': hashes}
    (output / 'release-identity.json').write_text(json.dumps(identity, indent=2) + '\n')
    checksums = ''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in sorted(output.iterdir()))
    (output / 'SHA256SUMS').write_text(checksums, encoding='ascii')
    with tarfile.open(output / (archive + '.tar.gz')) as tar:
        assert {m.name: hashlib.sha256(tar.extractfile(m).read()).hexdigest() for m in tar.getmembers()} == hashes
    with zipfile.ZipFile(output / (archive + '.zip')) as z:
        assert {n: hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()} == hashes
    print(f'Packaged {len(files)} files for taken-my {version} from {commit}')


if __name__ == '__main__':
    main()
