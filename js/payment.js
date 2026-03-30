/**
 * @fileoverview Интеграция с платёжным шлюзом.
 *
 * Модуль не выполняет прямой оплаты — он инициирует редирект на страницу шлюза
 * и читает результат из URL при возврате пользователя.
 *
 * Поддерживаемые шлюзы: Stripe Checkout, YooKassa.
 * Для смены шлюза замените реализацию функции initiatePayment.
 */

/**
 * @typedef {"pending"|"succeeded"|"failed"} PaymentStatus
 */

/**
 * @typedef {Object} PaymentResult
 * @property {PaymentStatus} status
 * @property {string|null}   paymentId - Идентификатор платежа или null при ошибке
 */

/**
 * Читает результат оплаты из параметров URL после редиректа со шлюза.
 * Вызывается при загрузке страницы, если в URL есть параметры оплаты.
 *
 * Ожидаемые параметры:
 * - ?payment_id=xxx&status=success  — успешная оплата
 * - ?status=failed                  — неуспешная оплата
 *
 * @returns {PaymentResult|null} null если страница открыта не после редиректа
 */
export function readPaymentResult() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");

  if (!status) return null;

  if (status === "success") {
    const paymentId = params.get("payment_id");
    return { status: "succeeded", paymentId };
  }

  if (status === "failed") {
    return { status: "failed", paymentId: null };
  }

  return null;
}

/**
 * Инициирует оплату через редирект на страницу шлюза.
 *
 * В production замените URL и логику создания сессии согласно документации
 * выбранного шлюза (Stripe Checkout или YooKassa).
 *
 * @param {number} amount     - Сумма оплаты
 * @param {string} currency   - Код валюты, например "RUB"
 * @param {string} description - Описание заказа для отображения пользователю
 * @returns {Promise<void>}   Резолвится перед редиректом (практически никогда)
 */
export async function initiatePayment(amount, currency, description) {
  const params = new URLSearchParams(window.location.search);

  // Demo-режим: имитируем редирект на шлюз и мгновенный возврат с успехом.
  // Заказчик видит полный флоу без реальной оплаты.
  if (params.has("demo")) {
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("status", "success");
    returnUrl.searchParams.set("payment_id", `demo-pay-${Date.now()}`);
    // Небольшая задержка — имитация перехода на страницу шлюза и обратно
    await new Promise((r) => setTimeout(r, 1000));
    window.location.href = returnUrl.toString();
    return;
  }

  // TODO: вызвать серверный endpoint для создания платёжной сессии,
  // получить URL редиректа и выполнить window.location.href = url.
  //
  // Пример для Stripe:
  //   const { url } = await fetch("/api/create-checkout-session", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ amount, currency, description }),
  //   }).then(r => r.json());
  //   window.location.href = url;

  console.warn("initiatePayment: интеграция с платёжным шлюзом не настроена", {
    amount,
    currency,
    description,
  });
}

/**
 * Очищает параметры оплаты из URL без перезагрузки страницы.
 * Вызывается после обработки результата, чтобы убрать ?payment_id=... из адресной строки.
 */
export function clearPaymentParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("payment_id");
  url.searchParams.delete("status");
  window.history.replaceState({}, "", url.toString());
}
