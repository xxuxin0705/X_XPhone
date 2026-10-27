# 小手机 X_XPhone

先读 AGENTS.md（项目规矩、文件地图、核心约定、模块边界、测试），再动手。
改界面前读 DESIGN.md（主题变量、尺寸、动效规则、不要做的事），沿用它，不要另起一套风格。
测试：只跑改动相关的组，如 `node tests/run.cjs isle`；改到 core.js / index.js / style.css 这类共用文件再加 `e2e`。不要默认跑全量（太慢），用户要求时才跑。说明见 tests/README.md。
