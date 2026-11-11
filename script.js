const grid = document.querySelector('#project-grid');
const frame = document.createElement('iframe');
frame.className = 'reference-orbit-frame';
frame.title = '博客与 TripBeam 项目图像漫游';
grid.replaceWith(frame);
// Native iframe lazy loading starts well below the viewport in some browsers.
// Defer this second WebGL scene until the project area actually approaches view.
const orbitVisibility = new IntersectionObserver(entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  frame.src = 'orbit-engine/index.html#image-orbit';
  orbitVisibility.disconnect();
}, { rootMargin: '120px' });
orbitVisibility.observe(frame);
frame.addEventListener('load', () => {
  try {
    const frameDoc = frame.contentDocument;
    const destinations = {
      'project-blog': ['https://www.raincode.top/', '打开个人博客 ↗'],
      'project-tripbeam': ['https://www.raincode.top/tripBeam/', '打开 TripBeam ↗'],
    };
    let lastSelectedProject = '';
    const mountProjectLink = () => {
      const preview = frameDoc.querySelector('figure.orbit-preview[data-image-id]');
      if (!preview) return;
      let link = preview.querySelector('.portfolio-live-link');
      if (!link) {
        link = frameDoc.createElement('a');
        link.className = 'portfolio-live-link';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        Object.assign(link.style, {
          position: 'absolute', bottom: '-48px', left: '50%', transform: 'translateX(-50%)',
          zIndex: '20', padding: '11px 16px', background: '#171814', color: '#f4f1e9',
          font: '12px sans-serif', textDecoration: 'none', whiteSpace: 'nowrap',
          pointerEvents: 'auto', borderRadius: '2px',
        });
        preview.append(link);
      }
      const project = Object.entries(destinations).find(([prefix]) => preview.dataset.imageId.startsWith(prefix));
      link.hidden = !project;
      if (project) {
        if (link.href !== project[1][0]) link.href = project[1][0];
        if (link.textContent !== project[1][1]) link.textContent = project[1][1];
        if (lastSelectedProject !== project[0]) {
          lastSelectedProject = project[0];
          window.dispatchEvent(new CustomEvent('portfolio:project-selection', {
            detail: { slug: project[0] },
          }));
        }
      }
    };
    new MutationObserver(mountProjectLink).observe(frameDoc.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-image-id'],
    });
    mountProjectLink();
  } catch (error) {
    console.warn('项目在线链接无法加载，请使用下方在线项目入口。', error);
  }
});
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
}));
