/** Light-dismiss disclosures without trapping pointer input or keyboard focus. */
export function installPanelDismissal(root:HTMLElement,signal:AbortSignal){
  const panels=()=>Array.from(root.querySelectorAll<HTMLDetailsElement>('details'));
  const close=(panel:HTMLDetailsElement,restoreFocus=false)=>{panel.open=false;if(restoreFocus)panel.querySelector('summary')?.focus({preventScroll:true});};
  for(const panel of panels()){
    // Close peers synchronously before native summary activation; avoids queued toggle races.
    panel.querySelector('summary')?.addEventListener('click',()=>{
      if(!panel.open)for(const other of panels())if(other!==panel)close(other);
    },{signal});
    panel.addEventListener('toggle',()=>{
      if(panel.open)for(const other of panels())if(other!==panel)close(other);
    },{signal});
  }
  root.addEventListener('click',event=>{
    const button=(event.target as Element).closest('[data-close-panel]');
    const panel=button?.closest('details');if(panel)close(panel,true);
  },{signal});
  document.addEventListener('pointerdown',event=>{
    for(const panel of panels())if(panel.open&&!panel.contains(event.target as Node))close(panel);
  },{capture:true,signal});
  document.addEventListener('keydown',event=>{
    // Let a nested control consume Escape first (for example its own picker).
    if(event.key!=='Escape'||event.defaultPrevented||event.isComposing)return;
    const open=panels().filter(p=>p.open);if(!open.length)return;
    event.preventDefault();for(const panel of open)close(panel);
    open[open.length-1].querySelector('summary')?.focus({preventScroll:true});
  },{signal});
}

export function installInspectorTabs(root:HTMLElement,signal:AbortSignal){
  const tabs=Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const select=(selected:HTMLButtonElement,focus=false)=>{
    for(const tab of tabs){
      const active=tab===selected;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
      const panel=root.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls')}`);if(panel)panel.hidden=!active;
    }
    const scroll=root.querySelector('.inspector-body');if(scroll)scroll.scrollTop=0;
    if(focus)selected.focus({preventScroll:true});
  };
  tabs.forEach((tab,index)=>{
    // Pointer activation must not leave focus inside the panel being hidden.
    tab.addEventListener('click',()=>select(tab,true),{signal});
    tab.addEventListener('keydown',event=>{
      const target=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;
      if(target<0)return;event.preventDefault();select(tabs[target],true);
    },{signal});
  });
}

let rangeId=0;
/** Keep visible values aligned with both pointer input and asynchronous renderer state. */
export function refreshRangeOutputs(root:HTMLElement){
  for(const input of root.querySelectorAll<HTMLInputElement>('input[type="range"]')){
    const label=input.closest('label');if(!label)continue;
    // Output is labelable too: bind explicitly before inserting it ahead of the range.
    if(!input.id)input.id=`cloudia-range-${++rangeId}`;
    label.htmlFor=input.id;
    let output=label.querySelector('output');
    if(!output){output=document.createElement('output');output.setAttribute('aria-hidden','true');label.insertBefore(output,input);}
    const value=Number(input.value);output.textContent=`${Math.round(value)}%`;
    input.setAttribute('aria-valuetext',`${Math.round(value)} per cento`);
    input.style.setProperty('--range-fill',`${value}%`);
  }
}
