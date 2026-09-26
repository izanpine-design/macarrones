import { QuestionType } from './question.model';
import { NewQuestion, QUESTION_MAX_LENGTH, QUESTION_MIN_LENGTH } from './room.model';

export interface CsvRowError {
  /** 1-based line number in the file, header included. */
  row: number;
  message: string;
}

export interface ParsedQuestionsCsv {
  questions: NewQuestion[];
  errors: CsvRowError[];
  /** Rows repeated inside the same file (only the first one is kept). */
  duplicates: number;
}

const TYPES: Record<string, QuestionType> = { verdad: 'verdad', reto: 'reto' };

/**
 * Parses a questions CSV with a header row and the columns `texto` and (when
 * `requireType`) `tipo` = verdad | reto. Accepts `,` or `;` as separator (Excel
 * in Spanish uses `;`), quoted fields and a UTF-8 BOM.
 */
export function parseQuestionsCsv(content: string, requireType: boolean): ParsedQuestionsCsv {
  const text = content.replace(/^﻿/, '');
  const rows = splitRows(text, detectDelimiter(text));
  const result: ParsedQuestionsCsv = { questions: [], errors: [], duplicates: 0 };

  const header = rows[0]?.cells.map((cell) => normalize(cell)) ?? [];
  const textColumn = header.indexOf('texto');
  const typeColumn = header.indexOf('tipo');

  if (textColumn === -1) {
    result.errors.push({ row: 1, message: 'Falta la columna "texto" en la primera fila.' });
    return result;
  }
  if (requireType && typeColumn === -1) {
    result.errors.push({ row: 1, message: 'Falta la columna "tipo" en la primera fila.' });
    return result;
  }

  const seen = new Set<string>();
  for (const { line, cells } of rows.slice(1)) {
    if (cells.every((cell) => cell.trim() === '')) continue;

    const texto = (cells[textColumn] ?? '').trim();
    if (texto.length < QUESTION_MIN_LENGTH || texto.length > QUESTION_MAX_LENGTH) {
      result.errors.push({
        row: line,
        message: `El texto debe tener entre ${QUESTION_MIN_LENGTH} y ${QUESTION_MAX_LENGTH} caracteres.`,
      });
      continue;
    }

    let tipo: QuestionType | null = null;
    if (requireType) {
      tipo = TYPES[normalize(cells[typeColumn] ?? '')] ?? null;
      if (!tipo) {
        result.errors.push({ row: line, message: 'El tipo tiene que ser "verdad" o "reto".' });
        continue;
      }
    }

    const key = `${tipo}|${texto.toLowerCase()}`;
    if (seen.has(key)) {
      result.duplicates++;
      continue;
    }
    seen.add(key);
    result.questions.push({ texto, tipo });
  }

  return result;
}

/** Lowercase, trimmed and without accents ("Tipo " → "tipo", "RÉTO" → "reto"). */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** `;` if the header has more semicolons than commas, `,` otherwise. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const count = (char: string) => firstLine.split(char).length - 1;
  return count(';') > count(',') ? ';' : ',';
}

/** RFC 4180 style: quoted fields may contain the delimiter, newlines and "" escapes. */
function splitRows(text: string, delimiter: string): { line: number; cells: string[] }[] {
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        if (char === '\n') line++;
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      cells.push(cell);
      rows.push({ line: rowStartLine, cells });
      cells = [];
      cell = '';
      line++;
      rowStartLine = line;
    } else {
      cell += char;
    }
  }

  if (cell !== '' || cells.length > 0) {
    cells.push(cell);
    rows.push({ line: rowStartLine, cells });
  }
  return rows;
}
