import { build } from 'vite';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
await build({root,configFile:false,base:'./',publicDir:false,resolve:{alias:{'@':root}},
  build:{outDir:'node_modules/.cache/spatial-actions-build',emptyOutDir:true,copyPublicDir:false,
    rollupOptions:{input:path.join(root,'labs/composable/dungeon-spatial-actions-lab/index.html')}}});
