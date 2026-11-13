# X 中文回复翻译

桌面 Chrome 扩展。在 X 的回复框旁用中文写草稿，一键翻成英文并填入原回复框。英文可编辑，由你点击 X 的「回复」发送。模型随安装包提供，翻译在本机进行，无需联网或 API 密钥。

## 安装

1. 从 [GitHub Releases](https://github.com/bbw-88/x-cn-reply-translator/releases/latest) 下载 **x-cn-reply-translator-v1.0.0.zip**（后续版本请选择同名、版本号更新的安装包）。
2. 解压到一个会保留的文件夹。在桌面 Chrome 地址栏打开 chrome://extensions。
3. 打开右上角「开发者模式」，点「加载已解压的扩展程序」，选择解压后直接包含 manifest.json 的文件夹。
4. 刷新 X 页面。

需要桌面 Chrome 116 或更新版本。Release 的安装包包含模型。安装后保留解压目录。

## 使用

1. 打开一条帖子的回复框，点「中文回复 → 英文」。
2. 输入中文，点「翻译并填入」，或按 Ctrl+Enter。
3. 英文会直接进入 X 的原回复框。检查或修改后，再点击 X 的「回复」。

首次翻译需要加载本地模型。小框最多可输入 450 个字符，发送时仍以 X 的字数限制为准。扩展保留在 X 回复框中手动输入或修改的草稿。扩展仅在 x.com 和 twitter.com 的回复框显示。

## 从源码构建

需要 Node.js 22 或更新版本。首次构建需要联网，从 npm 安装依赖，并从 Hugging Face 下载固定版本的模型文件。构建会验证模型文件的 SHA-256。

    npm ci --ignore-scripts
    npm run build

构建完成后，在 Chrome 的「加载已解压的扩展程序」中选择 dist 文件夹。安装包由 dist 文件夹内的文件打包生成。

## 许可

扩展自写代码采用 MIT 许可证。离线模型和第三方运行库的来源、修改说明和许可证见 [第三方许可](THIRD_PARTY_NOTICES.md)。
