import { CREW, CrewId, CrewMember, PetId } from '../crew/crew';
import { PET_ART, PetArt, PixelPalette } from '../pixel/pixel-art';

export interface Pet {
  id: PetId;
  nombre: string;
  art: PetArt;
  owner: CrewMember;
  /** Walking speed in px/s (the dog trots faster, the chubby cat waddles). */
  speed: number;
  /** How it gets down from a rocket: parachute, or blown up and bouncing. */
  landing: 'chute' | 'balloon';
  chutePalette: PixelPalette;
}

interface PetInfo {
  nombre: string;
  owner: CrewId;
  speed: number;
  landing: Pet['landing'];
}

/** Every pet anyone can pick; all of them roam the bottom of the screen. */
const INFO: Record<PetId, PetInfo> = {
  pichu: { nombre: 'Pichu', owner: 'noe', speed: 72, landing: 'chute' },
  nael: { nombre: 'Nael', owner: 'raul', speed: 52, landing: 'chute' },
  simba: { nombre: 'Simba', owner: 'izan', speed: 52, landing: 'chute' },
  enana: { nombre: 'Enana', owner: 'miguel', speed: 52, landing: 'chute' },
  gordo: { nombre: 'Enano Gordo', owner: 'miguel', speed: 40, landing: 'balloon' },
};

export const PETS: readonly Pet[] = (Object.keys(INFO) as PetId[]).map((id) => {
  const { owner: ownerId, ...info } = INFO[id];
  const owner = CREW.find((m) => m.id === ownerId)!;
  return {
    id,
    ...info,
    art: PET_ART[id],
    owner,
    chutePalette: { k: '#1d1626', c: owner.color, w: '#fff6e0', d: owner.colorOscuro, g: '#d8cfc2', s: '#eee6da' },
  };
});

export const PET_IDS: readonly PetId[] = PETS.map((pet) => pet.id);

export const PET_BY_ID = new Map(PETS.map((pet) => [pet.id, pet]));
