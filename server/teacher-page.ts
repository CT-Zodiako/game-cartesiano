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

async function card(form: TeacherForm): Promise<string> {
	const svg = (await QRCode.toString(form.url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }))
		.replace('<svg ', `<svg class="qr" role="img" aria-label="Código QR: ${escapeHtml(form.title)}" `);
	return `<article class="card">
		<h3>${escapeHtml(form.title)}</h3>
		<p>${escapeHtml(form.description)}</p>
		${svg}
		<a href="${escapeHtml(form.url)}" target="_blank" rel="noopener noreferrer">Abrir formulario</a>
	</article>`;
}

export async function renderTeacherPage(): Promise<string> {
	const groups = [...new Set(TEACHER_FORMS.map((form) => form.group))];
	const sections = await Promise.all(
		groups.map(async (group) => {
			const cards = await Promise.all(TEACHER_FORMS.filter((form) => form.group === group).map(card));
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
	.card a { color: #16e7ff; font-weight: 700; }
	@media print { body { background: #ffffff; color: #000000; } .card { background: #ffffff; border-color: #000000; break-inside: avoid; } .lead, .card p { color: #333333; } }
</style>
</head>
<body>
<h1>Encuestas XY Arena</h1>
<p class="lead">Mostrá el QR que corresponde a cada grupo. Cada estudiante escribe su código de participante al inicio de cada formulario.</p>
${sections.join('')}
</body>
</html>`;
}
