# 一个博客

基于 Astro 的个人静态博客。使用本地 Markdown 写作，文章与图片放在一起；
推送到 `source` 分支后由 GitHub Actions 构建并发布到 GitHub Pages。

不包含点赞、评论、账号、数据库或第三方互动服务。GitHub Pages 无法直接提供
匿名共享点赞计数，因此按维护成本的取舍不加入该功能。

## 本地开发

需要 Node.js **22.12 或更高版本**，CI 使用 Node.js 22。

```powershell
npm ci
npm run dev
```

打开终端显示的本地地址。开发预览包含草稿，正式构建不发布草稿。
编辑器的 Markdown 预览可以直接显示相对路径图片；完整主题效果使用开发服务器查看。

其他命令：

| 命令 | 用途 |
| --- | --- |
| `npm run check` | Astro 与 TypeScript 检查 |
| `npm test` | 文章元数据、图片路径和新文章工具测试 |
| `npm run build` | 生成 `dist`，包括旧图片地址兼容副本 |
| `npm run test:site` | 构建后检查站内链接、目录锚点、旧网址、RSS 等 |
| `npm run preview` | 预览正式构建结果 |

## 写文章与插入图片

创建文章：

```powershell
npm run new -- my-first-post "我的新文章"
```

工具按上海时区创建日期和网址，不覆盖已有文章：

```text
src\content\posts\2026-09-28-my-first-post\
  index.md
  images\
    screenshot.png
```

在正文中使用标准 Markdown 相对路径：

```markdown
![截图说明](./images/screenshot.png)
```

- VS Code 已配置粘贴/拖入外部图片时将其复制到当前文章的 `images` 目录。
  如出现粘贴选项，选择“插入图片”；从资源管理器拖入时可按住 Shift。
- 使用 Typora 等其他编辑器时，将图片复制位置配置为相对当前文件的 `./images`。
- 不要使用磁盘绝对路径，也不要为正文图片使用站点根路径。
- 文章目录放在 `src` 中，Astro 在构建时处理并优化图片；图片不用单独上传图床。
- 公用头像、图标和背景图保存在 [public](public)，不会被图片优化器处理。

新文章默认 `draft: true`，准备发布时改成 `false`：

```yaml
---
title: "我的新文章"
description: "文章摘要"
date: "2026-09-28T00:00:00+08:00"
permalink: "/2026/09/28/my-first-post/"
tags:
  - Astro
draft: false
---
```

可选字段：`excerpt`（列表/RSS 摘要）、`updated`（更新时间）、`author`、`catalog`
（设为 `false` 不显示目录）。`permalink` 是稳定的公开地址，发布后尽量不要更改；
中文和空格使用原文填写，不要手动 URL 编码。新文章目录建议使用小写英文及连字符。

草稿不会出现在正式页面、RSS 和站点地图中，但**公开仓库中的草稿源码仍然是公开的**。

公式使用 `$行内公式$`；独立公式的 `$$` 分别放在单独一行：

```markdown
$$
E = mc^2
$$
```

公式及代码高亮在构建时生成，不需要外部 CDN 脚本。

## 自动部署（首次配置一次）

1. 在 GitHub 仓库 **Settings → Pages → Build and deployment** 中，
   将 **Source** 从分支发布改为 **GitHub Actions**。
2. 如果已有 `github-pages` environment 且部署分支规则只允许 `main`，
   在 **Settings → Environments → github-pages** 中允许 `source`。
3. 将迁移后的代码提交并推送到 `source`。也可以在 Actions 页面手动运行
   **Build and deploy Astro**，运行分支选择 `source`。

后续只需写作、提交和推送：

```text
Markdown + 图片 → git push → 检查/测试/构建 → GitHub Pages
```

[部署工作流](.github/workflows/deploy.yml) 使用 GitHub 自带的 `GITHUB_TOKEN` 权限，
不需要 PAT、额外 Secrets 或新平台账号。PR 只做检查和构建，不部署。
构建产物直接以 Pages artifact 发布，**不会再向 `main` 提交生成的 HTML**。
当前保留 `source` 作为源码分支，避免无必要地改名或覆盖旧 `main`。

若以后重命名源码分支，需要同步调整工作流的分支触发器、部署条件和 environment 规则。
本文档描述的是配置步骤；添加工作流文件本身不会替你修改 GitHub 仓库的 Pages 设置。

## 网站配置与内容兼容

- [src/site.ts](src/site.ts)：标题、副标题、作者、网址、头像、时区、每页文章数。
- [src/content.config.ts](src/content.config.ts)：文章字段校验。
- [src/styles](src/styles)：响应式样式及系统浅色/深色外观。
- [astro.config.mjs](astro.config.mjs)：静态构建、Markdown、公式、高亮和站点地图。
- `/archives/`：按年/月归档；`/tags/`：标签；`/rss.xml`：订阅。

迁移保留了 17 篇原有文章、原文图片、日期、文章网址、标签网址和归档分页。
原 Hexo 与 Astro 的标题锚点算法不同，因此
[legacy-headings.json](scripts/legacy-headings.json) 保留旧标题 ID，
防止已有文章内链接和外部带 `#` 的链接失效。新增文章使用 Astro 默认锚点。
修改旧文章标题时应注意相关旧锚点兼容记录。

[legacy-assets.json](scripts/legacy-assets.json) 记录 18 张原有图片的旧公开地址。
`npm run build` 的后置步骤从文章图片目录复制兼容文件，不需要维护两份原图。
这些旧图片地址只在正式构建中提供，日常写作继续使用新的相对路径。

[legacy-pages.json](tests/fixtures/legacy-pages.json) 用于防止迁移后的原有网址丢失。
旧文的非标准单行 `$$...$$` 公式已整理为标准 Markdown 公式分隔符。

## Hexo 备份

迁移前的源码提交 `9ae46ad` 保存在备份分支：

```text
backup/hexo-2026-09-28
```

备份包括原 Hexo 配置、文章及 Stun 子模块的提交引用；主题内容仍由其独立仓库管理。
备份分支可通过下面的命令推送到远端：

```powershell
git push origin backup/hexo-2026-09-28
```

查看旧版本时，先保存当前改动，再切换备份分支，并运行
`git submodule update --init --recursive` 和 `npm ci`。
不要在尚未切换 Pages 发布方式时删除旧 `main` 分支。
