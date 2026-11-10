const grid = document.querySelector('#project-grid');
const frame = document.createElement('iframe');
frame.className = 'reference-orbit-frame';
frame.title = '博客与 TripBeam 项目图像漫游';
frame.src = '/orbit-engine/index.html#image-orbit';
grid.replaceWith(frame);
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
