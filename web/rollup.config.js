import svelte from "rollup-plugin-svelte";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import sveltePreprocess from "svelte-preprocess";
import typescript from "@rollup/plugin-typescript";

export default {
	input: "./src/index.ts",
	output: {
		format: "iife",
		file: "../static/app.js",
	},
	plugins: [
		svelte({
			preprocess: sveltePreprocess(),
			emitCss: false,
		}),
		resolve({ browser: true }),
		commonjs(),
		typescript(),
	],
};
