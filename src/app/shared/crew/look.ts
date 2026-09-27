import { isCutoutHead, Profile } from '../../core/profile.model';
import { CrewMember, CrewObject, PetId } from './crew';

/**
 * Everything needed to draw someone's rocket, head and "¡A beber!". Picture
 * fields are ready-to-use URLs.
 */
export interface Look {
  /** 'user:<user id>' for profiles, 'crew:<crew id>' for the default designs. Unique on screen. */
  key: string;
  nombre: string;
  color: string;
  colorOscuro: string;
  pelo: string;
  cabeza: string | null;
  /** The head is a cut-out (transparent background): no round frame. */
  cabezaLibre: boolean;
  delante: CrewObject | null;
  detras: CrewObject | null;
  mascota: PetId | null;
  /** Uploaded picture that replaces the drawn rocket. */
  naveImagen: string | null;
  /** Own "¡A beber!" background. */
  fondoBeber: string | null;
}

/** Look of a profile. `url` turns a picture reference into a URL. */
export function profileLook(profile: Profile, url: (ref: string) => string): Look {
  const ship = profile.nave;
  const picture = (ref: string | null) => (ref ? url(ref) : null);
  return {
    key: `user:${profile.user_id}`,
    nombre: profile.apodo,
    color: ship.color,
    colorOscuro: ship.colorOscuro,
    pelo: ship.pelo,
    cabeza: picture(ship.cabeza),
    cabezaLibre: isCutoutHead(ship.cabeza),
    delante: ship.delante,
    detras: ship.detras,
    mascota: ship.mascota,
    naveImagen: ship.nave === 'imagen' ? picture(ship.naveImagen) : null,
    fondoBeber: ship.usarFondoBeber ? picture(ship.fondoBeber) : null,
  };
}

/** The original design of a crew member (used when no profile can be loaded). */
export function crewLook(member: CrewMember): Look {
  return {
    key: `crew:${member.id}`,
    nombre: member.nombre,
    color: member.color,
    colorOscuro: member.colorOscuro,
    pelo: member.pelo,
    cabeza: member.cabeza,
    cabezaLibre: false,
    delante: member.delante,
    detras: member.detras,
    mascota: member.mascota,
    naveImagen: null,
    fondoBeber: null,
  };
}
