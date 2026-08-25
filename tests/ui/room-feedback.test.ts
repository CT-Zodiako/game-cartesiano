import assert from "node:assert/strict";
import test from "node:test";

import {
	ROOM_NOT_ACTIVE_MESSAGE,
	getRoomErrorFeedback,
} from "../../src/infrastructure/ws/room-feedback.ts";

test("explains an inactive cancelled room in Spanish", () => {
	assert.equal(
		getRoomErrorFeedback("ROOM_NOT_ACTIVE", false),
		ROOM_NOT_ACTIVE_MESSAGE,
	);
	assert.match(ROOM_NOT_ACTIVE_MESSAGE, /sala|partida/i);
	assert.doesNotMatch(ROOM_NOT_ACTIVE_MESSAGE, /ROOM_NOT_ACTIVE/);
});

test("keeps the host-left closure notice when an inactive-room error arrives after it", () => {
	assert.equal(getRoomErrorFeedback("ROOM_NOT_ACTIVE", true), null);
});

test("preserves other protocol error codes", () => {
	assert.equal(getRoomErrorFeedback("NOT_HOST", false), "NOT_HOST");
});
