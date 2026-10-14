/** Light-dismiss disclosures without trapping pointer input or keyboard focus. */
export function installPanelDismissal(root:HTMLElement,signal:AbortSignal){
  const panels=()=>Array.from(root.querySelectorAll<HTMLDetailsElement>('details'));
  for(const panel of panels())panel.addEventListener('toggle',()=>{
    if(panel.open)for(const other of panels())if(other!==panel)other.open=false;
  },{signal});
  document.addEventListener('pointerdown',event=>{
    for(const panel of panels())if(panel.open&&!panel.contains(event.target as Node))panel.open=false;
  },{capture:true,signal});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const open=panels().filter(p=>p.open);if(!open.length)return;
    event.preventDefault();for(const panel of open)panel.open=false;
    open[open.length-1].querySelector('summary')?.focus();
  },{signal});
}
