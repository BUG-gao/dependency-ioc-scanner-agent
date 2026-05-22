# Dependency IOC Scanner Agent

Dependency IOC Scanner Agent 用来根据安全通知里的 IOC，扫描多个本地项目配置文件，判断项目是否引用了风险依赖版本，或是否命中供应链投毒指标。

它支持两种使用方式：

- CLI：在终端里执行 `ioc-scan axios 1.14.1`
- openClaw Skill：把 `ioc_text` 或整段 `notice_text` 作为输入交给 skill 调用

核心扫描逻辑只在 `core/` 中实现，CLI 和 openClaw Skill 共用同一套 Core。

## CLI 安装

### 从 GitHub 本地安装

```bash
git clone https://github.com/BUG-gao/dependency-ioc-scanner-agent.git
cd dependency-ioc-scanner-agent
npm install
npm run build
npm link
```

安装完成后，终端中会有 `ioc-scan` 命令。

```bash
ioc-scan --help
```

### 不全局安装，直接在项目内运行

```bash
npm install
npm run build
npm run dev -- axios 1.14.1 -c config/projects.yaml
```

## 配置需要检测的项目

CLI 支持全局安装后扫描任意项目。项目路径不需要在被扫描项目里配置，可以统一写到一个 YAML 文件里。

推荐使用全局配置文件：

```bash
mkdir -p ~/.ioc-scan
vim ~/.ioc-scan/projects.yaml
```

写入：

```yaml
projects:
  - name: goplus_web
    path: /Users/xxx/goplus_web

  - name: secware
    path: /Users/xxx/secware
```

也可以把配置文件放在任意位置，执行时用 `--config` 指定：

```bash
ioc-scan axios 1.14.1 -c /Users/xxx/security/projects.yaml
```

配置查找顺序：

1. 命令行参数：`--config /path/to/projects.yaml`
2. 环境变量：`IOC_SCAN_CONFIG=/path/to/projects.yaml`
3. 当前执行目录：`./config/projects.yaml`
4. 全局配置：`~/.ioc-scan/projects.yaml`

字段说明：

- `name`：项目名称，只用于报告展示
- `path`：项目在本机的绝对路径

扫描器会在每个项目目录里查找以下文件：

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `go.mod`
- `go.sum`
- `pom.xml`
- `build.gradle`
- `requirements.txt`
- `pyproject.toml`
- `Pipfile`

openClaw Skill 的供应链投毒扫描还会额外检查：

- 项目根目录和 `node_modules/**/package.json`
- npm 生命周期脚本，例如 `preinstall`、`postinstall`
- npm GitHub 依赖，例如 `"@antv/setup": "github:..."`
- 文本文件中的 URL、域名、可疑标记字符串
- 可疑 npm 包名或仓库名模式，例如 `word-word-123`

默认会忽略：

- `node_modules/`
- `dist/`
- `build/`
- `.git/`
- `vendor/`

## CLI 使用

推荐使用短命令：

```bash
ioc-scan <包名> <版本或范围> [<包名> <版本或范围>...]
```

### 扫描固定版本

```bash
ioc-scan axios 1.14.1
```

### 扫描版本范围

```bash
ioc-scan axios ">=1.14.0 <1.15.0"
```

### 一次扫描多个 IOC

```bash
ioc-scan axios 1.14.1 axum 0.8 requests 2.31.0
```

也可以重复使用 `-i`：

```bash
ioc-scan -i "axios 1.14.1" -i "axum 0.8" -i "requests 2.31.0"
```

旧写法仍然兼容：

```bash
ioc-scan --ioc "axios 1.14.1"
```

### 输出 JSON

```bash
ioc-scan axios 1.14.1 axum 0.8 -j
```

### 临时指定配置文件

```bash
ioc-scan axios 1.14.1 -c /Users/xxx/security/projects.yaml
```

### 输出示例

```markdown
# Dependency IOC Scan Result

IOC:

axios 1.14.1

扫描项目：3

发现风险：1

项目：goplus_web

文件：package.json

发现：axios@1.14.1

状态：Potential Risk

项目：secware

未发现
```

## 如何把安全通知发给它，让它提炼依赖包

CLI 当前接收的是已经提炼好的 IOC，例如：

```text
axios 1.14.1
```

如果你拿到的是完整安全通知，建议先让 Agent 从通知中提炼出要检测的依赖包和版本，再调用 CLI。

可以这样发消息：

