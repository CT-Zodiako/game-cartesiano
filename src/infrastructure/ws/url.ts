/**
 * Derives the WebSocket URL from the page location.
 * HTTPS pages must use wss:// — browsers block ws:// as mixed content.
 * An explicit override (e.g. window.__WS_URL__) always wins.
 */
export function deriveWsUrl(
	pageProtocol: string,
	host: string,
	override?: string,
): string {
	if (override) return override;
	const wsProtocol = pageProtocol === "https:" ? "wss" : "ws";
	return `${wsProtocol}://${host}/ws`;
}
