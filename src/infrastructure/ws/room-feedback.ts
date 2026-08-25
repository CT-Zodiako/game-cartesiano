export const ROOM_NOT_ACTIVE_MESSAGE =
	"La sala ya no está activa porque la partida fue cancelada. Podés crear o unirte a otra sala.";

export function getRoomErrorFeedback(
	code: string,
	hasHostLeftClosureNotice: boolean,
): string | null {
	if (code !== "ROOM_NOT_ACTIVE") return code;
	return hasHostLeftClosureNotice ? null : ROOM_NOT_ACTIVE_MESSAGE;
}
