import { ActCtx, PartyPlayer, Reducer } from '../party.model';
import * as adivinanza from './adivinanza/adivinanza.logic';
import * as cuanto from './cuanto-me-conoces/cuanto-me-conoces.logic';
import { generarBrebaje, MAX_ALCOHOL_CL, MAX_BREBAJES } from './kryptonita/brebaje';
import * as kryptonita from './kryptonita/kryptonita.logic';
import * as masProbable from './mas-probable/mas-probable.logic';
import * as mimica from './mimica/mimica.logic';
import * as palabra from './palabra-prohibida/palabra-prohibida.logic';
import * as reglas from './reglas-carta/reglas-carta.logic';
import { mostVoted, nextInRotation } from './shared.logic';
import * as tier from './tier-list/tier-list.logic';
import * as yoNunca from './yo-nunca/yo-nunca.logic';

const PLAYERS: PartyPlayer[] = [
  { user_id: 'ana', apodo: 'Ana' },
  { user_id: 'bea', apodo: 'Bea' },
  { user_id: 'cris', apodo: 'Cris' },
];
const ctx = (me: string, players = PLAYERS, now = 1000): ActCtx => ({ me, players, now });

/** Applies rules in order; fails if one does not apply. */
function play<S>(state: S, ...steps: [Reducer<S>, string][]): S {
  return steps.reduce((s, [rule, me]) => {
    const next = rule(s, ctx(me));
    if (!next) throw new Error(`rule did not apply for ${me}`);
    return next;
  }, state);
}

describe('shared logic', () => {
  it('finds every tied player at the top', () => {
    expect(mostVoted({ a: 'x', b: 'y', c: 'x', d: 'y' }).sort()).toEqual(['x', 'y']);
    expect(mostVoted({})).toEqual([]);
  });

  it('skips players who left in a rotation', () => {
    expect(nextInRotation(['ana', 'bea', 'cris'], 0, PLAYERS.filter((p) => p.user_id !== 'bea'))).toBe(2);
    expect(nextInRotation(['ana', 'bea'], 0, [])).toBeNull();
  });
});

describe('Yo nunca nunca', () => {
  it('collects who did it and moves on once even if two tap at the same time', () => {
    const s = play(yoNunca.yoNuncaInicial(['Yo nunca nunca A.', 'Yo nunca nunca B.']), [yoNunca.toggleYoSi(0), 'ana']);
    expect(s.yoSi).toEqual({ ana: true });
    const next = yoNunca.siguienteFrase(0)(s, ctx('bea'))!;
    expect(next.indice).toBe(1);
    expect(next.yoSi).toEqual({});
    // The second tap was for the phrase already passed: ignored.
    expect(yoNunca.siguienteFrase(0)(next, ctx('cris'))).toBeNull();
  });

  it('normalises your own phrases and plays them next', () => {
    expect(yoNunca.normalizeFrase('yo nunca he ido a Roma')).toBe('Yo nunca nunca he ido a Roma.');
    const s = yoNunca.anadirFrase('he bailado salsa')(yoNunca.yoNuncaInicial(['X', 'Y']), ctx('ana'))!;
    expect(s.mazo[1]).toBe('Yo nunca nunca he bailado salsa.');
  });
});

describe('¿Quién es más probable?', () => {
  it('reveals when everybody voted and the most voted drink', () => {
    let s = masProbable.masProbableInicial(['¿Quién…?']);
    s = play(s, [masProbable.votar(0, 'bea'), 'ana'], [masProbable.votar(0, 'bea'), 'cris']);
    expect(s.fase).toBe('votando');
    s = play(s, [masProbable.votar(0, 'ana'), 'bea']);
    expect(s.fase).toBe('resultado');
    expect(masProbable.quienesBeben(s)).toEqual(['bea']);
  });

  it('does not accept votes for someone outside the room', () => {
    expect(masProbable.votar(0, 'nadie')(masProbable.masProbableInicial(['x']), ctx('ana'))).toBeNull();
  });
});

