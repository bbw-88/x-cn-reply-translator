# Native Translate 派生说明

本项目 2.x 是面向 X 回复的精简派生版本。采用 Native Translate 的页面主环境翻译桥与 Translator 实例复用实现，保留已有 X 输入适配层。不是原项目官方发行版。

- 上游：https://github.com/zh30/native-translate
- 固定提交：c5486dade61b40971ed6187e70ae7ca6e3318b82
- 原文件：src/scripts/pageBridge.ts
- 上游原始快照：upstream/pageBridge.ts
- 修改版：src/native-bridge.ts
- 上游作者与许可：Copyright (c) 2025 Henry Zhang，MIT，见 licenses/Native-Translate-LICENSE.txt。

修改包括固定 zh → en、语言包下载进度、失败后可重试、请求边界检查、保留换行与链接/账号，以及 X 回复填入、并发草稿保护与撤销。

未包含上游整页翻译、Gemini Nano 写作或 OCR 等功能。本扩展不提供云端翻译兜底。
