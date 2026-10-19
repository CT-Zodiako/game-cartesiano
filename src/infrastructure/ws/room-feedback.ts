export const ROOM_NOT_ACTIVE_MESSAGE =
	"La sala ya no está activa porque la partida fue cancelada. Podés crear o unirte a otra sala.";

export function getRoomErrorFeedback(
	code: string,
	hasHostLeftClosureNotice: boolean,
): string | null {
	if (code !== "ROOM_NOT_ACTIVE") return code;
	return hasHostLeftClosureNotice ? null : ROOM_NOT_ACTIVE_MESSAGE;
}

export function getConnectionLostFeedback(roomCode: string | null): string {
	return roomCode
		? `Se perdió la conexión con la sala ${roomCode}. Revisá tu internet y volvé a unirte con el mismo código.`
		: "Se perdió la conexión con la sala. Revisá tu internet y volvé a crear o unirte a una sala.";
}
