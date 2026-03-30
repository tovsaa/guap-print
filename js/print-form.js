/**
 * @fileoverview Управление формой параметров печати.
 * Валидирует ввод, рассчитывает стоимость в реальном времени.
 */

import { parsePageRange, calcCost, formatCost } from "./calculator.js";

/**
 * @typedef {import('./api-client.js').PricesResponse} PricesResponse
 */

/**
 * @typedef {Object} PrintParams
 * @property {string}        pages    - Строка диапазона страниц ("all", "1-5", ...)
 * @property {number}        copies   - Количество копий
 * @property {"bw"|"color"}  color    - Режим печати
 */

/**
 * Инициализирует форму параметров печати.
 *
 * @param {object}                              elements
 * @param {HTMLFormElement}                     elements.form           - Форма
 * @param {HTMLInputElement}                    elements.inputPages     - Поле диапазона страниц
 * @param {HTMLInputElement}                    elements.inputCopies    - Поле количества копий
 * @param {NodeListOf<HTMLInputElement>}        elements.radiosColor    - Радиокнопки цвета
 * @param {HTMLElement}                         elements.pagesError     - Блок ошибки страниц
 * @param {HTMLElement}                         elements.copiesError    - Блок ошибки копий
 * @param {HTMLElement}                         elements.totalPagesDisplay - Отображение кол-ва страниц
 * @param {HTMLElement}                         elements.costValue      - Значение стоимости
 * @param {HTMLElement}                         elements.costCurrency   - Валюта стоимости
 * @param {PricesResponse}                      prices                  - Тарифы с сервера
 * @param {number}                              totalPages              - Всего страниц в документе
 * @param {(params: PrintParams) => void}       onChange                - Коллбэк при изменении параметров
 */
export function initPrintForm(elements, prices, totalPages, onChange) {
  const { form, inputPages, inputCopies, radiosColor,
          pagesError, copiesError, totalPagesDisplay,
          costValue, costCurrency } = elements;

  totalPagesDisplay.textContent = totalPages;
  costCurrency.textContent = prices.currency;

  recalculate();

  form.addEventListener("input", () => {
    recalculate();
  });

  function recalculate() {
    const params = getParams();
    const valid = validate(params);
    if (valid) {
      updateCost(params);
      onChange(params);
    }
  }

  /**
   * Считывает текущие значения из формы.
   * @returns {PrintParams}
   */
  function getParams() {
    const colorRadio = [...radiosColor].find((r) => r.checked);
    return {
      pages:  inputPages.value.trim() || "all",
      copies: parseInt(inputCopies.value, 10) || 1,
      color:  /** @type {"bw"|"color"} */ (colorRadio?.value ?? "bw"),
    };
  }

  /**
   * Валидирует параметры, показывает/скрывает ошибки.
   * @param {PrintParams} params
   * @returns {boolean} true если всё валидно
   */
  function validate(params) {
    let valid = true;

    // Диапазон страниц
    const { error: pagesErr } = parsePageRange(params.pages, totalPages);
    if (pagesErr) {
      showError(pagesError, pagesErr);
      valid = false;
    } else {
      hideError(pagesError);
    }

    // Количество копий
    if (!Number.isInteger(params.copies) || params.copies < 1 || params.copies > 10) {
      showError(copiesError, "Количество копий должно быть от 1 до 10");
      valid = false;
    } else {
      hideError(copiesError);
    }

    return valid;
  }

  /**
   * Пересчитывает и отображает стоимость.
   * @param {PrintParams} params
   */
  function updateCost(params) {
    const { pages } = parsePageRange(params.pages, totalPages);
    if (!pages) {
      costValue.textContent = "—";
      return;
    }
    const cost = calcCost(pages.length, params.copies, params.color, prices);
    costValue.textContent = formatCost(cost, prices.currency);
  }
}

/**
 * @param {HTMLElement} el
 * @param {string} message
 */
function showError(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
}

/**
 * @param {HTMLElement} el
 */
function hideError(el) {
  el.textContent = "";
  el.classList.add("hidden");
}
