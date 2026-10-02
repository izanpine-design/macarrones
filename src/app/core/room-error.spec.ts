import { isNetworkError, roomErrorMessage, toRoomError } from './room.service';

describe('room errors', () => {
  it('recognises network failures of every browser', () => {
    for (const message of ['TypeError: Load failed', 'TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.']) {
      const error = toRoomError({ message });
      expect(error.code).toBe('NETWORK');
      expect(isNetworkError(error)).toBe(true);
      expect(roomErrorMessage(error)).toContain('conexión');
    }
  });

  it('keeps the codes raised by the database', () => {
    expect(toRoomError({ message: 'WRONG_PASSWORD' }).code).toBe('WRONG_PASSWORD');
    expect(isNetworkError(toRoomError({ message: 'NOT_HOST' }))).toBe(false);
  });

  it('turns a raw network TypeError into a readable message', () => {
    expect(roomErrorMessage(new TypeError('Load failed'))).toContain('conexión');
  });
});
