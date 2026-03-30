/**
 * @fileoverview Логика загрузки файла: валидация, drag-and-drop, прогресс, UI.
 */

import { uploadFile } from "./api-client.js";

const ALLOWED_MIME = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

/**
 * @typedef {Object} UploadResult
 * @property {string} fileId   - Идентификатор файла на сервере
 * @property {number} pages    - Количество страниц в документе
 * @property {string} fileName - Имя файла (для отображения в UI)
 */

/**
 * Инициализирует модуль загрузки файла.
 * Навешивает обработчики на зону загрузки и файловый инпут.
 *
 * @param {object}                              elements - DOM-элементы
 * @param {HTMLElement}                         elements.zone         - Зона drag-and-drop
 * @param {HTMLInputElement}                    elements.input        - <input type="file">
 * @param {HTMLElement}                         elements.progress     - Обёртка прогресс-бара
 * @param {HTMLElement}                         elements.progressBar  - Полоска прогресса
 * @param {HTMLElement}                         elements.progressText - Текст процента
 * @param {HTMLElement}                         elements.fileInfo     - Блок с именем и страницами
 * @param {HTMLElement}                         elements.fileInfoName - Элемент с именем файла
 * @param {HTMLElement}                         elements.fileInfoPages- Элемент с кол-вом страниц
 * @param {HTMLButtonElement}                   elements.btnNext      - Кнопка "Далее"
 * @param {(result: UploadResult) => void}      onSuccess             - Коллбэк при успехе
 * @param {(message: string) => void}           onError               - Коллбэк при ошибке
 */
export function initUpload(elements, onSuccess, onError) {
  const { zone, input, progress, progressBar, progressText,
          fileInfo, fileInfoName, fileInfoPages, btnNext } = elements;

  // Клик по зоне открывает диалог выбора файла
  zone.addEventListener("click", (e) => {
    if (e.target !== input) input.click();
  });

  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });

  // Drag-and-drop
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("upload-zone--dragover");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("upload-zone--dragover");
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("upload-zone--dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) handleFile(file);
  });

  /**
   * Валидирует и загружает файл.
   * @param {File} file
   */
  async function handleFile(file) {
    const validationError = validateFile(file);
    if (validationError) {
      onError(validationError);
      return;
    }

    setUploading(true);

    try {
      const result = await uploadFile(file, (percent) => {
        setProgress(percent);
      });

      setUploading(false);
      showFileInfo(file.name, result.pages);
      btnNext.disabled = false;
      btnNext.removeAttribute("aria-disabled");

      onSuccess({ fileId: result.file_id, pages: result.pages, fileName: file.name });
    } catch (err) {
      setUploading(false);
      onError(err.message);
    }
  }

  /**
   * @param {boolean} active
   */
  function setUploading(active) {
    zone.classList.toggle("hidden", active);
    progress.classList.toggle("hidden", !active);
    if (active) setProgress(0);
  }

  /**
   * @param {number} percent - 0–100
   */
  function setProgress(percent) {
    progressBar.style.width = `${percent}%`;
    progressBar.closest("[role=progressbar]")?.setAttribute("aria-valuenow", percent);
    progressText.textContent = percent < 100 ? `Загрузка... ${percent}%` : "Обработка...";
  }

  /**
   * @param {string} name
   * @param {number} pages
   */
  function showFileInfo(name, pages) {
    fileInfo.classList.remove("hidden");
    fileInfoName.textContent = name;
    fileInfoPages.textContent = `${pages} стр.`;
  }
}

/**
 * Клиентская валидация файла перед отправкой.
 *
 * @param {File} file
 * @returns {string|null} Текст ошибки или null если файл валиден
 */
export function validateFile(file) {
  if (!ALLOWED_MIME.includes(file.type)) {
    return "Поддерживаются только файлы .doc и .docx";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `Максимальный размер файла — ${MAX_SIZE_MB} МБ`;
  }
  return null;
}
