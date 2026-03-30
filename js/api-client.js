/**
 * @fileoverview Обёртка для всех HTTP-запросов к серверу печати.
 * URL сервера задаётся константой API_BASE — при деплое подставьте реальный адрес.
 *
 * Demo-режим: добавьте ?demo=true в URL — все запросы будут возвращать
 * заглушки без обращения к серверу. Используется для демонстрации на GitHub Pages.
 */

const API_BASE  = "http://localhost:3000/api";
const DEMO_MODE = new URLSearchParams(window.location.search).has("demo");

// ============================================================
// Demo-заглушки
// ============================================================

/** @returns {Promise<void>} */
function demoDelay(ms = 800) {
  return new Promise((r) => setTimeout(r, ms));
}

/** @type {number} */
let _demoPrintAttempts = 0;

/**
 * @param {File} file
 * @param {(percent: number) => void} onProgress
 * @returns {Promise<UploadResponse>}
 */
async function demoUpload(file, onProgress) {
  for (let p = 0; p <= 100; p += 20) {
    await demoDelay(150);
    onProgress(p);
  }
  await demoDelay(400);
  return { file_id: "demo-file-001", pages: 8 };
}

/** @returns {Promise<PricesResponse>} */
async function demoGetPrices() {
  await demoDelay(100);
  return { bw: 2, color: 5, currency: "RUB" };
}

/**
 * @param {PrintRequest} _data
 * @returns {Promise<PrintResponse>}
 */
async function demoSendPrintJob(_data) {
  await demoDelay(600);
  _demoPrintAttempts++;
  if (_demoPrintAttempts < 2) {
    const err = new Error("Оплата ещё не подтверждена. Подождите несколько секунд и попробуйте снова.");
    err.status = 402;
    throw err;
  }
  return { job_id: `demo-job-${Date.now()}`, status: "queued" };
}

/**
 * @typedef {Object} UploadResponse
 * @property {string} file_id - Уникальный идентификатор загруженного файла
 * @property {number} pages   - Общее количество страниц в документе
 */

/**
 * @typedef {Object} PricesResponse
 * @property {number} bw       - Цена за страницу чёрно-белой печати
 * @property {number} color    - Цена за страницу цветной печати
 * @property {string} currency - Код валюты (ISO 4217), например "RUB"
 */

/**
 * @typedef {Object} PrintRequest
 * @property {string} file_id    - Идентификатор файла из UploadResponse
 * @property {string} [pages]    - Диапазон страниц: "all", "1-5", "1,3,5-8"
 * @property {number} copies     - Количество копий (1–10)
 * @property {"bw"|"color"} color - Режим печати
 * @property {string} payment_id - Идентификатор подтверждённого платежа
 */

/**
 * @typedef {Object} PrintResponse
 * @property {string} job_id - Идентификатор задания на печать
 * @property {"queued"|"printing"|"done"|"failed"} status - Статус задания
 */

/**
 * @typedef {Object} ApiError
 * @property {string} detail - Текст ошибки от сервера
 */

/**
 * Базовый fetch с обработкой ошибок.
 * При статусе >= 400 выбрасывает Error с текстом из поля `detail`.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<unknown>}
 */
async function request(url, options) {
  const res = await fetch(url, options);

  if (!res.ok) {
    /** @type {ApiError} */
    const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    const err = new Error(body.detail || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

/**
 * Загружает Word-файл на сервер.
 * Использует XMLHttpRequest для отслеживания прогресса.
 *
 * @param {File} file                          - Файл .doc/.docx
 * @param {(percent: number) => void} onProgress - Коллбэк прогресса (0–100)
 * @returns {Promise<UploadResponse>}
 */
export function uploadFile(file, onProgress) {
  if (DEMO_MODE) return demoUpload(file, onProgress);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.open("POST", `${API_BASE}/upload`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Неверный формат ответа сервера"));
        }
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          const err = new Error(body.detail || `HTTP ${xhr.status}`);
          err.status = xhr.status;
          reject(err);
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Сервер недоступен, попробуйте позже")));
    xhr.addEventListener("timeout", () => reject(new Error("Превышено время ожидания")));

    xhr.timeout = 60_000;
    xhr.send(formData);
  });
}

/**
 * Запрашивает актуальные тарифы на печать.
 *
 * @returns {Promise<PricesResponse>}
 */
export function getPrices() {
  if (DEMO_MODE) return demoGetPrices();
  return request(`${API_BASE}/prices`);
}

/**
 * Отправляет задание на печать.
 * Требует подтверждённой оплаты — сервер проверяет по payment_id.
 *
 * @param {PrintRequest} data
 * @returns {Promise<PrintResponse>}
 */
export function sendPrintJob(data) {
  if (DEMO_MODE) return demoSendPrintJob(data);
  return request(`${API_BASE}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
