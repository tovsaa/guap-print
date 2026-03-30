/**
 * @fileoverview Отправка задания на печать и отображение результата.
 */

import { sendPrintJob } from "./api-client.js";

/**
 * @typedef {import('./api-client.js').PrintRequest}  PrintRequest
 * @typedef {import('./api-client.js').PrintResponse} PrintResponse
 */

/**
 * Максимальное число попыток при статусе 402 (оплата ещё не подтверждена).
 * Сервер подтверждает оплату через Webhook — между редиректом шлюза
 * и получением Webhook может пройти несколько секунд.
 */
const MAX_PAYMENT_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

/**
 * Отправляет задание на печать с автоматическими повторами при 402.
 *
 * @param {PrintRequest}                        job       - Параметры задания
 * @param {(message: string) => void}           onPending - Коллбэк ожидания (показать спиннер)
 * @param {(result: PrintResponse) => void}     onSuccess - Коллбэк успеха
 * @param {(message: string) => void}           onError   - Коллбэк ошибки
 * @returns {Promise<void>}
 */
export async function submitPrintJob(job, onPending, onSuccess, onError) {
  onPending("Подтверждаем оплату и отправляем задание на печать...");

  for (let attempt = 1; attempt <= MAX_PAYMENT_RETRIES; attempt++) {
    try {
      const result = await sendPrintJob(job);
      onSuccess(result);
      return;
    } catch (err) {
      if (err.status === 402 && attempt < MAX_PAYMENT_RETRIES) {
        await delay(RETRY_DELAY_MS);
        onPending(`Ожидаем подтверждение оплаты... (${attempt}/${MAX_PAYMENT_RETRIES})`);
        continue;
      }
      onError(err.message);
      return;
    }
  }

  onError("Оплата не подтверждена. Попробуйте снова через несколько секунд.");
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
