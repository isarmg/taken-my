# Bundled fonts

These WOFF2 files were already present in the project. They were not
re-downloaded, modified, or regenerated when these attribution files were
added. The original download URLs for the font binaries are not recorded in
the existing repository; the identities below were read directly from their
embedded OpenType `name` metadata.

## EB Garamond

- `eb-garamond-400.woff2`: EB Garamond Regular, `EBGaramond-Regular`, Version 1.003
- `eb-garamond-400-italic.woff2`: EB Garamond Italic, `EBGaramond-Italic`, Version 1.003
- Embedded copyright notice (both files):
  `Copyright 2017 The EB Garamond Project Authors (https://github.com/octaviopardo/EBGaramond12)`
- Embedded license URL: https://openfontlicense.org
- License: [OFL-EB-Garamond.txt](OFL-EB-Garamond.txt), SIL Open Font License 1.1
- License source: https://github.com/google/fonts/blob/main/ofl/ebgaramond/OFL.txt
- Downloaded verbatim on 2026-10-10 from:
  https://raw.githubusercontent.com/google/fonts/refs/heads/main/ofl/ebgaramond/OFL.txt
- License SHA-256: `0985066662eb755ed3683ae5482a81a9195b49ce3f7e165cc2388b3dbece7dd7`

## IBM Plex Mono

- `ibm-plex-mono-400.woff2`: IBM Plex Mono Regular, `IBMPlexMono-Regular`, Version 2.3
- Embedded copyright notice:
  `Copyright 2017 IBM Corp. All rights reserved.`
- Embedded license URL: http://scripts.sil.org/OFL
- License: [OFL-IBM-Plex-Mono.txt](OFL-IBM-Plex-Mono.txt), SIL Open Font License 1.1
- Upstream license copyright notice:
  `Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"`
- License source: https://github.com/google/fonts/blob/main/ofl/ibmplexmono/OFL.txt
- Downloaded verbatim on 2026-10-10 from:
  https://raw.githubusercontent.com/google/fonts/refs/heads/main/ofl/ibmplexmono/OFL.txt
- Original downloaded license SHA-256 (CRLF): `7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da`
- Repository license SHA-256 (LF): `37784b44044a4ffd9256702b7c0982c37e5c8887ba90c6dca0479aea93dc898d`

The two license files preserve the upstream license text and copyright notices.
The IBM Plex Mono license has only its line endings normalized from CRLF to LF;
its license text is unchanged. Vite copies this directory, including the
licenses, into the production build.
