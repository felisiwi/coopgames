// Who is doing what, and when they swap.
//
// The game has two seats. The POURER carries the source along its run and
// works the cork; the CATCHER carries the vessel and, by moving it, makes
// it lean. Solo, one person does both. In a two-player session each peer
// drives one seat and the other arrives over the wire.
//
// Roles swap every stage (DESIGN.md Q21): catching is the skill-heavy seat,
// and fixing it for a whole run means one player spends the session as a
// faucet.
//
// Pure and separate from game.js so it can be tested without a render loop.
export const SEATS = ['pourer', 'catcher'];

// `role` is the hub's 'host' | 'guest'. Host starts as the catcher, so the
// person who set the session up gets the interesting seat first.
export function seatFor(role, stage) {
  const swapped = (stage - 1) % 2 === 1;
  const hostIsCatcher = !swapped;
  const isHost = role !== 'guest';
  const catcher = isHost === hostIsCatcher;
  return catcher ? 'catcher' : 'pourer';
}

export function otherSeat(seat) {
  return seat === 'catcher' ? 'pourer' : 'catcher';
}

// One tick of intent, as plain integers. This is the ONLY thing that
// crosses the wire in a two-player game — never grid state, never
// positions the simulation derived for itself. Keeping it integral is what
// lets both peers run the identical simulation from it.
export function emptyInput() {
  return { bowl: 0, spout: 0, cork: 0 };
}

// Merge the two seats' intents into the single frame the simulation eats.
// Each seat may only touch its own fields: a peer that tried to drive the
// other's controls would desync rather than cheat, but keeping the split
// explicit means the bug is obvious rather than mysterious.
export function mergeInputs(pourerInput, catcherInput) {
  return {
    bowl: catcherInput.bowl | 0,
    spout: pourerInput.spout | 0,
    cork: pourerInput.cork ? 1 : 0,
  };
}

export function sameInput(a, b) {
  return a.bowl === b.bowl && a.spout === b.spout && a.cork === b.cork;
}
