/**
 * Internationalization (i18n) dictionaries for Beatspotto.
 *
 * Supported languages:
 *   - ru     Russian (default)
 *   - de     German
 *   - uk     Ukrainian
 *   - fr     French
 *   - en-US  English (US)
 *
 * Usage:
 *   const t = useTranslations()
 *   <p>{t.tracks}</p>
 */

export type Locale = 'ru' | 'de' | 'uk' | 'fr' | 'en-US'

export interface LocaleMeta {
  code: Locale
  nativeName: string  // name in the locale's own language
  flag: string        // emoji flag for the dropdown
}

export const LOCALES: LocaleMeta[] = [
  { code: 'ru', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'de', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'uk', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'fr', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'en-US', nativeName: 'English (US)', flag: '🇺🇸' },
]

export type AudioFormat = 'mp3-320' | 'wav-16-44100'

/** Search mode:
 *  - 'extended' — Search Extended: tries Extended Mix / Original Mix for
 *    short tracks (< 4:30) or tracks with Mixed/Cut/Radio Edit keywords.
 *  - 'simple'   — Simple download: downloads the track exactly as it appears
 *    on Spotify, no extended-version search.
 */
export type SearchMode = 'extended' | 'simple'

/**
 * Tunable parameters for the extended-mix search algorithm. These map 1:1
 * to constants in the python helper (`scripts/spotify_dl.py`) and are
 * forwarded via the `SD_SEARCH_PARAMS` env var as JSON.
 */
export interface SearchParams {
  /** Tracks shorter than this (in seconds) are considered "short" and trigger
   *  the Extended Mix / Original Mix search. Default: 270 (4:30). */
  maxDurationSeconds: number
  /** Comma-separated regex keywords. If a track title matches, the extended
   *  search is triggered even if the track is longer than maxDurationSeconds.
   *  Default: "mixed|cut|radioedit|radio edit" */
  shortTitleKeywords: string
  /** Title similarity threshold (0..1). Search results whose title is less
   *  similar to "{artist} - {title} {suffix}" than this are rejected.
   *  Default: 0.70 */
  similarityThreshold: number
  /** Comma-separated list of suffixes tried in order when searching for a
   *  longer version. Default: "Extended Mix,Original Mix" (+ empty string
   *  is always appended as a final fallback). */
  extendedMixSuffixes: string
  /** Comma-separated regex of suffixes that, if already present in the
   *  Spotify title, skip the extended-mix search and just download the
   *  exact match. Default: "extended|original|club mix" */
  existingSuffixPattern: string
  /** Regex pattern for "(ArtistName Remix)" suffixes in Spotify titles.
   *  When present, the search for a longer version is always triggered.
   *  Default: "\\([^\\)]*\\bremix\\b[^\\)]*\\)" */
  remixSuffixPattern: string
}

export const DEFAULT_SEARCH_PARAMS: SearchParams = {
  maxDurationSeconds: 270,
  shortTitleKeywords: 'mixed|cut|radioedit|radio edit',
  similarityThreshold: 0.70,
  extendedMixSuffixes: 'Extended Mix,Original Mix',
  existingSuffixPattern: 'extended|original|club mix',
  remixSuffixPattern: '\\([^\\)]*\\bremix\\b[^\\)]*\\)',
}

export interface AudioFormatMeta {
  id: AudioFormat
  label: string
  description: string
}

// Dictionary keys — every string shown in the UI must have an entry here.
export interface Dict {
  // Header
  appTitle: string
  appSubtitle: string
  // URL input
  urlPlaceholder: string
  findTracks: string
  searching: string
  // Cookies button / banner
  cookies: string
  cookiesActive: string
  cookiesConfigure: string
  cookiesRequiredBanner: string
  insertCookies: string
  // Tracks section
  tracks: string
  trackCount: (n: number) => string
  playlistSource: string
  albumSource: string
  singleTrackSource: string
  listEmpty: string
  fetchingMetadata: string
  enterUrlPrompt: string
  downloadAll: string
  downloadingAll: string
  download: string
  save: string
  retry: string
  downloading: string
  downloaded: string
  skipped: string
  failed: string
  extBadge: string
  // Log section
  eventLog: string
  online: string
  offline: string
  clearLog: string
  logEmpty: string
  // History section
  downloadHistory: string
  archiveCount: (n: number) => string
  mp3Count: (n: number) => string
  mp3Label: string
  wavLabel: string
  refresh: string
  historyEmpty: string
  lastArchive: string
  downloadZip: string
  delete: string
  // Status bar
  total: string
  ok: string
  skip: string
  error: string
  clear: string
  batchInProgress: string
  // Settings dialog
  settings: string
  settingsDescription: string
  sectionGeneral: string
  sectionAudio: string
  sectionCookies: string
  sectionDownloadSource: string
  downloadSourceAuto: string
  downloadSourceQobuz: string
  downloadSourceTidal: string
  downloadSourceAmazon: string
  downloadSourceYoutube: string
  sectionSearch: string
  searchMode: string
  searchModeExtended: string
  searchModeExtendedDesc: string
  searchModeSimple: string
  searchModeSimpleDesc: string
  searchParamsTitle: string
  searchParamsDescription: string
  searchParamMaxDuration: string
  searchParamMaxDurationDesc: string
  searchParamShortKeywords: string
  searchParamShortKeywordsDesc: string
  searchParamSimilarity: string
  searchParamSimilarityDesc: string
  searchParamSuffixes: string
  searchParamSuffixesDesc: string
  searchParamExistingPattern: string
  searchParamExistingPatternDesc: string
  searchParamRemixPattern: string
  searchParamRemixPatternDesc: string
  resetToDefaults: string
  searchParamsHint: string
  modeToggleExtended: string
  modeToggleSimple: string
  // Stop button + abort
  stop: string
  stopTitle: string
  stopped: string
  // Candidate picker dialog
  pickerTitle: string
  pickerDescription: string
  pickerEmpty: string
  pickerSource: string
  pickerDuration: string
  pickerSimilar: string
  pickerMatches: string
  pickerDownload: string
  pickerCancel: string
  pickerNeedsPick: string
  theme: string
  themeDark: string
  themeLight: string
  language: string
  audioFormat: string
  audioFormatDescription: string
  mp3Title: string
  mp3Desc: string
  wavTitle: string
  wavDesc: string
  cookiesSectionDescription: string
  cookiesAvailable: string
  cookiesNotConfigured: string
  openCookiesDialog: string
  // Lossless-Core section
  sectionLosslessCore: string
  losslessCoreDescription: string
  losslessCoreUrl: string
  losslessCoreUrlDesc: string
  losslessCoreUrlPlaceholder: string
  losslessCoreAvailable: string
  losslessCoreNotConfigured: string
  losslessCoreSave: string
  losslessCoreSaved: string
  // 2FA section
  section2FA: string
  twoFactorDescription: string
  twoFactorEnabled: string
  twoFactorDisabled: string
  enable2FA: string
  disable2FA: string
  twoFactorSecretLabel: string
  twoFactorCodePlaceholder: string
  verifyAndEnable: string
  // Password section
  sectionPassword: string
  currentPassword: string
  newPassword: string
  confirmPassword: string
  changePasswordButton: string
  passwordChangedSuccess: string
  passwordsDoNotMatch: string
  passwordTooShort: string
  // Cookies dialog
  cookiesDialogTitle: string
  cookiesDialogDescription: string
  howToGetCookies: string
  cookiesStep1: string
  cookiesChromeExt: string
  cookiesFirefoxExt: string
  cookiesStep2: string
  cookiesStep3: string
  cookiesStep3Site: string
  cookiesStep4: string
  cookiesSecurityNote: string
  cookiesContentLabel: string
  cookiesContentPlaceholder: string
  cookiesFirstLineHint: string
  deleteCookies: string
  cancel: string
  saveBtn: string
  // Clear history dialog
  clearHistoryTitle: string
  clearHistoryWarning: string
  clearHistoryFiles: (n: number) => string
  clearHistoryArchives: (n: number) => string
  clearHistoryLogs: (n: number) => string
  clearHistoryCounters: string
  clearHistoryIrreversible: string
  clearHistoryAlsoCookies: string
  clearAll: string
  // Toasts
  toastEnterUrl: string
  toastEnterUrlDesc: string
  toastInvalidUrl: string
  toastInvalidUrlDesc: string
  toastTracksFound: (n: number) => string
  toastPlaylistLoaded: string
  albumLoaded: string
  toastTrackReceived: string
  toastFetchError: string
  toastRequestError: string
  toastTrackSkipped: string
  toastTrackSkippedDesc: (artist: string, title: string) => string
  toastTrackDownloaded: string
  toastTrackDownloadedDesc: (artist: string, title: string) => string
  toastDownloadFailed: string
  toastBatchComplete: string
  toastBatchCompleteDesc: (dl: number, sk: number, fl: number) => string
  toastBatchStartError: string
  toastFileDeleted: string
  toastDeleteError: string
  toastHistoryCleared: string
  toastHistoryClearedDesc: string
  toastClearError: string
  toastCookiesEmpty: string
  toastCookiesEmptyDesc: string
  toastCookiesInvalid: string
  toastCookiesInvalidDesc: string
  toastCookiesSaved: string
  toastCookiesSavedDesc: string
  toastCookiesSaveError: string
  toastCookiesDeleted: string
  toastCookiesDeleteError: string
  // Footer
  footerTech: string
  footerPort: string
}

// ----------------------------------------------------------------------------
// Russian (default)
// ----------------------------------------------------------------------------

