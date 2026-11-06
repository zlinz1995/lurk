import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('out',{recursive:true});
for(const name of ['index.html','style.css','app.js','assistant.js','commerce.js','PHOTO-CREDITS.md']) copyFileSync('woodshop/'+name,'out/'+name);
