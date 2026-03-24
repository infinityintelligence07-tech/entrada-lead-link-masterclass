import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { SeparationInfo } from './types/masterclass.types';

dayjs.extend(customParseFormat);

const MONTHS_PT_BR: Record<string, string> = {
  '01': 'JANEIRO',
  '02': 'FEVEREIRO',
  '03': 'MARCO',
  '04': 'ABRIL',
  '05': 'MAIO',
  '06': 'JUNHO',
  '07': 'JULHO',
  '08': 'AGOSTO',
  '09': 'SETEMBRO',
  '10': 'OUTUBRO',
  '11': 'NOVEMBRO',
  '12': 'DEZEMBRO',
};

export function formatEventInfo(cidadeSlug: string, data: string): SeparationInfo {
  const parsed = dayjs(data, ['DD/MM/YYYY', 'DD/MM/YY'], true);
  if (!parsed.isValid()) {
    throw new Error(`Data invalida para evento: ${data}`);
  }

  const dd = parsed.format('DD');
  const mm = parsed.format('MM');
  const yyyy = parsed.format('YYYY');
  const city = String(cidadeSlug ?? '').trim();
  const cityName = city.replace(/\s/g, '').toUpperCase();
  const eventName = `[${dd}.${mm}][MC][${cityName}]`;
  const monthFolder = `${Number(mm)} - ${MONTHS_PT_BR[mm] ?? 'MES_DESCONHECIDO'} - ${yyyy}`;

  return {
    cidade: city,
    nome: eventName,
    pasta: monthFolder,
  };
}

export function shouldSkipWrongLine(nome?: string, whatsapp?: string): boolean {
  return !String(nome ?? '').trim() && !String(whatsapp ?? '').trim();
}

export function shouldSendLink(value?: string): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'x' || normalized === 'ok';
}