const ru: Dict = {
  appTitle: 'Beatspotto',
  appSubtitle: 'Search for Extended & Original',
  urlPlaceholder: 'https://open.spotify.com/playlist/... или /album/... или /track/......',
  findTracks: 'Найти треки',
  searching: 'Поиск...',
  cookies: 'Cookies',
  cookiesActive: 'Cookies настроены',
  cookiesConfigure: 'Настроить YouTube cookies',
  cookiesRequiredBanner: 'YouTube требует cookies для скачивания. Получена ошибка «Sign in to confirm you\'re not a bot».',
  insertCookies: 'Вставить cookies',
  tracks: 'Треки',
  trackCount: (n) => `${n}`,
  playlistSource: 'плейлист',
  albumSource: 'альбом',
  singleTrackSource: 'одиночный трек',
  listEmpty: 'Список пуст',
  fetchingMetadata: 'Получение метаданных из Spotify...',
  enterUrlPrompt: 'Введите URL выше, чтобы загрузить список треков',
  downloadAll: 'Скачать все',
  downloadingAll: 'Идёт...',
  download: 'Скачать',
  save: 'Сохранить',
  retry: 'Повтор',
  downloading: 'Загрузка',
  downloaded: 'OK',
  skipped: 'Пропуск',
  failed: 'Ошибка',
  extBadge: 'EXT?',
  eventLog: 'Журнал событий',
  online: 'online',
  offline: 'offline',
  clearLog: 'Очистить журнал',
  logEmpty: 'Журнал пуст.\nВыполните действие, чтобы увидеть события.',
  downloadHistory: 'История скачивания',
  archiveCount: (n) => `${n}`,
  mp3Count: (n) => `${n} MP3`,
  mp3Label: 'MP3',
  wavLabel: 'WAV',
  refresh: 'Обновить',
  historyEmpty: 'Пока нет скачанных файлов',
  lastArchive: 'последний',
  downloadZip: 'Скачать ZIP',
  delete: 'Удалить',
  total: 'Всего',
  ok: 'OK',
  skip: 'Пропуск',
  error: 'Ошибка',
  clear: 'Очистить',
  batchInProgress: 'Пакет...',
  settings: 'Настройки',
  settingsDescription: 'Настройте язык, тему и формат скачивания',
  sectionGeneral: 'Общие',
  sectionAudio: 'Аудио формат',
  sectionCookies: 'YouTube Cookies',
    sectionDownloadSource: 'Download Source',
    downloadSourceAuto: 'Auto (Best available)',
    downloadSourceQobuz: 'Qobuz',
    downloadSourceTidal: 'Tidal',
    downloadSourceAmazon: 'Amazon',
    downloadSourceYoutube: 'YouTube',
  sectionSearch: 'Поиск расширенных версий',
  searchMode: 'Режим поиска',
  searchModeExtended: 'Search Extended',
  searchModeExtendedDesc: 'Для коротких треков (< 4:30) или с пометками Mixed/Cut/Radio Edit ищет Extended Mix → Original Mix → точное совпадение',
  searchModeSimple: 'Простое скачивание',
  searchModeSimpleDesc: 'Скачивает треки в исходном виде из Spotify без поиска расширенных версий',
  searchParamsTitle: 'Параметры поиска',
  searchParamsDescription: 'Тонкая настройка алгоритма поиска расширенных версий (только для режима Search Extended)',
  searchParamMaxDuration: 'Макс. длительность, сек',
  searchParamMaxDurationDesc: 'Треки короче этого значения считаются «короткими» и активируют поиск Extended Mix. По умолчанию: 270 (4:30)',
  searchParamShortKeywords: 'Ключевые слова в названии',
  searchParamShortKeywordsDesc: 'Regex-паттерн. Если название трека содержит эти слова, поиск Extended Mix активируется даже для длинных треков. По умолчанию: mixed|cut|radioedit|radio edit',
  searchParamSimilarity: 'Порог схожести названия',
  searchParamSimilarityDesc: 'Число 0..1. Результаты поиска с меньшей схожестью с «{artist} - {title} {suffix}» отклоняются. По умолчанию: 0.70',
  searchParamSuffixes: 'Суффиксы для поиска',
  searchParamSuffixesDesc: 'Суффиксы через запятую, перебираемые по порядку при поиске длинной версии. По умолчанию: Extended Mix,Original Mix',
  searchParamExistingPattern: 'Паттерн существующего суффикса',
  searchParamExistingPatternDesc: 'Regex-паттерн. Если название уже содержит эти суффиксы, поиск Extended Mix пропускается. По умолчанию: extended|original|club mix',
  searchParamRemixPattern: 'Паттерн ремикс-суффикса',
  searchParamRemixPatternDesc: 'Regex для суффиксов вида «(ArtistName Remix)». Если название содержит такой суффикс, всегда ищется версия длиннее, чем в Spotify. По умолчанию: \\([^\\)]*\\bremix\\b[^\\)]*\\)',
  resetToDefaults: 'Сбросить к значениям по умолчанию',
  searchParamsHint: 'Изменения применяются к следующему скачиванию',
  modeToggleExtended: 'Search Extended',
  modeToggleSimple: 'Простой',
  stop: 'Стоп',
  stopTitle: 'Остановить текущий поиск и скачивание',
  stopped: 'Операция остановлена пользователем',
  pickerTitle: 'Выберите версию для скачивания',
  pickerDescription: 'Не найдено версии длиннее максимальной длительности. Выберите одну из найденных версий:',
  pickerEmpty: 'Нет доступных версий для выбора',
  pickerSource: 'Источник',
  pickerDuration: 'Длительность',
  pickerSimilar: 'похоже',
  pickerMatches: 'соответствует фильтру',
  pickerDownload: 'Скачать эту версию',
  pickerCancel: 'Отмена',
  pickerNeedsPick: 'Требуется выбор',
  theme: 'Тема оформления',
  themeDark: 'Тёмная',
  themeLight: 'Светлая',
  language: 'Язык интерфейса',
  audioFormat: 'Формат скачивания',
  audioFormatDescription: 'Выберите формат и качество аудио для скачиваемых треков',
  mp3Title: 'MP3 320 kbps',
  mp3Desc: 'Сжатый формат, малый размер, высокое качество',
  wavTitle: 'WAV 16-bit 44100 Hz',
  wavDesc: 'Без потерь, аудио CD-качество, большой размер',
  cookiesSectionDescription: 'Cookies используются yt-dlp для обхода проверки «не бот» на YouTube',
  cookiesAvailable: 'Cookies настроены и активны',
  cookiesNotConfigured: 'Cookies не настроены',
  openCookiesDialog: 'Настроить cookies',
  // Lossless-Core section
  sectionLosslessCore: 'Lossless-Core (метаданные)',
  losslessCoreDescription: 'Встроенный модуль Lossless-Core (аналог микросервиса из Charlotte-v2) запрашивает расширенные метаданные из Spotify: альбом, ISRC, дату релиза и обложку. Метаданные встраиваются в MP3 в стандарте ID3v2.3.',
  losslessCoreUrl: 'URL Lossless-Core',
  losslessCoreUrlDesc: 'Адрес микросервиса Lossless-Core, например http://lossless-core:7856 или http://localhost:7856. Пустое значение отключает интеграцию.',
  losslessCoreUrlPlaceholder: 'http://localhost:7856',
  losslessCoreAvailable: 'Lossless-Core активен (встроенный модуль)',
  losslessCoreNotConfigured: 'Lossless-Core не настроен',
  losslessCoreSave: 'Сохранить URL',
  losslessCoreSaved: 'URL Lossless-Core сохранён',
  // 2FA section
  section2FA: 'Двухфакторная аутентификация (2FA)',
  twoFactorDescription: 'Защитите ваш аккаунт 6-значным кодом из приложения-аутентификатора (Google Authenticator, Authy и др.)',
  twoFactorEnabled: '2FA включена и активна',
  twoFactorDisabled: '2FA не настроена',
  enable2FA: 'Включить 2FA',
  disable2FA: 'Отключить 2FA',
  twoFactorSecretLabel: 'Отсканируйте QR-код или введите секретный ключ:',
  twoFactorCodePlaceholder: '000000',
  verifyAndEnable: 'Подтвердить и включить',
  // Password section
  sectionPassword: 'Смена пароля',
  currentPassword: 'Текущий пароль',
  newPassword: 'Новый пароль',
  confirmPassword: 'Подтвердите новый пароль',
  changePasswordButton: 'Изменить пароль',
  passwordChangedSuccess: 'Пароль успешно изменён!',
  passwordsDoNotMatch: 'Пароли не совпадают',
  passwordTooShort: 'Пароль должен быть от 6 до 128 символов',
  cookiesDialogTitle: 'YouTube Cookies (Netscape format)',
  cookiesDialogDescription: 'YouTube может требовать авторизацию для скачивания некоторых видео. Экспортируйте cookies из браузера и вставьте их ниже — они будут автоматически использоваться при всех последующих загрузках.',
  howToGetCookies: 'Как получить cookies:',
  cookiesStep1: 'Установите расширение для экспорта cookies в формате Netscape:',
  cookiesChromeExt: 'Chrome: «Get cookies.txt LOCALLY»',
  cookiesFirefoxExt: 'Firefox: «cookies.txt»',
  cookiesStep2: 'Войдите в свой аккаунт YouTube в этом браузере.',
  cookiesStep3: 'Откройте',
  cookiesStep3Site: 'и нажмите на иконку расширения.',
  cookiesStep4: 'Выберите «Export» → скопируйте содержимое файла в поле ниже.',
  cookiesSecurityNote: 'Cookies хранятся на сервере в файле youtube-cookies.txt и используются только для yt-dlp.',
  cookiesContentLabel: 'Содержимое cookies.txt',
  cookiesContentPlaceholder: '# Netscape HTTP Cookie File\n# https://www.youtube.com\n.youtube.com\tTRUE\t/\tFALSE\t...\tVISITOR_INFO1_LIVE\t...',
  cookiesFirstLineHint: 'Первая строка должна быть # Netscape HTTP Cookie File',
  deleteCookies: 'Удалить cookies',
  cancel: 'Отмена',
  saveBtn: 'Сохранить',
  clearHistoryTitle: 'Очистить историю скачивания?',
  clearHistoryWarning: 'Будут безвозвратно удалены:',
  clearHistoryFiles: (n) => `• все скачанные аудио файлы (${n} шт.)`,
  clearHistoryArchives: (n) => `• все ZIP / tar.gz архивы (${n} шт.)`,
  clearHistoryLogs: (n) => `• журнал событий (${n} записей)`,
  clearHistoryCounters: '• счётчики сводки (всего/OK/пропуск/ошибка)',
  clearHistoryIrreversible: 'Это действие нельзя отменить.',
  clearHistoryAlsoCookies: 'Также удалить YouTube cookies',
  clearAll: 'Очистить всё',
  toastEnterUrl: 'Введите URL',
  toastEnterUrlDesc: 'Вставьте ссылку на Spotify плейлист или трек.',
  toastInvalidUrl: 'Неверный формат',
  toastInvalidUrlDesc: 'URL должен быть ссылкой Spotify на плейлист или трек.',
  toastTracksFound: (n) => `Найдено треков: ${n}`,
  toastPlaylistLoaded: 'Плейлист успешно загружен',
  albumLoaded: 'Альбом успешно загружен',
  toastTrackReceived: 'Трек получен',
  toastFetchError: 'Ошибка получения треков',
  toastRequestError: 'Ошибка запроса',
  toastTrackSkipped: 'Трек пропущен',
  toastTrackSkippedDesc: (a, t) => `${a} — ${t} — подходящая версия не найдена`,
  toastTrackDownloaded: 'Трек скачан',
  toastTrackDownloadedDesc: (a, t) => `${a} — ${t}`,
  toastDownloadFailed: 'Скачивание не удалось',
  toastBatchComplete: 'Пакетное скачивание завершено',
  toastBatchCompleteDesc: (dl, sk, fl) => `Готово: ${dl} скачано, ${sk} пропущено, ${fl} неудач.`,
  toastBatchStartError: 'Не удалось запустить пакетное скачивание',
  toastFileDeleted: 'Файл удалён',
  toastDeleteError: 'Ошибка удаления',
  toastHistoryCleared: 'История очищена',
  toastHistoryClearedDesc: 'Все скачанные файлы, архивы и журналы удалены.',
  toastClearError: 'Ошибка очистки',
  toastCookiesEmpty: 'Cookies пусты',
  toastCookiesEmptyDesc: 'Вставьте содержимое cookies.txt',
  toastCookiesInvalid: 'Неверный формат',
  toastCookiesInvalidDesc: 'Первая строка должна быть "# Netscape HTTP Cookie File"',
  toastCookiesSaved: 'Cookies сохранены',
  toastCookiesSavedDesc: 'Последующие загрузки с YouTube будут использовать их.',
  toastCookiesSaveError: 'Ошибка сохранения',
  toastCookiesDeleted: 'Cookies удалены',
  toastCookiesDeleteError: 'Ошибка удаления',
  footerTech: 'Поиск на YouTube + SoundCloud через yt-dlp · Метаданные и обложка из Spotify',
  footerPort: 'Порт оригинального SearchExtendedBot · Только для личного использования',
}