describe('Palabra prohibida', () => {
  it('hands out a different word to each player and reveals at the end', () => {
    let s = palabra.palabraProhibidaInicial(['uno', 'dos', 'tres', 'cuatro']);
    s = play(s, [palabra.empezarRonda(0), 'ana']);
    const words = palabra.palabrasDeRonda(s);
    expect(Object.keys(words).sort()).toEqual(['ana', 'bea', 'cris']);
    expect(new Set(Object.values(words)).size).toBe(3);
    expect(s.terminaEn).toBe(1000 + 10 * 60_000);
    s = play(s, [palabra.pillar('bea'), 'ana']);
    expect(palabra.pillar('ana')(s, ctx('ana'))).toBeNull(); // you cannot catch yourself
    expect(palabra.vecesPillado(s)).toEqual({ bea: 1 });
    s = play(s, [palabra.terminarRonda(1), 'cris']);
    expect(s.revelarSecretos).toBe(true);
    // Next round takes new words.
    s = play(s, [palabra.otraRonda(1), 'ana'], [palabra.empezarRonda(1), 'bea']);
    expect(Object.values(palabra.palabrasDeRonda(s))).not.toEqual(Object.values(words));
  });
});

describe('Reglas por carta', () => {
  it('draws cards once per tap and keeps at most four rules', () => {
    let s = reglas.reglasCartaInicial();
    s = play(s, [reglas.sacarCarta(0), 'ana']);
    expect(s.actual?.por).toBe('ana');
    expect(reglas.sacarCarta(0)(s, ctx('bea'))).toBeNull();
    for (let i = 0; i < 6; i++) s = play(s, [reglas.anadirRegla(`Regla ${i}`), 'bea']);
    expect(s.reglas.length).toBe(reglas.MAX_REGLAS);
    expect(s.reglas.at(-1)?.texto).toBe('Regla 5');
  });

  it('reshuffles when the deck runs out', () => {
    let s = reglas.reglasCartaInicial();
    for (let i = 0; i < s.mazo.length + 3; i++) s = play(s, [reglas.sacarCarta(i), 'ana']);
    expect(s.indice).toBe(3);
  });
});

describe('Tu kryptonita', () => {
  it('chooses in a ring and starts when every kryptonite is chosen', () => {
    let s = play(kryptonita.kryptonitaInicial(), [kryptonita.configurar({ secreta: false }), 'ana'], [kryptonita.empezarEleccion(0), 'ana']);
    expect(Object.keys(s.asignador).sort()).toEqual(['ana', 'bea', 'cris']);
    expect(new Set(Object.values(s.asignador)).size).toBe(3);
    expect(Object.entries(s.asignador).every(([a, b]) => a !== b)).toBe(true);
    for (const p of PLAYERS) s = play(s, [kryptonita.elegirKryptonita('Mirar el móvil'), p.user_id]);
    expect(s.fase).toBe('jugando');
    expect(Object.keys(s.manias).length).toBe(3);
  });

  it('gives Brebajes up to the limit, then challenges without alcohol', () => {
    let s = play(kryptonita.kryptonitaInicial(), [kryptonita.toggleBebida('ron'), 'ana'], [kryptonita.toggleBebida('cola'), 'bea'], [kryptonita.empezarEleccion(0), 'ana']);
    for (const p of PLAYERS) s = play(s, [kryptonita.elegirKryptonita('Decir «vale»'), p.user_id]);
    for (let i = 0; i < MAX_BREBAJES + 1; i++) s = play(s, [kryptonita.pillar('cris', true, 'Cris'), 'ana']);
    expect(s.brebajes['cris']).toBe(MAX_BREBAJES);
    expect(s.pillados[0].castigo).toContain('cl de Ron');
    expect(s.pillados.at(-1)?.castigo).toContain('Reto sin alcohol');
  });

  it('keeps every Brebaje under the alcohol limit', () => {
    for (let i = 0; i < 200; i++) {
      const b = generarBrebaje(['ron', 'vodka', 'tequila', 'cola', 'tonica'], 'Ana');
      expect(b!.alcoholCl).toBeLessThanOrEqual(MAX_ALCOHOL_CL);
      expect(b!.nombre).toContain('de Ana');
    }
    expect(generarBrebaje(['cola', 'zumo'], 'Ana')).toBeNull();
  });
});

