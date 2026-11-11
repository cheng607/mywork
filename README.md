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

## 主页角色向导

主页角色保留“家里 / 游戏 / 用餐”三个场景，并在滚动离开首屏后收起到右下角。站立、握手柄和桌边休息使用从同一初始骨架计算的完整姿态，切换时平滑插值；页面板块变化只更新提示，不再打断场景姿态。

页面使用 `assets/models/cheng607-mascot-web.glb`，约 2.0 MB、6.5 万三角面。原始约 42.2 MB、150 万三角面的模型保留为源文件，不进入发布包。轻量模型移除了夸张的法线/高光贴图与旧动画，压缩颜色贴图，并保留骨架。生成命令见 `assets/models/README.md`。

首屏先显示约 15 KB 的透明角色预览，再切换到实时 3D；加载失败时三个场景仍能显示预览。模型下载与 JS 模块并行加载，不再发起 HEAD 预检。Three.js 和 Draco 解码器随站点发布，其他场景图片按选择加载，项目漫游在接近视口时初始化。角色在隐藏标签页、离开视口或收起时停止动画，支持减少动态效果设置。

场景背景位于 `assets/scenes/`，静态角色预览位于 `assets/mascot/`，实时姿态定义位于 `mascot-rig.js`。GitHub Pages 构建会对角色脚本、姿态模块和模型使用内容版本号。

项目截图位于 `assets/`，漫游数据位于 `orbit-engine/content.json`。
