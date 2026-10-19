import assert from 'node:assert/strict';
import test from 'node:test';

import {
	isAuthorized,
	renderTeacherPage,
	TEACHER_FORMS,
} from '../../server/teacher-page.ts';

const basic = (user: string, password: string): string =>
	`Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

test('lists the five published response links grouped by condition', () => {
	assert.deepEqual(
		TEACHER_FORMS.map((form) => [form.group, form.title, form.url]),
		[
			['Grupo A (juego)', 'Pretest', 'https://docs.google.com/forms/d/e/1FAIpQLSeRF-4peYBEWtdTwAKVEsi188hiSC4jguypa2R8U7T9oBruAQ/viewform'],
			['Grupo A (juego)', 'Postest', 'https://docs.google.com/forms/d/e/1FAIpQLSdc650ngSTxcU2gOUiYXTaF0Sn6H5p2jc8UBemmfXyDet3MdQ/viewform'],
			['Grupo A (juego)', 'Evaluación del juego (V3)', 'https://docs.google.com/forms/d/e/1FAIpQLSfZlSFAGHF46Sbcgh-j7v4u6y9bmlWufKUzk3-Ujg8a7MIO2w/viewform'],
			['Grupo B (explicación)', 'Pretest', 'https://docs.google.com/forms/d/e/1FAIpQLScebzFz3eJpbB2F5RhRy4YtWDSDEFAHhACtnEigHqHkyvpEFA/viewform'],
			['Grupo B (explicación)', 'Postest', 'https://docs.google.com/forms/d/e/1FAIpQLSc8aM7vzcviWCfEpd4Se9HNt0F2eqnnxe2McV43KlNpNtm06Q/viewform'],
		],
	);
});

test('accepts only the exact Basic credentials', () => {
	assert.equal(isAuthorized(basic('docente', 's3cret'), 'docente', 's3cret'), true);
	assert.equal(isAuthorized(basic('docente', 'wrong'), 'docente', 's3cret'), false);
	assert.equal(isAuthorized(basic('other', 's3cret'), 'docente', 's3cret'), false);
	assert.equal(isAuthorized(basic('docente', 's3cret-longer'), 'docente', 's3cret'), false);
	assert.equal(isAuthorized(undefined, 'docente', 's3cret'), false);
	assert.equal(isAuthorized('Bearer abc', 'docente', 's3cret'), false);
	assert.equal(isAuthorized('Basic !!!not-base64', 'docente', 's3cret'), false);
});

test('a password containing a colon still matches', () => {
	assert.equal(isAuthorized(basic('docente', 'a:b:c'), 'docente', 'a:b:c'), true);
	assert.equal(isAuthorized(basic('docente', 'a'), 'docente', 'a:b:c'), false);
});

test('renders one QR code, title, and link per form, grouped by condition', async () => {
	const html = await renderTeacherPage();
	assert.match(html, /^<!doctype html>/i);
	assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
	assert.equal(html.match(/<svg[^>]*class="qr"/g)?.length, TEACHER_FORMS.length);
	assert.equal(html.match(/<section class="group">/g)?.length, 2);
	for (const form of TEACHER_FORMS) assert.ok(html.includes(`href="${form.url}"`), form.url);
	assert.ok(html.indexOf('Grupo A (juego)') < html.indexOf('Grupo B (explicación)'));
});

test('every card offers a full-screen view for projectors and phones', async () => {
	const html = await renderTeacherPage();
	const buttons = [...html.matchAll(/<button type="button" class="fullscreen-btn" data-qr="(\d+)">Pantalla completa<\/button>/g)];
	assert.deepEqual(buttons.map((match) => Number(match[1])), [0, 1, 2, 3, 4]);
	assert.match(html, /<div id="qr-stage" class="qr-stage" role="dialog" aria-modal="true" aria-labelledby="qr-stage-title" hidden>/);
	for (const id of ['qr-stage-title', 'qr-stage-code', 'qr-stage-prev', 'qr-stage-next', 'qr-stage-close', 'qr-stage-counter']) {
		assert.ok(html.includes(`id="${id}"`), id);
	}
	// The stage reads its titles from the cards so it shows the same five forms in the same order.
	for (const [index, form] of TEACHER_FORMS.entries()) {
		assert.ok(html.includes(`data-qr-title="${form.group} · ${form.title}"`), String(index));
	}
	assert.match(html, /requestFullscreen/);
	assert.match(html, /wakeLock/);
	assert.match(html, /\.qr-stage\s*\{[^}]*position: fixed;[^}]*background: #ffffff;/);
	assert.match(html, /\.qr-stage \.qr\s*\{[^}]*width: min\(92vw, calc\(100dvh - 190px\)\);/);
	// The title keeps clear of the close button on narrow phones.
	assert.match(html, /\.qr-stage h2 \{[^}]*padding: 0 72px;/);
});