describe('¿Cuánto me conoces?', () => {
  it('reveals when everyone answered and scores the right guesses', () => {
    let s = cuanto.cuantoMeConocesInicial(['¿Mi comida favorita?', '¿Mi color?'], ['ana', 'bea', 'cris']);
    const prota = cuanto.protagonista(s);
    for (const p of PLAYERS) s = play(s, [cuanto.responder(0, 'Pizza'), p.user_id]);
    expect(s.fase).toBe('revelado');
    const acierta = PLAYERS.find((p) => p.user_id !== prota)!.user_id;
    expect(cuanto.toggleAcierto(0, prota)(s, ctx('ana'))).toBeNull(); // not the protagonist
    s = play(s, [cuanto.toggleAcierto(0, acierta), prota], [cuanto.siguiente(0), prota]);
    expect(s.puntos[acierta]).toBe(1);
    expect(s.fase).toBe('respondiendo');
    expect(cuanto.protagonista(s)).not.toBe(prota);
  });

  it('ends after every player was the protagonist', () => {
    let s = cuanto.cuantoMeConocesInicial(['q'], ['ana', 'bea']);
    const two = PLAYERS.slice(0, 2);
    for (let turno = 0; turno < 2; turno++) {
      for (const p of two) s = cuanto.responder(turno, 'x')(s, ctx(p.user_id, two))!;
      s = cuanto.siguiente(turno)(s, ctx('ana', two))!;
    }
    expect(s.fase).toBe('final');
  });
});

describe('Secretos anónimos / ¿Quién dijo qué?', () => {
  it('scores who guessed the author, and the author when nobody did', () => {
    let s = play(adivinanza.adivinanzaInicial(), [adivinanza.empezarAdivinar([7]), 'ana']);
    s = play(s, [adivinanza.votar(0, 'bea'), 'ana'], [adivinanza.votar(0, 'ana'), 'cris']);
    s = adivinanza.revelar(0, 'secretos', 'bea', 'bea')(s, ctx('cris'))!;
    expect(s.puntos).toEqual({ ana: 1 });
    expect(adivinanza.siguiente(0)(s, ctx('ana'))!.fase).toBe('final');

    let t = play(adivinanza.adivinanzaInicial(), [adivinanza.empezarAdivinar([1]), 'ana'], [adivinanza.votar(0, 'ana'), 'bea']);
    t = adivinanza.revelar(0, 'secretos', 'cris', 'cris')(t, ctx('ana'))!;
    expect(t.puntos).toEqual({ cris: 1 });
  });

  it('does not score the writer of a phrase', () => {
    let s = play(adivinanza.adivinanzaInicial(), [adivinanza.empezarAdivinar([1]), 'ana']);
    s = play(s, [adivinanza.votar(0, 'cris'), 'ana'], [adivinanza.votar(0, 'cris'), 'bea']);
    s = adivinanza.revelar(0, 'frases', 'ana', 'cris')(s, ctx('ana'))!;
    expect(s.puntos).toEqual({ bea: 1 });
  });
});

describe('Mímica o Pictionary', () => {
  it('only the actor starts; a guess scores guesser and actor', () => {
    let s = mimica.mimicaInicial(['Titanic', 'Shrek'], ['ana', 'bea', 'cris'], 1);
    const actor = mimica.actor(s);
    const otro = PLAYERS.find((p) => p.user_id !== actor)!.user_id;
    expect(mimica.empezar(0, 'dibujo')(s, ctx(otro))).toBeNull();
    s = play(s, [mimica.empezar(0, 'dibujo'), actor]);
    expect(s.terminaEn).toBe(1000 + 60_000);
    s = play(s, [mimica.acertado(0, otro), otro]);
    expect(s.puntos).toEqual({ [otro]: 1, [actor]: 1 });
    s = play(s, [mimica.siguienteTurno(0), actor]);
    expect(mimica.actor(s)).not.toBe(actor);
  });
});

describe('Tier list de amigos', () => {
  it('needs everyone in each list and averages the positions', () => {
    let s = tier.tierListInicial(['El más tacaño']);
    expect(tier.enviarOrden(0, ['ana', 'bea'])(s, ctx('ana'))).toBeNull();
    s = play(
      s,
      [tier.enviarOrden(0, ['bea', 'ana', 'cris']), 'ana'],
      [tier.enviarOrden(0, ['bea', 'cris', 'ana']), 'bea'],
      [tier.enviarOrden(0, ['ana', 'bea', 'cris']), 'cris'],
    );
    expect(s.fase).toBe('resultado');
    expect(tier.ordenDelGrupo(s, PLAYERS).map((r) => r.userId)).toEqual(['bea', 'ana', 'cris']);
  });
});
