import { timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';

export interface TeacherForm {
	group: string;
	title: string;
	description: string;
	url: string;
}

/** Published Google Forms response links; each condition has its own forms so the group is known. */
export const TEACHER_FORMS: readonly TeacherForm[] = [
	{
		group: 'Grupo A (juego)',
		title: 'Pretest',
		description: 'Antes de jugar.',
		url: 'https://docs.google.com/forms/d/e/1FAIpQLSeRF-4peYBEWtdTwAKVEsi188hiSC4jguypa2R8U7T9oBruAQ/viewform',
	},
	{
		group: 'Grupo A (juego)',
		title: 'Postest',
		description: 'Después de jugar.',
		url: 'https://docs.google.com/forms/d/e/1FAIpQLSdc650ngSTxcU2gOUiYXTaF0Sn6H5p2jc8UBemmfXyDet3MdQ/viewform',
	},
	{
		group: 'Grupo A (juego)',
		title: 'Evaluación del juego (V3)',
		description: 'Percepción y usabilidad, al final.',
		url: 'https://docs.google.com/forms/d/e/1FAIpQLSfZlSFAGHF46Sbcgh-j7v4u6y9bmlWufKUzk3-Ujg8a7MIO2w/viewform',
	},
	{
		group: 'Grupo B (explicación)',
		title: 'Pretest',
		description: 'Antes de la explicación.',
		url: 'https://docs.google.com/forms/d/e/1FAIpQLScebzFz3eJpbB2F5RhRy4YtWDSDEFAHhACtnEigHqHkyvpEFA/viewform',
	},
	{
		group: 'Grupo B (explicación)',
		title: 'Postest',
		description: 'Después de la explicación y los ejercicios.',
		url: 'https://docs.google.com/forms/d/e/1FAIpQLSc8aM7vzcviWCfEpd4Se9HNt0F2eqnnxe2McV43KlNpNtm06Q/viewform',
	},
];

function safeEqual(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	// timingSafeEqual needs equal lengths; comparing against itself keeps the timing flat on mismatch.
	if (left.length !== right.length) {
		timingSafeEqual(left, left);
		return false;
	}
	return timingSafeEqual(left, right);
}

/** Checks an HTTP Basic Authorization header against the configured teacher credentials. */
export function isAuthorized(header: string | undefined, user: string, password: string): boolean {
	const match = /^Basic ([A-Za-z0-9+/=]+)$/.exec(header ?? '');
	if (!match) return false;
	const decoded = Buffer.from(match[1], 'base64').toString('utf8');
	const separator = decoded.indexOf(':');
	if (separator < 0) return false;
	const userOk = safeEqual(decoded.slice(0, separator), user);
	const passwordOk = safeEqual(decoded.slice(separator + 1), password);
	return userOk && passwordOk;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

async function card(form: TeacherForm, index: number): Promise<string> {
	const svg = (await QRCode.toString(form.url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }))
		.replace('<svg ', `<svg class="qr" role="img" aria-label="Código QR: ${escapeHtml(form.title)}" `);
	return `<article class="card" data-qr-card="${index}" data-qr-title="${escapeHtml(`${form.group} · ${form.title}`)}">
		<h3>${escapeHtml(form.title)}</h3>
		<p>${escapeHtml(form.description)}</p>
		${svg}
		<button type="button" class="fullscreen-btn" data-qr="${index}">Pantalla completa</button>
		<a href="${escapeHtml(form.url)}" target="_blank" rel="noopener noreferrer">Abrir formulario</a>
	</article>`;
}

/** Inline because the page is private and server-rendered; it has no access to the game bundle. */
const STAGE_SCRIPT = `
(() => {
	const cards = [...document.querySelectorAll('[data-qr-card]')];
	const stage = document.getElementById('qr-stage');
	const title = document.getElementById('qr-stage-title');
	const code = document.getElementById('qr-stage-code');
	const counter = document.getElementById('qr-stage-counter');
	const close = document.getElementById('qr-stage-close');
	let current = 0;
	let opener = null;
	let wakeLock = null;

	const show = (index) => {
		current = (index + cards.length) % cards.length;
		const card = cards[current];
		title.textContent = card.dataset.qrTitle;
		code.replaceChildren(card.querySelector('svg.qr').cloneNode(true));
		counter.textContent = (current + 1) + ' / ' + cards.length;
	};

	const keepAwake = async () => {
		try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
	};

	const open = (index, button) => {
		opener = button;
		show(index);
		stage.hidden = false;
		document.documentElement.requestFullscreen?.().catch(() => {});
		keepAwake();
		close.focus();
	};

	const hide = () => {
		stage.hidden = true;
		if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
		wakeLock?.release?.().catch(() => {});
		wakeLock = null;
		opener?.focus();
	};

	document.querySelectorAll('.fullscreen-btn').forEach((button) => {
		button.addEventListener('click', () => open(Number(button.dataset.qr), button));
	});
	document.getElementById('qr-stage-prev').addEventListener('click', () => show(current - 1));
	document.getElementById('qr-stage-next').addEventListener('click', () => show(current + 1));
	close.addEventListener('click', hide);
	document.addEventListener('keydown', (event) => {
		if (stage.hidden) return;
		if (event.key === 'Escape') hide();
		if (event.key === 'ArrowLeft') show(current - 1);
		if (event.key === 'ArrowRight') show(current + 1);
	});
	// Leaving browser full screen (Esc on a projector laptop) also closes the stage.
	document.addEventListener('fullscreenchange', () => {
		if (!document.fullscreenElement && !stage.hidden) hide();
	});
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible' && !stage.hidden) keepAwake();
	});
	let touchStartX = null;
	stage.addEventListener('touchstart', (event) => { touchStartX = event.touches[0].clientX; }, { passive: true });
	stage.addEventListener('touchend', (event) => {
		if (touchStartX === null) return;
		const delta = event.changedTouches[0].clientX - touchStartX;
		touchStartX = null;
		if (Math.abs(delta) > 50) show(current + (delta < 0 ? 1 : -1));
	});
})();
`;

export async function renderTeacherPage(): Promise<string> {
	const groups = [...new Set(TEACHER_FORMS.map((form) => form.group))];
	const sections = await Promise.all(
		groups.map(async (group) => {
			const cards = await Promise.all(
				TEACHER_FORMS.map((form, index) => ({ form, index }))
					.filter(({ form }) => form.group === group)
					.map(({ form, index }) => card(form, index)),
			);
			return `<section class="group">
				<h2>${escapeHtml(group)}</h2>
				<div class="cards">${cards.join('')}</div>
			</section>`;
		}),
	);
	return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>XY Arena — Encuestas</title>
<style>
	body { margin: 0; padding: 24px; background: #050b2e; color: #eef7ff; font-family: Arial, sans-serif; }
	h1 { margin: 0 0 4px; }
	.lead { margin: 0 0 24px; color: #a7bad8; }
	.group { margin-bottom: 32px; }
	.group h2 { margin: 0 0 12px; color: #facc15; }
	.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
	.card { padding: 16px; border: 2px solid #21458e; border-radius: 16px; background: #0b1645; text-align: center; }
	.card h3 { margin: 0 0 4px; font-size: 1.3rem; }
	.card p { margin: 0 0 12px; color: #a7bad8; }
	.qr { display: block; width: 100%; max-width: 260px; height: auto; margin: 0 auto 12px; background: #ffffff; border-radius: 8px; }
	.card a { display: inline-block; margin-top: 10px; color: #16e7ff; font-weight: 700; }
	.fullscreen-btn { display: block; width: 100%; min-height: 48px; border: 2px solid #facc15; border-radius: 12px; background: #facc15; color: #050b2e; font-size: 1.05rem; font-weight: 800; cursor: pointer; }
	.fullscreen-btn:focus-visible, .qr-stage button:focus-visible { outline: 3px solid #16e7ff; outline-offset: 2px; }
	/* Full-screen stage for projectors and phones: white background and the largest QR that fits. */
	.qr-stage { position: fixed; inset: 0; z-index: 10; display: grid; grid-template-rows: auto 1fr auto; justify-items: center; align-items: center; gap: 8px; padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom)); background: #ffffff; color: #050b2e; text-align: center; touch-action: pan-y; }
	.qr-stage[hidden] { display: none; }
	.qr-stage h2 { box-sizing: border-box; width: 100%; margin: 0; padding: 0 72px; font-size: clamp(1.6rem, 5vw, 3.4rem); line-height: 1.1; }
	.qr-stage .qr { width: min(92vw, calc(100dvh - 190px)); max-width: none; margin: 0; border-radius: 0; }
	.qr-stage-controls { display: flex; align-items: center; gap: 12px; }
	.qr-stage button { min-width: 56px; min-height: 56px; padding: 0 18px; border: 2px solid #050b2e; border-radius: 14px; background: #ffffff; color: #050b2e; font-size: 1.4rem; font-weight: 800; cursor: pointer; }
	.qr-stage-close { position: absolute; top: max(12px, env(safe-area-inset-top)); right: 12px; }
	.qr-stage-counter { min-width: 4.5em; font-size: 1.1rem; font-weight: 700; }
	@media print { body { background: #ffffff; color: #000000; } .card { background: #ffffff; border-color: #000000; break-inside: avoid; } .lead, .card p { color: #333333; } }
</style>
</head>
<body>
<h1>Encuestas XY Arena</h1>
<p class="lead">Mostrá el QR que corresponde a cada grupo. Cada estudiante escribe su código de participante al inicio de cada formulario.</p>
${sections.join('')}
<div id="qr-stage" class="qr-stage" role="dialog" aria-modal="true" aria-labelledby="qr-stage-title" hidden>
	<h2 id="qr-stage-title"></h2>
	<div id="qr-stage-code"></div>
	<div class="qr-stage-controls">
		<button type="button" id="qr-stage-prev" aria-label="QR anterior">←</button>
		<span id="qr-stage-counter" class="qr-stage-counter"></span>
		<button type="button" id="qr-stage-next" aria-label="QR siguiente">→</button>
	</div>
	<button type="button" id="qr-stage-close" class="qr-stage-close" aria-label="Cerrar pantalla completa">✕</button>
</div>
<script>${STAGE_SCRIPT}</script>
</body>
</html>`;
}
