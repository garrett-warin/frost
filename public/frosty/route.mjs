                                                                           
export function createFrostyRoute({window:win=window,render}) {
  const sync=()=>render(['#ai','#frosty'].includes(win.location.hash));
  win.addEventListener('hashchange',sync);
  win.addEventListener('popstate',sync);
  return {
    sync,
    open(){if(win.location.hash!=='#ai')win.history.pushState(null,'','#ai');sync();},
    close(){if(['#ai','#frosty'].includes(win.location.hash))win.history.replaceState(null,'',win.location.pathname+win.location.search);sync();},
  };
}
