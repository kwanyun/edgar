import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),context);
const data=context.window.EDGAR_DATA;
const views=[...data.groups.flatMap(g=>g.views),...data.cross];
const failures=[];
const checked=new Set();
for(const view of views){
  for(const key of ['before','after','posterBefore','posterAfter','thumbnail','reference','driver','targetReference']){
    if(!view[key])continue;
    const asset=path.resolve(root,view[key]);
    if(!asset.startsWith(root+path.sep)||!fs.existsSync(asset))failures.push(`${view.id}: missing ${key}`);
    checked.add(view[key]);
  }
  if(view.before===view.after)failures.push(`${view.id}: identical source path`);
  if(!view.frames||!view.fps)failures.push(`${view.id}: missing timing`);
}
for(const file of ['index.html','styles.css','app.js','favicon.ico','favicon-32.png','favicon-64.png','assets/method.png','assets/architecture.png'])if(!fs.existsSync(path.join(root,file)))failures.push(`Missing ${file}`);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
for(const id of ids)if(ids.filter(x=>x===id).length>1)failures.push(`Duplicate id ${id}`);
for(const m of html.matchAll(/href="#([^"]+)"/g))if(!ids.includes(m[1]))failures.push(`Missing anchor ${m[1]}`);
for(const m of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g))if(!/^(https?:|data:)/.test(m[1])&&!fs.existsSync(path.join(root,m[1])))failures.push(`Broken reference ${m[1]}`);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({comparisonPairs:views.length,pipelines:data.groups.length,mediaReferences:checked.size,localReferences:'valid',anchors:'valid'}));