```text
请从下面安全通知中提炼需要检测的依赖包 IOC，只输出“包名 版本或版本范围”，不要输出解释。

安全通知：
axios 1.14.1 存在风险，请尽快排查项目中是否引用该版本。
```

期望 Agent 提炼结果：

```text
axios 1.14.1
```

然后执行：

```bash
ioc-scan axios 1.14.1
```

如果安全通知中包含范围版本，可以让 Agent 保留范围：

```text
请从下面安全通知中提炼依赖包 IOC，格式为“包名 semver范围”。

安全通知：
foo-lib 在 >=2.0.0 <2.3.5 版本中存在漏洞。
```

期望结果：

```text
foo-lib >=2.0.0 <2.3.5
```

再执行：

```bash
ioc-scan foo-lib ">=2.0.0 <2.3.5"
```

## openClaw Skill 安装

本项目提供 openClaw Skill 适配器：

```ts
runOpenClawSkill(input)
```

通用安装方式：

```bash
git clone https://github.com/BUG-gao/dependency-ioc-scanner-agent.git
cd dependency-ioc-scanner-agent
npm install
npm run build
npm link
```

然后在 openClaw 的 skill 工程中安装本地包：

```bash
npm link dependency-ioc-scanner-agent
```

如果 openClaw 环境不使用 `npm link`，也可以直接用 GitHub 地址安装：

```bash
npm install git+https://github.com/BUG-gao/dependency-ioc-scanner-agent.git
```

## openClaw Skill 使用

扫描普通依赖版本 IOC：

```ts
import { runOpenClawSkill } from "dependency-ioc-scanner-agent";

const output = await runOpenClawSkill({
  ioc_text: "axios 1.14.1"
});

return output.report;
```

扫描整段安全通知。Skill 会自动提炼依赖版本 IOC 和供应链投毒 IOC，再选择对应检测逻辑：

```ts
import { runOpenClawSkill } from "dependency-ioc-scanner-agent";

const output = await runOpenClawSkill({
  notice_text: `
又一起供应链投毒，大家请自查：
IOCs网络指标
恶意域名和URL：t.m-kosche.com https://t.m-kosche.com:443/api/public/otel/v1/traces
文件与代码指标
恶意npm生命周期脚本："preinstall" : "bun run index.js"
恶意GitHub依赖："@antv/setup" : "github:antvis/G2#1916faa365f2788b6e193514872d51a242876569"
仓库反标记：niagA oG eW ereH :duluH-iahS
  `
});

return output.report;
```

也可以直接传入项目列表，不依赖配置文件：

```ts
import { runOpenClawSkill } from "dependency-ioc-scanner-agent";

const output = await runOpenClawSkill({
  ioc_text: "axios >=1.14.0 <1.15.0",
  projects: [
    {
      name: "goplus_web",
      path: "/Users/xxx/goplus_web"
    },
    {
      name: "secware",
      path: "/Users/xxx/secware"
    }
  ]
});

return output.report;
```

## openClaw 里怎么给它发消息

### 依赖版本漏洞消息模板

```text
请使用 Dependency IOC Scanner Skill 扫描下面安全通知中的依赖风险。

要求：
1. 先从安全通知里提炼依赖包 IOC，格式为“包名 版本或版本范围”。
2. 调用 skill 时把提炼结果放到 ioc_text。
3. 使用默认项目配置；如果没有传 configPath，则按 CLI 相同顺序查找配置。
4. 返回扫描报告，不要省略发现风险的项目、文件、依赖版本和状态。

安全通知：
axios 1.14.1 存在风险，请排查项目中是否引用该版本。
```

如果你已经知道 IOC，可以直接发：

```text
请使用 Dependency IOC Scanner Skill 扫描：
ioc_text = "axios 1.14.1"

请返回 Markdown 扫描报告。
```

### 供应链投毒消息模板

当消息里不是简单的“包名 + 版本”，而是包含域名、URL、生命周期脚本、GitHub 依赖、README 标记等供应链 IOC 时，可以直接把整段消息发给 openClaw：

