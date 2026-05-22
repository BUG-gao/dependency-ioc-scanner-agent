# Dependency IOC Scanner Agent

本工具用于本地扫描项目是否命中依赖 IOC 或供应链投毒 IOC。

支持两种方式：

- CLI：命令行扫描，例如 `ioc-scan axios 1.14.1`
- openClaw Skill：在 openClaw 中调用 `runOpenClawSkill`

检测过程是本地离线扫描，不会上传项目代码。

## CLI 全局安装

直接从 GitHub 安装：

```bash
npm install -g git+https://github.com/BUG-gao/dependency-ioc-scanner-agent.git
```

验证：

```bash
ioc-scan --help
```

配置要扫描的项目：

```bash
mkdir -p ~/.ioc-scan
vim ~/.ioc-scan/projects.yaml
```

示例：

```yaml
projects:
  - name: goplus_web
    path: /Users/xxx/goplus_web

  - name: costr
    path: /Users/xxx/costr
```

## CLI 项目内安装

如果不想全局安装，也可以拉源码后在项目内运行：

```bash
git clone https://github.com/BUG-gao/dependency-ioc-scanner-agent.git
cd dependency-ioc-scanner-agent
npm install
npm run build
```

项目内运行：

```bash
npm run dev -- axios 1.14.1 -c ~/.ioc-scan/projects.yaml
```

## CLI 使用

扫描一个 IOC：

```bash
ioc-scan axios 1.14.1
```

扫描版本范围：

```bash
ioc-scan axios ">=1.14.0 <1.15.0"
```

一次扫描多个 IOC：

```bash
ioc-scan axios 1.14.1 axum 0.8 requests 2.31.0
```

指定配置文件：

```bash
ioc-scan axios 1.14.1 -c /Users/xxx/security/projects.yaml
```

输出 JSON：

```bash
ioc-scan axios 1.14.1 -j
```

支持扫描的依赖文件包括：

```text
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
go.mod
go.sum
pom.xml
build.gradle
requirements.txt
pyproject.toml
Pipfile
Cargo.toml
Cargo.lock
```

## openClaw Skill 安装

在 openClaw 的 skill 工程中安装：

```bash
npm install git+https://github.com/BUG-gao/dependency-ioc-scanner-agent.git
```

## openClaw Skill 使用

扫描依赖版本 IOC：

```ts
import { runOpenClawSkill } from "dependency-ioc-scanner-agent";

const output = await runOpenClawSkill({
  ioc_text: "axios 1.14.1"
});

return output.report;
```

扫描整段安全通知或供应链投毒通知：

```ts
import { runOpenClawSkill } from "dependency-ioc-scanner-agent";

const output = await runOpenClawSkill({
  notice_text: `
又一起供应链投毒，大家请自查：
恶意域名和URL：t.m-kosche.com https://t.m-kosche.com:443/api/public/otel/v1/traces
恶意npm生命周期脚本："preinstall" : "bun run index.js"
恶意GitHub依赖："@antv/setup" : "github:antvis/G2#1916faa365f2788b6e193514872d51a242876569"
仓库反标记：niagA oG eW ereH :duluH-iahS
  `
});

return output.report;
```

如果不想使用 `~/.ioc-scan/projects.yaml`，可以直接传项目列表：

```ts
const output = await runOpenClawSkill({
  ioc_text: "axios 1.14.1",
  projects: [
    {
      name: "goplus_web",
      path: "/Users/xxx/goplus_web"
    }
  ]
});
```

## 更新

更新全局 CLI：

```bash
npm install -g git+https://github.com/BUG-gao/dependency-ioc-scanner-agent.git
```

更新项目内安装：

```bash
cd dependency-ioc-scanner-agent
git pull
npm install
npm run build
```

更新 openClaw Skill：

```bash
cd 你的-openClaw-skill-项目
npm install git+https://github.com/BUG-gao/dependency-ioc-scanner-agent.git
```

## 删除

删除全局 CLI：

```bash
npm uninstall -g dependency-ioc-scanner-agent
```

删除项目内源码：

```bash
rm -rf dependency-ioc-scanner-agent
```

删除 openClaw Skill 依赖：

```bash
cd 你的-openClaw-skill-项目
npm uninstall dependency-ioc-scanner-agent
```

删除本地扫描配置：

```bash
rm ~/.ioc-scan/projects.yaml
```
