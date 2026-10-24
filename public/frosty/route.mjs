// Keep the browser workspace mounted while Frosty's own page is visible.
export function createFrostyRoute({window:win=window,render}) {
  const sync=()=>render(win.location.hash==='#frosty');
  win.addEventListener('hashchange',sync);
  win.addEventListener('popstate',sync);
  return {
    sync,
    open(){if(win.location.hash!=='#frosty')win.history.pushState(null,'','#frosty');sync();},
    close(){if(win.location.hash==='#frosty')win.history.replaceState(null,'',win.location.pathname+win.location.search);sync();},
  };
}
