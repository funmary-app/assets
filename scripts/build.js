// 各フォルダの svg/ の SVG を最適化し、そこから png/ の PNG を作る
// Figma から SVG を書き出し直したら、`npm run build` を実行してから PNG ごとコミットする
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { optimize } from 'svgo';

// social/ と parody/ は、使う先が決めた大きさちょうどで作ってあるので、等倍だけにする
const SCALES_BY_KIND = {
	icon: [1, 2],
	logo: [1, 2],
	social: [1],
	parody: [1],
};

// archives/ の過去の版も、current/ と同じ構成なので同じように扱う。SVG を最適化し直しても結果は変わらない
const versions = existsSync('archives')
	? (await readdir('archives', { withFileTypes: true }))
			.filter((d) => d.isDirectory())
			.map((d) => path.join('archives', d.name))
	: [];

for (const root of ['current', 'extras', ...versions]) {
	for (const [kind, scales] of Object.entries(SCALES_BY_KIND)) {
		const svgDir = path.join(root, kind, 'svg');
		if (!existsSync(svgDir)) continue;
		const pngDir = path.join(root, kind, 'png');
		const names = (await readdir(svgDir)).filter((f) => f.endsWith('.svg')).sort();

		// SVG から消えたファイルの PNG が残らないように、毎回作り直す
		await rm(pngDir, { recursive: true, force: true });
		await mkdir(pngDir, { recursive: true });

		for (const name of names) {
			const svgPath = path.join(svgDir, name);
			const { data: svg } = optimize(await readFile(svgPath, 'utf8'), {
				path: svgPath,
				multipass: true,
				plugins: ['preset-default'],
			});
			await writeFile(svgPath, `${svg}\n`);

			const base = path.basename(name, '.svg');
			for (const scale of scales) {
				const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale } }).render().asPng();
				const suffix = scale === 1 ? '' : `@${scale}x`;
				await writeFile(path.join(pngDir, `${base}${suffix}.png`), png);
			}
		}
		console.log(
			`${path.join(root, kind)}: ${names.length} SVG, ${names.length * scales.length} PNG`,
		);
	}
}
