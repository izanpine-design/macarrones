import { CREW, CrewMember, PetId } from '../crew/crew';
import { PET_ART, PetArt, PixelPalette } from '../pixel/pixel-art';

export interface Pet {
  id: PetId;
  nombre: string;
  art: PetArt;
  owner: CrewMember;
  /** Walking speed in px/s (the dog trots faster). */
  speed: number;
  chutePalette: PixelPalette;
}

const NAMES: Record<PetId, string> = {
  pichu: 'Pichu',
  nael: 'Nael',
  simba: 'Simba',
  enana: 'Enana',
};

export const PETS: readonly Pet[] = CREW.map((owner) => ({
  id: owner.mascota,
  nombre: NAMES[owner.mascota],
  art: PET_ART[owner.mascota],
  owner,
  speed: owner.mascota === 'pichu' ? 72 : 52,
  chutePalette: { k: '#1d1626', c: owner.color, w: '#fff6e0', d: owner.colorOscuro, g: '#d8cfc2', s: '#eee6da' },
}));

export const PET_BY_ID = new Map(PETS.map((pet) => [pet.id, pet]));
