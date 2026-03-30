/**
 * @fileoverview Точка входа. Оркестрирует wizard из 4 шагов.
 *
 * Состояние приложения хранится в одном объекте `state`.
 * Переходы между шагами — через функцию goToStep().
 */

import { getPrices } from "./api-client.js";
import { initUpload } from "./upload.js";
import { initPrintForm } from "./print-form.js";
import { initiatePayment, readPaymentResult, clearPaymentParams } from "./payment.js";
import { submitPrintJob } from "./print-sender.js";
import { parsePageRange, formatCost } from "./calculator.js";

// ============================================================
// Состояние приложения
// ============================================================

/**
 * @typedef {Object} AppState
 * @property {string|null}                          fileId      - ID файла на сервере
 * @property {number|null}                          pages       - Кол-во страниц документа
 * @property {string|null}                          fileName    - Имя файла
 * @property {import('./api-client.js').PricesResponse|null} prices - Тарифы
 * @property {import('./print-form.js').PrintParams|null}    printParams - Параметры печати
 * @property {string|null}                          paymentId   - ID подтверждённого платежа
 */

/** @type {AppState} */
const state = {
  fileId:      null,
  pages:       null,
  fileName:    null,
  prices:      null,
  printParams: null,
  paymentId:   null,
};

// ============================================================
// DOM-элементы
// ============================================================

const el = {
  // Шаги
  steps: /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".step")),
  stepIndicators: /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".stepper__item")),

  // Глобальная ошибка
  globalError:     /** @type {HTMLElement}      */ (document.getElementById("global-error")),
  globalErrorText: /** @type {HTMLElement}      */ (document.getElementById("global-error-text")),
  globalErrorClose:/** @type {HTMLButtonElement}*/ (document.getElementById("global-error-close")),

  // Шаг 1
  uploadZone:        /** @type {HTMLElement}       */ (document.getElementById("upload-zone")),
  fileInput:         /** @type {HTMLInputElement}  */ (document.getElementById("file-input")),
  uploadProgress:    /** @type {HTMLElement}       */ (document.getElementById("upload-progress")),
  uploadProgressBar: /** @type {HTMLElement}       */ (document.getElementById("upload-progress-bar")),
  uploadProgressText:/** @type {HTMLElement}       */ (document.getElementById("upload-progress-text")),
  fileInfo:          /** @type {HTMLElement}       */ (document.getElementById("file-info")),
  fileInfoName:      /** @type {HTMLElement}       */ (document.getElementById("file-info-name")),
  fileInfoPages:     /** @type {HTMLElement}       */ (document.getElementById("file-info-pages")),
  btnNext1:          /** @type {HTMLButtonElement} */ (document.getElementById("btn-next-1")),

  // Шаг 2
  printForm:         /** @type {HTMLFormElement}               */ (document.getElementById("print-form")),
  inputPages:        /** @type {HTMLInputElement}              */ (document.getElementById("input-pages")),
  inputCopies:       /** @type {HTMLInputElement}              */ (document.getElementById("input-copies")),
  radiosColor:       /** @type {NodeListOf<HTMLInputElement>}  */ (document.querySelectorAll('input[name="color"]')),
  pagesError:        /** @type {HTMLElement}                   */ (document.getElementById("pages-error")),
  copiesError:       /** @type {HTMLElement}                   */ (document.getElementById("copies-error")),
  totalPagesDisplay: /** @type {HTMLElement}                   */ (document.getElementById("total-pages-display")),
  costValue:         /** @type {HTMLElement}                   */ (document.getElementById("cost-value")),
  costCurrency:      /** @type {HTMLElement}                   */ (document.getElementById("cost-currency")),
  btnBack2:          /** @type {HTMLButtonElement}             */ (document.getElementById("btn-back-2")),
  btnNext2:          /** @type {HTMLButtonElement}             */ (document.getElementById("btn-next-2")),

  // Шаг 3
  summaryFilename: /** @type {HTMLElement}      */ (document.getElementById("summary-filename")),
  summaryPages:    /** @type {HTMLElement}      */ (document.getElementById("summary-pages")),
  summaryCopies:   /** @type {HTMLElement}      */ (document.getElementById("summary-copies")),
  summaryColor:    /** @type {HTMLElement}      */ (document.getElementById("summary-color")),
  summaryTotal:    /** @type {HTMLElement}      */ (document.getElementById("summary-total")),
  btnBack3:        /** @type {HTMLButtonElement}*/ (document.getElementById("btn-back-3")),
  btnPay:          /** @type {HTMLButtonElement}*/ (document.getElementById("btn-pay")),

  // Шаг 4
  resultPending:      /** @type {HTMLElement} */ (document.getElementById("result-pending")),
  resultSuccess:      /** @type {HTMLElement} */ (document.getElementById("result-success")),
  resultPaymentError: /** @type {HTMLElement} */ (document.getElementById("result-payment-error")),
  resultJobId:        /** @type {HTMLElement} */ (document.getElementById("result-job-id")),
  btnNewOrder:        /** @type {HTMLButtonElement} */ (document.getElementById("btn-new-order")),
  btnRetryPayment:    /** @type {HTMLButtonElement} */ (document.getElementById("btn-retry-payment")),
};

