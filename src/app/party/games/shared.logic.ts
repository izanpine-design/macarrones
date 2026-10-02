import { PartyPlayer } from '../party.model';

/** New array in random order (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function ids(players: readonly PartyPlayer[]): string[] {
  return players.map((p) => p.user_id);
}

/** True when every player in the room has an entry in `byPlayer`. */
export function everyoneDid(byPlayer: Record<string, unknown>, players: readonly PartyPlayer[]): boolean {
  return players.length > 0 && players.every((p) => byPlayer[p.user_id] !== undefined);
}

/** Votes per player (`votes` maps voter → voted), highest first. */
export function tally(votes: Record<string, string>): { userId: string; votos: number }[] {
  const counts = new Map<string, number>();
  for (const target of Object.values(votes)) counts.set(target, (counts.get(target) ?? 0) + 1);
  return [...counts.entries()].map(([userId, votos]) => ({ userId, votos })).sort((a, b) => b.votos - a.votos);
}

/** The most voted players (all of them if tied), or [] without votes. */
export function mostVoted(votes: Record<string, string>): string[] {
  const results = tally(votes);
  const top = results[0]?.votos ?? 0;
  return results.filter((r) => r.votos === top && top > 0).map((r) => r.userId);
}

/** Adds points: returns a new map. */
export function addPoints(puntos: Record<string, number>, userIds: readonly string[], amount = 1): Record<string, number> {
  const result = { ...puntos };
  for (const id of userIds) result[id] = (result[id] ?? 0) + amount;
  return result;
}

/** Players sorted by points (ties keep the room order). */
export function ranking(
  puntos: Record<string, number>,
  players: readonly PartyPlayer[],
): { userId: string; apodo: string; puntos: number }[] {
  return players
    .map((p) => ({ userId: p.user_id, apodo: p.apodo, puntos: puntos[p.user_id] ?? 0 }))
    .sort((a, b) => b.puntos - a.puntos);
}

/**
 * The next player of a rotation fixed at the start (`orden`), skipping those
 * who left the room. Null if nobody of the rotation is left.
 */
export function nextInRotation(orden: readonly string[], from: number, players: readonly PartyPlayer[]): number | null {
  const present = new Set(ids(players));
  for (let step = 1; step <= orden.length; step++) {
    const index = from + step;
    if (present.has(orden[index % orden.length])) return index;
  }
  return null;
}

/** Item of a deck by position, going round when it is exhausted. */
export function deckItem<T>(deck: readonly T[], index: number): T | null {
  return deck.length === 0 ? null : deck[index % deck.length];
}

export function clampText(text: string, max = 300): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, max);
}
