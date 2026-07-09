import { getRequestContext } from './requestContext.js';

export interface LogFields {
  actor?: string;
  resource?: string;
  operation?: string;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  correlationId: string;
  actor: string;
  resource: string;
  operation: string;
  message: string;
}

type LogWriter = (line: string, level: 'info' | 'warn' | 'error' | 'debug') => void;

const defaultWriter: LogWriter = (line, level) => {
  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
};

let writeLog: LogWriter = defaultWriter;

export function setLogWriter(writer: LogWriter): void {
  writeLog = writer;
}

export function resetLogWriter(): void {
  writeLog = defaultWriter;
}

function buildLogEntry(
  level: string,
  message: string,
  fields: LogFields = {},
): StructuredLogEntry {
  const context = getRequestContext();

  return {
    timestamp: new Date().toISOString(),
    level,
    correlationId: context?.correlationId ?? 'no-correlation-id',
    actor: fields.actor ?? context?.actor ?? 'system',
    resource: fields.resource ?? context?.resource ?? 'unknown',
    operation: fields.operation ?? context?.operation ?? 'unknown',
    message,
  };
}

function emit(level: 'info' | 'warn' | 'error' | 'debug', message: string, fields?: LogFields): void {
  const entry = buildLogEntry(level, message, fields);
  writeLog(JSON.stringify(entry), level);
}

export const logger = {
  info(message: string, fields?: LogFields): void {
    emit('info', message, fields);
  },
  warn(message: string, fields?: LogFields): void {
    emit('warn', message, fields);
  },
  error(message: string, fields?: LogFields): void {
    emit('error', message, fields);
  },
  debug(message: string, fields?: LogFields): void {
    emit('debug', message, fields);
  },
};

export function parseLogLine(line: string): StructuredLogEntry {
  return JSON.parse(line) as StructuredLogEntry;
}