// ============================================================
// Навигация между шагами
// ============================================================

/**
 * Переходит на указанный шаг (1–4).
 * @param {1|2|3|4} stepNumber
 */
function goToStep(stepNumber) {
  el.steps.forEach((step, i) => {
    step.classList.toggle("hidden", i + 1 !== stepNumber);
  });

  el.stepIndicators.forEach((indicator, i) => {
    const n = i + 1;
    indicator.classList.toggle("stepper__item--active", n === stepNumber);
    indicator.classList.toggle("stepper__item--done", n < stepNumber);
    if (n === stepNumber) {
      indicator.setAttribute("aria-current", "step");
    } else {
      indicator.removeAttribute("aria-current");
    }
  });
}

// ============================================================
// Глобальные ошибки
// ============================================================

/**
 * @param {string} message
 */
function showGlobalError(message) {
  el.globalErrorText.textContent = message;
  el.globalError.classList.remove("hidden");
}

function hideGlobalError() {
  el.globalError.classList.add("hidden");
}

el.globalErrorClose.addEventListener("click", hideGlobalError);

// ============================================================
// Шаг 1 — загрузка файла
// ============================================================

initUpload(
  {
    zone:          el.uploadZone,
    input:         el.fileInput,
    progress:      el.uploadProgress,
    progressBar:   el.uploadProgressBar,
    progressText:  el.uploadProgressText,
    fileInfo:      el.fileInfo,
    fileInfoName:  el.fileInfoName,
    fileInfoPages: el.fileInfoPages,
    btnNext:       el.btnNext1,
  },
  (result) => {
    state.fileId   = result.fileId;
    state.pages    = result.pages;
    state.fileName = result.fileName;
    hideGlobalError();
  },
  showGlobalError,
);

el.btnNext1.addEventListener("click", async () => {
  if (!state.prices) {
    try {
      state.prices = await getPrices();
    } catch {
      showGlobalError("Не удалось загрузить тарифы. Проверьте соединение.");
      return;
    }
  }

  initPrintForm(
    {
      form:              el.printForm,
      inputPages:        el.inputPages,
      inputCopies:       el.inputCopies,
      radiosColor:       el.radiosColor,
      pagesError:        el.pagesError,
      copiesError:       el.copiesError,
      totalPagesDisplay: el.totalPagesDisplay,
      costValue:         el.costValue,
      costCurrency:      el.costCurrency,
    },
    state.prices,
    /** @type {number} */ (state.pages),
    (params) => { state.printParams = params; },
  );

  goToStep(2);
});

// ============================================================
// Шаг 2 — параметры печати
// ============================================================

el.btnBack2.addEventListener("click", () => goToStep(1));

el.btnNext2.addEventListener("click", () => {
  if (!state.printParams) return;
  fillOrderSummary();
  goToStep(3);
});

/**
 * Заполняет сводку заказа перед оплатой.
 */
