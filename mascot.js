const stage = document.querySelector('[data-mascot-stage]');
const homeArt = document.querySelector('.mascot-home-art');

if (stage && homeArt) {
  const loading = stage.querySelector('[data-mascot-loading]');
  const canvas = stage.querySelector('[data-mascot-canvas]');
  const message = stage.querySelector('[data-mascot-message]');
  const minimizeButton = stage.querySelector('[data-mascot-minimize]');
  const sections = [...document.querySelectorAll('[data-mascot-section]')];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sceneStorageKey = 'cheng607-portfolio-scene';
  const savedScene = (() => {
    try {
      const name = localStorage.getItem(sceneStorageKey);
      return ['home', 'gaming', 'dining'].includes(name) ? name : 'home';
    } catch { return 'home'; }
  })();

  // Let the renderer use the whole scene viewport while the figure button stays a
  // smaller, accessible hit target over the character.
  if (canvas) stage.append(canvas);

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
  let modelPivot = null;
  let modelVisible = true;
  let motionTime = 0;
  let gestureStarted = 0;
  let waveUpperArm = null;
  let waveForeArm = null;
  let THREEEngine = null;
  let activeScene = savedScene;
  let sceneTransitionAction = null;
  let proceduralBoneBases = new Map();

  const scenePrompts = {
    home: { text: '在家放松一下，再继续把想法做出来。' },
    gaming: { text: '坐下来开一局，灵感也许就在下一关。' },
    dining: { text: '坐下来好好吃饭，补充能量再继续。' },
  };

  function selectScene(name) {
    if (!scenePrompts[name] || name === activeScene) return;
    const previousScene = activeScene;
    activeScene = name;
    try { localStorage.setItem(sceneStorageKey, name); } catch { /* Storage can be unavailable in private contexts. */ }
    stage.dataset.mascotScene = name;
    stage.querySelectorAll('[data-scene-select]').forEach((button) => {
      const selected = button.dataset.sceneSelect === name;
      button.setAttribute('aria-pressed', String(selected));
    });
    const prompt = name === 'home'
      ? (sectionPrompts[activeSection] || sectionPrompts.home)
      : { action: 'idle', text: scenePrompts[name].text };
    setAction(prompt.action, prompt.text);
    playSceneForSelection(previousScene, name);
    if (!prefersReducedMotion.matches) startRenderLoop();
    renderOnce();
  }

  function restoreProceduralBonePose() {
    for (const [bone, quaternion] of proceduralBoneBases) bone.quaternion.copy(quaternion);
    proceduralBoneBases.clear();
  }

  function addPoseRotation(bone, x, y, z, weight) {
    if (!bone || (!x && !y && !z) || weight <= 0) return;
    if (!proceduralBoneBases.has(bone)) proceduralBoneBases.set(bone, bone.quaternion.clone());
    const offset = new THREEEngine.Quaternion().setFromEuler(new THREEEngine.Euler(x * weight, y * weight, z * weight, 'XYZ'));
    bone.quaternion.multiply(offset);
  }

  function say(text) {
    if (message && message.textContent !== text) message.textContent = text;
  }

  function playAction(action, { loop = false, fade = 0.22, staticPose = false } = {}) {
    if (!action || !mixer) return;
    if (activeModelAction === action) {
      if (staticPose) {
        action.paused = true;
        mixer.update(0);
      }
      return;
    }
    if (activeModelAction) activeModelAction.fadeOut(fade);
    action.reset();
    action.enabled = true;
    action.setLoop(loop ? THREEEngine.LoopRepeat : THREEEngine.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.paused = false;
    action.fadeIn(fade).play();
    activeModelAction = action;
    if (staticPose) {
      action.time = loop ? action.getClip().duration * 0.28 : action.getClip().duration;
      action.paused = true;
      mixer.update(0);
    }
  }

  function playModelAction(name, staticPose = false) {
    sceneTransitionAction = null;
    playAction(modelActions.get(name) || modelActions.get('idle'), { loop: true, staticPose });
  }

  function playSceneLoop(name, staticPose = false) {
    const actionName = name === 'gaming' ? 'sceneGaming' : 'sceneDining';
    sceneTransitionAction = null;
    playAction(modelActions.get(actionName) || modelActions.get('idle'), { loop: true, fade: 0.28, staticPose });
  }

  function playSceneTransition(name, targetScene) {
    const action = modelActions.get(name);
    if (!action || prefersReducedMotion.matches) {
      if (targetScene === 'home') {
        const prompt = sectionPrompts[activeSection] || sectionPrompts.home;
        playModelAction(prompt.action, prefersReducedMotion.matches);
      } else playSceneLoop(targetScene, prefersReducedMotion.matches);
      return;
    }
    sceneTransitionAction = action;
    playAction(action, { loop: false, fade: 0.28 });
    if (action._portfolioFinishedHandler) mixer.removeEventListener('finished', action._portfolioFinishedHandler);
    action._portfolioFinishedHandler = (event) => {
      if (event.action !== action) return;
      mixer.removeEventListener('finished', action._portfolioFinishedHandler);
      if (sceneTransitionAction !== action) return;
      sceneTransitionAction = null;
      if (targetScene === 'home') {
        const prompt = sectionPrompts[activeSection] || sectionPrompts.home;
        playModelAction(prompt.action);
      } else playSceneLoop(activeScene);
    };
    mixer.addEventListener('finished', action._portfolioFinishedHandler);
  }

  function playSceneForSelection(previousScene, nextScene) {
    if (!modelLoaded) return;
    if (nextScene === 'home') {
      if (previousScene !== 'home') playSceneTransition('sceneStandUp', 'home');
      else {
        const prompt = sectionPrompts[activeSection] || sectionPrompts.home;
        playModelAction(prompt.action, prefersReducedMotion.matches);
      }
    } else if (previousScene === 'home') {
      playSceneTransition('sceneSitDown', nextScene);
    } else {
      playSceneLoop(nextScene, prefersReducedMotion.matches);
    }
  }

  function setAction(name, text) {
    currentAction = name;
    gestureStarted = motionTime;
    stage.classList.remove('action-idle', 'action-wave', 'action-present', 'action-think');
    if (!prefersReducedMotion.matches) {
      void stage.offsetWidth;
      stage.classList.add(`action-${name}`);
    }
    if (text) say(text);
    playModelAction(name, prefersReducedMotion.matches);
  }

  function enterSection(name) {
    if (!sectionPrompts[name] || activeSection === name) return;
    activeSection = name;
    if (activeScene !== 'home') {
      setAction('idle', scenePrompts[activeScene].text);
      return;
    }
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
    if (activeScene !== 'home') {
      setAction('idle', scenePrompts[activeScene].text);
      return;
    }
    const prompt = sectionPrompts[activeSection] || sectionPrompts.home;
    const text = activeSection === 'work' && projectPrompts[lastProject]
      ? projectPrompts[lastProject]
      : prompt.text;
    setAction(prompt.action, text);
  }

  stage.querySelectorAll('[data-mascot-replay]').forEach((button) => {
    button.addEventListener('click', restartCurrentAction);
  });

  stage.querySelectorAll('[data-scene-select]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.sceneSelect === activeScene));
    button.addEventListener('click', () => selectScene(button.dataset.sceneSelect));
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
    if (activeSection === 'work' && projectPrompts[slug] && activeScene === 'home') {
      setAction('present', projectPrompts[slug]);
    } else if (activeScene !== 'home') {
      setAction('idle', scenePrompts[activeScene].text);
    }
  });

  prefersReducedMotion.addEventListener?.('change', () => {
    if (prefersReducedMotion.matches) {
      stage.classList.remove('action-idle', 'action-wave', 'action-present', 'action-think');
      if (activeScene === 'home') playModelAction(currentAction, true);
      else playSceneLoop(activeScene, true);
    } else {
      stage.classList.add(`action-${currentAction}`);
      if (activeModelAction) activeModelAction.paused = false;
    }
    if (prefersReducedMotion.matches && modelPivot) {
      modelPivot.rotation.set(0, 0, 0);
      modelPivot.position.y = 0;
      modelPivot.scale.set(1, 1, 1);
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      renderOnce();
    } else {
      startRenderLoop();
    }
  });

  async function loadModel() {
    const modelUrl = stage.dataset.glbSrc;
    if (!modelUrl || !canvas) return;

    try {
      const absoluteModelUrl = new URL(modelUrl, document.baseURI);
      const head = await fetch(absoluteModelUrl, { method: 'HEAD' });
      if (!head.ok) throw new Error(`Model request failed: ${head.status}`);

      const [THREE, { GLTFLoader }, { DRACOLoader }] = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/loaders/DRACOLoader.js'),
      ]);
      THREEEngine = THREE;

      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);

      scene = new THREE.Scene();
      scene.background = null;
      camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
      camera.position.set(0, 1.55, 9.2);
      camera.lookAt(0, 1.55, 0);
      scene.add(new THREE.HemisphereLight(0xfff6e9, 0x9b9aa3, 2.0));

      const keyLight = new THREE.DirectionalLight(0xfff2e3, 1.35);
      keyLight.position.set(-3, 5, 5);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
      fillLight.position.set(4, 3, 5);
      scene.add(fillLight);
      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/libs/draco/');
      loader.setDRACOLoader(dracoLoader);
      const modelBytes = Number(stage.dataset.glbBytes);
      const gltf = await loader.loadAsync(absoluteModelUrl.href, (event) => {
        if (loading && event.loaded > 0) {
          if (Number.isFinite(modelBytes) && modelBytes > 0) {
            const percent = Math.min(100, Math.floor(event.loaded / modelBytes * 100));
            loading.textContent = percent >= 100
              ? '模型已下载，正在解析…'
              : `正在下载 3D 角色… ${percent}%`;
          } else {
            loading.textContent = `正在加载 3D 角色… 已接收 ${(event.loaded / (1024 * 1024)).toFixed(1)} MB`;
          }
        }
      });
      dracoLoader.dispose();
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = size.y > 0 ? 3.1 / size.y : 1;
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      model.traverse((object) => {
        if (!object.isMesh || !object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if ('roughness' in material) material.roughness = Math.max(material.roughness, 0.72);
          if ('metalness' in material) material.metalness = 0;
        });
      });
      modelPivot = new THREE.Group();
      modelPivot.add(model);
      scene.add(modelPivot);
      model.traverse((object) => {
        if (!object.isBone) return;
        const name = object.name.replace(/[^a-z]/gi, '').toLowerCase();
        if (name.endsWith('rightarm')) waveUpperArm = object;
        if (name.endsWith('rightforearm')) waveForeArm = object;
      });
      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        const clipMatches = {
          idle: /idle|rest|stand/i,
          wave: /wave|hello|greet/i,
          present: /point|present|show/i,
          think: /think|ponder/i,
          sceneSitDown: /scene[_ -]?sit[_ -]?down/i,
          sceneStandUp: /scene[_ -]?stand[_ -]?up/i,
          sceneGaming: /scene[_ -]?(gaming|game)[_ -]?(play|idle)?/i,
          sceneDining: /scene[_ -]?(dining|eat)[_ -]?(eat|idle)?/i,
        };
        for (const [name, pattern] of Object.entries(clipMatches)) {
          const clip = gltf.animations.find((candidate) => pattern.test(candidate.name));
          if (clip) modelActions.set(name, mixer.clipAction(clip));
        }
        playModelAction(currentAction);
      }

      modelLoaded = true;
      stage.classList.add('has-model');
      resizeRenderer();
      if (activeScene !== 'home') playSceneLoop(activeScene, prefersReducedMotion.matches);
      else if (prefersReducedMotion.matches) playModelAction(currentAction, true);
      renderOnce();
      startRenderLoop();
    } catch (error) {
      console.error('3D 角色加载失败。', error);
      if (loading) loading.textContent = '3D 角色加载失败，请刷新页面重试。';
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
    const halfFov = camera.fov * Math.PI / 360;
    camera.position.z = Math.max(9.2, 1.1 / (Math.tan(halfFov) * camera.aspect) + 0.6);
    camera.lookAt(0, 1.55, 0);
    camera.updateProjectionMatrix();
    renderOnce();
  }

  function renderOnce() {
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function renderFrame(time) {
    rafId = 0;
    if (!modelLoaded || document.hidden || !modelVisible || prefersReducedMotion.matches) return;
    if (lastFrameTime && time - lastFrameTime < 33) {
      rafId = window.requestAnimationFrame(renderFrame);
      return;
    }
    const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0;
    lastFrameTime = time;
    motionTime += delta;
    restoreProceduralBonePose();
    mixer?.update(delta);
    if (mixer && waveUpperArm && ['wave', 'present'].includes(currentAction) && !modelActions.has(currentAction)) {
      const age = motionTime - gestureStarted;
      const duration = currentAction === 'wave' ? 6 : 3;
      if (age >= 0 && age < duration) {
        const blend = Math.min(1, age / 0.5, (duration - age) / 0.8);
        const upperAngle = currentAction === 'wave' ? -2.0 : -1.15;
        addPoseRotation(waveUpperArm, upperAngle * blend, 0, 0, 1);
        if (waveForeArm) {
          const foreAngle = currentAction === 'wave' ? -0.65 + 0.35 * Math.sin(Math.max(0, age - 0.5) * 7) : -0.25;
          addPoseRotation(waveForeArm, foreAngle * blend, 0, 0, 1);
        }
      }
    }
    if (modelPivot) {
      const gestureAge = motionTime - gestureStarted;
      const gesture = gestureAge < 1.4 ? Math.sin(Math.PI * gestureAge / 1.4) : 0;
      modelPivot.rotation.y = 0.045 * Math.sin(motionTime * 0.7) + gesture * (currentAction === 'present' ? -0.12 : 0.07);
      modelPivot.rotation.z = 0.012 * Math.sin(motionTime * 1.1) + gesture * (currentAction === 'think' ? -0.035 : 0.02);
      modelPivot.position.y = 0.012 * Math.sin(motionTime * 1.4);
      modelPivot.scale.y = 1 + 0.004 * Math.sin(motionTime * 1.4);
    }
    renderOnce();
    rafId = window.requestAnimationFrame(renderFrame);
  }

  function startRenderLoop() {
    if (!rafId && modelLoaded && modelVisible && !document.hidden && !prefersReducedMotion.matches) {
      lastFrameTime = 0;
      rafId = window.requestAnimationFrame(renderFrame);
    }
  }

  window.addEventListener('resize', resizeRenderer, { passive: true });
  const stageResizeObserver = new ResizeObserver(resizeRenderer);
  stageResizeObserver.observe(stage);
  const stageVisibilityObserver = new IntersectionObserver((entries) => {
    modelVisible = entries[0].isIntersecting;
    if (modelVisible) startRenderLoop();
    else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; lastFrameTime = 0; }
  });
  stageVisibilityObserver.observe(stage);
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

  stage.dataset.mascotScene = activeScene;
  homeArt.classList.add('mascot-active');
  const initialPrompt = activeScene === 'home'
    ? sectionPrompts.home
    : { action: 'idle', text: scenePrompts[activeScene].text };
  setAction(initialPrompt.action, initialPrompt.text);
  updateFromScroll();
  loadModel();
}
