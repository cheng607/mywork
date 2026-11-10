const stage = document.querySelector('[data-mascot-stage]');
const homeArt = document.querySelector('.mascot-home-art');

if (stage && homeArt) {
  const poster = stage.querySelector('.mascot-poster');
  const canvas = stage.querySelector('[data-mascot-canvas]');
  const message = stage.querySelector('[data-mascot-message]');
  const minimizeButton = stage.querySelector('[data-mascot-minimize]');
  const sections = [...document.querySelectorAll('[data-mascot-section]')];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const sectionPrompts = {
    home: { action: 'wave', text: '你好，我是 Cheng。来看看我做的项目吧。' },
    work: { action: 'present', text: '项目都在这里，选一个看看吧。' },
    about: { action: 'think', text: '我喜欢把想法做成能运行的产品。' },
    contact: { action: 'wave', text: '有想法的话，欢迎来聊聊。' },
  };
  const projectPrompts = {
    'project-blog': '这是我的个人博客，记录技术实践与日常。',
    'project-tripbeam': '这是 TripBeam，帮你规划城市旅行。',
  };

  let activeSection = '';
  let currentAction = 'idle';
  let lastProject = '';
  let modelActions = new Map();
  let activeModelAction = null;
  let mixer = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let rafId = 0;
  let lastFrameTime = 0;
  let modelLoaded = false;

  function say(text) {
    if (message && message.textContent !== text) message.textContent = text;
  }

  function playModelAction(name) {
    const action = modelActions.get(name) || modelActions.get('idle');
    if (action === activeModelAction) return;
    const previous = activeModelAction;
    if (previous) previous.fadeOut(0.2);
    if (!action) {
      activeModelAction = null;
      return;
    }
    action.reset().fadeIn(0.2).play();
    activeModelAction = action;
  }

  function setAction(name, text) {
    currentAction = name;
    stage.classList.remove('action-idle', 'action-wave', 'action-present', 'action-think');
    if (!prefersReducedMotion.matches) {
      void stage.offsetWidth;
      stage.classList.add(`action-${name}`);
    }
    if (text) say(text);
    playModelAction(name);
  }

  function enterSection(name) {
    if (!sectionPrompts[name] || activeSection === name) return;
    activeSection = name;
    const prompt = sectionPrompts[name];
    setAction(prompt.action, prompt.text);
  }

  function currentSectionAtViewport() {
    const marker = window.innerHeight * 0.46;
    const current = sections.find((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= marker && rect.bottom > marker;
    });
    if (current) enterSection(current.dataset.mascotSection);
  }

  function updateDock() {
    const artBottom = homeArt.getBoundingClientRect().bottom;
    const shouldDock = artBottom < 130;
    const alreadyDocked = stage.parentElement === document.body;

    if (shouldDock && !alreadyDocked) {
      document.body.append(stage);
      stage.classList.add('is-docked');
      homeArt.classList.remove('mascot-active');
    } else if (!shouldDock && alreadyDocked) {
      homeArt.append(stage);
      stage.classList.remove('is-docked', 'is-minimized');
      homeArt.classList.add('mascot-active');
      minimizeButton?.setAttribute('aria-expanded', 'true');
      minimizeButton?.setAttribute('aria-label', '收起角色助手');
      if (minimizeButton) minimizeButton.textContent = '−';
    }
  }

  let scrollFrame = 0;
  function updateFromScroll() {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      updateDock();
      currentSectionAtViewport();
    });
  }

  function restartCurrentAction() {
    const prompt = sectionPrompts[activeSection] || sectionPrompts.home;
    const text = activeSection === 'work' && projectPrompts[lastProject]
      ? projectPrompts[lastProject]
      : prompt.text;
    setAction(prompt.action, text);
  }

  stage.querySelectorAll('[data-mascot-replay]').forEach((button) => {
    button.addEventListener('click', restartCurrentAction);
  });

  minimizeButton?.addEventListener('click', () => {
    const minimized = stage.classList.toggle('is-minimized');
    minimizeButton.setAttribute('aria-expanded', String(!minimized));
    minimizeButton.setAttribute('aria-label', minimized ? '展开角色助手' : '收起角色助手');
    minimizeButton.textContent = minimized ? '+' : '−';
  });

  window.addEventListener('portfolio:project-selection', (event) => {
    const slug = event.detail?.slug;
    if (!slug || slug === lastProject) return;
    lastProject = slug;
    if (activeSection === 'work' && projectPrompts[slug]) {
      setAction('present', projectPrompts[slug]);
    }
  });

  prefersReducedMotion.addEventListener?.('change', () => {
    if (prefersReducedMotion.matches) {
      stage.classList.remove('action-idle', 'action-wave', 'action-present', 'action-think');
    } else {
      stage.classList.add(`action-${currentAction}`);
    }
  });

  async function loadModel() {
    const modelUrl = stage.dataset.glbSrc;
    if (!modelUrl || !canvas) return;

    try {
      const absoluteModelUrl = new URL(modelUrl, document.baseURI);
      const head = await fetch(absoluteModelUrl, { method: 'HEAD' });
      if (!head.ok) return;

      const [THREE, { GLTFLoader }] = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
      ]);

      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
      camera.position.set(0, 1.65, 5.8);
      camera.lookAt(0, 1.45, 0);
      scene.add(new THREE.HemisphereLight(0xfff3dc, 0x51414d, 2.1));

      const keyLight = new THREE.DirectionalLight(0xffe8ce, 2.7);
      keyLight.position.set(-3, 5, 5);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xffffff, 1.15);
      fillLight.position.set(4, 2.5, -2);
      scene.add(fillLight);

      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(absoluteModelUrl.href);
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = size.y > 0 ? 3.1 / size.y : 1;
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      scene.add(model);

      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        const clipMatches = {
          idle: /idle|rest|stand/i,
          wave: /wave|hello|greet/i,
          present: /point|present|show/i,
          think: /think|ponder/i,
        };
        for (const [name, pattern] of Object.entries(clipMatches)) {
          const clip = gltf.animations.find((candidate) => pattern.test(candidate.name));
          if (clip) modelActions.set(name, mixer.clipAction(clip));
        }
        playModelAction(currentAction);
      }

      modelLoaded = true;
      stage.classList.add('has-model');
      poster?.setAttribute('aria-hidden', 'true');
      resizeRenderer();
      renderOnce();
      startRenderLoop();
    } catch (error) {
      console.info('3D 角色文件尚未配置，继续显示轻量静态角色。', error);
      renderer?.dispose();
      renderer = null;
      stage.classList.remove('has-model');
    }
  }

  function resizeRenderer() {
    if (!renderer || !camera || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderOnce();
  }

  function renderOnce() {
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function renderFrame(time) {
    rafId = 0;
    if (!modelLoaded || document.hidden || !mixer) return;
    const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0;
    lastFrameTime = time;
    mixer.update(delta);
    renderOnce();
    rafId = window.requestAnimationFrame(renderFrame);
  }

  function startRenderLoop() {
    if (!rafId && mixer && !document.hidden) {
      lastFrameTime = 0;
      rafId = window.requestAnimationFrame(renderFrame);
    }
  }

  window.addEventListener('resize', resizeRenderer, { passive: true });
  const stageResizeObserver = new ResizeObserver(resizeRenderer);
  stageResizeObserver.observe(stage);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
      lastFrameTime = 0;
    } else {
      startRenderLoop();
    }
  });
  window.addEventListener('scroll', updateFromScroll, { passive: true });
  window.addEventListener('resize', updateFromScroll, { passive: true });

  homeArt.classList.add('mascot-active');
  setAction('wave', sectionPrompts.home.text);
  updateFromScroll();
  loadModel();
}
