/**
 * @fileoverview Расчёт стоимости печати и парсинг диапазонов страниц.
 * Чистые функции без побочных эффектов — легко тестируются.
 */

/**
 * @typedef {import('./api-client.js').PricesResponse} PricesResponse
 */

/**
 * @typedef {Object} ParseResult
 * @property {number[]|null} pages  - Массив номеров страниц или null при ошибке
 * @property {string|null}   error  - Текст ошибки или null при успехе
 */

/**
 * Парсит строку диапазона страниц в массив номеров.
 *
 * Поддерживаемые форматы:
 * - "" или "all" — все страницы от 1 до totalPages
 * - "3"          — одна страница
 * - "1-5"        — диапазон
 * - "1,3,5-8"    — комбинация одиночных страниц и диапазонов
 *
 * @param {string} rangeStr   - Строка диапазона от пользователя
 * @param {number} totalPages - Общее количество страниц в документе
 * @returns {ParseResult}
 */
export function parsePageRange(rangeStr, totalPages) {
  const trimmed = rangeStr.trim();

  if (trimmed === "" || trimmed.toLowerCase() === "all") {
    return { pages: range(1, totalPages), error: null };
  }

  /** @type {Set<number>} */
  const result = new Set();
  const parts = trimmed.split(",");

  for (const part of parts) {
    const segment = part.trim();
    if (!segment) continue;

    const rangeMatch = segment.match(/^(\d+)-(\d+)$/);
    const singleMatch = segment.match(/^(\d+)$/);

    if (rangeMatch) {
      const from = parseInt(rangeMatch[1], 10);
      const to   = parseInt(rangeMatch[2], 10);

      if (from > to) {
        return { pages: null, error: `Неверный диапазон: ${segment} (начало больше конца)` };
      }
      if (from < 1 || to > totalPages) {
        return { pages: null, error: `Страницы ${segment} выходят за пределы документа (1–${totalPages})` };
      }

      for (let p = from; p <= to; p++) result.add(p);

    } else if (singleMatch) {
      const page = parseInt(singleMatch[1], 10);

      if (page < 1 || page > totalPages) {
        return { pages: null, error: `Страница ${page} выходит за пределы документа (1–${totalPages})` };
      }

      result.add(page);

    } else {
      return { pages: null, error: `Неверный формат: "${segment}". Используйте: 1-5, 3, 1,3,5-8` };
    }
  }

  if (result.size === 0) {
    return { pages: null, error: "Укажите хотя бы одну страницу" };
  }

  return { pages: [...result].sort((a, b) => a - b), error: null };
}

/**
 * Рассчитывает стоимость печати.
 *
 * Формула: количество_страниц × копии × цена_за_страницу
 *
 * @param {number}        pageCount - Количество страниц к печати
 * @param {number}        copies    - Количество копий
 * @param {"bw"|"color"}  colorMode - Режим печати
 * @param {PricesResponse} prices   - Тарифы с сервера
 * @returns {number} Итоговая стоимость
 */
export function calcCost(pageCount, copies, colorMode, prices) {
  const pricePerPage = colorMode === "color" ? prices.color : prices.bw;
  return pageCount * copies * pricePerPage;
}

/**
 * Форматирует стоимость для отображения.
 *
 * @param {number} cost       - Сумма
 * @param {string} currency   - Код валюты, например "RUB"
 * @returns {string}          - Например: "40 ₽" или "40 RUB"
 */
export function formatCost(cost, currency) {
  const symbols = { RUB: "₽", USD: "$", EUR: "€" };
  const symbol = symbols[currency] ?? currency;
  return `${cost} ${symbol}`;
}

// ---------------------------------------------------------------------------

/**
 * Вспомогательная функция: массив целых чисел от from до to включительно.
 *
 * @param {number} from
 * @param {number} to
 * @returns {number[]}
 */
function range(from, to) {
  const arr = [];
  for (let i = from; i <= to; i++) arr.push(i);
  return arr;
}
