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

主页角色会跟随当前板块切换提示和动作，并在滚动离开首屏后收起到右下角。模型加载期间显示已接收的数据量，加载失败时提示刷新重试。

将经过优化的角色模型放到 `assets/models/cheng607-mascot.glb`。可选的动画片段名建议包含 `idle`、`wave`、`point` 或 `think`；构建脚本会将模型目录复制到 GitHub Pages 发布目录。将模型加入公开站点前，请确认许可和署名要求。

当前模型由腾讯混元 3D 根据角色概念图生成，约 82 MB，尚未绑定骨骼或包含动画；页面动作目前通过整体的轻微位移呈现。

项目截图位于 `assets/`，漫游数据位于 `orbit-engine/content.json`。
