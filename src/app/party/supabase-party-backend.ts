import { inject, Service } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { RoomService, toRoomError } from '../core/room.service';
import { SupabaseService } from '../core/supabase.service';
import { DrinkService } from '../shared/drink/drink.service';
import { Aporte, AporteTipo, DrawEvent, DrawingChannel, PartyBackend, PartyRecord, Secreto } from './party.model';

/** The party games' backend on Supabase (tables and functions in supabase/salas.sql). */
@Service()
export class SupabasePartyBackend implements PartyBackend {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly rooms = inject(RoomService);
  private readonly drinks = inject(DrinkService);

  async load(roomId: string): Promise<PartyRecord | null> {
    await this.auth.ensureSignedIn();
    const { data, error } = await this.supabase
      .from('partidas')
      .select('estado, version')
      .eq('sala_id', roomId)
      .maybeSingle();
    if (error) throw toRoomError(error);
    return data as PartyRecord | null;
  }

  async start(roomId: string, estado: object): Promise<void> {
    await this.rpc('empezar_juego', { p_sala_id: roomId, p_estado: estado });
  }

  async save(roomId: string, estado: object, version: number): Promise<number> {
    return (await this.rpc('guardar_partida', { p_sala_id: roomId, p_estado: estado, p_version: version })) as number;
  }

  watch(roomId: string, onChange: () => void): () => void {
    const channel = this.supabase
      .channel(`partida:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas', filter: `sala_id=eq.${roomId}` }, () =>
        onChange(),
      )
      .subscribe();
    return () => void this.supabase.removeChannel(channel);
  }

  async sendAporte(roomId: string, tipo: AporteTipo, texto: string, sobreId: string | null = null): Promise<void> {
    await this.rpc('enviar_aporte', { p_sala_id: roomId, p_tipo: tipo, p_texto: texto, p_sobre_id: sobreId });
  }

  async listAportes(roomId: string, tipo: AporteTipo): Promise<Aporte[]> {
    await this.auth.ensureSignedIn();
    // Only these columns are readable: the author never leaves the database.
    const { data, error } = await this.supabase
      .from('aportes')
      .select('id, texto')
      .eq('sala_id', roomId)
      .eq('tipo', tipo)
      .order('id');
    if (error) throw toRoomError(error);
    return data as Aporte[];
  }

  async revealAporte(roomId: string, id: number): Promise<{ autor_id: string; sobre_id: string | null } | null> {
    const rows = (await this.rpc('revelar_aporte', { p_sala_id: roomId, p_id: id })) as {
      autor_id: string;
      sobre_id: string | null;
    }[];
    return rows[0] ?? null;
  }

  async aporteProgress(roomId: string, tipo: AporteTipo): Promise<Record<string, number>> {
    const rows = (await this.rpc('autores_aportes', { p_sala_id: roomId, p_tipo: tipo })) as {
      user_id: string;
      total: number;
    }[];
    return Object.fromEntries(rows.map((r) => [r.user_id, r.total]));
  }

  async saveSecret(roomId: string, userId: string, datos: Secreto): Promise<void> {
    await this.rpc('guardar_secreto', { p_sala_id: roomId, p_user_id: userId, p_datos: datos });
  }

  async clearSecrets(roomId: string): Promise<void> {
    await this.rpc('borrar_secretos', { p_sala_id: roomId });
  }

  async visibleSecrets(roomId: string): Promise<Record<string, Secreto>> {
    await this.auth.ensureSignedIn();
    const { data, error } = await this.supabase.from('secretos_jugador').select('user_id, datos').eq('sala_id', roomId);
    if (error) throw toRoomError(error);
    return Object.fromEntries((data as { user_id: string; datos: Secreto }[]).map((r) => [r.user_id, r.datos]));
  }

  async allSecrets(roomId: string): Promise<Record<string, Secreto>> {
    const rows = (await this.rpc('secretos_de_sala', { p_sala_id: roomId })) as { user_id: string; datos: Secreto }[];
    return Object.fromEntries(rows.map((r) => [r.user_id, r.datos]));
  }

  drink(call: Parameters<DrinkService['send']>[0]): Promise<void> {
    return this.drinks.send(call);
  }

  endGame(roomId: string): Promise<void> {
    return this.rooms.endGame(roomId);
  }

  drawing(roomId: string, onEvent: (event: DrawEvent) => void): DrawingChannel {
    const channel = this.supabase.channel(`dibujo:${roomId}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'dibujo' }, ({ payload }) => onEvent(payload as DrawEvent)).subscribe();
    return {
      send: (event) => void channel.send({ type: 'broadcast', event: 'dibujo', payload: event }),
      close: () => void this.supabase.removeChannel(channel),
    };
  }

  async packItems(packId: number): Promise<string[]> {
    const { data, error } = await this.supabase.from('preguntas').select('texto').eq('lote_id', packId);
    if (error) throw toRoomError(error);
    return (data as { texto: string }[]).map((r) => r.texto);
  }

  private async rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
    await this.auth.ensureSignedIn();
    const { data, error } = await this.supabase.rpc(fn, args);
    if (error) throw toRoomError(error);
    return data;
  }
}
