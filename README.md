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

主页角色会跟随当前板块切换提示和动作，并在滚动离开首屏后收起到右下角。模型加载期间显示下载进度，加载失败时提示刷新重试；发布构建会根据 GLB 的实际大小更新进度基准。

角色 GLB 位于 `assets/models/cheng607-mascot.glb`。场景动作由 Blender 制作并嵌入 GLB，再由 Three.js 按场景播放；构建脚本会将模型目录复制到 GitHub Pages 发布目录。模型发布前请确认许可和署名要求。

当前模型由腾讯混元 3D 根据角色概念图生成，并借助 Mixamo 自动绑骨。GLB 包含 `idle`、`scene_sit_down`、`scene_stand_up`、`scene_gaming_play` 和 `scene_dining_eat` 动画片段。页面按场景播放坐下/起身过渡及游戏、用餐循环，保留原 Draco 网格压缩；模型约 42 MB，当前不包含面部表情动画。动作生成命令见 `assets/models/README.md`。

主页角色舞台可在“家里 / 游戏 / 用餐”三种预渲染 WebP 背景间切换，透明 Three.js 画布只绘制角色。坐姿和手部活动通过独立 Blender 骨骼片段驱动，页面会在切换场景时交叉淡入对应动作。场景背景位于 `assets/scenes/`，Pages 构建会将其复制到发布目录。

项目截图位于 `assets/`，漫游数据位于 `orbit-engine/content.json`。
