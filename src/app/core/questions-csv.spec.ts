import { parseQuestionsCsv } from './questions-csv';

describe('parseQuestionsCsv', () => {
  it('parses texto,tipo with quoted commas', () => {
    const csv = 'texto,tipo\n"¿Uno, dos o tres?",verdad\nHaz el pino.,reto\n';
    const result = parseQuestionsCsv(csv, true);
    expect(result.errors).toEqual([]);
    expect(result.questions).toEqual([
      { texto: '¿Uno, dos o tres?', tipo: 'verdad' },
      { texto: 'Haz el pino.', tipo: 'reto' },
    ]);
  });

  it('accepts semicolons, BOM, CRLF, header case and accents', () => {
    const csv = '﻿Texto;Tipo\r\nCanta algo;RÉTO\r\n\r\n';
    const result = parseQuestionsCsv(csv, true);
    expect(result.questions).toEqual([{ texto: 'Canta algo', tipo: 'reto' }]);
  });

  it('reports invalid rows with their line number and skips duplicates', () => {
    const csv = 'texto,tipo\nab,verdad\nPregunta válida,quizás\nOtra más,verdad\nOtra más,verdad';
    const result = parseQuestionsCsv(csv, true);
    expect(result.questions).toEqual([{ texto: 'Otra más', tipo: 'verdad' }]);
    expect(result.errors.map((e) => e.row)).toEqual([2, 3]);
    expect(result.duplicates).toBe(1);
  });

  it('requires the columns in the header', () => {
    expect(parseQuestionsCsv('pregunta\nHola qué tal', false).errors[0].row).toBe(1);
    expect(parseQuestionsCsv('texto\nHola qué tal', true).errors[0].message).toContain('tipo');
  });

  it('ignores tipo for games without types', () => {
    const result = parseQuestionsCsv('texto\nYo nunca he volado', false);
    expect(result.questions).toEqual([{ texto: 'Yo nunca he volado', tipo: null }]);
  });
});