```text
请使用 Dependency IOC Scanner Skill 检查下面这条供应链投毒通知，判断我们的项目是否中招。

要求：
1. 把下面整段通知作为 notice_text 调用 skill。
2. skill 需要自动提炼 URL、域名、npm 生命周期脚本、GitHub 依赖、可疑文本标记和可疑仓库命名模式。
3. 使用默认项目配置 ~/.ioc-scan/projects.yaml。
4. 返回 Markdown 报告，包含命中的项目、文件、IOC、证据和风险状态。

供应链投毒通知：
又一起供应链投毒，大家请自查：

1. 检查项目依赖：审查项目根目录和node_modules下所有package.json文件，排查是否存在被篡改的preinstall脚本。
2. 搜索失陷指标(IOCs)：在项目中搜索上述提及的网络、文件、代码和行为指标。
3. 审查网络流量日志：检查CI/CD流水线和开发环境是否有到t.m-kosche.com的DNS解析请求或HTTPS连接记录。

IOCs网络指标
● 恶意域名和URL：t.m-kosche.com https://t.m-kosche.com:443/api/public/otel/v1/traces
● 可疑的合法服务API调用：https://fulcio.sigstore.dev/api/v2/signingCert https://rekor.sigstore.dev/api/v1/log/entries

文件与代码指标
● 恶意npm生命周期脚本："preinstall" : "bun run index.js"
● 恶意GitHub依赖："@antv/setup" : "github:antvis/G2#1916faa365f2788b6e193514872d51a242876569"

行为指标
● GitHub仓库特征：攻击者创建的仓库通常遵循 <单词>-<单词>-<3位数字> 的命名模式，例如 sayyadina-stillsuit-852。
● 仓库反标记：README中包含 niagA oG eW ereH :duluH-iahS。
```

### openClaw 完整沟通案例：安装、配置、使用

可以按下面三段和 openClaw 沟通。

第一段：让 openClaw 安装 skill。

```text
请帮我安装这个 openClaw skill 依赖：
git+https://github.com/BUG-gao/dependency-ioc-scanner-agent.git

安装后请确认可以在 skill 代码中 import：
import { runOpenClawSkill } from "dependency-ioc-scanner-agent";
```

第二段：让 openClaw 配置要扫描的项目。

```text
请帮我创建或更新配置文件：
~/.ioc-scan/projects.yaml

配置内容：
projects:
  - name: goplus_web
    path: /Users/gaopengfei/Documents/goPlus_project/goplus_web
```

第三段：直接发送投毒通知，让 openClaw 调用 skill 自动分析和检测。

```text
请使用 Dependency IOC Scanner Skill 检查我们的项目是否命中下面这条供应链投毒通知。

调用要求：
1. 把下面整段消息作为 notice_text 传给 runOpenClawSkill。
2. 不要手工只提炼依赖版本；请让 skill 自动提炼供应链 IOC 并选择检测逻辑。
3. 使用 ~/.ioc-scan/projects.yaml 中的项目路径。
4. 返回 Markdown 报告。

投毒通知：
又一起供应链投毒，大家请自查：
IOCs网络指标：t.m-kosche.com https://t.m-kosche.com:443/api/public/otel/v1/traces
文件与代码指标："preinstall" : "bun run index.js"
恶意GitHub依赖："@antv/setup" : "github:antvis/G2#1916faa365f2788b6e193514872d51a242876569"
仓库反标记：niagA oG eW ereH :duluH-iahS
```

或者直接复制投毒信息抛给他

![image-20260522170750151](/Users/gaopengfei/Library/Application Support/typora-user-images/image-20260522170750151.png)

如果要指定项目路径，可以发：

```text
请使用 Dependency IOC Scanner Skill 扫描：
ioc_text = "axios >=1.14.0 <1.15.0"

projects:
- name: goplus_web
  path: /Users/xxx/goplus_web
- name: secware
  path: /Users/xxx/secware

请返回 Markdown 扫描报告。
```

## 支持的 IOC 格式

固定版本：

```text
axios 1.14.1
```

多个版本：

```text
axios 1.14.1, 1.14.2
```

多个 IOC：

```bash
ioc-scan axios 1.14.1 axum 0.8 requests 2.31.0
```

版本范围：

```text
axios >=1.14.0 <1.15.0
```

Scoped npm 包：

```text
@scope/pkg 2.0.1
```

Java Maven 坐标：

```text
org.example:demo-lib 1.2.3
```

供应链投毒 IOC：

```text
t.m-kosche.com
https://t.m-kosche.com:443/api/public/otel/v1/traces
"preinstall" : "bun run index.js"
"@antv/setup" : "github:antvis/G2#1916faa365f2788b6e193514872d51a242876569"
niagA oG eW ereH :duluH-iahS
```

## 开发和验证

```bash
npm install
npm run typecheck
npm test
npm run build
```
