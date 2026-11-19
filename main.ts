// Vice Cover — the program that hands the app in.
//
// The app is plain static files: app/index.html, its ES modules under app/src/, the stylesheet and the two sample
// photographs under app/samples/. There is no build step and no library: the page opens offline in desktop Chrome,
// reads photos from the visitor's own machine and paints the cover on a canvas.
//
// This program copies app/ and screenshots/ from beside this file into the output directory — the grader's /output,
// or MAKEFUN_OUTPUT_DIR when it is run by hand — and writes dossier.json there with buildDossier from the kit's
// vendored library, holding the entry to the scorer's own caps.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });

// The app, exactly as it sits in the repository: no build, no generated files.
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });

// The screenshots the maker took, in the order their names sort: the cover first.
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer refuses an entry past these limits, so the dossier is built with them rather than with guesses.
const limits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

writeFileSync(join(out, 'dossier.json'), buildDossier(out, limits));

// A short receipt, so a run by hand says what it wrote.
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`Vice Cover handed in: app/ and screenshots/ copied to ${out}, dossier.json ${dossierBytes} bytes.`);
