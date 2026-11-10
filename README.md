# cheng607 — 个人作品集

静态个人作品集，展示个人博客与 TripBeam。项目漫游复用参考站的 Three.js 图像环形交互，使用两张本地页面截图填充卡片；悬停切换中间预览，移动鼠标改变视角，拖动或滚轮旋转。

## 本地预览

```bash
python -m http.server 8000
```

打开 `http://localhost:8000`。

## GitHub Pages

仓库名为 `mywork`，发布后地址为 `https://cheng607.github.io/mywork/`。仓库内的 GitHub Actions 会将静态页面构建到 `dist/` 并发布到 Pages。

```bash
node scripts/build-pages.mjs
```

项目截图位于 `assets/`，漫游数据位于 `orbit-engine/content.json`。
