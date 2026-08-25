import assert from "node:assert/strict";
import test from "node:test";

class FakeGraphics {
	readonly fillColors: number[] = [];
	readonly lineColors: number[] = [];
	readonly filledPoints: { x: number; y: number }[][] = [];

	clear(): this {
		return this;
	}

	fillStyle(color: number): this {
		this.fillColors.push(color);
		return this;
	}

	fillRect(): this {
		return this;
	}

	lineStyle(_width: number, color: number): this {
		this.lineColors.push(color);
		return this;
	}

	lineBetween(): this {
		return this;
	}

	fillPoints(points: { x: number; y: number }[]): this {
		this.filledPoints.push(points);
		return this;
	}
}

class FakeText {
	constructor(readonly style: { color?: string }) {}

	destroy(): void {}
}

class FakeSprite {
	setOrigin(): this {
		return this;
	}

	setScale(): this {
		return this;
	}

	setPosition(): this {
		return this;
	}
}

class FakeZone {
	private pointerDownListener: ((pointer: { x: number; y: number }) => void) | null = null;

	setOrigin(): this {
		return this;
	}

	setInteractive(): this {
		return this;
	}

	on(_event: string, listener: (pointer: { x: number; y: number }) => void): this {
		this.pointerDownListener = listener;
		return this;
	}

	setSize(): this {
		return this;
	}

	pointerDown(x: number, y: number): void {
		this.pointerDownListener?.({ x, y });
	}
}

const graphics: FakeGraphics[] = [];
const labels: FakeText[] = [];
const zones: FakeZone[] = [];

class FakeScene {
	readonly load = { image: (_key: string, _url: string): void => {} };
	readonly add = {
		graphics: (): FakeGraphics => {
			const item = new FakeGraphics();
			graphics.push(item);
			return item;
		},
		sprite: (_x: number, _y: number, _key: string): FakeSprite => new FakeSprite(),
		zone: (_x: number, _y: number, _width: number, _height: number): FakeZone => {
			const item = new FakeZone();
			zones.push(item);
			return item;
		},
		text: (_x: number, _y: number, _text: string, style: { color?: string }): FakeText => {
			const item = new FakeText(style);
			labels.push(item);
			return item;
		},
	};
	readonly scale = {
		width: 400,
		height: 400,
		resizeListener: null as (() => void) | null,
		on: (_event: string, listener: () => void, context: unknown): void => {
			this.scale.resizeListener = () => listener.call(context);
		},
	};
}

Object.assign(globalThis, { Phaser: { Scene: FakeScene } });

const { BOARD_PALETTES, RoverScene } = await import("../../src/ui/phaser/RoverScene.ts");

function contrastRatio(foreground: number, background: number): number {
	const relativeLuminance = (color: number): number => {
		const channels = [color >> 16, (color >> 8) & 0xff, color & 0xff].map((channel) => {
			const normalized = channel / 255;
			return normalized <= 0.04045
				? normalized / 12.92
				: ((normalized + 0.055) / 1.055) ** 2.4;
		});

		return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
	};

	const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
	return (lighter + 0.05) / (darker + 0.05);
}

test("the board grid meets the minimum 3:1 contrast ratio in both themes", () => {
	for (const palette of Object.values(BOARD_PALETTES)) {
		assert.ok(contrastRatio(palette.grid, palette.background) >= 3);
	}
});

test("the board renders both palettes and redraws immediately when the theme changes", () => {
	const scene = new RoverScene();
	scene.create();

	const boardGraphics = graphics[0];
	assert.equal(boardGraphics.fillColors.at(-1), BOARD_PALETTES.dark.background);
	assert.deepEqual(boardGraphics.lineColors.slice(-2), [
		BOARD_PALETTES.dark.grid,
		BOARD_PALETTES.dark.axis,
	]);
	assert.ok(labels.some((label) => label.style.color === BOARD_PALETTES.dark.axisLabel));

	scene.setTheme("light");

	assert.equal(boardGraphics.fillColors.at(-1), BOARD_PALETTES.light.background);
	assert.deepEqual(boardGraphics.lineColors.slice(-2), [
		BOARD_PALETTES.light.grid,
		BOARD_PALETTES.light.axis,
	]);
	assert.ok(labels.some((label) => label.style.color === BOARD_PALETTES.light.axisLabel));
});

function diamondCenter(points: { x: number; y: number }[]): { x: number; y: number } {
	return {
		x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
		y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
	};
}

test("the native current-position marker stays accessible and redraws after selection, resize, and theme changes", () => {
	const scene = new RoverScene();
	scene.create();

	const marker = graphics.at(-1)!;
	assert.equal(marker.fillColors.at(-1), BOARD_PALETTES.dark.marker);
	assert.equal(marker.lineColors.at(-1), BOARD_PALETTES.dark.markerOutline);
	assert.deepEqual(diamondCenter(marker.filledPoints.at(-1)!), { x: 200, y: 200 });

	const selected: { x: number; y: number }[] = [];
	const claimed: { x: number; y: number }[] = [];
	scene.setCellSelectedCallback((cell) => selected.push(cell));
	scene.setClaimSubmitCallback((cell) => claimed.push(cell));
	zones.at(-1)!.pointerDown(268, 268);
	zones.at(-1)!.pointerDown(132, 132);

	assert.deepEqual(selected, [{ x: 2, y: -2 }, { x: -2, y: 2 }]);
	assert.deepEqual(claimed, [{ x: 2, y: -2 }]);
	assert.deepEqual(diamondCenter(marker.filledPoints.at(-1)!), { x: 132, y: 132 });

	const fakeScale = scene.scale as unknown as { width: number; height: number; resizeListener: (() => void) | null };
	fakeScale.width = 500;
	fakeScale.height = 300;
	fakeScale.resizeListener?.();
	assert.deepEqual(diamondCenter(marker.filledPoints.at(-1)!), { x: 162, y: 102 });

	scene.setTheme("light");
	assert.equal(marker.fillColors.at(-1), BOARD_PALETTES.light.marker);
	assert.equal(marker.lineColors.at(-1), BOARD_PALETTES.light.markerOutline);
	assert.deepEqual(diamondCenter(marker.filledPoints.at(-1)!), { x: 162, y: 102 });

	for (const palette of Object.values(BOARD_PALETTES)) {
		assert.ok(contrastRatio(palette.marker, palette.background) >= 3);
		assert.ok(contrastRatio(palette.markerOutline, palette.background) >= 3);
	}
});