// ----------------------------------------------------------------------------
// English (US)
// ----------------------------------------------------------------------------

const enUS: Dict = {
  appTitle: 'Beatspotto',
  appSubtitle: 'Search for Extended & Original',
  urlPlaceholder: 'https://open.spotify.com/playlist/... or /album/... or /track/......',
  findTracks: 'Find tracks',
  searching: 'Searching...',
  cookies: 'Cookies',
  cookiesActive: 'Cookies configured',
  cookiesConfigure: 'Configure YouTube cookies',
  cookiesRequiredBanner: 'YouTube requires cookies for download. Got error "Sign in to confirm you\'re not a bot".',
  insertCookies: 'Insert cookies',
  tracks: 'Tracks',
  trackCount: (n) => `${n}`,
  playlistSource: 'playlist',
  albumSource: 'album',
  singleTrackSource: 'single track',
  listEmpty: 'List is empty',
  fetchingMetadata: 'Fetching metadata from Spotify...',
  enterUrlPrompt: 'Enter a URL above to load the track list',
  downloadAll: 'Download all',
  downloadingAll: 'Running...',
  download: 'Download',
  save: 'Save',
  retry: 'Retry',
  downloading: 'Loading',
  downloaded: 'OK',
  skipped: 'Skipped',
  failed: 'Failed',
  extBadge: 'EXT?',
  eventLog: 'Event log',
  online: 'online',
  offline: 'offline',
  clearLog: 'Clear log',
  logEmpty: 'Log is empty.\nPerform an action to see events.',
  downloadHistory: 'Download history',
  archiveCount: (n) => `${n}`,
  mp3Count: (n) => `${n} files`,
  mp3Label: 'MP3',
  wavLabel: 'WAV',
  refresh: 'Refresh',
  historyEmpty: 'No downloaded files yet',
  lastArchive: 'latest',
  downloadZip: 'Download ZIP',
  delete: 'Delete',
  total: 'Total',
  ok: 'OK',
  skip: 'Skip',
  error: 'Error',
  clear: 'Clear',
  batchInProgress: 'Batch...',
  settings: 'Settings',
  settingsDescription: 'Configure language, theme and download format',
  sectionGeneral: 'General',
  sectionAudio: 'Audio format',
  sectionCookies: 'YouTube Cookies',
    sectionDownloadSource: 'Download Source',
    downloadSourceAuto: 'Auto (Best available)',
    downloadSourceQobuz: 'Qobuz',
    downloadSourceTidal: 'Tidal',
    downloadSourceAmazon: 'Amazon',
    downloadSourceYoutube: 'YouTube',
  sectionSearch: 'Поиск расширенных версий',
  searchMode: 'Режим поиска',
  searchModeExtended: 'Search Extended',
  searchModeExtendedDesc: 'Для коротких треков (< 4:30) или с пометками Mixed/Cut/Radio Edit ищет Extended Mix → Original Mix → точное совпадение',
  searchModeSimple: 'Простое скачивание',
  searchModeSimpleDesc: 'Скачивает треки в исходном виде из Spotify без поиска расширенных версий',
  searchParamsTitle: 'Параметры поиска',
  searchParamsDescription: 'Тонкая настройка алгоритма поиска расширенных версий (только для режима Search Extended)',
  searchParamMaxDuration: 'Макс. длительность, сек',
  searchParamMaxDurationDesc: 'Треки короче этого значения считаются «короткими» и активируют поиск Extended Mix. По умолчанию: 270 (4:30)',
  searchParamShortKeywords: 'Ключевые слова в названии',
  searchParamShortKeywordsDesc: 'Regex-паттерн. Если название трека содержит эти слова, поиск Extended Mix активируется даже для длинных треков. По умолчанию: mixed|cut|radioedit|radio edit',
  searchParamSimilarity: 'Порог схожести названия',
  searchParamSimilarityDesc: 'Число 0..1. Результаты поиска с меньшей схожестью с «{artist} - {title} {suffix}» отклоняются. По умолчанию: 0.70',
  searchParamSuffixes: 'Суффиксы для поиска',
  searchParamSuffixesDesc: 'Суффиксы через запятую, перебираемые по порядку при поиске длинной версии. По умолчанию: Extended Mix,Original Mix',
  searchParamExistingPattern: 'Паттерн существующего суффикса',
  searchParamExistingPatternDesc: 'Regex-паттерн. Если название уже содержит эти суффиксы, поиск Extended Mix пропускается. По умолчанию: extended|original|club mix',
  searchParamRemixPattern: 'Паттерн ремикс-суффикса',
  searchParamRemixPatternDesc: 'Regex для суффиксов вида «(ArtistName Remix)». Если название содержит такой суффикс, всегда ищется версия длиннее, чем в Spotify. По умолчанию: \\([^\\)]*\\bremix\\b[^\\)]*\\)',
  resetToDefaults: 'Сбросить к значениям по умолчанию',
  searchParamsHint: 'Изменения применяются к следующему скачиванию',
  modeToggleExtended: 'Search Extended',
  modeToggleSimple: 'Простой',
  stop: 'Стоп',
  stopTitle: 'Остановить текущий поиск и скачивание',
  stopped: 'Операция остановлена пользователем',
  pickerTitle: 'Выберите версию для скачивания',
  pickerDescription: 'Не найдено версии длиннее максимальной длительности. Выберите одну из найденных версий:',
  pickerEmpty: 'Нет доступных версий для выбора',
  pickerSource: 'Источник',
  pickerDuration: 'Длительность',
  pickerSimilar: 'похоже',
  pickerMatches: 'соответствует фильтру',
  pickerDownload: 'Скачать эту версию',
  pickerCancel: 'Отмена',
  pickerNeedsPick: 'Требуется выбор',
  theme: 'Theme',
  themeDark: 'Dark',
  themeLight: 'Light',
  language: 'Interface language',
  audioFormat: 'Download format',
  audioFormatDescription: 'Choose the audio format and quality for downloaded tracks',
  mp3Title: 'MP3 320 kbps',
  mp3Desc: 'Compressed format, small size, high quality',
  wavTitle: 'WAV 16-bit 44100 Hz',
  wavDesc: 'Lossless, audio CD quality, large size',
  cookiesSectionDescription: 'Cookies are used by yt-dlp to bypass YouTube\'s "not a bot" check',
  cookiesAvailable: 'Cookies are configured and active',
  cookiesNotConfigured: 'Cookies are not configured',
  openCookiesDialog: 'Configure cookies',
  // Lossless-Core section
  sectionLosslessCore: 'Lossless-Core (metadata)',
  losslessCoreDescription: 'The built-in Lossless-Core module (analogous to the microservice from Charlotte-v2) fetches rich metadata from Spotify: album, ISRC, release date and cover art. Metadata is embedded into MP3 files as ID3v2.3 tags.',
  losslessCoreUrl: 'Lossless-Core URL',
  losslessCoreUrlDesc: 'Address of the Lossless-Core microservice, e.g. http://lossless-core:7856 or http://localhost:7856. Empty disables the integration.',
  losslessCoreUrlPlaceholder: 'http://localhost:7856',
  losslessCoreAvailable: 'Lossless-Core is active (built-in module)',
  losslessCoreNotConfigured: 'Lossless-Core is not configured',
  losslessCoreSave: 'Save URL',
  losslessCoreSaved: 'Lossless-Core URL saved',
  // 2FA section
  section2FA: 'Two-Factor Authentication (2FA)',
  twoFactorDescription: 'Protect your account with a 6-digit code from an authenticator app (Google Authenticator, Authy, etc.)',
  twoFactorEnabled: '2FA is enabled and active',
  twoFactorDisabled: '2FA is not configured',
  enable2FA: 'Enable 2FA',
  disable2FA: 'Disable 2FA',
  twoFactorSecretLabel: 'Scan the QR code or enter the secret key:',
  twoFactorCodePlaceholder: '000000',
  verifyAndEnable: 'Verify and Enable',
  // Password section
  sectionPassword: 'Change Password',
  currentPassword: 'Current Password',
  newPassword: 'New Password',
  confirmPassword: 'Confirm New Password',
  changePasswordButton: 'Change Password',
  passwordChangedSuccess: 'Password changed successfully!',
  passwordsDoNotMatch: 'Passwords do not match',
  passwordTooShort: 'Password must be between 6 and 128 characters',
  cookiesDialogTitle: 'YouTube Cookies (Netscape format)',
  cookiesDialogDescription: 'YouTube may require authentication to download some videos. Export cookies from your browser and paste them below — they will be automatically used for all subsequent downloads.',
  howToGetCookies: 'How to get cookies:',
  cookiesStep1: 'Install a browser extension to export cookies in Netscape format:',
  cookiesChromeExt: 'Chrome: "Get cookies.txt LOCALLY"',
  cookiesFirefoxExt: 'Firefox: "cookies.txt"',
  cookiesStep2: 'Sign in to your YouTube account in that browser.',
  cookiesStep3: 'Open',
  cookiesStep3Site: 'and click the extension icon.',
  cookiesStep4: 'Select "Export" → copy the file contents into the field below.',
  cookiesSecurityNote: 'Cookies are stored on the server in youtube-cookies.txt and used only by yt-dlp.',
  cookiesContentLabel: 'cookies.txt contents',
  cookiesContentPlaceholder: '# Netscape HTTP Cookie File\n# https://www.youtube.com\n.youtube.com\tTRUE\t/\tFALSE\t...\tVISITOR_INFO1_LIVE\t...',
  cookiesFirstLineHint: 'The first line must be # Netscape HTTP Cookie File',
  deleteCookies: 'Delete cookies',
  cancel: 'Cancel',
  saveBtn: 'Save',
  clearHistoryTitle: 'Clear download history?',
  clearHistoryWarning: 'The following will be permanently deleted:',
  clearHistoryFiles: (n) => `• all downloaded audio files (${n})`,
  clearHistoryArchives: (n) => `• all ZIP / tar.gz archives (${n})`,
  clearHistoryLogs: (n) => `• event log (${n} entries)`,
  clearHistoryCounters: '• summary counters (total/ok/skip/error)',
  clearHistoryIrreversible: 'This action cannot be undone.',
  clearHistoryAlsoCookies: 'Also delete YouTube cookies',
  clearAll: 'Clear all',
  toastEnterUrl: 'Enter a URL',
  toastEnterUrlDesc: 'Paste a Spotify playlist or track link.',
  toastInvalidUrl: 'Invalid format',
  toastInvalidUrlDesc: 'URL must be a Spotify playlist or track link.',
  toastTracksFound: (n) => `Found ${n} track(s)`,
  toastPlaylistLoaded: 'Playlist loaded successfully',
  albumLoaded: 'Album loaded successfully',
  toastTrackReceived: 'Track received',
  toastFetchError: 'Failed to fetch tracks',
  toastRequestError: 'Request error',
  toastTrackSkipped: 'Track skipped',
  toastTrackSkippedDesc: (a, t) => `${a} — ${t} — no matching version found`,
  toastTrackDownloaded: 'Track downloaded',
  toastTrackDownloadedDesc: (a, t) => `${a} — ${t}`,
  toastDownloadFailed: 'Download failed',
  toastBatchComplete: 'Batch download complete',
  toastBatchCompleteDesc: (dl, sk, fl) => `Done: ${dl} downloaded, ${sk} skipped, ${fl} failed.`,
  toastBatchStartError: 'Failed to start batch download',
  toastFileDeleted: 'File deleted',
  toastDeleteError: 'Delete error',
  toastHistoryCleared: 'History cleared',
  toastHistoryClearedDesc: 'All downloaded files, archives and logs have been removed.',
  toastClearError: 'Clear error',
  toastCookiesEmpty: 'Cookies are empty',
  toastCookiesEmptyDesc: 'Paste the contents of cookies.txt',
  toastCookiesInvalid: 'Invalid format',
  toastCookiesInvalidDesc: 'The first line must be "# Netscape HTTP Cookie File"',
  toastCookiesSaved: 'Cookies saved',
  toastCookiesSavedDesc: 'Subsequent YouTube downloads will use them.',
  toastCookiesSaveError: 'Save error',
  toastCookiesDeleted: 'Cookies deleted',
  toastCookiesDeleteError: 'Delete error',
  footerTech: 'Search on YouTube + SoundCloud via yt-dlp · Metadata and cover art from Spotify',
  footerPort: 'Port of the original SearchExtendedBot · For personal use only',
}

