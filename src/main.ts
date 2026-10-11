import './styles.css';

const root=document.querySelector<HTMLElement>('#cloudia-lab');
if(!root) throw new Error('Cloudia root element is missing');
if(new URLSearchParams(location.search).has('legacy')) {
  const {LabApp}=await import('./lab/LabApp');
  const app=new LabApp(root.querySelector<HTMLElement>("[data-testid='cloudia-stage']")!);
  app.start();
  const status=root.querySelector('#cloudia-status');
  if(status) status.textContent='Laboratorio originale · WebGL';
  window.addEventListener('beforeunload',()=>app.destroy());
} else {
  root.className='cloud-scene';
  const {CumulonimbusApp}=await import('./cumulonimbus/CumulonimbusApp');
  const app=new CumulonimbusApp(root);
  void app.start();
  window.addEventListener('beforeunload',()=>app.destroy());
}
