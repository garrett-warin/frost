import {marked} from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
export function renderMarkdown(node,text){
 node.innerHTML=DOMPurify.sanitize(marked.parse(text,{gfm:true}),{ALLOWED_TAGS:['p','br','strong','em','del','ul','ol','li','blockquote','pre','code','h1','h2','h3','h4','hr','a','table','thead','tbody','tr','th','td'],ALLOWED_ATTR:['href','class','title'],ALLOW_DATA_ATTR:false});
 for(const a of node.querySelectorAll('a')){try{const url=new URL(a.getAttribute('href'));if(!['https:','http:'].includes(url.protocol))a.removeAttribute('href');}catch{a.removeAttribute('href');}}
 for(const code of node.querySelectorAll('pre code')){if(code.textContent.length<12000)hljs.highlightElement(code);}
}
