import { test } from "node:test";
import assert from "node:assert/strict";
import { SoundManager, type SoundContext, type SoundCue } from "../../src/infrastructure/audio/sound-manager.ts";

function fakeContext() {
	const frequencies: number[] = [];
	const starts: number[] = [];
	const stops: number[] = [];
	const envelopes: number[][] = [];
	let disconnected = 0;
	const context = {
		state: "suspended",
		currentTime: 10,
		destination: {},
		async resume() { this.state = "running"; },
		createOscillator() {
			return {
				frequency: { setValueAtTime(value: number) { frequencies.push(value); } },
				connect() {}, disconnect() {},
				start(time: number) { starts.push(time); },
				stop(time: number) { stops.push(time); },
			};
		},
		createGain() {
			return {
				gain: {
					setValueAtTime(value: number, time: number) { envelopes.push([value, time]); },
					linearRampToValueAtTime(value: number, time: number) { envelopes.push([value, time]); },
				},
				connect() {}, disconnect() { disconnected++; },
			};
		},
	};
	return { context: context as unknown as SoundContext, frequencies, starts, stops, envelopes, disconnected: () => disconnected };
}

test("creation is lazy and playback cannot unlock audio", async () => {
	const fake = fakeContext();
	let created = 0;
	const sounds = new SoundManager(() => { created++; return fake.context; });
	sounds.play("tap");
	assert.equal(created, 0);
	await sounds.unlock();
	await sounds.unlock();
	assert.equal(created, 1);
	assert.equal(fake.context.state, "running");
	sounds.play("tap");
	assert.deepEqual(fake.starts, [10]);
});

for (const [cue, expected] of Object.entries({ tap: [440], countdown: [660], roundStart: [523, 784], correct: [523, 659, 784], wrong: [220, 165], urgent: [880], timeout: [330, 220, 110], playerJoined: [659, 784], victory: [523, 659, 784, 1047] })) {
	test(`${cue} schedules finite tones with attack/release envelopes`, async () => {
		const fake = fakeContext();
		const sounds = new SoundManager(() => fake.context);
		await sounds.unlock();
		sounds.play(cue as SoundCue);
		assert.deepEqual(fake.frequencies, expected);
		expected.forEach((_, index) => {
			const start = 10 + index * 0.12;
			assert.equal(fake.starts[index], start);
			assert.equal(fake.stops[index], start + 0.1);
			assert.deepEqual(fake.envelopes.slice(index * 3, index * 3 + 3), [[0, start], [0.08, start + 0.01], [0, start + 0.1]]);
		});
	});
}

test("muting disconnects playing tones and suppresses new cues until enabled", async () => {
	const fake = fakeContext();
	const sounds = new SoundManager(() => fake.context);
	sounds.enabled = false;
	await sounds.unlock();
	assert.equal(fake.context.state, "suspended");
	sounds.enabled = true;
	await sounds.unlock();
	sounds.play("tap");
	sounds.muted = true;
	assert.equal(sounds.enabled, false);
	assert.equal(fake.disconnected(), 1);
	sounds.play("correct");
	assert.equal(fake.starts.length, 1);
	sounds.muted = false;
	sounds.play("wrong");
	assert.equal(fake.starts.length, 3);
});

test("missing, throwing and rejected audio contexts remain silent", async () => {
	for (const sounds of [
		new SoundManager(),
		new SoundManager(() => undefined),
		new SoundManager(() => { throw new Error("unsupported"); }),
		new SoundManager(() => ({ ...fakeContext().context, resume: async () => { throw new Error("denied"); } })),
	]) {
		await assert.doesNotReject(() => sounds.unlock());
		assert.doesNotThrow(() => sounds.play("correct"));
	}
});
