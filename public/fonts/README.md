# 随包字体

应用启动前一次性加载并解码三个完整字体。字体二进制不变，未按 Unicode 分片。

这些 WOFF2 文件原已存在。补充来源说明时没有重新下载、修改或生成字体。仓库没有记录二进制的原始下载 URL；以下身份直接读取自其 OpenType `name` 元数据。

`provenance.json` 记录实际字体名称、版本、许可和当前源码路径。正式物料使用精确源码提交的公开镜像文件及 SHA-256 核对；这个可追溯镜像不代表已经找回历史原始下载地址。

## EB Garamond

- `eb-garamond-400.woff2`: EB Garamond Regular, `EBGaramond-Regular`, Version 1.003
- `eb-garamond-400-italic.woff2`: EB Garamond Italic, `EBGaramond-Italic`, Version 1.003
- 内嵌版权声明（两个文件）：
  `Copyright 2017 The EB Garamond Project Authors (https://github.com/octaviopardo/EBGaramond12)`
- 内嵌许可证 URL： https://openfontlicense.org
- 许可证： [OFL-EB-Garamond.txt](OFL-EB-Garamond.txt), SIL Open Font License 1.1
- 许可证来源： https://github.com/google/fonts/blob/main/ofl/ebgaramond/OFL.txt
- 许可证于 2026-10-10 原样下载自：
  https://raw.githubusercontent.com/google/fonts/refs/heads/main/ofl/ebgaramond/OFL.txt
- 许可证 SHA-256： `0985066662eb755ed3683ae5482a81a9195b49ce3f7e165cc2388b3dbece7dd7`

## IBM Plex Mono

- `ibm-plex-mono-400.woff2`: IBM Plex Mono Regular, `IBMPlexMono-Regular`, Version 2.3
- 内嵌版权声明：
  `Copyright 2017 IBM Corp. All rights reserved.`
- 内嵌许可证 URL： http://scripts.sil.org/OFL
- 许可证： [OFL-IBM-Plex-Mono.txt](OFL-IBM-Plex-Mono.txt), SIL Open Font License 1.1
- 上游许可证版权声明：
  `Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"`
- 许可证来源： https://github.com/google/fonts/blob/main/ofl/ibmplexmono/OFL.txt
- 许可证于 2026-10-10 原样下载自：
  https://raw.githubusercontent.com/google/fonts/refs/heads/main/ofl/ibmplexmono/OFL.txt
- 原始下载许可证 SHA-256（CRLF）： `7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da`
- 仓库许可证 SHA-256（LF）： `37784b44044a4ffd9256702b7c0982c37e5c8887ba90c6dca0479aea93dc898d`

两个许可证文件保留上游正文和版权声明。IBM Plex Mono 许可证只将换行从 CRLF 规范为 LF，正文不变。Vite 将本目录和许可证复制到生产构建。