// ----------------------------------------------------------------------------
// German (Deutsch)
// ----------------------------------------------------------------------------

const de: Dict = {
  appTitle: 'Beatspotto',
  appSubtitle: 'Search for Extended & Original',
  urlPlaceholder: 'https://open.spotify.com/playlist/... oder /album/... oder /track/......',
  findTracks: 'Titel suchen',
  searching: 'Suche...',
  cookies: 'Cookies',
  cookiesActive: 'Cookies konfiguriert',
  cookiesConfigure: 'YouTube-Cookies konfigurieren',
  cookiesRequiredBanner: 'YouTube erfordert Cookies für den Download. Fehler erhalten: „Sign in to confirm you\'re not a bot".',
  insertCookies: 'Cookies einfügen',
  tracks: 'Titel',
  trackCount: (n) => `${n}`,
  playlistSource: 'Playlist',
  albumSource: 'Album',
  singleTrackSource: 'einzelner Titel',
  listEmpty: 'Liste leer',
  fetchingMetadata: 'Metadaten werden von Spotify abgerufen...',
  enterUrlPrompt: 'Geben Sie oben eine URL ein, um die Titel zu laden',
  downloadAll: 'Alle herunterladen',
  downloadingAll: 'Läuft...',
  download: 'Herunterladen',
  save: 'Speichern',
  retry: 'Wiederholen',
  downloading: 'Lädt',
  downloaded: 'OK',
  skipped: 'Übersprungen',
  failed: 'Fehler',
  extBadge: 'EXT?',
  eventLog: 'Ereignisprotokoll',
  online: 'online',
  offline: 'offline',
  clearLog: 'Protokoll löschen',
  logEmpty: 'Protokoll leer.\nFühren Sie eine Aktion aus, um Ereignisse zu sehen.',
  downloadHistory: 'Download-Verlauf',
  archiveCount: (n) => `${n}`,
  mp3Count: (n) => `${n} Dateien`,
  mp3Label: 'MP3',
  wavLabel: 'WAV',
  refresh: 'Aktualisieren',
  historyEmpty: 'Noch keine heruntergeladenen Dateien',
  lastArchive: 'neueste',
  downloadZip: 'ZIP herunterladen',
  delete: 'Löschen',
  total: 'Gesamt',
  ok: 'OK',
  skip: 'Überspr.',
  error: 'Fehler',
  clear: 'Löschen',
  batchInProgress: 'Stapel...',
  settings: 'Einstellungen',
  settingsDescription: 'Sprache, Design und Download-Format konfigurieren',
  sectionGeneral: 'Allgemein',
  sectionAudio: 'Audioformat',
  sectionCookies: 'YouTube-Cookies',
    sectionDownloadSource: 'Download-Quelle',
    downloadSourceAuto: 'Auto (Beste verfügbar)',
    downloadSourceQobuz: 'Qobuz',
    downloadSourceTidal: 'Tidal',
    downloadSourceAmazon: 'Amazon',
    downloadSourceYoutube: 'YouTube',
  sectionSearch: 'Suche nach erweiterten Versionen',
  searchMode: 'Suchmodus',
  searchModeExtended: 'Search Extended',
  searchModeExtendedDesc: 'Sucht für kurze Titel (< 4:30) oder mit Mixed/Cut/Radio Edit Markierungen nach Extended Mix → Original Mix → exakte Übereinstimmung',
  searchModeSimple: 'Einfacher Download',
  searchModeSimpleDesc: 'Lädt Titel in der Originalversion von Spotify herunter, ohne erweiterte Versionen zu suchen',
  searchParamsTitle: 'Suchparameter',
  searchParamsDescription: 'Feinabstimmung des Suchalgorithmus (nur für Search Extended Modus)',
  searchParamMaxDuration: 'Max. Dauer, Sek.',
  searchParamMaxDurationDesc: 'Titel kürzer als dieser Wert gelten als „kurz" und lösen die Extended-Mix-Suche aus. Standard: 270 (4:30)',
  searchParamShortKeywords: 'Schlüsselwörter im Titel',
  searchParamShortKeywordsDesc: 'Regex-Muster. Wenn der Titel diese Wörter enthält, wird die Extended-Mix-Suche auch für lange Titel ausgelöst. Standard: mixed|cut|radioedit|radio edit',
  searchParamSimilarity: 'Ähnlichkeitsschwelle',
  searchParamSimilarityDesc: 'Zahl 0..1. Suchergebnisse mit geringerer Ähnlichkeit mit „{artist} - {title} {suffix}" werden abgelehnt. Standard: 0.70',
  searchParamSuffixes: 'Suffixe für die Suche',
  searchParamSuffixesDesc: 'Komma-getrennte Suffixe, die der Reihe nach bei der Suche nach einer längeren Version ausprobiert werden. Standard: Extended Mix,Original Mix',
  searchParamExistingPattern: 'Muster für vorhandenes Suffix',
  searchParamExistingPatternDesc: 'Regex-Muster. Wenn der Titel bereits diese Suffixe enthält, wird die Extended-Mix-Suche übersprungen. Standard: extended|original|club mix',
  searchParamRemixPattern: 'Remix-Suffix-Muster',
  searchParamRemixPatternDesc: 'Regex für Suffixe der Form «(ArtistName Remix)». Wenn der Titel ein solches Suffix enthält, wird immer nach einer längeren Version als auf Spotify gesucht. Standard: \\([^\\)]*\\bremix\\b[^\\)]*\\)',
  resetToDefaults: 'Auf Standardwerte zurücksetzen',
  searchParamsHint: 'Änderungen gelten für den nächsten Download',
  modeToggleExtended: 'Search Extended',
  modeToggleSimple: 'Einfach',
  stop: 'Stopp',
  stopTitle: 'Aktuelle Suche und Download stoppen',
  stopped: 'Vom Benutzer gestoppt',
  pickerTitle: 'Version für Download wählen',
  pickerDescription: 'Keine Version länger als die maximale Dauer gefunden. Wählen Sie eine der gefundenen Versionen:',
  pickerEmpty: 'Keine Versionen zur Auswahl verfügbar',
  pickerSource: 'Quelle',
  pickerDuration: 'Dauer',
  pickerSimilar: 'ähnlich',
  pickerMatches: 'entspricht Filter',
  pickerDownload: 'Diese Version herunterladen',
  pickerCancel: 'Abbrechen',
  pickerNeedsPick: 'Auswahl erforderlich',
  theme: 'Design',
  themeDark: 'Dunkel',
  themeLight: 'Hell',
  language: 'Oberflächensprache',
  audioFormat: 'Download-Format',
  audioFormatDescription: 'Wählen Sie das Audioformat und die Qualität für heruntergeladene Titel',
  mp3Title: 'MP3 320 kbps',
  mp3Desc: 'Komprimiertes Format, geringe Größe, hohe Qualität',
  wavTitle: 'WAV 16-bit 44100 Hz',
  wavDesc: 'Verlustfrei, Audio-CD-Qualität, große Dateigröße',
  cookiesSectionDescription: 'Cookies werden von yt-dlp verwendet, um YouTubes „Kein Bot"-Prüfung zu umgehen',
  cookiesAvailable: 'Cookies sind konfiguriert und aktiv',
  cookiesNotConfigured: 'Cookies sind nicht konfiguriert',
  openCookiesDialog: 'Cookies konfigurieren',
  // Lossless-Core section
  sectionLosslessCore: 'Lossless-Core (Metadaten)',
  losslessCoreDescription: 'Das eingebaute Lossless-Core-Modul (Analog zum Microservice aus Charlotte-v2) ruft erweiterte Metadaten von Spotify ab: Album, ISRC, Veröffentlichungsdatum und Cover. Metadaten werden als ID3v2.3 in MP3 eingebettet.',
  losslessCoreUrl: 'Lossless-Core URL',
  losslessCoreUrlDesc: 'Adresse des Lossless-Core-Microservice, z.B. http://lossless-core:7856 oder http://localhost:7856. Leer deaktiviert die Integration.',
  losslessCoreUrlPlaceholder: 'http://localhost:7856',
  losslessCoreAvailable: 'Lossless-Core ist aktiv (eingebautes Modul)',
  losslessCoreNotConfigured: 'Lossless-Core ist nicht konfiguriert',
  losslessCoreSave: 'URL speichern',
  losslessCoreSaved: 'Lossless-Core URL gespeichert',
  // 2FA section
  section2FA: 'Zwei-Faktor-Authentifizierung (2FA)',
  twoFactorDescription: 'Schützen Sie Ihr Konto mit einem 6-stelligen Code aus einer Authentifikator-App (Google Authenticator, Authy etc.)',
  twoFactorEnabled: '2FA ist aktiviert und aktiv',
  twoFactorDisabled: '2FA ist nicht konfiguriert',
  enable2FA: '2FA aktivieren',
  disable2FA: '2FA deaktivieren',
  twoFactorSecretLabel: 'Scannen Sie den QR-Code oder geben Sie den geheimen Schlüssel ein:',
  twoFactorCodePlaceholder: '000000',
  verifyAndEnable: 'Bestätigen und aktivieren',
  // Password section
  sectionPassword: 'Passwort ändern',
  currentPassword: 'Aktuelles Passwort',
  newPassword: 'Neues Passwort',
  confirmPassword: 'Neues Passwort bestätigen',
  changePasswordButton: 'Passwort ändern',
  passwordChangedSuccess: 'Passwort erfolgreich geändert!',
  passwordsDoNotMatch: 'Passwörter stimmen nicht überein',
  passwordTooShort: 'Passwort muss zwischen 6 und 128 Zeichen lang sein',
  cookiesDialogTitle: 'YouTube-Cookies (Netscape-Format)',
  cookiesDialogDescription: 'YouTube kann für den Download einiger Videos eine Authentifizierung verlangen. Exportieren Sie Cookies aus Ihrem Browser und fügen Sie sie unten ein — sie werden automatisch für alle nachfolgenden Downloads verwendet.',
  howToGetCookies: 'So erhalten Sie Cookies:',
  cookiesStep1: 'Installieren Sie eine Browser-Erweiterung zum Exportieren von Cookies im Netscape-Format:',
  cookiesChromeExt: 'Chrome: „Get cookies.txt LOCALLY"',
  cookiesFirefoxExt: 'Firefox: „cookies.txt"',
  cookiesStep2: 'Melden Sie sich in diesem Browser bei Ihrem YouTube-Konto an.',
  cookiesStep3: 'Öffnen Sie',
  cookiesStep3Site: 'und klicken Sie auf das Erweiterungssymbol.',
  cookiesStep4: 'Wählen Sie „Export" → kopieren Sie den Dateiinhalt in das Feld unten.',
  cookiesSecurityNote: 'Cookies werden auf dem Server in youtube-cookies.txt gespeichert und nur von yt-dlp verwendet.',
  cookiesContentLabel: 'Inhalt der cookies.txt',
  cookiesContentPlaceholder: '# Netscape HTTP Cookie File\n# https://www.youtube.com\n.youtube.com\tTRUE\t/\tFALSE\t...\tVISITOR_INFO1_LIVE\t...',
  cookiesFirstLineHint: 'Die erste Zeile muss # Netscape HTTP Cookie File sein',
  deleteCookies: 'Cookies löschen',
  cancel: 'Abbrechen',
  saveBtn: 'Speichern',
  clearHistoryTitle: 'Download-Verlauf löschen?',
  clearHistoryWarning: 'Folgendes wird dauerhaft gelöscht:',
  clearHistoryFiles: (n) => `• alle heruntergeladenen Audiodateien (${n})`,
  clearHistoryArchives: (n) => `• alle ZIP-/tar.gz-Archive (${n})`,
  clearHistoryLogs: (n) => `• Ereignisprotokoll (${n} Einträge)`,
  clearHistoryCounters: '• Zusammenfassungszähler (Gesamt/OK/Überspr./Fehler)',
  clearHistoryIrreversible: 'Diese Aktion kann nicht rückgängig gemacht werden.',
  clearHistoryAlsoCookies: 'Auch YouTube-Cookies löschen',
  clearAll: 'Alles löschen',
  toastEnterUrl: 'URL eingeben',
  toastEnterUrlDesc: 'Fügen Sie einen Spotify-Playlist- oder Titel-Link ein.',
  toastInvalidUrl: 'Ungültiges Format',
  toastInvalidUrlDesc: 'URL muss ein Spotify-Playlist- oder Titel-Link sein.',
  toastTracksFound: (n) => `${n} Titel gefunden`,
  toastPlaylistLoaded: 'Playlist erfolgreich geladen',
  albumLoaded: 'Album erfolgreich geladen',
  toastTrackReceived: 'Titel erhalten',
  toastFetchError: 'Fehler beim Abrufen der Titel',
  toastRequestError: 'Anfragefehler',
  toastTrackSkipped: 'Titel übersprungen',
  toastTrackSkippedDesc: (a, t) => `${a} — ${t} — keine passende Version gefunden`,
  toastTrackDownloaded: 'Titel heruntergeladen',
  toastTrackDownloadedDesc: (a, t) => `${a} — ${t}`,
  toastDownloadFailed: 'Download fehlgeschlagen',
  toastBatchComplete: 'Stapel-Download abgeschlossen',
  toastBatchCompleteDesc: (dl, sk, fl) => `Fertig: ${dl} heruntergeladen, ${sk} übersprungen, ${fl} fehlgeschlagen.`,
  toastBatchStartError: 'Stapel-Download konnte nicht gestartet werden',
  toastFileDeleted: 'Datei gelöscht',
  toastDeleteError: 'Löschen fehlgeschlagen',
  toastHistoryCleared: 'Verlauf gelöscht',
  toastHistoryClearedDesc: 'Alle heruntergeladenen Dateien, Archive und Protokolle wurden entfernt.',
  toastClearError: 'Fehler beim Löschen',
  toastCookiesEmpty: 'Cookies sind leer',
  toastCookiesEmptyDesc: 'Fügen Sie den Inhalt der cookies.txt ein',
  toastCookiesInvalid: 'Ungültiges Format',
  toastCookiesInvalidDesc: 'Die erste Zeile muss „# Netscape HTTP Cookie File" sein',
  toastCookiesSaved: 'Cookies gespeichert',
  toastCookiesSavedDesc: 'Nachfolgende YouTube-Downloads werden sie verwenden.',
  toastCookiesSaveError: 'Fehler beim Speichern',
  toastCookiesDeleted: 'Cookies gelöscht',
  toastCookiesDeleteError: 'Fehler beim Löschen',
  footerTech: 'Suche auf YouTube + SoundCloud via yt-dlp · Metadaten und Cover von Spotify',
  footerPort: 'Port des ursprünglichen SearchExtendedBot · Nur für persönliche Nutzung',
}

