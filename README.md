# Dependency IOC Scanner Agent

Scans configured projects for dependency IOC matches from security notices such as `axios 1.14.1`.

## Usage

```bash
npm install
npm run build
npm run dev -- --ioc "axios 1.14.1" --config config/projects.yaml
```

The built CLI is exposed as `ioc-scan`.

```bash
ioc-scan --ioc "axios 1.14.1"
ioc-scan --ioc "axios >=1.14.0 <1.15.0" --json
```

## Configuration

```yaml
projects:
  - name: goplus_web
    path: /Users/xxx/goplus_web
  - name: secware
    path: /Users/xxx/secware
```

## openClaw Adapter

```ts
import { runOpenClawSkill } from "dependency-ioc-scanner-agent";

const result = await runOpenClawSkill({
  ioc_text: "axios 1.14.1",
  projects: [{ name: "goplus_web", path: "/Users/xxx/goplus_web" }]
});
```
