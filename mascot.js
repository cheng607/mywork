const stage = document.querySelector('[data-mascot-stage]');
const homeArt = document.querySelector('.mascot-home-art');

if (stage && homeArt) {
  const canvas = stage.querySelector('[data-mascot-canvas]');
  const loading = stage.querySelector('[data-mascot-loading]');
  const message = stage.querySelector('[data-mascot-message]');
  const minimize = stage.querySelector('[data-mascot-minimize]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sections = [...document.querySelectorAll('[data-mascot-section]')];
  const storageKey = 'cheng607-portfolio-scene';
  const prompts = {
    home: '你好，我是 Cheng。来看看我做的项目吧。',
    work: '项目都在这里，选一个看看吧。',
    about: '我喜欢把想法做成能运行的产品。',
    contact: '有想法的话，欢迎来聊聊。',
    gaming: '玩一会儿，换个思路再继续。',
    dining: '好好吃饭，也给自己留一点休息时间。',
  };
  const layouts = { home: { y: 0, scale: 1 }, gaming: { y: 0.35, scale: 0.9 }, dining: { y: -0.24, scale: 1 } };
  let activeScene = 'home';
  try {
    const saved = localStorage.getItem(storageKey);
    if (Object.hasOwn(layouts, saved)) activeScene = saved;
  } catch { /* Storage is optional. */ }
  let activeSection = 'home';
  let renderer, camera, scene, pivot, rig, draco;
  let raf = 0, lastTime = 0, motionTime = 0;
  let visible = true;
  stage.append(loading, canvas);
  const say = text => { if (message.textContent !== text) message.textContent = text; };

  function selectScene(name) {
    if (!Object.hasOwn(layouts, name)) return;
    activeScene = name;
    stage.dataset.mascotScene = name;
    stage.querySelectorAll('[data-scene-select]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.sceneSelect === name));
    });
    // Other rooms load only when selected.
    stage.querySelectorAll(`[data-scene-image="${name}"], [data-scene-foreground="${name}"], [data-scene-preview="${name}"]`).forEach(image => {
      if (image.dataset.src) { image.src = image.dataset.src; delete image.dataset.src; }
    });
    say(prompts[name === 'home' ? activeSection : name]);
    try { localStorage.setItem(storageKey, name); } catch { /* Storage is optional. */ }
    if (reducedMotion.matches || stage.classList.contains('is-minimized')) renderStill();
    else start();
  }
  function updatePose(delta, still = false) {
    if (!rig) return;
    const name = stage.classList.contains('is-minimized') ? 'home' : activeScene;
    const layout = layouts[name];
    const blend = still ? 1 : 1 - Math.exp(-delta * 8);
    pivot.position.y += (layout.y - pivot.position.y) * blend;
    pivot.scale.setScalar(pivot.scale.x + (layout.scale - pivot.scale.x) * blend);
    rig.update(name, delta, motionTime, still);
  }
  function renderStill() {
    updatePose(0, true);
    if (renderer) renderer.render(scene, camera);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; lastTime = 0; }
  function canAnimate() {
    return renderer && rig && visible && !document.hidden && !reducedMotion.matches
      && !stage.classList.contains('is-minimized');
  }
  function frame(time) {
    raf = 0;
    if (!canAnimate()) return;
    if (!lastTime || time - lastTime >= 1000 / 30) {
      const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 1 / 30;
      lastTime = time;
      motionTime += delta;
      updatePose(delta);
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (!raf && canAnimate()) { lastTime = 0; raf = requestAnimationFrame(frame); }
  }
  function resize() {
    if (!renderer) return;
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = Math.max(9.2, 1.1 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect) + 0.6);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  async function loadModel() {
    try {
      // Fetch in parallel with modules: no blocking HEAD request or CDN chain.
      const bytesPromise = fetch(new URL(stage.dataset.glbSrc, document.baseURI)).then(response => {
        if (!response.ok) throw new Error(`Model request failed: ${response.status}`);
        return response.arrayBuffer();
      });
      const [THREE, { GLTFLoader }, { DRACOLoader }, { createMascotRig }, bytes] = await Promise.all([
        import('three'), import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/loaders/DRACOLoader.js'), import('./mascot-rig.js'), bytesPromise,
      ]);
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
      camera.position.set(0, 1.55, 9.2);
      camera.lookAt(0, 1.55, 0);
      scene.add(new THREE.HemisphereLight(0xfff8ef, 0xc4b6ad, 2.2));
      const key = new THREE.DirectionalLight(0xfff5eb, 1.7);
      key.position.set(-3, 5, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.6);
      fill.position.set(4, 2, 5);
      scene.add(fill);
      draco = new DRACOLoader();
      draco.setDecoderPath('assets/vendor/three/examples/jsm/libs/draco/gltf/');
      draco.setWorkerLimit(1);
      const loader = new GLTFLoader().setDRACOLoader(draco);
      const gltf = await loader.parseAsync(bytes, new URL('.', document.baseURI).href);
      const model = gltf.scene;
      model.traverse(object => {
        if (!object.isMesh) return;
        for (const material of [].concat(object.material || [])) {
          if (material.map) {
            // Preserve smooth minification for the small on-screen character.
            material.map.minFilter = THREE.LinearMipmapLinearFilter;
            material.map.generateMipmaps = true;
            material.map.needsUpdate = true;
          }
          material.side = THREE.DoubleSide;
        }
      });
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 3.1 / size.y;
      model.scale.multiplyScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      pivot = new THREE.Group();
      pivot.add(model);
      scene.add(pivot);
      rig = createMascotRig(model, pivot);
      resize();
      renderStill();
      stage.classList.add('has-model');
      loading.hidden = true;
      performance.mark('mascot-ready');
      start();
    } catch (error) {
      console.error('角色加载失败。', error);
      loading.textContent = '暂时显示静态角色，场景仍可切换。';
      renderer?.dispose();
      renderer = null;
      stage.classList.add('model-unavailable');
    } finally { draco?.dispose(); }
  }
  let scrollRaf = 0;
  function updatePage() {
    scrollRaf = 0;
    const shouldDock = homeArt.getBoundingClientRect().bottom < 130;
    if (shouldDock !== stage.classList.contains('is-docked')) {
      (shouldDock ? document.body : homeArt).append(stage);
      stage.classList.toggle('is-docked', shouldDock);
      homeArt.classList.toggle('mascot-active', !shouldDock);
      if (!shouldDock) {
        stage.classList.remove('is-minimized');
        minimize.setAttribute('aria-expanded', 'true');
        minimize.setAttribute('aria-label', '收起角色助手');
        minimize.textContent = '−';
      }
      resize(); renderStill(); start();
    }
    const marker = innerHeight * 0.46;
    const section = sections.find(section => {
      const rect = section.getBoundingClientRect();
      return rect.top <= marker && rect.bottom > marker;
    });
    if (section && section.dataset.mascotSection !== activeSection) {
      activeSection = section.dataset.mascotSection;
      if (activeScene === 'home') say(prompts[activeSection]);
    }
  }
  const onScroll = () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(updatePage); };
  stage.querySelectorAll('[data-scene-select]').forEach(button => {
    button.addEventListener('click', () => selectScene(button.dataset.sceneSelect));
  });
  minimize.addEventListener('click', () => {
    const minimized = stage.classList.toggle('is-minimized');
    minimize.setAttribute('aria-expanded', String(!minimized));
    minimize.setAttribute('aria-label', minimized ? '展开角色助手' : '收起角色助手');
    minimize.textContent = minimized ? '+' : '−';
    stop(); resize(); renderStill(); start();
  });
  window.addEventListener('portfolio:project-selection', event => {
    if (activeScene !== 'home' || activeSection !== 'work') return;
    const texts = {
      'project-blog': '这是我的个人博客，记录技术实践与日常。',
      'project-tripbeam': '这是 TripBeam，帮你规划城市旅行。',
    };
    if (texts[event.detail?.slug]) say(texts[event.detail.slug]);
  });
  reducedMotion.addEventListener('change', () => { stop(); renderStill(); start(); });
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) start(); else stop();
  }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  homeArt.classList.add('mascot-active');
  selectScene(activeScene);
  updatePage();
  loadModel();
}