// ----------------------------------------------------------------------------
// Ukrainian (Українська)
// ----------------------------------------------------------------------------

const uk: Dict = {
  appTitle: 'Beatspotto',
  appSubtitle: 'Search for Extended & Original',
  urlPlaceholder: 'https://open.spotify.com/playlist/... або /album/... або /track/......',
  findTracks: 'Знайти треки',
  searching: 'Пошук...',
  cookies: 'Cookies',
  cookiesActive: 'Cookies налаштовано',
  cookiesConfigure: 'Налаштувати YouTube cookies',
  cookiesRequiredBanner: 'YouTube потребує cookies для завантаження. Отримано помилку «Sign in to confirm you\'re not a bot».',
  insertCookies: 'Вставити cookies',
  tracks: 'Треки',
  trackCount: (n) => `${n}`,
  playlistSource: 'плейлист',
  albumSource: 'альбом',
  singleTrackSource: 'окремий трек',
  listEmpty: 'Список порожній',
  fetchingMetadata: 'Отримання метаданих з Spotify...',
  enterUrlPrompt: 'Введіть URL вище, щоб завантажити список треків',
  downloadAll: 'Завантажити все',
  downloadingAll: 'Йде...',
  download: 'Завантажити',
  save: 'Зберегти',
  retry: 'Повтор',
  downloading: 'Завантаження',
  downloaded: 'OK',
  skipped: 'Пропуск',
  failed: 'Помилка',
  extBadge: 'EXT?',
  eventLog: 'Журнал подій',
  online: 'online',
  offline: 'offline',
  clearLog: 'Очистити журнал',
  logEmpty: 'Журнал порожній.\nВиконайте дію, щоб побачити події.',
  downloadHistory: 'Історія завантажень',
  archiveCount: (n) => `${n}`,
  mp3Count: (n) => `${n} файлів`,
  mp3Label: 'MP3',
  wavLabel: 'WAV',
  refresh: 'Оновити',
  historyEmpty: 'Поки що немає завантажених файлів',
  lastArchive: 'останній',
  downloadZip: 'Завантажити ZIP',
  delete: 'Видалити',
  total: 'Всього',
  ok: 'OK',
  skip: 'Пропуск',
  error: 'Помилка',
  clear: 'Очистити',
  batchInProgress: 'Пакет...',
  settings: 'Налаштування',
  settingsDescription: 'Налаштуйте мову, тему та формат завантаження',
  sectionGeneral: 'Загальні',
  sectionAudio: 'Аудіо формат',
  sectionCookies: 'YouTube Cookies',
    sectionDownloadSource: 'Download Source',
    downloadSourceAuto: 'Auto (Best available)',
    downloadSourceQobuz: 'Qobuz',
    downloadSourceTidal: 'Tidal',
    downloadSourceAmazon: 'Amazon',
    downloadSourceYoutube: 'YouTube',
  sectionSearch: 'Поиск расширенных версий',
  searchMode: 'Режим поиска',
  searchModeExtended: 'Search Extended',
  searchModeExtendedDesc: 'Для коротких треков (< 4:30) или с пометками Mixed/Cut/Radio Edit ищет Extended Mix → Original Mix → точное совпадение',
  searchModeSimple: 'Простое скачивание',
  searchModeSimpleDesc: 'Скачивает треки в исходном виде из Spotify без поиска расширенных версий',
  searchParamsTitle: 'Параметры поиска',
  searchParamsDescription: 'Тонкая настройка алгоритма поиска расширенных версий (только для режима Search Extended)',
  searchParamMaxDuration: 'Макс. длительность, сек',
  searchParamMaxDurationDesc: 'Треки короче этого значения считаются «короткими» и активируют поиск Extended Mix. По умолчанию: 270 (4:30)',
  searchParamShortKeywords: 'Ключевые слова в названии',
  searchParamShortKeywordsDesc: 'Regex-паттерн. Если название трека содержит эти слова, поиск Extended Mix активируется даже для длинных треков. По умолчанию: mixed|cut|radioedit|radio edit',
  searchParamSimilarity: 'Порог схожести названия',
  searchParamSimilarityDesc: 'Число 0..1. Результаты поиска с меньшей схожестью с «{artist} - {title} {suffix}» отклоняются. По умолчанию: 0.70',
  searchParamSuffixes: 'Суффиксы для поиска',
  searchParamSuffixesDesc: 'Суффиксы через запятую, перебираемые по порядку при поиске длинной версии. По умолчанию: Extended Mix,Original Mix',
  searchParamExistingPattern: 'Паттерн существующего суффикса',
  searchParamExistingPatternDesc: 'Regex-паттерн. Если название уже содержит эти суффиксы, поиск Extended Mix пропускается. По умолчанию: extended|original|club mix',
  searchParamRemixPattern: 'Паттерн ремикс-суффикса',
  searchParamRemixPatternDesc: 'Regex для суффиксов вида «(ArtistName Remix)». Если название содержит такой суффикс, всегда ищется версия длиннее, чем в Spotify. По умолчанию: \\([^\\)]*\\bremix\\b[^\\)]*\\)',
  resetToDefaults: 'Сбросить к значениям по умолчанию',
  searchParamsHint: 'Изменения применяются к следующему скачиванию',
  modeToggleExtended: 'Search Extended',
  modeToggleSimple: 'Простой',
  stop: 'Стоп',
  stopTitle: 'Остановить текущий поиск и скачивание',
  stopped: 'Операция остановлена пользователем',
  pickerTitle: 'Выберите версию для скачивания',
  pickerDescription: 'Не найдено версии длиннее максимальной длительности. Выберите одну из найденных версий:',
  pickerEmpty: 'Нет доступных версий для выбора',
  pickerSource: 'Источник',
  pickerDuration: 'Длительность',
  pickerSimilar: 'похоже',
  pickerMatches: 'соответствует фильтру',
  pickerDownload: 'Скачать эту версию',
  pickerCancel: 'Отмена',
  pickerNeedsPick: 'Требуется выбор',
  theme: 'Тема оформлення',
  themeDark: 'Темна',
  themeLight: 'Світла',
  language: 'Мова інтерфейсу',
  audioFormat: 'Формат завантаження',
  audioFormatDescription: 'Оберіть формат та якість аудіо для завантажуваних треків',
  mp3Title: 'MP3 320 kbps',
  mp3Desc: 'Стиснутий формат, малий розмір, висока якість',
  wavTitle: 'WAV 16-bit 44100 Hz',
  wavDesc: 'Без втрат, аудіо CD-якість, великий розмір',
  cookiesSectionDescription: 'Cookies використовуються yt-dlp для обходу перевірки «не бот» на YouTube',
  cookiesAvailable: 'Cookies налаштовані та активні',
  cookiesNotConfigured: 'Cookies не налаштовані',
  openCookiesDialog: 'Налаштувати cookies',
  // Lossless-Core section
  sectionLosslessCore: 'Lossless-Core (метадані)',
  losslessCoreDescription: 'Вбудований модуль Lossless-Core (аналог мікросервісу з Charlotte-v2) запитує розширені метадані зі Spotify: альбом, ISRC, дату релізу та обкладинку. Метадані вбудовуються в MP3 у стандарті ID3v2.3.',
  losslessCoreUrl: 'URL Lossless-Core',
  losslessCoreUrlDesc: 'Адреса мікросервісу Lossless-Core, наприклад http://lossless-core:7856 або http://localhost:7856. Порожнє значення вимикає інтеграцію.',
  losslessCoreUrlPlaceholder: 'http://localhost:7856',
  losslessCoreAvailable: 'Lossless-Core активний (вбудований модуль)',
  losslessCoreNotConfigured: 'Lossless-Core не налаштований',
  losslessCoreSave: 'Зберегти URL',
  losslessCoreSaved: 'URL Lossless-Core збережено',
  // 2FA section
  section2FA: 'Двофакторна автентифікація (2FA)',
  twoFactorDescription: 'Захистіть свій акаунт 6-значним кодом із додатка-аутентифікатора (Google Authenticator, Authy тощо)',
  twoFactorEnabled: '2FA увімкнено та активно',
  twoFactorDisabled: '2FA не налаштовано',
  enable2FA: 'Увімкнути 2FA',
  disable2FA: 'Вимкнути 2FA',
  twoFactorSecretLabel: 'Відскануйте QR-код або введіть секретний ключ:',
  twoFactorCodePlaceholder: '000000',
  verifyAndEnable: 'Підтвердити та увімкнути',
  // Password section
  sectionPassword: 'Зміна пароля',
  currentPassword: 'Поточний пароль',
  newPassword: 'Новий пароль',
  confirmPassword: 'Підтвердіть новий пароль',
  changePasswordButton: 'Змінити пароль',
  passwordChangedSuccess: 'Пароль успішно змінено!',
  passwordsDoNotMatch: 'Паролі не збігаються',
  passwordTooShort: 'Пароль має бути від 6 до 128 символів',
  cookiesDialogTitle: 'YouTube Cookies (Netscape формат)',
  cookiesDialogDescription: 'YouTube може вимагати авторизацію для завантаження деяких відео. Експортуйте cookies з браузера та вставте їх нижче — вони будуть автоматично використовуватись для всіх наступних завантажень.',
  howToGetCookies: 'Як отримати cookies:',
  cookiesStep1: 'Встановіть розширення браузера для експорту cookies у форматі Netscape:',
  cookiesChromeExt: 'Chrome: «Get cookies.txt LOCALLY»',
  cookiesFirefoxExt: 'Firefox: «cookies.txt»',
  cookiesStep2: 'Увійдіть у свій акаунт YouTube у цьому браузері.',
  cookiesStep3: 'Відкрийте',
  cookiesStep3Site: 'та натисніть на іконку розширення.',
  cookiesStep4: 'Оберіть «Export» → скопіюйте вміст файлу у поле нижче.',
  cookiesSecurityNote: 'Cookies зберігаються на сервері у файлі youtube-cookies.txt та використовуються лише yt-dlp.',
  cookiesContentLabel: 'Вміст cookies.txt',
  cookiesContentPlaceholder: '# Netscape HTTP Cookie File\n# https://www.youtube.com\n.youtube.com\tTRUE\t/\tFALSE\t...\tVISITOR_INFO1_LIVE\t...',
  cookiesFirstLineHint: 'Перший рядок має бути # Netscape HTTP Cookie File',
  deleteCookies: 'Видалити cookies',
  cancel: 'Скасувати',
  saveBtn: 'Зберегти',
  clearHistoryTitle: 'Очистити історію завантажень?',
  clearHistoryWarning: 'Буде безповоротно видалено:',
  clearHistoryFiles: (n) => `• всі завантажені аудіо файли (${n} шт.)`,
  clearHistoryArchives: (n) => `• всі ZIP / tar.gz архіви (${n} шт.)`,
  clearHistoryLogs: (n) => `• журнал подій (${n} записів)`,
  clearHistoryCounters: '• лічильники підсумку (всього/OK/пропуск/помилка)',
  clearHistoryIrreversible: 'Цю дію не можна скасувати.',
  clearHistoryAlsoCookies: 'Також видалити YouTube cookies',
  clearAll: 'Очистити все',
  toastEnterUrl: 'Введіть URL',
  toastEnterUrlDesc: 'Вставте посилання на Spotify плейлист або трек.',
  toastInvalidUrl: 'Невірний формат',
  toastInvalidUrlDesc: 'URL має бути посиланням Spotify на плейлист або трек.',
  toastTracksFound: (n) => `Знайдено треків: ${n}`,
  toastPlaylistLoaded: 'Плейлист успішно завантажено',
  albumLoaded: 'Альбом успішно завантажено',
  toastTrackReceived: 'Трек отримано',
  toastFetchError: 'Помилка отримання треків',
  toastRequestError: 'Помилка запиту',
  toastTrackSkipped: 'Трек пропущено',
  toastTrackSkippedDesc: (a, t) => `${a} — ${t} — відповідну версію не знайдено`,
  toastTrackDownloaded: 'Трек завантажено',
  toastTrackDownloadedDesc: (a, t) => `${a} — ${t}`,
  toastDownloadFailed: 'Завантаження не вдалось',
  toastBatchComplete: 'Пакетне завантаження завершено',
  toastBatchCompleteDesc: (dl, sk, fl) => `Готово: ${dl} завантажено, ${sk} пропущено, ${fl} невдало.`,
  toastBatchStartError: 'Не вдалось запустити пакетне завантаження',
  toastFileDeleted: 'Файл видалено',
  toastDeleteError: 'Помилка видалення',
  toastHistoryCleared: 'Історію очищено',
  toastHistoryClearedDesc: 'Всі завантажені файли, архіви та журнали видалено.',
  toastClearError: 'Помилка очищення',
  toastCookiesEmpty: 'Cookies порожні',
  toastCookiesEmptyDesc: 'Вставте вміст cookies.txt',
  toastCookiesInvalid: 'Невірний формат',
  toastCookiesInvalidDesc: 'Перший рядок має бути «# Netscape HTTP Cookie File»',
  toastCookiesSaved: 'Cookies збережено',
  toastCookiesSavedDesc: 'Наступні завантаження з YouTube будуть їх використовувати.',
  toastCookiesSaveError: 'Помилка збереження',
  toastCookiesDeleted: 'Cookies видалено',
  toastCookiesDeleteError: 'Помилка видалення',
  footerTech: 'Пошук на YouTube + SoundCloud через yt-dlp · Метадані та обкладинка з Spotify',
  footerPort: 'Порт оригінального SearchExtendedBot · Тільки для особистого використання',
}

