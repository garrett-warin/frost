                                                                                
                                                                                   
export function createBrowserRefresh(refresh) {
 let baseline, requested=false;
 return value=>{
  if(requested||!value||!['all','account'].every(k=>Number.isSafeInteger(value[k])&&value[k]>=0))return false;
  if(!baseline){baseline={...value};return false;}
  const changed=value.all>baseline.all||value.account>baseline.account;
  baseline={all:Math.max(baseline.all,value.all),account:Math.max(baseline.account,value.account)};
  if(!changed)return false;
  requested=true;
  refresh();
  return true;
 };
}
