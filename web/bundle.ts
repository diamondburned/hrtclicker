#!/usr/bin/env -S deno run -A
/// <reference lib="deno.ns" />

import * as esbuild from "https://deno.land/x/esbuild@v0.19.11/mod.js";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader@0.8.5/mod.ts";

const entryPoints = Deno.args.slice(0, -1);
const outfile = Deno.args[Deno.args.length - 1];
if (!entryPoints || !outfile) {
  console.error("Usage: bundle.ts <entrypoints...> <outfile>");
  Deno.exit(1);
}

await esbuild.build({
  plugins: [...denoPlugins()],
  entryPoints: entryPoints,
  outfile,
  format: "esm",
  bundle: true,
  minify: true,
  sourcemap: true,
});

esbuild.stop();