// ----------------------------------------------------------------------------
// French (Français)
// ----------------------------------------------------------------------------

const fr: Dict = {
  appTitle: 'Beatspotto',
  appSubtitle: 'Search for Extended & Original',
  urlPlaceholder: 'https://open.spotify.com/playlist/... ou /album/... ou /track/......',
  findTracks: 'Rechercher des pistes',
  searching: 'Recherche...',
  cookies: 'Cookies',
  cookiesActive: 'Cookies configurés',
  cookiesConfigure: 'Configurer les cookies YouTube',
  cookiesRequiredBanner: 'YouTube nécessite des cookies pour le téléchargement. Erreur reçue : « Sign in to confirm you\'re not a bot ».',
  insertCookies: 'Insérer les cookies',
  tracks: 'Pistes',
  trackCount: (n) => `${n}`,
  playlistSource: 'playlist',
  albumSource: 'album',
  singleTrackSource: 'piste unique',
  listEmpty: 'Liste vide',
  fetchingMetadata: 'Récupération des métadonnées depuis Spotify...',
  enterUrlPrompt: 'Saisissez une URL ci-dessus pour charger la liste des pistes',
  downloadAll: 'Tout télécharger',
  downloadingAll: 'En cours...',
  download: 'Télécharger',
  save: 'Enregistrer',
  retry: 'Réessayer',
  downloading: 'Chargement',
  downloaded: 'OK',
  skipped: 'Ignoré',
  failed: 'Échec',
  extBadge: 'EXT?',
  eventLog: 'Journal d\'événements',
  online: 'en ligne',
  offline: 'hors ligne',
  clearLog: 'Effacer le journal',
  logEmpty: 'Journal vide.\nEffectuez une action pour voir les événements.',
  downloadHistory: 'Historique de téléchargement',
  archiveCount: (n) => `${n}`,
  mp3Count: (n) => `${n} fichiers`,
  mp3Label: 'MP3',
  wavLabel: 'WAV',
  refresh: 'Actualiser',
  historyEmpty: 'Aucun fichier téléchargé pour le moment',
  lastArchive: 'dernier',
  downloadZip: 'Télécharger ZIP',
  delete: 'Supprimer',
  total: 'Total',
  ok: 'OK',
  skip: 'Ignoré',
  error: 'Erreur',
  clear: 'Effacer',
  batchInProgress: 'Lot...',
  settings: 'Paramètres',
  settingsDescription: 'Configurer la langue, le thème et le format de téléchargement',
  sectionGeneral: 'Général',
  sectionAudio: 'Format audio',
  sectionCookies: 'Cookies YouTube',
    sectionDownloadSource: 'Source de Téléchargement',
    downloadSourceAuto: 'Auto (Meilleur disponible)',
    downloadSourceQobuz: 'Qobuz',
    downloadSourceTidal: 'Tidal',
    downloadSourceAmazon: 'Amazon',
    downloadSourceYoutube: 'YouTube',
  sectionSearch: 'Recherche de versions étendues',
  searchMode: 'Mode de recherche',
  searchModeExtended: 'Search Extended',
  searchModeExtendedDesc: 'Pour les pistes courtes (< 4:30) ou avec mention Mixed/Cut/Radio Edit, cherche Extended Mix → Original Mix → correspondance exacte',
  searchModeSimple: 'Téléchargement simple',
  searchModeSimpleDesc: 'Télécharge les pistes telles quelles depuis Spotify sans rechercher de versions étendues',
  searchParamsTitle: 'Paramètres de recherche',
  searchParamsDescription: 'Réglage fin de l\'algorithme de recherche (mode Search Extended uniquement)',
  searchParamMaxDuration: 'Durée max, sec',
  searchParamMaxDurationDesc: 'Les pistes plus courtes que cette valeur sont considérées comme « courtes » et déclenchent la recherche Extended Mix. Par défaut : 270 (4:30)',
  searchParamShortKeywords: 'Mots-clés dans le titre',
  searchParamShortKeywordsDesc: 'Motif regex. Si le titre contient ces mots, la recherche Extended Mix est déclenchée même pour les pistes longues. Par défaut : mixed|cut|radioedit|radio edit',
  searchParamSimilarity: 'Seuil de similarité',
  searchParamSimilarityDesc: 'Nombre 0..1. Les résultats dont la similarité avec « {artist} - {title} {suffix} » est inférieure sont rejetés. Par défaut : 0.70',
  searchParamSuffixes: 'Suffixes de recherche',
  searchParamSuffixesDesc: 'Suffixes séparés par virgule, essayés dans l\'ordre lors de la recherche d\'une version plus longue. Par défaut : Extended Mix,Original Mix',
  searchParamExistingPattern: 'Motif de suffixe existant',
  searchParamExistingPatternDesc: 'Motif regex. Si le titre contient déjà ces suffixes, la recherche Extended Mix est ignorée. Par défaut : extended|original|club mix',
  searchParamRemixPattern: 'Motif de suffixe remix',
  searchParamRemixPatternDesc: 'Regex pour les suffixes de la forme « (ArtistName Remix) ». Si le titre contient un tel suffixe, une version plus longue que sur Spotify est toujours recherchée. Par défaut : \\([^\\)]*\\bremix\\b[^\\)]*\\)',
  resetToDefaults: 'Réinitialiser aux valeurs par défaut',
  searchParamsHint: 'Les modifications s\'appliquent au prochain téléchargement',
  modeToggleExtended: 'Search Extended',
  modeToggleSimple: 'Simple',
  stop: 'Arrêter',
  stopTitle: 'Arrêter la recherche et le téléchargement en cours',
  stopped: 'Opération arrêtée par l\'utilisateur',
  pickerTitle: 'Choisir une version à télécharger',
  pickerDescription: 'Aucune version plus longue que la durée maximale trouvée. Choisissez l\'une des versions trouvées :',
  pickerEmpty: 'Aucune version disponible à la sélection',
  pickerSource: 'Source',
  pickerDuration: 'Durée',
  pickerSimilar: 'similaire',
  pickerMatches: 'correspond au filtre',
  pickerDownload: 'Télécharger cette version',
  pickerCancel: 'Annuler',
  pickerNeedsPick: 'Sélection requise',
  theme: 'Thème',
  themeDark: 'Sombre',
  themeLight: 'Clair',
  language: 'Langue de l\'interface',
  audioFormat: 'Format de téléchargement',
  audioFormatDescription: 'Choisissez le format et la qualité audio pour les pistes téléchargées',
  mp3Title: 'MP3 320 kbps',
  mp3Desc: 'Format compressé, petite taille, haute qualité',
  wavTitle: 'WAV 16-bit 44100 Hz',
  wavDesc: 'Sans perte, qualité audio CD, grande taille',
  cookiesSectionDescription: 'Les cookies sont utilisés par yt-dlp pour contourner la vérification « pas un bot » de YouTube',
  cookiesAvailable: 'Les cookies sont configurés et actifs',
  cookiesNotConfigured: 'Les cookies ne sont pas configurés',
  openCookiesDialog: 'Configurer les cookies',
  // Lossless-Core section
  sectionLosslessCore: 'Lossless-Core (métadonnées)',
  losslessCoreDescription: 'Le module intégré Lossless-Core (analogue au microservice de Charlotte-v2) récupère des métadonnées enrichies depuis Spotify : album, ISRC, date de sortie et pochette. Les métadonnées sont intégrées au format ID3v2.3 dans les MP3.',
  losslessCoreUrl: 'URL Lossless-Core',
  losslessCoreUrlDesc: 'Adresse du microservice Lossless-Core, par ex. http://lossless-core:7856 ou http://localhost:7856. Vide désactive l\'intégration.',
  losslessCoreUrlPlaceholder: 'http://localhost:7856',
  losslessCoreAvailable: 'Lossless-Core est actif (module intégré)',
  losslessCoreNotConfigured: 'Lossless-Core n\'est pas configuré',
  losslessCoreSave: 'Enregistrer l\'URL',
  losslessCoreSaved: 'URL Lossless-Core enregistrée',
  // 2FA section
  section2FA: 'Authentification à deux facteurs (2FA)',
  twoFactorDescription: 'Protégez votre compte avec un code à 6 chiffres provenant d\'une application d\'authentification (Google Authenticator, Authy, etc.)',
  twoFactorEnabled: 'La 2FA est activée et active',
  twoFactorDisabled: 'La 2FA n\'est pas configurée',
  enable2FA: 'Activer la 2FA',
  disable2FA: 'Désactiver la 2FA',
  twoFactorSecretLabel: 'Scannez le code QR ou saisissez la clé secrète :',
  twoFactorCodePlaceholder: '000000',
  verifyAndEnable: 'Vérifier et activer',
  // Password section
  sectionPassword: 'Changer le mot de passe',
  currentPassword: 'Mot de passe actuel',
  newPassword: 'Nouveau mot de passe',
  confirmPassword: 'Confirmer le nouveau mot de passe',
  changePasswordButton: 'Changer le mot de passe',
  passwordChangedSuccess: 'Mot de passe modifié avec succès !',
  passwordsDoNotMatch: 'Les mots de passe ne correspondent pas',
  passwordTooShort: 'Le mot de passe doit contenir entre 6 et 128 caractères',
  cookiesDialogTitle: 'Cookies YouTube (format Netscape)',
  cookiesDialogDescription: 'YouTube peut nécessiter une authentification pour télécharger certaines vidéos. Exportez les cookies depuis votre navigateur et collez-les ci-dessous — ils seront automatiquement utilisés pour tous les téléchargements suivants.',
  howToGetCookies: 'Comment obtenir les cookies :',
  cookiesStep1: 'Installez une extension de navigateur pour exporter les cookies au format Netscape :',
  cookiesChromeExt: 'Chrome : « Get cookies.txt LOCALLY »',
  cookiesFirefoxExt: 'Firefox : « cookies.txt »',
  cookiesStep2: 'Connectez-vous à votre compte YouTube dans ce navigateur.',
  cookiesStep3: 'Ouvrez',
  cookiesStep3Site: 'et cliquez sur l\'icône de l\'extension.',
  cookiesStep4: 'Sélectionnez « Export » → copiez le contenu du fichier dans le champ ci-dessous.',
  cookiesSecurityNote: 'Les cookies sont stockés sur le serveur dans youtube-cookies.txt et utilisés uniquement par yt-dlp.',
  cookiesContentLabel: 'Contenu du cookies.txt',
  cookiesContentPlaceholder: '# Netscape HTTP Cookie File\n# https://www.youtube.com\n.youtube.com\tTRUE\t/\tFALSE\t...\tVISITOR_INFO1_LIVE\t...',
  cookiesFirstLineHint: 'La première ligne doit être # Netscape HTTP Cookie File',
  deleteCookies: 'Supprimer les cookies',
  cancel: 'Annuler',
  saveBtn: 'Enregistrer',
  clearHistoryTitle: 'Effacer l\'historique de téléchargement ?',
  clearHistoryWarning: 'Les éléments suivants seront définitivement supprimés :',
  clearHistoryFiles: (n) => `• tous les fichiers audio téléchargés (${n})`,
  clearHistoryArchives: (n) => `• toutes les archives ZIP / tar.gz (${n})`,
  clearHistoryLogs: (n) => `• le journal d\'événements (${n} entrées)`,
  clearHistoryCounters: '• les compteurs de synthèse (total/ok/ignoré/erreur)',
  clearHistoryIrreversible: 'Cette action ne peut pas être annulée.',
  clearHistoryAlsoCookies: 'Supprimer également les cookies YouTube',
  clearAll: 'Tout effacer',
  toastEnterUrl: 'Saisissez une URL',
  toastEnterUrlDesc: 'Collez un lien de playlist ou de piste Spotify.',
  toastInvalidUrl: 'Format invalide',
  toastInvalidUrlDesc: 'L\'URL doit être un lien de playlist ou de piste Spotify.',
  toastTracksFound: (n) => `${n} piste(s) trouvée(s)`,
  toastPlaylistLoaded: 'Playlist chargée avec succès',
  albumLoaded: 'Album chargé avec succès',
  toastTrackReceived: 'Piste reçue',
  toastFetchError: 'Échec de la récupération des pistes',
  toastRequestError: 'Erreur de requête',
  toastTrackSkipped: 'Piste ignorée',
  toastTrackSkippedDesc: (a, t) => `${a} — ${t} — aucune version correspondante trouvée`,
  toastTrackDownloaded: 'Piste téléchargée',
  toastTrackDownloadedDesc: (a, t) => `${a} — ${t}`,
  toastDownloadFailed: 'Échec du téléchargement',
  toastBatchComplete: 'Téléchargement par lot terminé',
  toastBatchCompleteDesc: (dl, sk, fl) => `Terminé : ${dl} téléchargés, ${sk} ignorés, ${fl} échoués.`,
  toastBatchStartError: 'Échec du démarrage du téléchargement par lot',
  toastFileDeleted: 'Fichier supprimé',
  toastDeleteError: 'Erreur de suppression',
  toastHistoryCleared: 'Historique effacé',
  toastHistoryClearedDesc: 'Tous les fichiers, archives et journaux téléchargés ont été supprimés.',
  toastClearError: 'Erreur d\'effacement',
  toastCookiesEmpty: 'Les cookies sont vides',
  toastCookiesEmptyDesc: 'Collez le contenu du cookies.txt',
  toastCookiesInvalid: 'Format invalide',
  toastCookiesInvalidDesc: 'La première ligne doit être « # Netscape HTTP Cookie File »',
  toastCookiesSaved: 'Cookies enregistrés',
  toastCookiesSavedDesc: 'Les prochains téléchargements YouTube les utiliseront.',
  toastCookiesSaveError: 'Erreur d\'enregistrement',
  toastCookiesDeleted: 'Cookies supprimés',
  toastCookiesDeleteError: 'Erreur de suppression',
  footerTech: 'Recherche sur YouTube + SoundCloud via yt-dlp · Métadonnées et pochette depuis Spotify',
  footerPort: 'Port du SearchExtendedBot original · Usage personnel uniquement',
}

// ----------------------------------------------------------------------------

export const dictionaries: Record<Locale, Dict> = {
  'ru': ru,
  'de': de,
  'uk': uk,
  'fr': fr,
  'en-US': enUS,
}

export function getDict(locale: Locale): Dict {
  return dictionaries[locale] ?? ru
}
