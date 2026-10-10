# 大就是强 · BiggerIsBetter

全球变异背景下的横向碰撞成长游戏。主角从农村老家的轮椅上出发，凭借“战胜对手就能变大变强”的异能一路战斗。

**当前 GitHub 基线已同步 Sites v17 的可部署主游戏产物；world-impact 0.1.0 仍是独立实验，尚未合并或部署到原游戏。**

## 入口

- [原公开试玩站](https://big-is-strong.jimmy-vaughanowl.chatgpt.site/)
- [世界影响模块源码与运行说明](experiments/world-impact/README.md)
- [版本索引](versions/index.json)
- [本次导入及校验记录](versions/world-impact-0.1.0.json)
- [版本管理规则](docs/VERSIONING.md)
- [变更记录](CHANGELOG.md)

## 已归档内容

| 版本 | 内容 | 状态 |
| --- | --- | --- |
| Sites v17 | 当前 Sites 生产版本，已同步 `dist/index.html` 与 16 个 SVG 资产 | 已同步到本仓库 main，可部署基线 |
| Sites v15 | 对话中较早确认的主游戏版本 | 历史发布记录，不作为当前源码基线 |
| world-impact 0.1.0 | M/A/N/F 道路影响、敌人行动修正、设施反应、跨轮回响、死亡重开、独立验收场 | 已导入仓库；未接入主游戏、未部署 |

v17 源码快照来自 Sites 项目，GitHub 快照头为 `f883b298e798ac90276ea959b237f42d25533cd2`；`cafbee9a0d39dd005e77ce83e69631c2cdd7fd9f` 仅是 hosting metadata 提交。`dist/index.html` 是当前生产入口。不能从当前网页恢复 v1-v14 的历史源码，因此本仓库不制造缺失的旧版本。以后以实际 Git 提交、版本索引和发布记录共同管理。

## 本地运行候选模块

需要 Node.js 18+ 和 Python 3；逻辑模块无第三方运行时依赖。

```sh
git clone https://github.com/yzhai4/BiggerIsBetter.git
cd BiggerIsBetter/experiments/world-impact
npm run check
npm test
python build.py
```

打开生成的 `standalone.html`。也可启动 `python -m http.server 8000` 后在浏览器访问本地服务。验收台的 Boss 胜利与死亡按钮是明确标注的模拟控制，不代表完成正式 Boss 战。

## 验证

2026-10-10 导入时重新验证：60 项 Node 逻辑/接入测试通过、58 项本地 Chromium 检查通过；9 个原始代码和测试文件的 Git blob 哈希与本地交付包逐一一致。浏览器测试使用手机尺寸与触控模拟，不是微信真机测试。详细范围见版本记录。

GitHub Actions 配置执行语法检查、Node 测试与单文件构建，并保存候选 HTML 构建产物；实际运行结果以 Actions 页面为准。它不自动修改原 Sites 站点。

## 本阶段范围

只打通现有 M 巨臂 / A 甲壳 / N 神经 / F 菌群：即时能力变化 → 道路和敌人受影响 → 本轮后果 → 下一地区回响 → 死亡重开。暂不增加新进化路线、大型分支剧情或正式图像/音乐/音效资产。

必须保持全球陆地变异、农村轮椅起点、左向右地面道路、大小可读和碰撞胜利成长；不是水下吞食游戏。Boss 后保留绝对力量、变异和世界后果，仅重设显示基准；死亡重开清空本局状态，不误删既有局外成长。

## 仓库结构

```text
experiments/world-impact/  # 候选模块、交互验收场、测试、构建
versions/                 # 真实来源与验证状态
.github/workflows/        # 只读测试与构建，不是生产部署
AGENTS.md                 # 后续开发约束
```

`main` 是管理入口，不等同于已上线。`archive/world-impact-0.1.0` 保留导入基线；后续改动放 `feature/*`，测试后审阅合并。归档分支不是受保护标签，不应继续在其上提交。

仓库不保存访问令牌、Cookie、个人存档或部署密钥。本次访问原站点时，当前浏览器返回 `ERR_BLOCKED_BY_ADMINISTRATOR`，因此未声称站点下线、私有或已完成试玩，也未访问认证域名。
