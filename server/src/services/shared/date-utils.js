/**
 * Utilitários para manipulação de datas
 */

/**
 * Adiciona dias a uma data
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Adiciona meses a uma data
 */
function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Obtém o primeiro dia do mês
 */
function getFirstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Obtém o último dia do mês
 */
function getLastDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Obtém o primeiro dia do ano
 */
function getFirstDayOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

/**
 * Obtém o último dia do ano
 */
function getLastDayOfYear(date) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

/**
 * Obtém o início do dia (00:00:00)
 */
function getStartOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Obtém o fim do dia (23:59:59)
 */
function getEndOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Obtém o primeiro dia da semana (domingo ou segunda)
 */
function getFirstDayOfWeek(date, startOnMonday = false) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = startOnMonday ? (day === 0 ? -6 : 1 - day) : -day;
  result.setDate(result.getDate() + diff);
  return getStartOfDay(result);
}

/**
 * Converte string de data para objeto Date
 */
function parseDate(dateString) {
  if (dateString instanceof Date) {
    return dateString;
  }
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    throw new Error(`Data inválida: ${dateString}`);
  }
  
  return date;
}

/**
 * Formata data para ISO string (YYYY-MM-DD)
 */
function formatDateISO(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Formata data para datetime ISO string
 */
function formatDateTimeISO(date) {
  return date.toISOString();
}

/**
 * Verifica se uma data é válida
 */
function isValidDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Calcula diferença em dias entre duas datas
 */
function getDaysDifference(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1 - date2) / oneDay));
}

/**
 * Aplica timezone offset
 */
function applyTimezone(date, timezone) {
  if (!timezone) return date;
  
  try {
    return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  } catch (error) {
    console.warn(`Timezone inválido: ${timezone}, usando UTC`);
    return date;
  }
}

module.exports = {
  addDays,
  addMonths,
  getFirstDayOfMonth,
  getLastDayOfMonth,
  getFirstDayOfYear,
  getLastDayOfYear,
  getStartOfDay,
  getEndOfDay,
  getFirstDayOfWeek,
  parseDate,
  formatDateISO,
  formatDateTimeISO,
  isValidDate,
  getDaysDifference,
  applyTimezone
};
