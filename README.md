# X 中文回复翻译 · Native Translate 精简派生版

在 X 回复框写中文，一键在本机翻成英文并填回原框，也可撤销。不会自动发送。固定中文 → 英文，避免短词自动识别错误。

## 安装

1. 在 [Releases](https://github.com/bbw-88/x-cn-reply-translator/releases/latest) 下载 `x-cn-reply-translator-v2.0.0.zip` 并解压。
2. 桌面 Chrome 打开 `chrome://extensions`，开启「开发者模式」，选择「加载已解压的扩展程序」，选直接包含 `manifest.json` 的目录。
3. 刷新 X，打开帖子回复框。保留解压目录，后续 Chrome 从这里加载扩展。

需要桌面 Chrome 138 或更新版本，且 Chrome 内置 Translator API 在设备上可用。首次翻译需联网由 Chrome 下载语言包，之后翻译在本机完成。**安装包不包含 Chrome 模型，不能在从未下载语言包的新电脑上直接断网初始化。** Chrome 管理语言包，清除浏览器数据或模型被回收后可能需要重新下载。打开 X 本身仍需联网。

从 1.x 升级：关闭正在写的回复前先保存文字，将新版解压到新的固定目录，移除旧扩展后加载新版，或将原安装目录中的文件完整替换成新版并点击「重新加载」。不要同时启用两份。

## 使用

- 在 X 原回复框里输入中文，点击「翻译框内中文」。英文直接替换原稿，点「撤销填入」可恢复中文。
- 或点击「中文回复 → 英文」，在独立小框输入中文，点「翻译并填入」或 Ctrl+Enter。
- 填入后先检查措辞，再自行点击 X 的回复按钮。程序没有发送动作。
- 一次最多 450 个字符，保留换行、链接、@账号和 #话题。发送时以 X 的字符限制为准。
- 翻译期间若草稿有变动，停止填入。手动修改英文后，扩展不会用撤销覆盖你的修改。

译文仍可能误解省略句、俚语或专业词。没有足够上下文时，请补全中文后再翻译。该项目不承诺所有短句均准确。

## 隐私与权限

仅在 x.com 和 twitter.com 注入界面。不使用在线翻译服务、API 密钥、遥测、剪贴板权限或后台 Service Worker。仅在点击翻译后调用 Chrome 本机 Translator API。文本已经在 X 页面中，不代表 X 网站无法读取输入内容。

## 从源码构建

需要 Node.js 22+。安装依赖需要联网，构建不下载任何模型。

    npm ci --ignore-scripts
    npm test
    npm run build

在 Chrome 加载 `dist` 目录即可。`dist` 需为空或是同版本构建目录，避免混入 1.x 的旧模型。

## 来源和许可

采用 [Native Translate](https://github.com/zh30/native-translate) 的本机翻译桥并进行 X 专用改造，属于非官方精简派生版，非完整上游扩展。来源、固定提交及修改范围见 [UPSTREAM.md](UPSTREAM.md)，MIT 许可和第三方说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。Chrome 的翻译模型不属于本仓库开源代码，也未重新分发。