function fillOrderSummary() {
  const { printParams, prices, pages: totalPages, fileName } = state;
  if (!printParams || !prices || !totalPages) return;

  const { pages: pageList } = parsePageRange(printParams.pages, totalPages);
  const pageCount = pageList?.length ?? totalPages;
  const cost = pageCount * printParams.copies * (printParams.color === "color" ? prices.color : prices.bw);

  el.summaryFilename.textContent = fileName ?? "—";
  const pagesLabel = printParams.pages === "all"
    ? `Все (${totalPages} стр.)`
    : `${printParams.pages} — ${pageCount} стр.`;
  el.summaryPages.textContent = pagesLabel;
  el.summaryCopies.textContent   = String(printParams.copies);
  el.summaryColor.textContent    = printParams.color === "color" ? "Цветной" : "Чёрно-белый";
  el.summaryTotal.textContent    = formatCost(cost, prices.currency);
}

// ============================================================
// Шаг 3 — оплата
// ============================================================

el.btnBack3.addEventListener("click", () => goToStep(2));

el.btnPay.addEventListener("click", async () => {
  const { printParams, prices, pages: totalPages } = state;
  if (!printParams || !prices || !totalPages) return;

  const { pages: pageList } = parsePageRange(printParams.pages, totalPages);
  const pageCount = pageList?.length ?? totalPages;
  const cost = pageCount * printParams.copies * (printParams.color === "color" ? prices.color : prices.bw);

  // Сохраняем state в sessionStorage перед редиректом — после возврата страница перезагрузится
  sessionStorage.setItem("printState", JSON.stringify({
    fileId:     state.fileId,
    pages:      state.pages,
    fileName:   state.fileName,
    prices:     state.prices,
    printParams: state.printParams,
  }));

  await initiatePayment(cost, prices.currency, `Печать: ${pageCount} стр. × ${printParams.copies} коп.`);
});

// ============================================================
// Шаг 4 — результат после редиректа с платёжного шлюза
// ============================================================

/**
 * Показывает одно из состояний шага 4, скрывая остальные.
 * @param {"pending"|"success"|"payment-error"} which
 */
function showResult(which) {
  el.resultPending.classList.toggle("hidden", which !== "pending");
  el.resultSuccess.classList.toggle("hidden", which !== "success");
  el.resultPaymentError.classList.toggle("hidden", which !== "payment-error");
}

async function handlePaymentReturn() {
  const result = readPaymentResult();
  if (!result) return;

  clearPaymentParams();
  goToStep(4);

  if (result.status === "failed") {
    showResult("payment-error");
    return;
  }

  // Восстанавливаем state из sessionStorage после редиректа
  const saved = sessionStorage.getItem("printState");
  if (saved) {
    Object.assign(state, JSON.parse(saved));
    sessionStorage.removeItem("printState");
  }

  state.paymentId = result.paymentId;
  showResult("pending");

  const { printParams, pages: totalPages } = state;
  if (!printParams || !totalPages || !state.fileId || !state.paymentId) {
    showResult("payment-error");
    return;
  }

  await submitPrintJob(
    {
      file_id:    state.fileId,
      pages:      printParams.pages,
      copies:     printParams.copies,
      color:      printParams.color,
      payment_id: state.paymentId,
    },
    (message) => { el.resultPending.querySelector("p").textContent = message; },
    (jobResult) => {
      el.resultJobId.textContent = jobResult.job_id;
      showResult("success");
    },
    () => showResult("payment-error"),
  );
}

el.btnRetryPayment.addEventListener("click", () => goToStep(3));

el.btnNewOrder.addEventListener("click", () => {
  Object.assign(state, {
    fileId: null, pages: null, fileName: null,
    printParams: null, paymentId: null,
  });
  el.fileInfo.classList.add("hidden");
  el.uploadProgress.classList.add("hidden");
  el.uploadZone.classList.remove("hidden");
  el.btnNext1.disabled = true;
  el.btnNext1.setAttribute("aria-disabled", "true");
  el.fileInput.value = "";
  goToStep(1);
});

// ============================================================
// Инициализация
// ============================================================

handlePaymentReturn();
goToStep(1);
