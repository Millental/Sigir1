# Каталог тест-кейсов и лог прогонов

Файл ведётся по тому же принципу, что `SESSION_LOG.md`/`REQUIREMENTS.md`: каталог кейсов —
живой и переиспользуемый (дополняется, не пересоздаётся), лог прогонов — новое сверху.

---

## Каталог тест-кейсов

Префикс `TC-P4-*` — Этап 4 (сборка презентации, `server/src/routes/presentations.ts`,
`client/src/pages/AssemblePage.tsx`). Префикс `TC-P5A-*` — Этап 5а (архивация цикла + фикс
видимости для SPEAKER, `server/src/routes/weeklyCycles.ts`, `server/src/routes/presentations.ts`,
`client/src/pages/CyclesPage.tsx`). Префикс `TC-P5B-*` — Этап 5б (блочная модель слайда
`Template.layoutKind`/`TemplateBlock`/`SlideBlockValue` + UI-конструктор шаблонов,
`server/src/routes/templates.ts`, `server/src/routes/slides.ts`, `server/src/routes/presentations.ts`,
`client/src/pages/TemplatesPage.tsx`, `client/src/pages/SlideFormPage.tsx`,
`client/src/components/slideBlocks.tsx`). Префикс `TC-P5C-*` — Этап 5в (легаси-pptx-импортёр,
`server/src/pptx/parse.ts`, `server/src/routes/pptxImport.ts`, `BlockType.CHART_IMAGE` в
`server/src/routes/slides.ts`/`templates.ts`, `client/src/pages/TemplatesPage.tsx` — кнопка
«Импортировать из pptx»). Префикс `TC-P6-*` — Этап 6 (экспорт презентации/слайда в PDF,
`server/src/pdf/browser.ts`, `server/src/utils/presentationAccess.ts`, `server/src/utils/
pdfFilename.ts`, `server/src/routes/presentationExport.ts`, `client/src/pages/PrintPage.tsx`,
`client/src/components/PresentationSlideCard.tsx`, кнопки «Скачать PDF презентации»/«Скачать слайд
(PDF)» в `client/src/pages/AssemblePage.tsx`). Категории: `positive` / `negative` / `unit` /
`integration` / `e2e`.

### `POST /api/templates` и `PATCH /api/templates/:id` — блочные шаблоны (Этап 5б)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P5B-01 | Легаси-шаблон (`layoutKind=null`) — обычный `PATCH` (`isShared`, без `blocks`) | positive(regression)/integration | Существующий dev-легаси-шаблон | ADMIN `PATCH {isShared}` | 200, `layoutKind` остаётся `null` |
| TC-P5B-11 | Создание блочного шаблона каждого из 3 `layoutKind` (QUADRANT/FINANCIAL_CHART/SIMPLE_COLUMN) с блоками всех 4 типов (включая `TABLE` с 3 колонками) | positive/integration | ADMIN | `POST /templates {layoutKind, blocks: [...]}` × 3 | 201 на каждый, `blocks.length === 4`, `layoutKind` сохранён |
| TC-P5B-12 | `TABLE` без `config.columns` | negative/integration | ADMIN | `POST {blocks:[{blockType:"TABLE", label, order}]}` (без `config`) | 400 |
| TC-P5B-13 | Блок без `label` | negative/integration | ADMIN | `POST {blocks:[{blockType:"RICH_TEXT_SECTION", label:"", order}]}` | 400 |
| TC-P5B-14 | Пустой `blocks` | negative/integration | ADMIN | `POST {layoutKind, blocks: []}` | 400 |
| TC-P5B-15 | Неизвестный `layoutKind` | negative/integration | ADMIN | `POST {layoutKind:"NOT_A_KIND", blocks:[...]}` | 400 |
| TC-P5B-16 | SPEAKER создаёт блочный шаблон | negative(role)/integration | — | SPEAKER `POST /templates {layoutKind, blocks}` | 403 |
| TC-P5B-17 | Свободное редактирование блоков ДО первого слайда (лейблы/состав) | positive/integration | Свежий блочный шаблон, 0 слайдов | ADMIN `PATCH {blocks: [...изменённые лейблы...]}` | 200, изменения применены |
| TC-P5B-18 | `layoutKind` в теле `PATCH` существующего шаблона | negative(edge)/integration | Блочный шаблон | ADMIN `PATCH {layoutKind:"SIMPLE_COLUMN", ...}` на шаблоне с `layoutKind=QUADRANT` | 200, но `layoutKind` в ответе остаётся `QUADRANT` (игнорируется, не 400) |
| TC-P5B-33 | `PATCH blocks` у шаблона, по которому уже есть ≥1 слайд | negative/integration | Блочный шаблон + 1 слайд | ADMIN `PATCH {blocks: [...]}` | 409, состав блоков не меняется |
| TC-P5B-34 | `PATCH` только `name`/`isShared` (БЕЗ ключа `blocks`) у шаблона с ≥1 слайдом | positive/integration | То же | ADMIN `PATCH {name: "..."}` | 200 — заморожен только состав блоков, не всё редактирование |
| TC-P5B-43/44 | Reorder блоков кнопками ▲▼ (эквивалент — полный `blocks`-payload с новым `order`) на неиспользуемом шаблоне | positive/integration | Блочный шаблон, 0 слайдов | ADMIN `PATCH {blocks: [...reversed order...]}` | 200, порядок блоков в ответе реально изменился |
| TC-P5B-45 | Удаление одного блока из шаблона без слайдов | positive/integration | То же | `PATCH {blocks: [...3 из 4...]}` | 200, `blocks.length === 3` |
| TC-P5B-47 | Неизвестный `blockType` (в т.ч. `CHART_IMAGE` — сознательно не входит в 5б) | negative/integration | ADMIN | `POST {blocks:[{blockType:"CHART_IMAGE", ...}]}` | 400 |
| TC-P5B-48 | `PATCH blocks` с содержимым, ИДЕНТИЧНЫМ текущему, у шаблона с ≥1 слайдом | negative(edge)/integration | Блочный шаблон + 1 слайд | ADMIN `PATCH {blocks: <тот же набор>}` | 409 — заморозка безусловная, не diff-aware (соответствует плану, не проверяет реальное изменение) |
| TC-P5B-49 | Легаси-`PATCH` с посторонним ключом `blocks` в теле | negative(edge)/integration | Легаси-шаблон | ADMIN `PATCH {isShared, blocks:[...]}` | 200, `blocks` в теле молча игнорируется (легаси-ветка вообще не читает это поле), шаблон остаётся без блоков |
| TC-P5B-50 | Блочный `PATCH` с посторонним ключом `fields` в теле | negative(edge)/integration | Блочный шаблон | ADMIN `PATCH {name, fields:[...]}` | 200, не падает, `fields` молча игнорируется |

### `POST /api/slides` и `PATCH /api/slides/:id` — блочные слайды (Этап 5б)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P5B-02/03/04 | Легаси-регрессия: создание слайда по легаси-шаблону | positive(regression)/integration | Легаси-шаблон, COLLECTING-цикл | SPEAKER `POST /slides` | 201, `fieldValues.length === fields.length`, `blockValues === []` |
| TC-P5B-05 | `PATCH {values}` на легаси-слайде | positive(regression)/integration | То же | SPEAKER `PATCH {values: [...]}` | 200 (поведение не изменилось) |
| TC-P5B-06 | `PATCH {blockValues}` на легаси-слайде | negative/integration | То же | SPEAKER `PATCH {blockValues: [...]}` | 400 |
| TC-P5B-19/20 | Создание слайда по блочному шаблону, дефолты | positive/integration | Блочный шаблон (4 блока), COLLECTING-цикл | SPEAKER `POST /slides` | 201, `blockValues.length === 4`, `fieldValues === []` |
| TC-P5B-21/22/23 | Дефолтные значения по типу блока | positive/integration | То же | Проверить `value` каждого `blockValue` | `{text:""}` (rich-text/footer), `{value:""}` (metric-tile), `{rows:[]}` (table) |
| TC-P5B-24/25 | Валидное сохранение всех 4 типов блоков разом | positive/integration | Слайд `DRAFT` по блочному шаблону | SPEAKER `PATCH {blockValues: [...]}` (текст, метрика с 4 полями, таблица 2 строки, футер) | 200, значения сохранены, таблица содержит 2 строки |
| TC-P5B-26 | `PATCH {values}` на блочном слайде | negative/integration | То же | SPEAKER `PATCH {values: [...]}` | 400 |
| TC-P5B-27 | `metric-tile` — значение не объект (строка) | negative/integration | То же | `PATCH {blockValues:[{templateBlockId, value:"not-an-object"}]}` | 400 |
| TC-P5B-28 | `table` — длина строки ≠ `config.columns.length` | negative/integration | Блок `TABLE` с 3 колонками | `PATCH {blockValues:[{..., value:{rows:[["A","B"]]}}]}` (2 ячейки вместо 3) | 400 |
| TC-P5B-29/30 | Смешанный запрос: 1 валидный + 1 невалидный `blockValue` — атомарность | negative/integration | То же | `PATCH {blockValues: [валидный, невалидный]}` | 400 целиком; повторный `GET` слайда подтверждает — валидное значение НЕ сохранено частично |
| TC-P5B-31 | Неизвестный `templateBlockId` | negative/integration | То же | `PATCH {blockValues:[{templateBlockId:"random", ...}]}` | 400 |
| TC-P5B-32 | Стабильная сериализация: повторный `PATCH` того же `metric-tile`-значения с ключами в другом порядке | positive/integration+db | Слайд с уже сохранённым `metric-tile` | `PATCH {blockValues:[{..., value:{percent,fact,plan,value} (переставлен порядок ключей)}]}` | 200; прямой запрос к БД подтверждает — `BlockValueHistory` для этого `SlideBlockValue` содержит ровно 1 запись (не 2 — ложного «изменения» из-за `JSON.stringify` не возникло) |

### Сквозной флоу и презентация (Этап 5б)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P5B-07/08/09/10 | Легаси-регрессия целиком: submit → admin добавляет в презентацию → просмотр | positive(regression)/integration | Легаси-слайд с заполненным значением | Полный цикл через API | Слот виден в `GET /presentations/cycle/:id`, реальное значение поля видно в ответе (не только факт наличия слайда) |
| TC-P5B-36/37/38/39/40/41 | Блочный флоу целиком: submit → admin добавляет в презентацию → просмотр с реальными значениями | positive/integration | Блочный слайд с заполненными rich-text/metric-tile/table | Полный цикл через API | Слот виден; `blockValues` с реальными значениями (в т.ч. 2 строки таблицы) присутствуют в ответе; `template.blocks` (4 блока) тоже присутствует — для рендера `AssemblePage` |
| TC-P5B-42 | SPEAKER видит собранную презентацию блочного цикла со значениями | positive/integration | То же | SPEAKER `GET /presentations/cycle/:id` | 200, `blockValues.length === 4` |
| TC-P5B-46 | Неавторизованный `POST /templates` | negative/integration | — | Без cookie | 401 |

### E2E (Playwright, `npx playwright@1.61.1`, прямой API без `@playwright/test`)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P5B-E01/E02 | Реальный проход конструктора: создание блочного шаблона QUADRANT со всеми 4 типами блоков через форму | positive/e2e | ADMIN залогинен, COLLECTING-цикл создан через форму `/cycles` | `/templates` → «+ Новый шаблон» → выбор `layoutKind` → добавление 4 блоков (`RICH_TEXT_SECTION`, `METRIC_TILE`, `TABLE` с 3 колонками, `FOOTER_STATS`) → «Сохранить шаблон» | Шаблон появляется в списке без бейджа «легаси» |
| TC-P5B-E03 | Кнопка ▲ в конструкторе реально переупорядочивает блоки | positive/e2e | Только что созданный шаблон, выбран в списке | Клик ▲ на втором блоке | Первый блок в форме меняется на ранее второй |
| TC-P5B-E04..E08 | Спикерская форма: заполнение rich-text/metric-tile/table (добавление 2 строк)/footer с live-превью, сохранение | positive/e2e | SPEAKER залогинен (создан через API — в клиенте нет `UsersPage`), выбраны цикл+шаблон | Заполнить все поля формы → сверить live-превью → «Сохранить» | Превью отражает введённые значения в реальном времени; после «Сохранить» — текст «Сохранено» |
| TC-P5B-E09 | Отправка блочного слайда на проверку | positive/e2e | То же, слайд сохранён | Клик «Отправить на проверку» | Статус-бейдж меняется на «На проверке» |
| TC-P5B-E10/E11/E12 | Заморозка в UI конструктора после первого слайда | positive/e2e | Шаблон только что использован в TC-P5B-E04..E09 | ADMIN открывает тот же шаблон в `/templates` | Баннер «Заморожено», все 4 `<select>` типа блока задизейблены, кнопка «+ Добавить блок» скрыта |
| TC-P5B-E13 | Переименование замороженного шаблона (без состава блоков) через реальную форму | positive/e2e | То же | Изменить «Название» → «Сохранить шаблон» | Сохраняется без 409-ошибки в UI (клиент не шлёт `blocks` при заморозке) |
| TC-P5B-E14 | `ReviewPage` показывает реальные значения блоков (не только факт наличия слайда) | positive/e2e | Слайд `SUBMITTED` по блочному шаблону | ADMIN → `/review` → выбрать цикл | Текст введённых блоков виден на экране проверки |
| TC-P5B-E15/E16 | `AssemblePage` показывает реальные значения блоков собранного слайда | positive/e2e | Слайд принят и добавлен в презентацию | ADMIN → `/presentation` → выбрать цикл → «Добавить» | Значения rich-text/metric-tile/table видны на карточке слота (не только имя спикера/шаблона) |

### Unit / статическая проверка типов (Этап 5б)

| ID | Название | Категория | Шаги | Ожидаемый результат |
|---|---|---|---|---|
| TC-P5B-U01 | `tsc --noEmit` чистый после правок Этапа 5б | unit | `npx tsc --noEmit` в `server/` и в `client/` | Без ошибок |

### `POST /api/pptx-import/parse` — импортёр pptx (Этап 5в)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P5C-01 | SPEAKER вызывает разбор pptx | negative(role)/integration | — | SPEAKER `POST /pptx-import/parse` (multipart, реальный файл) | 403 |
| TC-P5C-02 | Запрос без файла | negative/integration | ADMIN | `POST /pptx-import/parse` без `file` в `FormData` | 400 |
| TC-P5C-03 | Файл не `.pptx` (`.txt`) | negative/integration | ADMIN | `POST` с `notes.txt` (`text/plain`) | 400 |
| TC-P5C-04 | Файл больше лимита (21 МБ > 20 МБ) | negative/integration | ADMIN | `POST` с файлом-заглушкой 21 МБ | 400 (не 500 — отдельный 4-аргументный error-мидлварь на `MulterError` перехватывает раньше общего хендлера), тело ответа — валидный JSON с `error` |
| TC-P5C-05 | Реальный `референс общей презентации.pptx` (16 слайдов) | positive/integration | ADMIN | `POST /pptx-import/parse` с реальным файлом из корня репозитория | 200, `slides.length === 16` |
| TC-P5C-06 | Эвристика `proposeTemplate` на реальных слайдах референса | positive/integration | Результат TC-P5C-05 | Проверить `layoutKind`/блоки слайдов 1,2,3,4,7,9,10,11,14 (1-индексация) | Слайды 7/9/11/14 → `QUADRANT`; слайды 2/3/4/10 → `FINANCIAL_CHART`; слайд 10 (живые OOXML-чарты) даёт `CHART_IMAGE`-блоки БЕЗ `previewImageBase64`; слайды 1/9 (растровые картинки) дают `CHART_IMAGE` С `previewImageBase64` — полностью совпадает с планом (`crispy-stirring-cherny.md`) |
| TC-P5C-07 | Создание реального шаблона из предложенных блоков одного импортированного слайда | positive/integration | Результат TC-P5C-05 | `POST /api/templates {name, isShared, layoutKind, blocks}` (блоки взяты из ответа импортёра, `previewImageBase64` НЕ передаётся дальше — служебное поле только для UI) | 201, шаблон создан, состав блоков совпадает с предложенным |

### `CHART_IMAGE` — round-trip на слайде (Этап 5в)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P5C-08 | Создание слайда спикером по шаблону с `CHART_IMAGE`-блоком | positive/integration | Шаблон из TC-P5C-07 (с `CHART_IMAGE`-блоком), COLLECTING-цикл | SPEAKER `POST /slides` | 201, `blockValues` содержит запись для `CHART_IMAGE`-блока со значением ровно `{path: null}` |
| TC-P5C-09 | `PATCH` с непустым `path` для `CHART_IMAGE`-блока | negative/integration | Слайд из TC-P5C-08 | SPEAKER `PATCH {blockValues:[{templateBlockId: <chart-image>, value:{path:"somewhere.png"}}]}` | 400 |
| TC-P5C-10 | **Критический кейс**: `PATCH` с НЕИЗМЕНЁННЫМ `{path:null}` для `CHART_IMAGE` вместе с реальным изменением другого блока того же слайда | positive/integration | Слайд из TC-P5C-08 | SPEAKER `PATCH {blockValues:[{chart-image, value:{path:null}}, {другой блок, value:<новое>}]}` | 200; изменение другого блока реально сохранилось; `CHART_IMAGE`-значение осталось `{path:null}` — без этого сохранение любого слайда с `chart-image`-блоком было бы сломано (см. план) |
| TC-P5C-11 | Заморозка шаблона, созданного из импорта, после первого слайда | negative/integration | Слайд из TC-P5C-08 отправлен (`submit`) | ADMIN `PATCH /templates/:id {blocks:[...]}` на том же шаблоне | 409 — подчиняется тем же правилам заморозки блочных шаблонов Этапа 5б, импортное происхождение шаблона роли не играет |

### Регрессия и инфраструктура (Этап 5в)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P5C-12 | Регрессия: ручное (не через импорт) создание/правка блочного шаблона через API | positive(regression)/integration | ADMIN | `POST /api/templates {blocks:[{blockType:"RICH_TEXT_SECTION",...}]}`, затем `PATCH {blocks:[...]}` | 201, затем 200 — поведение Этапа 5б не изменилось |
| TC-P5C-13 | Регрессия: легаси-шаблон (`layoutKind=null`) `PATCH isShared` после появления `CHART_IMAGE` в схеме | positive(regression)/integration | Существующий dev-легаси-шаблон | ADMIN `PATCH {isShared}` | 200, `layoutKind` остаётся `null` |
| TC-P5C-14 | [ИНФОРМАЦИОННО] Ручное создание `CHART_IMAGE`-блока через `POST /api/templates` в обход UI-конструктора | positive(edge)/integration | ADMIN | `POST {blocks:[{blockType:"CHART_IMAGE", label:"...", order:0}]}` напрямую (без импорта) | 201 — сервер НЕ запрещает это (решение «`chart-image` — только результат импортёра» реализовано только ограничением UI-селектора в `TemplatesPage.tsx`, не серверной валидацией); это ожидаемо по плану, не баг, но стоит иметь в виду как поверхность для прямого API-обхода |
| TC-P5C-15 | Нет побочных файлов/директорий на диске после серии загрузок pptx | positive/integration | Несколько загрузок через API (TC-P5C-04/05) и через UI (TC-P5C-E02) в рамках одного прогона | Просмотр содержимого `server/` (`find` без `node_modules`) после прогона | Ни одной новой директории вида `uploads/`/`tmp/` — вся обработка в памяти, как заявлено в плане |

### E2E (Playwright, `npx playwright@1.61.1` из scratch-каталога, прямой API без `@playwright/test`) — Этап 5в

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P5C-E01/E02 | Реальная загрузка референс-файла через `<input type="file">` | positive/e2e | ADMIN залогинен, `/templates` | `fileInput.setInputFiles(<путь к референсу>)` | Список предложений слайдов появляется, ровно 16 пунктов |
| TC-P5C-E03..E06 | Выбор слайда-образца (слайд 1, растровые картинки) реально предзаполняет форму конструктора | positive/e2e | То же | Клик по пункту «Слайд 1: …» | `#layoutKind` получает валидное значение, блоки формы заполнены (5 строк), у `CHART_IMAGE`-строк реально отображается `<img class="chart-image-preview">` (не заглушка) |
| TC-P5C-E07/E08 | Сохранение импортированного шаблона через реальную форму | positive/e2e | То же, введено название | Клик «Сохранить шаблон» | Без баннера ошибки, шаблон появляется в списке слева |
| TC-P5C-E09/E10 | Регрессия: обычное ручное создание блочного шаблона (без импорта) через ту же форму по-прежнему работает | positive(regression)/e2e | То же | «+ Новый шаблон» → выбрать `layoutKind` → заполнить один блок вручную → «Сохранить шаблон» | Без ошибки, шаблон появляется в списке |

### `POST /api/weekly-cycles/:id/archive` (Этап 5а)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P5A-01 | SPEAKER вызывает архивацию | negative(role)/integration | — | SPEAKER `POST .../archive` | 403 |
| TC-P5A-02 | Архивация `COLLECTING`-цикла (нет презентации) | negative/integration | Свежий цикл без презентации | ADMIN `POST .../archive` | 409 |
| TC-P5A-03 | Архивация несуществующего цикла | negative/integration | — | ADMIN `POST /weekly-cycles/<random-uuid>/archive` | 404 |
| TC-P5A-03b | Архивация с заведомо не-UUID id в пути | negative/integration | — | ADMIN `POST /weekly-cycles/not-a-valid-id-at-all/archive` | 404 (не 500, `findUnique` по произвольной строке просто не находит запись — в схеме `id` не имеет строгого формата) |
| TC-P5A-04 | **Архивация `ASSEMBLED`-цикла БЕЗ реальной презентации** (реальная dev-данная — «2026-W30 (UI test)», статус `ASSEMBLED`, `presentation: null`) | negative(edge)/integration | Цикл уже существовал в БД в этом рассинхронизированном состоянии до начала прогона (не создан этим прогоном) | ADMIN `POST .../archive` | 409, статус цикла не меняется |
| TC-P5A-05 | Архивация реально собранной презентации (`ASSEMBLED` + `presentation` существует) | positive/integration | Цикл собран через полный флоу (спикер → submit → админ добавляет слайд) | ADMIN `POST .../archive` | 200; `status → ARCHIVED`; в `auditLogEntry` — запись `CYCLE_ARCHIVE` с верным `targetId`/`userId` |
| TC-P5A-06 | Повторная архивация уже `ARCHIVED`-цикла | negative/integration | Цикл из TC-P5A-05 | ADMIN `POST .../archive` ещё раз | 409, не 200 и не падение |
| TC-P5A-06b | Неавторизованный запрос | negative/integration | Нет cookie | `POST .../archive` без сессии | 401 |

### `PATCH /api/weekly-cycles/:id` (Этап 5а — доработка гарда статуса)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P5A-07 | Тело содержит `status` (попытка выставить `ARCHIVED` напрямую) | negative/integration | ADMIN | `PATCH {status: "ARCHIVED"}` | 400 |
| TC-P5A-07b | Тело содержит `status` со значением, СОВПАДающим с текущим (`COLLECTING`→`COLLECTING`) | negative/integration | ADMIN, цикл уже `COLLECTING` | `PATCH {status: "COLLECTING"}` | 400 (гард срабатывает по самому наличию поля `status` в теле, не по факту смены значения) |
| TC-P5A-08 | Обычное редактирование `weekLabel` БЕЗ поля `status` | positive/integration | ADMIN | `PATCH {weekLabel: "..."}` | 200, изменение сохранено (регрессия — редактирование дат/названия не должно было сломаться) |
| TC-P5A-09 | SPEAKER вызывает `PATCH` цикла | negative(role)/integration | — | SPEAKER `PATCH {weekLabel: "hacked"}` | 403 |

### Видимость для роли SPEAKER (Этап 5а)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P5A-10 | ADMIN видит `ARCHIVED`-циклы в общем списке | positive/integration | Известный `ARCHIVED`-цикл «2026-W29» (данные Этапа 4) | ADMIN `GET /weekly-cycles` | В ответе есть цикл «2026-W29» |
| TC-P5A-11 | ADMIN видит только что заархивированный цикл | positive/integration | Цикл из TC-P5A-05 | ADMIN `GET /weekly-cycles` | Цикл присутствует, `status: ARCHIVED` |
| TC-P5A-12 | SPEAKER НЕ видит известный `ARCHIVED`-цикл «2026-W29» | negative/integration | — | SPEAKER `GET /weekly-cycles` | Цикл «2026-W29» отсутствует в ответе |
| TC-P5A-13 | SPEAKER НЕ видит только что заархивированный цикл | negative/integration | Цикл из TC-P5A-05 | SPEAKER `GET /weekly-cycles` | Отсутствует в ответе |
| TC-P5A-14 | SPEAKER по-прежнему видит `COLLECTING`-цикл (регрессия) | positive/integration | Свежий `COLLECTING`-цикл | SPEAKER `GET /weekly-cycles` | Цикл присутствует |
| TC-P5A-15 | Точный подсчёт: длина списка SPEAKER == длина списка ADMIN минус число `ARCHIVED` | positive/integration | — | Сравнить оба списка по количеству | Совпадает |
| TC-P5A-16 | SPEAKER GET презентации известного `ARCHIVED`-цикла («2026-W29») напрямую по id (в обход UI) | negative/integration | — | SPEAKER `GET /presentations/cycle/<id 2026-W29>` | 403 |
| TC-P5A-17 | ADMIN GET презентации того же `ARCHIVED`-цикла | positive/integration | — | ADMIN `GET /presentations/cycle/<id 2026-W29>` | 200 (поведение для ADMIN не изменилось) |
| TC-P5A-18 | SPEAKER GET презентации только что заархивированного цикла | negative/integration | Цикл из TC-P5A-05 | SPEAKER `GET /presentations/cycle/:id` | 403 |
| TC-P5A-19 | ADMIN GET презентации только что заархивированного цикла | positive/integration | Цикл из TC-P5A-05 | ADMIN `GET /presentations/cycle/:id` | 200, содержимое слотов видно |
| TC-P5A-20 | SPEAKER GET презентации `COLLECTING`-цикла (не архивного) без презентации | positive/integration | Свежий `COLLECTING`-цикл | SPEAKER `GET /presentations/cycle/:id` | 200, `presentation: null` (правило скрытия касается только `ARCHIVED`, не любого «нет презентации») |
| TC-P5A-21 | **Регрессия**: полный цикл заполнения слайда спикером всё ещё работает | positive/integration | Свежий `COLLECTING`-цикл | SPEAKER создаёт слайд → `PATCH` значения → `submit` | 200 на каждом шаге, финальный статус `SUBMITTED` |

### E2E (Playwright, `npx playwright@1.61.1` из scratch-каталога, прямой API без `@playwright/test`)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P5A-E01 | ADMIN архивирует собранный цикл кнопкой «В архив» на `/cycles` | positive/e2e | Свежий `ASSEMBLED`-цикл с реальной презентацией (создан через API до теста) | Логин ADMIN → `/cycles` → строка со статусом «Собран» и кнопкой «В архив» → клик | Бейдж меняется на «Архив», кнопка «В архив» исчезает с этой строки, состояние переживает `page.reload()` (не только оптимистичное локальное состояние) |
| TC-P5A-E02 | SPEAKER не видит архивированный (только что) цикл в выпадающих списках | positive/e2e | Цикл из TC-P5A-E01 | Логин SPEAKER (владелец слайда в этом цикле) → `/presentation` и `/slides` | Цикл отсутствует в `#cycle option` на обеих страницах |
| TC-P5A-E03 | SPEAKER в обход UI напрямую дёргает API архивной презентации | negative/e2e | То же | Прямой `fetch` с cookie сессии SPEAKER на `/presentations/cycle/:id` архивного цикла | 403 |
| TC-P5A-E04 | ADMIN пытается заархивировать `ASSEMBLED`-цикл без реальной презентации через реальный клик (не только API) | negative(edge)/e2e | Известная dev-запись «2026-W30 (UI test)» (`ASSEMBLED`, `presentation: null`) | Логин ADMIN → `/cycles` → клик «В архив» на этой строке | Ошибка показана в `.error-text` («Архивировать можно только уже собранную презентацию»), бейдж остаётся «Собран», кнопка «В архив» никуда не девается — без падения страницы и без «тихого» ложного успеха |

### Unit / статическая проверка типов (Этап 5а)

| ID | Название | Категория | Шаги | Ожидаемый результат |
|---|---|---|---|---|
| TC-P5A-U01 | `tsc --noEmit` чистый после правок Этапа 5а | unit | `npx tsc --noEmit` в `server/` и в `client/` | Без ошибок (в проекте по-прежнему нет unit-фреймворка, конвенция — typecheck как минимальная проверка) |

### `GET /api/presentations/cycle/:weeklyCycleId`

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P4-01 | Неавторизованный GET | negative/integration | — | GET без cookie | 401 |
| TC-P4-02 | GET несуществующего цикла | negative/integration | Валидный админ-токен | GET `/cycle/<random-uuid>` | 404 |
| TC-P4-03 | Частичная сборка — кандидаты только SUBMITTED | positive/integration | Цикл с 2 `SUBMITTED` + 1 `DRAFT` слайдом, презентация ещё не собрана | Админ GET `/cycle/:id` | `presentation: null`, `candidateSlides` содержит ровно 2 `SUBMITTED`-слайда, `DRAFT` не попал |
| TC-P4-04 | Спикер не видит кандидатов | negative(role)/integration | Тот же цикл | Спикер (владелец одного из слайдов) GET `/cycle/:id` | 200, `candidateSlides === []` всегда, даже если у спикера есть `SUBMITTED`-слайды |
| TC-P4-05 | Просмотр презентации спикером, не участвующим в цикле | positive/integration | Собранная презентация цикла | Спикер без единого слайда в этом цикле делает GET | 200, видит `presentation` со слотами (просмотр открыт всем авторизованным по критерию приёмки №8) |

### `POST /api/presentations/cycle/:weeklyCycleId/slides`

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P4-06 | Без `slideId` в теле | negative/integration | Админ | `POST {}` | 400 |
| TC-P4-07 | Несуществующий `slideId` | negative/integration | Админ | `POST {slideId: <random-uuid>}` | 404 |
| TC-P4-08 | **Слайд из ЧУЖОГО цикла** | negative/integration | Слайд `SUBMITTED` в цикле B, эндпоинт вызван для цикла A | `POST /cycle/A/slides {slideId: <slide-of-cycle-B>}` | 404 «Слайд не найден в этом цикле» (не 200, не 500) |
| TC-P4-09 | Слайд ещё `DRAFT` | negative/integration | Неотправленный слайд в цикле | `POST {slideId: <draft-slide>}` | 403 «не готов к включению» |
| TC-P4-10 | Спикер вызывает добавление | negative(role)/integration | — | Спикер `POST /cycle/:id/slides` | 403 |
| TC-P4-11 | Первое добавление слайда — сборка презентации | positive/integration | Цикл `COLLECTING`, есть `SUBMITTED` слайд, презентации ещё нет | Админ добавляет слайд | 201; `WeeklyCycle.status → ASSEMBLED`; слайд → `IN_PRESENTATION`; в аудит-логе `PRESENTATION_ASSEMBLE` + `PRESENTATION_SLIDE_ADD` (по одной записи) |
| TC-P4-12 | **Повторное добавление уже `IN_PRESENTATION` слайда** | negative/integration | Слайд уже в презентации (из TC-P4-11) | Тот же `POST` ещё раз | 403 (не 500) — фильтр `status !== SUBMITTED` срабатывает верно |
| TC-P4-13 | Второе добавление другого слайда — без дублирования сборки | positive/integration | Презентация цикла уже существует | Добавить второй `SUBMITTED`-слайд | 201; в аудит-логе НЕТ второго `PRESENTATION_ASSEMBLE`, `Presentation.id` тот же |
| TC-P4-14 | **[БАГ, см. лог] Гонка: два одновременных первых добавления в один и тот же ещё не собранный цикл** | negative/integration | Свежий цикл без презентации, ≥1 `SUBMITTED` слайд | Два параллельных `POST .../slides` (разные админ-сессии, `Promise.all`) на один и тот же **свежий** цикл | Ожидание: один запрос 201, другой — предсказуемая ошибка (403/409), сервер не падает. **Факт**: сервер аварийно завершается (см. «Найденные дефекты» ниже) |

### `POST /api/presentations/cycle/:weeklyCycleId/placeholders`

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P4-15 | Пустая строка `label` | negative/integration | Админ | `POST {label: ""}` | 400 |
| TC-P4-16 | `label` из одних пробелов | negative/integration | Админ | `POST {label: "   "}` | 400 |
| TC-P4-17 | `label` отсутствует в теле | negative/integration | Админ | `POST {}` | 400 |
| TC-P4-18 | `label` не строка (число) | negative/integration | Админ | `POST {label: 123}` | 400 |
| TC-P4-19 | Спикер вызывает добавление заглушки | negative(role)/integration | — | Спикер `POST` | 403 |
| TC-P4-20 | Несуществующий цикл | negative/integration | Админ | `POST /cycle/<random-uuid>/placeholders` | 404 |
| TC-P4-21 | Валидная заглушка, кириллица, обрезка пробелов | positive/integration+e2e | Админ | `POST {label: "  Ivanov placeholder  "}` (curl/fetch) и отдельно кириллица через реальную форму (Playwright `page.fill`) | 201; сохранённый `placeholderLabel` = строка без краевых пробелов; кириллица через форму рендерится корректно |

### `PATCH /api/presentations/cycle/:weeklyCycleId/order`

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P4-22 | Валидный полный реордер | positive/integration+e2e | Презентация с ≥2 слотами | `PATCH {order: [id2, id1]}` (полная перестановка), затем повторный `GET` | 200; порядок сохранён и переживает рефетч/перезагрузку страницы |
| TC-P4-23 | Неполный список (пропущен id) | negative/integration | То же | `PATCH {order: [id1]}` при 2 слотах | 400 |
| TC-P4-24 | Лишний/несуществующий id в списке | negative/integration | То же | `PATCH {order: [...ids, randomUuid]}` | 400 |
| TC-P4-25 | `order` — не массив | negative/integration | То же | `PATCH {order: "not-an-array"}` | 400 |
| TC-P4-26 | Элемент массива не строка | negative/integration | То же | `PATCH {order: [id1, 123]}` | 400 |
| TC-P4-27 | Спикер вызывает reorder | negative(role)/integration | — | Спикер `PATCH` | 403 |
| TC-P4-28 | Reorder для цикла без презентации | negative/integration | Цикл без `Presentation` | `PATCH /cycle/:id/order {order: []}` | 404 «Презентация ещё не собрана» |
| TC-P4-29 | **`order` содержит id слота из ДРУГОЙ презентации** (то же количество элементов) | negative/integration | Две разные презентации (циклы A и B) | В `order` для цикла A подставить один id слота из презентации B вместо одного из id A | 400 (валидация по множеству текущих id срабатывает верно) |
| TC-P4-30 | `order` с дублирующимся id при неизменной длине массива (замена одного id дубликатом другого) | negative/integration | Презентация с 3 слотами | `PATCH {order: [A, A, C]}` (пропущен B, длина массива = 3, совпадает с числом слотов) | 400 — проверено, размер `Set` перестаёт совпадать с текущим количеством слотов, валидация ловит корректно |
| TC-P4-30b | **[БАГ, см. лог] `order` длиннее числа слотов, но с тем же множеством уникальных id** | negative/integration | Презентация с 3 слотами `A,B,C` | `PATCH {order: [A, A, B, C]}` (4 элемента вместо 3, `A` продублирован) | Ожидание: 400 (массив должен быть перестановкой ровно текущих слотов, один id — один раз). **Факт**: 200, запрос принят; итоговые `order` слотов — `1,2,3` вместо `0,1,2` (см. «Найденные дефекты») |

### `DELETE /api/presentations/slots/:presentationSlideId`

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P4-31 | Удаление слота с реальным слайдом | positive/integration | Слот с `slideId` в презентации | `DELETE /slots/:id` | 200; слайд → `SUBMITTED`; `WeeklyCycle.status` НЕ откатывается (остаётся `ASSEMBLED`); аудит `PRESENTATION_SLIDE_REMOVE` |
| TC-P4-32 | Удаление слота-заглушки | positive/integration | Слот без `slideId` | `DELETE /slots/:id` | 200; аудит `PRESENTATION_PLACEHOLDER_REMOVE`, никакой `Slide` не тронут |
| TC-P4-33 | Несуществующий слот | negative/integration | — | `DELETE /slots/<random-uuid>` | 404 |
| TC-P4-34 | Спикер вызывает удаление | negative(role)/integration | — | Спикер `DELETE` | 403 |
| TC-P4-35 | Повторное удаление того же слота | negative/integration | Слот уже удалён (TC-P4-31) | `DELETE` тем же id ещё раз | 404 на второй вызов |
| TC-P4-36 | Повторное добавление ранее удалённого слайда | positive/integration | Слайд вернулся в `SUBMITTED` после TC-P4-31 | Снова `POST .../slides` с тем же `slideId` | 201; слайд снова кандидат (виден в `candidateSlides` до добавления), попадает в КОНЕЦ списка (новый `order`, не на старую позицию) — ожидаемое поведение, не баг |

### Смежные гарды (уже существовали, важны для критериев приёмки Этапа 4)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P4-37 | Спикер не может править `IN_PRESENTATION`-слайд | negative/integration | Слайд в презентации | Спикер `PATCH /slides/:id {values:[]}` | 403 |
| TC-P4-38 | Спикер не может повторно отправить `IN_PRESENTATION`-слайд | negative/integration | То же | Спикер `POST /slides/:id/submit` | 403 |
| TC-P4-39 | Спикер не может создать новый слайд в `ASSEMBLED`-цикле | negative/integration | Цикл `ASSEMBLED` | Спикер `POST /slides {weeklyCycleId, templateId}` (новая комбинация владелец+шаблон) | 403 «Цикл закрыт для заполнения» |

### Граничные наблюдения (не баги Этапа 4, зафиксированы как известные ограничения)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат / факт |
|---|---|---|---|---|---|
| TC-P4-40 | `ARCHIVED`-цикл не защищён от сборки | negative(edge)/integration | Цикл вручную переведён в `ARCHIVED` через `PATCH /weekly-cycles/:id` | Админ добавляет `SUBMITTED`-слайд/заглушку в `ARCHIVED`-цикл | Факт: 201, действие проходит без проверки статуса цикла. `ARCHIVED` явно припарковано вне рамок Этапа 4 (REQUIREMENTS.md), поэтому не считается регрессией Этапа 4 — фиксируется как задел на будущий этап, где `ARCHIVED` получит полноценную семантику заморозки |

### E2E (Playwright, `npx playwright@1.61.1`, прямой API без `@playwright/test`)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P4-E01 | Прямой заход на `/presentation` без логина | negative/e2e | Свежий browser context | `page.goto(".../presentation")` | Редирект на `/login` |
| TC-P4-E02 | Админ: выбор цикла, кандидаты, добавление слайда кнопкой | positive/e2e | QA-цикл с 1 `SUBMITTED` слайдом | Логин → `/presentation` → выбрать цикл → «Добавить» на кандидате | Список кандидатов пуст после добавления, слот с бейджем «В презентации» появляется |
| TC-P4-E03 | Админ: заглушка с кириллицей через реальную форму | positive/e2e | То же | `page.fill('#placeholder', 'Иванов И.И. — доклад не готов (QA E2E)')` → «Добавить заглушку» | Текст рендерится корректно (не mojibake) — подтверждает, что баг кодировки в предыдущих сессиях был именно артефактом `curl -d`, а не приложения |
| TC-P4-E04 | Админ: реордер стрелкой, персистентность после перезагрузки | positive/e2e | ≥2 слота | Клик ▲ на втором слоте → сравнить порядок → `page.reload()` → выбрать цикл заново → сравнить порядок | Порядок после клика и порядок после перезагрузки совпадают |
| TC-P4-E05 | Админ: удаление слота кнопкой «Убрать» | positive/e2e | ≥1 слот | Клик «Убрать» на карточке заглушки | Количество карточек уменьшается на 1 |
| TC-P4-E06 | Спикер: read-only просмотр | positive/e2e | Тот же цикл, спикер — владелец одного из слайдов | Логин спикером → `/presentation` → выбрать цикл | Нет карточки «Готовые слайды», нет кнопок ▲▼/«Убрать», слайды видны с бейджем статуса |

### Unit / статическая проверка типов

| ID | Название | Категория | Шаги | Ожидаемый результат |
|---|---|---|---|---|
| TC-P4-U01 | `tsc --noEmit` чистый | unit | `npx tsc --noEmit` в `server/` и в `client/` | Без ошибок (в проекте нет unit-фреймворка — по конвенции проекта используется typecheck как минимальная проверка; чистая логика реордера (`moveSlot()`) тривиальна и покрыта косвенно через TC-P4-E04) |

### `GET /api/presentations/cycle/:weeklyCycleId/export.pdf` и `GET /api/presentations/slots/:slotId/export.pdf` (Этап 6)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P6-01 | ADMIN экспортирует всю презентацию `ASSEMBLED`-цикла | positive/integration | QA-цикл с 3 слотами (legacy + `FINANCIAL_CHART` + `SIMPLE_COLUMN`), собран | ADMIN `GET /cycle/:id/export.pdf` | 200, `Content-Type: application/pdf`, валидные magic bytes `%PDF-`, размер > 2 КБ |
| TC-P6-02 | SPEAKER экспортирует всю презентацию `ASSEMBLED`-цикла | positive/integration | То же | SPEAKER (не обязательно владелец слайда — просмотр открыт всем, см. TC-P4-05) `GET /cycle/:id/export.pdf` | 200, валидный PDF |
| TC-P6-03 | ADMIN экспортирует всю презентацию `ARCHIVED`-цикла (админ сохраняет доступ) | positive/integration | Цикл из TC-P6-01 заархивирован | ADMIN `GET /cycle/:id/export.pdf` | 200, валидный PDF |
| TC-P6-04 | SPEAKER экспортирует всю презентацию `ARCHIVED`-цикла | negative/integration | То же | SPEAKER `GET /cycle/:id/export.pdf` | 403, JSON `{error}`, быстрый ответ (гард срабатывает до запуска headless-браузера, не завис) |
| TC-P6-05 | SPEAKER экспортирует ОДИН слайд `ARCHIVED`-цикла | negative/integration | То же | SPEAKER `GET /slots/:slotId/export.pdf` | 403 (единое правило доступа переиспользуется обоими эндпоинтами) |
| TC-P6-06 | ADMIN экспортирует ОДИН слайд каждого вида шаблона (legacy/`FINANCIAL_CHART`/`SIMPLE_COLUMN`) | positive/integration | То же, 3 слота | ADMIN `GET /slots/:id/export.pdf` ×3 | 200 на каждый, валидный PDF |
| TC-P6-07 | ADMIN экспортирует слот-заглушку (без реального слайда) | positive/integration | Слот-заглушка в презентации | ADMIN `GET /slots/:placeholderSlotId/export.pdf` | 200, валидный PDF (не падает на `slide: null`) |
| TC-P6-08 | Без cookie | negative/integration | — | `GET /cycle/:id/export.pdf` без cookie | 401, JSON, быстрый ответ (< 1с — Playwright не запускается вообще) |
| TC-P6-09 | Мусорный (не-JWT) cookie `token` | negative/integration | — | `GET /cycle/:id/export.pdf` с `Cookie: token=garbage` | 401, быстрый ответ |
| TC-P6-10 | Несуществующий (валидный UUID) `weeklyCycleId` | negative/integration | ADMIN | `GET /cycle/<random-uuid>/export.pdf` | 404, JSON `{error}` |
| TC-P6-11 | Несуществующий `slotId` | negative/integration | ADMIN | `GET /slots/<random-uuid>/export.pdf` | 404, JSON `{error}` |
| TC-P6-12 | Не-UUID строка в пути `weeklyCycleId` | negative/integration | ADMIN | `GET /cycle/not-a-valid-id-at-all/export.pdf` | 404, не 500 |
| TC-P6-13 | Не-UUID строка в пути `slotId` | negative/integration | ADMIN | `GET /slots/not-a-valid-id-at-all/export.pdf` | 404, не 500 |
| TC-P6-14 | `COLLECTING`-цикл без собранной презентации | negative(edge)/integration | Свежий цикл, `presentation: null` | ADMIN `GET /cycle/:id/export.pdf` | Не 200/не пустой «успешный» PDF. **Факт**: 502 `{error: "Не удалось сформировать PDF"}` — см. «Найденные дефекты» в логе прогона, специфичное сообщение `/print`-страницы («Презентация ещё не собрана») теряется, статус семантически неточен (502 вместо 400/404/409), но сам по себе не падение и не ложный успех |
| TC-P6-15 | Известная в БД аномалия — `ARCHIVED`-цикл БЕЗ реальной презентации (та же рассинхронизация, что и TC-P5A-04, дата обнаружения — Этап 5а, не новая) | negative(edge)/integration | Существовавший ранее в БД цикл «2026-W29» | ADMIN `GET /cycle/:id/export.pdf` | 502 (та же ветка кода, что и TC-P6-14) — не регрессия Этапа 6, унаследованное состояние данных |
| TC-P6-16 | Concurrency — burst из 10 параллельных запросов экспорта (разные циклы/слоты) | positive/integration | Презентация с 3 слотами | `Promise.all` 10 одновременных `GET .../export.pdf` | Все 200 с валидными PDF; сервер не падает; `GET /api/health` быстро отвечает сразу после burst |
| TC-P6-17 | Content-Disposition — оба варианта имени файла, кириллица | positive/integration | `weekLabel` с кириллицей | ADMIN `GET /cycle/:id/export.pdf` | Заголовок содержит `attachment`, `filename="..."` (ASCII fallback) и `filename*=UTF-8''...`; декодированное `filename*` содержит реальный `weekLabel` |
| TC-P6-18 | Количество страниц — вся презентация | positive/integration | Презентация с N слотами | `GET /cycle/:id/export.pdf`, подсчёт страниц через `pdftotext`/эвристику `/Type /Page` | Ровно N+1 страница (N слайдов + 1 титульная) |
| TC-P6-19 | Количество страниц — один слайд | positive/integration | То же | `GET /slots/:id/export.pdf` | Ровно 1 страница, без титульной |
| TC-P6-20 | Реальное содержимое — legacy-шаблон (поля) | positive/integration | Legacy-слайд с заполненными полями | `GET /cycle/:id/export.pdf`, извлечь текст (`pdftotext -enc UTF-8`) | Реальные значения полей (включая кириллицу) присутствуют в тексте PDF |
| TC-P6-21 | Реальное содержимое — блочный шаблон `FINANCIAL_CHART` (`TABLE`+`METRIC_TILE`+`FOOTER_STATS`) | positive/integration | Слайд с заполненными блоками | То же | Строки таблицы («Январь 10 12», «Февраль 20 18»), значение метрики (`42`, план/факт/%), текст `FOOTER_STATS` — все присутствуют в тексте PDF |
| TC-P6-22 | Реальное содержимое — блочный шаблон `SIMPLE_COLUMN` (`RICH_TEXT_SECTION`+`METRIC_TILE`+`TABLE`+`FOOTER_STATS`) | positive/integration | Слайд с заполненными блоками | То же | Все 4 типа блоков с реальными значениями присутствуют в тексте PDF |

### `/print/:weeklyCycleId` — печатная страница (Этап 6)

| ID | Название | Категория | Предусловия | Шаги | Ожидаемый результат |
|---|---|---|---|---|---|
| TC-P6-E01 | SPEAKER видит обе PDF-ссылки на `/presentation` (не только ADMIN) | positive/e2e | SPEAKER залогинен, `ASSEMBLED`-цикл с 1 слотом, не архивный | `/presentation` → выбрать цикл | Ссылка «Скачать PDF презентации» и хотя бы одна «Скачать слайд (PDF)» видны; кнопки ▲▼/«Убрать» (admin-only) НЕ видны |
| TC-P6-E02 | Клик по ссылке реально даёт 200 PDF-ответ (не просто href) | positive/e2e | То же | `fetch(href, {credentials:'include'})` внутри контекста страницы | 200, `Content-Type: application/pdf`, нетривиальный размер |
| TC-P6-E03 | ADMIN по-прежнему видит admin-only кнопки рядом с новой PDF-ссылкой (регрессия) | positive(regression)/e2e | То же, ADMIN | `/presentation` → выбрать цикл | И PDF-ссылка, и кнопка «Убрать» видны одновременно |
| TC-P6-E04 | Прямой заход на `/print/:weeklyCycleId` в браузере (не через серверный Playwright-пайплайн) | positive/e2e | ADMIN залогинен, `ASSEMBLED`-цикл | `page.goto('/print/:id')` | `data-print-status="ready"`, титульная страница (`.print-title-page`) отрендерена |
| TC-P6-E05 | `/print/<bogus-id>` — несуществующий цикл | negative/e2e | ADMIN залогинен | `page.goto('/print/00000000-...')` | `data-print-status="error"`, видимое сообщение об ошибке (`.error-text`), не пустая/не сломанная страница |
| TC-P6-E06 | Регрессия: полный цикл ADMIN-редактирования на `/presentation` после рефакторинга в `PresentationSlideCard` | positive(regression)/e2e | `COLLECTING`-цикл, 1 слот уже собран, 1 `SUBMITTED`-кандидат | ADMIN: добавить кандидата → добавить заглушку → реордер ▲ → `reload()` → «Убрать» | Каждый шаг отражается в UI и переживает `reload()`; итоговое количество карточек после удаления на 1 меньше пикового |

### Unit / статическая проверка типов (Этап 6)

| ID | Название | Категория | Шаги | Ожидаемый результат |
|---|---|---|---|---|
| TC-P6-U01 | `tsc --noEmit` чистый после правок Этапа 6 | unit | `npx tsc --noEmit` в `server/` и в `client/` | Без ошибок |

---

## Лог прогонов

### 2026-07-20 — Независимая проверка Этапа 6 (экспорт презентации/слайда в PDF) — 1 незначительный дефект (неточный HTTP-статус/потеря сообщения на бизнес-ошибке), функциональных дефектов не найдено

**Что проверялось:** независимо от основной сессии реализации (которая уже сделала первый проход —
API + Playwright smoke-check) прогнал отдельный, более полный каталог `TC-P6-*` против реализации
Этапа 6 (требования — `REQUIREMENTS.md`, запись «Этап 6: сбор требований», раздел «Ответы на
открытые вопросы»; план — `C:\Users\mille\.claude\plans\purring-popping-plum.md`). На момент
проверки изменения ещё не закоммичены (`git status`: изменения в ожидаемых файлах —
`server/src/pdf/browser.ts` (новый), `server/src/utils/presentationAccess.ts` (новый, вынесенная
логика доступа), `server/src/utils/pdfFilename.ts` (новый), `server/src/routes/
presentationExport.ts` (новый), `server/src/app.ts`, `server/src/routes/presentations.ts`,
`server/package.json`/`package-lock.json`, `client/src/pages/PrintPage.tsx` (новый), `client/src/
components/PresentationSlideCard.tsx` (новый, вынесенный из `AssemblePage.tsx`), `client/src/pages/
AssemblePage.tsx`, `client/src/api/client.ts`, `client/src/App.tsx`, `client/src/styles.css`,
`README.md`, без посторонних правок).

**Окружение:** оба dev-сервера уже были подняты (`server` :4000, `client` :5173 на `127.0.0.1`).
Интеграционные тесты — Node `fetch` со встроенным cookie-jar (не `curl -d`, см.
[[feedback-curl-cyrillic-encoding]]). E2E — Playwright `chromium` (`playwright@1.61.1` из
`server/node_modules`, браузер уже закэширован, переустановки не потребовалось, см.
[[feedback-playwright-fallback]]). Содержимое сгенерированных PDF проверял не только по количеству
страниц (эвристика `/Type /Page`), но и по РЕАЛЬНОМУ ИЗВЛЕЧЁННОМУ ТЕКСТУ через `pdftotext -enc
UTF-8 -layout` (найден в комплекте Git for Windows, `C:\Program Files\Git\mingw64\bin\
pdftotext.exe`) — не поверил на слово, что текст блоков/полей реально попадает в PDF, а не просто
«рендерится в браузере без ошибок».

**Тестовые данные:** создал отдельный QA-цикл `2026-НеделяQA-PDF-<ts>` (кириллица в `weekLabel`
специально — для проверки Content-Disposition) с тремя слотами: legacy-шаблон («Отчёт по проекту» —
известный мойджибейк-баг названия из Этапа 5б/5в, не трогал), `FINANCIAL_CHART`-шаблон
(`TABLE`+`METRIC_TILE`+`FOOTER_STATS`) и `SIMPLE_COLUMN`-шаблон (все 4 типа блоков) — оба блочных
шаблона реально заполнены (таблица 2 строки, метрика 4 поля, текстовые блоки с кириллицей), т.к. в
существовавших dev-данных не нашлось НИ ОДНОЙ уже собранной презентации с `FINANCIAL_CHART`/
`SIMPLE_COLUMN`-слайдами (только `QUADRANT` и legacy) — пришлось создавать заново, а не переиспользовать.
Отдельно — второй QA-цикл `2026-QA-P6-UI-<ts>` (не архивировался, для e2e-регрессии редактирования и
проверки видимости ссылок обеим ролям) с 2 слайдами (1 в презентации + 1 кандидат) на разных
шаблонах. Плюс 2 новых спикера (`qa.speaker.p6.<ts>`, `qa.speaker.p6b.<ts>`).

**Результат: 41+9+5 = 55 интеграционных ассертов (`test_p6_integration.mjs` + `test_p6_filename.mjs`
+ `test_p6_extra.mjs`) и 18 e2e-ассертов (`test_p6_e2e.cjs`) — 73 PASS, 1 FAIL (не функциональный
баг реализации Этапа 6, а неточность кода ошибок — см. «Найденный дефект» ниже) + `tsc --noEmit`
чистый в обоих пакетах.**

1. **Матрица доступа — полностью по плану, на обоих эндпоинтах.** ADMIN на `ASSEMBLED` → 200
   (TC-P6-01/06). SPEAKER на `ASSEMBLED` (в т.ч. НЕ владелец ни одного слайда цикла — правило «просмотр
   открыт всем авторизованным», унаследованное из Этапа 4) → 200 (TC-P6-02, доп. проверка «non-owner
   speaker export» в `test_p6_extra.mjs`). ADMIN на `ARCHIVED` (после архивации того же QA-цикла в
   процессе прогона) → 200 на обоих эндпоинтах (TC-P6-03). **SPEAKER на `ARCHIVED` → 403 JSON, БЫСТРО**
   (15 мс — подтверждает, что гард `assertPresentationReadAccess` срабатывает до того, как код вообще
   пытается достучаться до headless Chromium, TC-P6-04/05). Без cookie → 401 за 13 мс, мусорный
   (не-JWT) cookie → 401 за 16 мс — оба варианта подтверждают, что дорогой путь (запуск браузера)
   не запускается вообще на невалидной авторизации (TC-P6-08/09). Несуществующие/не-UUID
   `weeklyCycleId`/`slotId` → 404 на всех 4 комбинациях, не 500 (TC-P6-10..13). Слот-заглушка (без
   `slide`) экспортируется корректно, без падения на `slide: null` (TC-P6-07).
2. **Реальное содержимое PDF — проверено текстом, не только количеством страниц.** Извлечение через
   `pdftotext -enc UTF-8 -layout` подтвердило: legacy-поля с реальными (кириллическими) значениями
   присутствуют в тексте PDF (TC-P6-20); `FINANCIAL_CHART`-слайд — таблица с двумя реальными строками
   («Январь 10 12», «Февраль 20 18»), метрика (значение `42`, план `40`/факт `42`/`%105`), футер-бэнд
   с текстом — всё нашлось в тексте PDF (TC-P6-21); `SIMPLE_COLUMN` — все 4 типа блоков разом, включая
   `RICH_TEXT_SECTION` (TC-P6-22). Количество страниц — эвристика `/Type /Page` (не `/Type /Pages`)
   подтвердила ровно **4** страницы для презентации из 3 слотов (3 слайда + 1 титульная, TC-P6-18) и
   ровно **1** страницу для каждого из 3 одиночных экспортов слайдов, без титульной (TC-P6-19).
3. **Файловая механика — всё по плану.** `Content-Type: application/pdf`, магические байты `%PDF-`,
   размер > 2 КБ (реально ~35 КБ для 4-страничной презентации), нетривиальный. `Content-Disposition`
   содержит и ASCII fallback (`filename="export.pdf"` — специально не ASCII-совместимое базовое имя
   схлопывается в generic fallback, это ожидаемая ветка `pdfFilename.ts`, не баг), и
   `filename*=UTF-8''...`; декодировал последний вручную — реальный кириллический `weekLabel`
   (`2026-НеделяQA-PDF-...`) присутствует (TC-P6-17). Для legacy-слайда с мойджибейк-названием
   шаблона декодированное имя корректно содержит `U+FFFD`-символы вместо мусора (не крашится на
   уже испорченных данных — унаследованная проблема Этапа 5б/5в, не новая).
4. **Concurrency — burst из 10 параллельных запросов (5×whole + 5×single-slide) — сервер не падает,
   все успешны, остаётся отзывчивым.** 10 запросов заняли ~2 сек суммарно (общий Chromium-singleton,
   отдельные `BrowserContext` на запрос — судя по времени, не полностью параллельно, но и не
   сериализовано намертво); все 10 вернули 200 с валидными PDF; `GET /api/health` сразу после burst
   ответил за 9 мс (TC-P6-16).
5. **UI (Playwright) — обе ссылки видны SPEAKER, не только ADMIN; реальный fetch подтверждает 200,
   не просто href; прямой заход на `/print/:id` и на `/print/<bogus>` — оба ведут себя по плану.**
   SPEAKER на `/presentation` видит и «Скачать PDF презентации», и хотя бы одну «Скачать слайд
   (PDF)», при этом НЕ видит кнопку «Убрать» (admin-only, TC-P6-E01, скриншот
   `p6-01-speaker-presentation-links.png`). `fetch(href, {credentials:'include'})` изнутри
   браузерного контекста SPEAKER реально вернул `200`/`application/pdf`/35259 байт — не просто
   валидный `href` (TC-P6-E02). ADMIN по-прежнему видит и новую PDF-ссылку, и старые admin-only
   кнопки одновременно — регрессии в разделении прав нет (TC-P6-E03). Прямой заход на `/print/:id`
   в отдельном браузерном контексте (не через серверный Playwright-пайплайн экспорта) →
   `data-print-status="ready"`, титульная страница видна (TC-P6-E04, скриншот
   `p6-02-print-page-direct.png`). `/print/<bogus-uuid>` → `data-print-status="error"`, видимый
   текст «Цикл не найден» в `.error-text`, страница не пустая и не падает (TC-P6-E05, скриншот
   `p6-03-print-page-bogus-error.png`).
6. **Регрессия конструктора презентации после выноса `PresentationSlideCard` — полный цикл
   add/reorder/remove по-прежнему работает.** На отдельном свежем `COLLECTING`→`ASSEMBLED`-цикле:
   добавление кандидата кнопкой «Добавить» (карточек стало 2), добавление заглушки с кириллицей
   (карточек стало 3), реордер клавишей ▲ (порядок реально изменился, включая заголовки карточек —
   не просто визуальный сдвиг), состояние реордера пережило `page.reload()` (не только оптимистичное
   локальное состояние), удаление кнопкой «Убрать» (карточек снова 2) — все шаги отработали как до
   Этапа 6 (TC-P6-E06, скриншот `p6-04-admin-regression-flow.png`). `tsc --noEmit` чистый в обоих
   пакетах (TC-P6-U01).

**Найденный дефект (не исправлял, см. задание — отчёт для основной сессии):**

- **[Незначительный/умеренный] Бизнес-ошибка «презентация ещё не собрана» на экспорте PDF теряет
  своё сообщение и получает семантически неточный HTTP-статус 502 вместо специфичного 400/404/409.**
  Воспроизведение: создать свежий `COLLECTING`-цикл БЕЗ единого добавленного слайда (значит,
  `Presentation` для него ещё физически не существует в БД) → `GET /api/presentations/cycle/:id/
  export.pdf` от имени ADMIN → сервер отвечает **`502 {"error": "Не удалось сформировать PDF"}`**
  (TC-P6-14, подтверждено также на реально существовавшей в БД аномалии «2026-W29» — `ARCHIVED`-цикл
  без `Presentation`, та же рассинхронизация, что уже фиксировалась в Этапе 5а как TC-P5A-04, не
  новая проблема данных — TC-P6-15). **Источник:** `client/src/pages/PrintPage.tsx` при
  `!data.presentation` выставляет содержательное `errorMsg = "Презентация ещё не собрана"` и
  `data-print-status="error"` → `server/src/pdf/browser.ts` (`renderPresentationPdf`) корректно
  считывает это сообщение из `data-print-error` и бросает `Error("Презентация ещё не собрана")` →
  но внешний `catch` в `server/src/routes/presentationExport.ts` (оба хендлера, строки ~33-36 и
  ~68-71) ловит ЛЮБУЮ ошибку рендера одинаково — логирует и всегда отвечает жёстко закодированным
  `502 {"error": "Не удалось сформировать PDF"}`, не пробрасывая исходное сообщение и не различая
  «реальный сбой headless-браузера» (для которого 502 уместен) от «бизнес-состояние: экспортировать
  нечего» (для которого куда точнее подошёл бы 404/409, и уж точно — оригинальное сообщение
  `err.message`). **Ожидаемое:** либо отдельная явная проверка `presentation == null` ДО вызова
  Playwright (по аналогии с тем, как `GET /cycle/:weeklyCycleId` в `presentations.ts` мог бы отдавать
  осмысленный статус ещё на серверной стороне без похода в браузер), либо как минимум проброс
  `err.message` в тело ответа вместо жёсткой строки — сейчас конечный пользователь/клиентский код,
  дёрнувший ссылку на несобранную презентацию, увидит одинаковую невыразительную ошибку "Не удалось
  сформировать PDF", как и при реальном техническом сбое рендера (упавший браузер, таймаут навигации
  и т.п.), и не сможет их различить. **Влияние:** не крашится, не даёт ложный «успешный» пустой PDF
  (соответствует минимальному требованию задания «sensible error, not a crash or blank PDF»), но
  качество диагностики хуже, чем могло бы быть, и HTTP-статус вводит в заблуждение (502 обычно
  читается как «сервер сломался», а не «нечего экспортировать»). Также стоит отметить: в UI
  (`AssemblePage.tsx`) практическое влияние минимально — ссылка «Скачать PDF презентации» рендерится
  только когда `view?.presentation` уже существует на клиенте, то есть обычный пользователь через
  штатный интерфейс на этот случай физически не попадает; риск актуален только при прямом обращении
  к API/по сохранённой ссылке на цикл, который с тех пор был «разобран» (в системе пока нет такой
  операции — Этап 9 из дорожной карты) или которого изначально не существовало как собранного.
  **Не исправлял** — фиксирую для основной сессии.

  **Исправлено (2026-07-20, основная сессия):** в `GET /cycle/:weeklyCycleId/export.pdf`
  (`server/src/routes/presentationExport.ts`) добавлена явная проверка `prisma.presentation.
  findUnique({ where: { weeklyCycleId } })` сразу после проверки прав доступа и до вызова
  `renderPresentationPdf` — при отсутствии презентации сервер теперь отвечает `404 {"error":
  "Презентация ещё не собрана"}` быстро (~0.25с, без запуска Chromium), не путая этот случай с
  реальным сбоем рендера (который по-прежнему даёт `502`). Регресс-проверено: SPEAKER всё ещё
  получает `403` на `ARCHIVED`-цикле (проверка доступа выполняется раньше проверки презентации),
  обычный успешный экспорт не задет, `tsc --noEmit` чист.

**Побочные наблюдения (не баги, не влияют на приёмку):**
- Тестовый селектор в `test_p6_e2e.cjs` (`:has-text("Добавить")`) по невнимательности матчил и
  кнопку «Добавить», и «Добавить заглушку» (подстрочное совпадение в Playwright `:has-text`) —
  собственная ошибка теста, не приложения; итоговый результат клика корректен (кликался первый,
  реально нужный элемент), не переделывал, так как assert на итоговое состояние (количество карточек)
  всё равно точно проверяет результат.
- Concurrency-burst (10 запросов) занял суммарно ~2 секунды — не быстро, но и не подозрительно долго
  для 10 независимых запусков headless-навигации через общий Chromium-процесс с отдельными
  `BrowserContext`; отдельно не профилировал, не в рамках задания.

**Тестовые данные, оставшиеся в БД:** цикл `2026-НеделяQA-PDF-<ts>` (заархивирован в процессе
прогона, 3 слота — legacy/`FINANCIAL_CHART`/`SIMPLE_COLUMN`), цикл `2026-QA-P6-UI-<ts>` (остался
`ASSEMBLED`, финальный состав слотов — legacy-слайд + заглушка «QA Regression Placeholder P6»
(добавлена в TC-P6-E06, реордер поднял её выше `SIMPLE_COLUMN`-слайда, а шагом «Убрать» в том же
тесте убрался именно вернувшийся в конец списка `SIMPLE_COLUMN`-слайд, а не эта заглушка — сам
`SIMPLE_COLUMN`-слайд при этом вернулся в статус `SUBMITTED`/кандидат, не потерян) + заглушка «QA
Placeholder For Export Test» (добавлена отдельно в `test_p6_extra.mjs` для TC-P6-07, не удалялась)),
свежий пустой `COLLECTING`-цикл `2026-QA-P6-collecting-<ts>` (создан для TC-P6-14, слайдов/презентации
нет). Спикеры: `qa.speaker.p6.<ts>`, `qa.speaker.p6b.<ts>`. Ни один из этих объектов не удалял.

**Скриншоты:** `p6-01-speaker-presentation-links.png`, `p6-02-print-page-direct.png`,
`p6-03-print-page-bogus-error.png`, `p6-04-admin-regression-flow.png` — в scratch-каталоге сессии
(`C:\Users\mille\AppData\Local\Temp\claude\C--Users-mille-sigir1\
8918fd05-eb88-4c92-a213-a53c7a60faa8\scratchpad\`).

**Не сделано:** дефект выше не исправлял (не моя роль в этой сессии). Код не коммитил. Не проверял
поведение при реальном падении/убийстве Chromium-процесса посреди рендера (искусственно не воспроизводил
краш браузера) — по коду `browser.ts` есть механизм ленивого перезапуска (`isConnected()`
проверка), но отдельно эмулировать сбой не стал, вне разумного объёма независимой проверки.

---

### 2026-07-19 — Независимая проверка Этапа 5в (легаси-pptx-импортёр) — 1 незначительный UX-дефект, функциональных багов не найдено

**Что проверялось:** независимо от основной сессии реализации прогнал каталог `TC-P5C-*`
(интеграционные — 1 Node-скрипт на встроенном `fetch` + 1 короткий скрипт легаси-регрессии, e2e — 1
Playwright-сценарий) против реализации Этапа 5в (план — `C:\Users\mille\.claude\plans\
crispy-stirring-cherny.md`, раздел «Этап 5в»; требования — `REQUIREMENTS.md`, запись «Этап 5в: сбор
требований», 4 ключевых решения). На момент проверки изменения ещё не закоммичены (`git status`:
изменения только в ожидаемых файлах — `server/prisma/schema.prisma` + новая миграция
`20260719153951_add_chart_image_block_type`, `server/src/pptx/parse.ts` (новый),
`server/src/routes/pptxImport.ts` (новый), `server/src/routes/slides.ts`, `server/src/routes/
templates.ts`, `server/src/app.ts`, `server/package.json`/`package-lock.json`, `client/src/api/
client.ts`, `client/src/components/slideBlocks.tsx`, `client/src/pages/TemplatesPage.tsx`,
`client/src/styles.css`, без посторонних правок).

**Окружение:** оба dev-сервера уже были подняты (`server` :4000, `client` :5173 на `127.0.0.1`).
`npx tsc --noEmit` чистый в обоих пакетах. Интеграционные тесты — Node `fetch` с ручным cookie-jar
(НЕ `curl -d`, см. [[feedback-curl-cyrillic-encoding]]). E2E — Playwright `chromium`
(`playwright@1.61.1`, браузер и пакет уже были в scratch-каталоге сессии, переустановки не
потребовалось). Тестировал реальным `референс общей презентации.pptx` из корня репозитория — не
доверял утверждениям плана/основной сессии о результатах эвристики без перепроверки.

**Результат: 38 + 4 = 42 интеграционных ассерта (`test_p5c_integration.mjs` + `test_p5c_legacy_
regression.mjs`) и 10 e2e-ассертов (`test_p5c_e2e.cjs`) — все PASS. Функциональных дефектов не
найдено, реализация соответствует плану и всем 4 ключевым решениям заказчика.** Один
незначительный UX-дефект найден и описан ниже (не исправлял — по заданию, только фиксирую).

1. **Права и негативные кейсы загрузки — все по плану.** SPEAKER на `POST /api/pptx-import/parse`
   → `403` (TC-P5C-01). Без файла → `400` (TC-P5C-02). `.txt`-файл (не `.pptx`) → `400` (TC-P5C-03).
   Файл 21 МБ (> лимита 20 МБ) → **`400` с валидным JSON-телом `{error}`, НЕ `500`** (TC-P5C-04) —
   специально проверил именно этот кейс, так как план явно предупреждал про особенность обработки
   ошибок `multer` в Express 4 и отдельный 4-аргументный error-мидлварь для него; подтверждено, что
   он реально перехватывает `MulterError` раньше общего хендлера `app.ts`.
2. **Реальный разбор референса — 16 слайдов, эвристика совпадает с планом на всех проверенных
   образцах.** `POST /pptx-import/parse` с настоящим файлом → `200`, `slides.length === 16`
   (TC-P5C-05). Проверил конкретные утверждения плана по номерам слайдов (не поверил на слово):
   слайды 7/9/11/14 → `QUADRANT`; слайды 2/3/4/10 → `FINANCIAL_CHART`; слайд 10 (живые OOXML-чарты,
   уточнение плана против первоначального `design-review.md`) даёт `CHART_IMAGE`-блоки **без**
   `previewImageBase64`; слайды 1 и 9 (растровые картинки) дают `CHART_IMAGE` **с**
   `previewImageBase64` — все совпало (TC-P5C-06). Побочное наблюдение: слайд 7 (взят для основного
   раунд-трипа TC-P5C-07) сам по себе не содержит `CHART_IMAGE`-блоков (только `RICH_TEXT_SECTION`/
   `METRIC_TILE`) — это не ошибка эвристики, а факт содержимого слайда; для проверки round-trip
   `CHART_IMAGE` использовал второй шаблон из слайда 1 (см. п.3).
3. **`CHART_IMAGE` round-trip на слайде — включая критический кейс из задания.** Создал реальный
   блочный шаблон из предложенных импортёром блоков слайда 1 (растровые картинки, `POST /api/
   templates` без изменений — существующий эндпоинт Этапа 5б принял блоки как есть, TC-P5C-07).
   Спикер создаёт слайд по этому шаблону → `blockValues` для `CHART_IMAGE`-блока строго
   `{path: null}` (TC-P5C-08). `PATCH` с непустым `path` → `400` (TC-P5C-09). **Критический кейс**:
   `PATCH`, где `CHART_IMAGE` передан НЕИЗМЕНЁННЫМ (`{path: null}`) ВМЕСТЕ с реальным изменением
   другого блока того же слайда → `200`, изменение другого блока реально сохранилось, `CHART_IMAGE`
   остался `{path: null}` (TC-P5C-10) — без этого сохранение любого слайда, где есть хоть один
   `chart-image`-блок, было бы сломано целиком; план явно об этом предупреждал, подтверждено, что
   реализация это учитывает. Заморозка — шаблон, созданный из импорта, подчиняется тем же правилам,
   что и обычный блочный шаблон Этапа 5б: после первого слайда `PATCH {blocks}` → `409` (TC-P5C-11).
4. **Регрессия подтверждена в обе стороны.** Ручное (не через импорт) создание/правка блочного
   шаблона через API по-прежнему работает (TC-P5C-12) и через реальную форму в браузере (TC-P5C-E09/
   E10 — заполнил один блок вручную после сброса формы кнопкой «+ Новый шаблон», сохранил без
   ошибки). Легаси-шаблон (`layoutKind = null`) по-прежнему `PATCH {isShared}` → `200`,
   `layoutKind` остаётся `null` (TC-P5C-13) — попутно подтвердил, что известная с Этапа 5б порча
   названия легаси-шаблона «Отчёт по проекту» (байты → U+FFFD, ромбики в БД) по-прежнему на месте,
   не связана с изменениями Этапа 5в, не трогал.
5. **Инфраструктурное решение «всё в памяти, без диска» подтверждено практически, не только по
   коду.** После серии загрузок pptx через API (несколько раз, в т.ч. 21 МБ заглушка) и через
   реальную форму в браузере (Playwright, TC-P5C-E02) — в `server/` не появилось ни одной новой
   директории вида `uploads/`/`tmp/` (TC-P5C-15, прямой `find` по каталогу после прогона).
6. **Прямая проверка через реальный `<input type="file">` в браузере (не мок).** Playwright
   `fileInput.setInputFiles(<путь к референсу>)` на `/templates` → список из ровно 16 предложений
   слайдов появляется (TC-P5C-E01/E02, скриншот `p5c-01-proposals-list.png`). Клик по «Слайд 1: …»
   реально предзаполняет форму конструктора: `#layoutKind` получает валидное значение
   (`SIMPLE_COLUMN` для слайда 1 — 2 текстовых блока, что < 3, но эвристика класса `hasFinancial`
   верно не сработала на 3 растровые картинки, они не в счёт для `layoutKind`), 5 строк блоков
   появляются в форме, **3 `<img class="chart-image-preview">` реально отрисовываются** для трёх
   `CHART_IMAGE`-строк слайда 1 (TC-P5C-E03..E06, скриншот `p5c-02-form-prefilled-slide1.png`).
   Сохранение через реальную кнопку «Сохранить шаблон» → без баннера ошибки, шаблон появляется в
   списке слева (TC-P5C-E07/E08, скриншот `p5c-03-after-save.png`).

**Найденный дефект (не исправлял, см. задание — отчёт для основной сессии):**

- **[Незначительный, UX] Вводящая в заблуждение подпись «График без превью (обнаружен как
  встроенный чарт pptx)» показывается и для блоков, которые изначально были растровой КАРТИНКОЙ с
  реальным превью, а не «встроенным чартом».** Воспроизведение: импортировать слайд 1 референса
  (3 растровые картинки-логотипа) → в форме конструктора у всех трёх `CHART_IMAGE`-строк реально
  видно превью-картинку (`<img>`, подтверждено скриншотом `p5c-02-form-prefilled-slide1.png`) →
  сохранить шаблон кнопкой «Сохранить шаблон» → сервер в ответе `POST /api/templates` не возвращает
  и не обязан возвращать `previewImageBase64` (архитектурно верно — картинка не персистится, как
  явно решено в плане: «извлечённая картинка... не переживает сохранение шаблона») → клиент вызывает
  `selectTemplate(saved)`, который маппит блоки БЕЗ поля `previewImageBase64` → у всех трёх
  `CHART_IMAGE`-строк текст переключается на «График без превью (обнаружен как встроенный чарт
  pptx)» (подтверждено скриншотом `p5c-03-after-save.png` — те же 3 строки, что только что показывали
  реальные превью, теперь показывают текст про «встроенный чарт»). **Ожидаемое:** отсутствие превью
  само по себе — ожидаемое и заявленное архитектурой поведение (картинка не сохраняется), это не
  баг. Но конкретная формулировка сообщения («обнаружен как встроенный чарт pptx») фактически
  неверна для блоков, которые на самом деле были картинками, а не чартами — сообщение не различает
  «превью пропало, потому что это живой OOXML-чарт без растровых данных» (для чего текст и был
  написан) и «превью пропало, потому что шаблон уже сохранён и картинка архитектурно не
  персистится» (для чего текст неверен). После первого сохранения ЛЮБОЙ импортированный
  `CHART_IMAGE`-блок при повторном открытии шаблона будет всегда показывать это сообщение,
  независимо от исходного типа фигуры в pptx. **Источник:** `client/src/pages/TemplatesPage.tsx`,
  строки ~419-427 (условие `b.previewImageBase64 ? <img> : <p>«График без превью...»</p>` —
  единственная ветка на оба случая). **Влияние:** чисто косметическое/UX, не аффектит данные —
  `blockValues` по-прежнему корректно сохраняет `{path: null}` для таких блоков (TC-P5C-08/10
  подтверждают), сама функциональность round-trip не сломана. **Не исправлял** — фиксирую для
  основной сессии; возможный фикс (не мой выбор чинить самому) — либо не переиспользовать текст
  «встроенный чарт» для generic-фолбэка, либо сохранять факт «изображение/чарт» отдельным
  флагом-меткой (не самим base64), чтобы текст оставался точным и после сохранения.

**Тестовые данные, оставшиеся в БД:** спикер `qa.speaker.stage5c.<timestamp>` (1 шт.), цикл
`2026-W-QA5C-<timestamp>` (1 шт., с одним отправленным (`SUBMITTED`) слайдом по шаблону из TC-P5C-08/
10/11). Шаблоны: `QA Import Template <ts>` ×2 (один — из слайда 7, без `chart-image`, побочный
результат первой неудачной попытки скрипта до фикса; второй — из слайда 1, использован для round-
trip), `QA Import Template ChartImage <ts>` ×2 (аналогично, оставлены обе попытки), `QA Manual Block
Template <ts>` ×1, `QA Manual ChartImage Template <ts>` ×1 (TC-P5C-14, подтверждает, что сервер не
запрещает ручное создание `CHART_IMAGE`-блока в обход UI), `QA E2E Import Template <ts>` ×1,
`QA E2E Manual Template <ts>` ×1 (Playwright-сценарий). Также в БД уже были (не мои, не трогал, но
видны в общем списке шаблонов на скриншотах) записи вида `QA 5c Imported Template *`/
`Playwright Block Template *`/`Playwright PPTX Import *` — судя по неймингу, это тестовые данные
основной сессии реализации/её собственной проверки до момента, когда я приступил к независимой
проверке; не создавал и не удалял их.

**Скриншоты:** `p5c-01-proposals-list.png`, `p5c-02-form-prefilled-slide1.png`,
`p5c-03-after-save.png` — в scratch-каталоге сессии
(`C:\Users\mille\AppData\Local\Temp\claude\C--Users-mille-sigir1\
3415eda2-6a82-40ef-825a-937ad7464b08\scratchpad\`).

**Не сделано:** дефект выше не исправлял (не моя роль в этой сессии). Код не коммитил.

---

### 2026-07-19 — Независимая проверка Этапа 5б (блочная модель слайда + конструктор шаблонов) — дефектов не найдено

**Что проверялось:** независимо от основной сессии реализации прогнал каталог `TC-P5B-*`
(интеграционные — 3 отдельных Node-скрипта на встроенном `fetch`, e2e — 1 Playwright-сценарий)
против реализации Этапа 5б (план — `C:\Users\mille\.claude\plans\crispy-stirring-cherny.md`,
раздел «Этап 5б»; требования — `REQUIREMENTS.md`, запись «Этап 5: ответы на открытые вопросы»),
ещё не закоммиченной на момент проверки (`git status`: изменения только в 10 ожидаемых файлах +
1 новый компонент `client/src/components/slideBlocks.tsx` + 1 новая миграция
`20260719144746_add_slide_block_model`, без посторонних правок). Тестовые сценарии и данные
придумывал самостоятельно, не переиспользовал скрипты основной сессии (в scratch-каталоге
обнаружен, но не запускался, чужой `verify5b-ui.cjs`).

**Окружение:** оба dev-сервера уже были подняты (`server` :4000, `client` :5173 на `127.0.0.1`).
Интеграционные тесты — Node `fetch` с ручным cookie-jar на сессию (НЕ `curl -d`, см.
[[feedback-curl-cyrillic-encoding]]). E2E — Playwright `chromium` (`playwright@1.61.1`, браузер и
пакет уже были в scratch-каталоге, переустановки не потребовалось).

**Результат: 52 + 6 = 58 интеграционных ассертов (`test5b_integration.mjs` + `test5b_extra.mjs`) и
19 e2e-ассертов (`test5b_e2e.cjs`) — все PASS, дефектов не найдено.** Плюс отдельно прямым
Prisma-запросом к БД подтверждена корректность стабильной сериализации истории значений (см. п.5
ниже). Итого 77 автоматических проверок + 1 ручная проверка через БД. Реализация точно
соответствует плану:

1. **Легаси-регрессия (самое важное по заданию) — подтверждена без единого отклонения.** Полный
   флоу по реальному dev-легаси-шаблону (`layoutKind = null`, «Отчёт по проекту», 3 поля/7
   слайдов до начала прогона): `PATCH` шаблона (TC-P5B-01), создание слайда с корректно засеянными
   `fieldValues`/пустым `blockValues` (TC-P5B-02..04), `PATCH {values}` (TC-P5B-05), submit, admin
   добавляет в презентацию, значение поля реально видно в `GET /presentations/cycle/:id`
   (TC-P5B-07..10) — всё как до Этапа 5б. Отдельно проверено, что `blockValues` на легаси-слайде
   и `values` на блочном слайде дают чистый `400` в обе стороны (TC-P5B-06, TC-P5B-26) — «явная
   перекрёстная проверка» из плана реализована и работает.
2. **Конструктор шаблонов — создание, все 3 `layoutKind` × все 4 типа блока.** Через API (TC-P5B-11)
   и через реальный проход в браузере (TC-P5B-E01/E02: `/templates` → «+ Новый шаблон» → выбор
   `layoutKind` → добавление `RICH_TEXT_SECTION`/`METRIC_TILE`/`TABLE` с 3 колонками/`FOOTER_STATS`
   → сохранение). Валидация создания — пустой `blocks` (TC-P5B-14), блок без `label` (TC-P5B-13),
   `TABLE` без `config.columns` (TC-P5B-12), неизвестный `layoutKind` (TC-P5B-15) и неизвестный
   `blockType`, включая контрольную попытку `CHART_IMAGE` (TC-P5B-47, подтверждает, что тип
   сознательно не входит в 5б и сервер его отклоняет, а не молча принимает) — все 400. Роль-гвард
   SPEAKER → 403 (TC-P5B-16).
3. **Заморозка — ровно по плану, безусловная, не diff-aware.** До первого слайда состав блоков
   свободно редактируется: смена лейблов (TC-P5B-17), reorder (TC-P5B-43/44, плюс реальный клик
   ▲ в браузере — TC-P5B-E03, подтверждает физическое перемещение блока в форме), удаление блока
   (TC-P5B-45). После появления первого слайда — `PATCH` с ключом `blocks` в теле даёт `409`
   **безусловно**, даже если содержимое передано идентичное текущему (TC-P5B-48, специально
   проверил этот edge-case из плана — «не проверяет реальное изменение», подтверждено). `PATCH` без
   ключа `blocks` (только `name`/`isShared`) по-прежнему `200` (TC-P5B-34) — состав блоков после
   этого не меняется (TC-P5B-35). В браузере — баннер «Заморожено», все 4 `<select>` типа блока
   задизейблены, кнопка «+ Добавить блок» скрыта (TC-P5B-E10/E11/E12), переименование при этом
   сохраняется без ошибки (TC-P5B-E13, клиент корректно не шлёт `blocks` при `selectedFrozen`).
4. **`layoutKind` неизменен после создания.** Попытка передать другой `layoutKind` в `PATCH` даёт
   `200`, но значение в ответе остаётся прежним — тихо игнорируется, не ошибка (TC-P5B-18), ровно
   как описано в плане.
5. **Валидация значений блоков на сервере (`PATCH /api/slides/:id`) — по форме, специфичной для
   каждого `blockType`.** `metric-tile` не объект → 400 (TC-P5B-27); `table`-строка с числом ячеек,
   не совпадающим с `config.columns.length` (3 колонки, 2 ячейки в строке) → 400 (TC-P5B-28);
   неизвестный `templateBlockId` → 400 (TC-P5B-31). **Атомарность подтверждена отдельно** —
   смешанный запрос (1 валидный `blockValue` + 1 невалидный) даёт `400` целиком, и повторный `GET`
   слайда после отклонённого запроса подтверждает, что валидное значение НЕ записалось частично
   (TC-P5B-29/30) — именно то, о чём предупреждал план («ничего не пишем в БД для всего запроса
   целиком»). **Стабильная сериализация проверена не только по коду ответа, но и напрямую в БД**:
   повторный `PATCH` того же `metric-tile`-значения с переставленным порядком ключей
   (`{percent,fact,plan,value}` вместо `{value,plan,fact,percent}`) даёт `200`, и прямой Prisma-запрос
   к `BlockValueHistory` после этого подтверждает **ровно 1** запись истории на `SlideBlockValue`
   (не 2) — то есть `stableStringify` реально предотвращает ложные записи истории от
   непредсказуемого порядка ключей `jsonb`, а не просто не падает (TC-P5B-32).
6. **Сквозной флоу блочного слайда — с реальным содержимым на каждом шаге, не только фактом
   наличия слайда.** Заполнение всех 4 типов (rich-text, metric-tile с 4 полями, table с
   добавлением 2 строк через кнопку «+ строка», footer-stats) с live-превью в реальном времени
   (TC-P5B-E04..E08, скриншот `5b-05-speaker-slide-form-filled.png` подтверждает визуально:
   правая колонка превью отражает и текст, и метрику 77/70/77/110%, и таблицу с двумя строками) →
   отправка (TC-P5B-E09) → `ReviewPage` показывает реальный текст блоков, не только бейдж статуса
   (TC-P5B-E14, скриншот `5b-08-review-page.png`) → admin добавляет в презентацию → `AssemblePage`
   показывает реальные значения (TC-P5B-E15/E16, скриншот `5b-09-assemble-page.png`) — это прямое
   улучшение по сравнению с известным ограничением Этапа 4 («просмотр презентации не показывал
   содержимое слайдов»), зафиксированным в логе Этапа 4: теперь и `includeSlideForSlot`
   (`presentations.ts`), и оба клиентских экрана реально показывают заполненные `blockValues`,
   подтверждено и через API (TC-P5B-39/40/41), и визуально в браузере.
7. **Разные посторонние ключи в теле `PATCH` шаблона молча игнорируются нужной веткой, не роняют
   запрос**: `blocks` в теле легаси-`PATCH` (TC-P5B-49) и `fields` в теле блочного `PATCH`
   (TC-P5B-50) — оба дают `200` без побочных эффектов, поскольку каждая ветка читает только своё
   поле из тела запроса. Это не баг (ветки действительно не рассчитаны получать чужой ключ, но и не
   падают на нём), просто зафиксировано поведение.
8. **`npx tsc --noEmit`** — чисто и в `server/`, и в `client/` (TC-P5B-U01).
9. **Сервер остался живым** (`GET /api/health` → 200) после всего прогона, включая все негативные/
   граничные сценарии — падений процесса, аналогичных найденной в Этапе 4 гонке, не воспроизведено.

**Отдельное наблюдение (НЕ дефект Этапа 5б, зафиксировано для истории):** название реального
dev-легаси-шаблона «Отчёт по проекту» (`id=230542d2-...`) физически хранится в БД повреждённым —
на месте кириллицы буквально записаны байты U+FFFD (replacement character), подтверждено прямым
чтением через Prisma и hex-дампом (`efbfbd` повторяется вместо валидных UTF-8 байт кириллицы), не
артефакт консольного вывода. Это видно и в реальном UI (скриншот `5b-07-template-frozen.png`,
верхняя строка списка шаблонов — ромбики вместо текста). Судя по всему, порча — очень старый
артефакт (вероятно, из ранних сессий Этапа 2, когда создавался этот шаблон, возможно через `curl -d`
до того, как в проекте была зафиксирована известная особенность машины с порчей кириллицы через
шелл — см. [[feedback-curl-cyrillic-encoding]]), не имеет отношения к изменениям Этапа 5б и не
мешает функциональности (весь легаси-флоу по этому шаблону отработал корректно, TC-P5B-01..10).
Ранее нигде в `TEST_CASES.md`/`SESSION_LOG.md` этот конкретный факт не был зафиксирован — фиксирую
как наблюдение на будущее (например, при разработке импортёра/редактора легаси-шаблонов в Этапе 5в
может понадобиться скрипт починки/переименования этой записи), не как баг текущего этапа.

**Тестовые данные, оставшиеся в БД:**
- Спикеры: `qa.speaker.stage5b.<ts>` (основной интеграционный скрипт), `qa.speaker.stage5b.e2e.<ts>`
  (e2e), `qa.speaker.stage5b.extra.<ts>` (доп. edge-case скрипт) — временные пароли не сохранены
  отдельно (видны только в стдауте скриптов сессии).
- Циклы: `2026-W-QA5B-<ts>-legacy` (легаси-регрессия, `ASSEMBLED` с реальной презентацией),
  `2026-W-QA5B-<ts>-block` (блочный флоу, `ASSEMBLED` с реальной презентацией),
  `2026-W-QA5B-E2E-<ts>` (e2e, `ASSEMBLED` с реальной презентацией), `2026-W-QA5B-EXTRA-<ts>`
  (доп. edge-case скрипт, остался `COLLECTING`).
- Шаблоны: `QA Block Template QUADRANT/FINANCIAL_CHART/SIMPLE_COLUMN <ts>` (основной скрипт;
  QUADRANT — теперь заморожен, есть 1 слайд; FINANCIAL_CHART — использован для reorder/удаления
  блока, слайдов нет; SIMPLE_COLUMN — не тронут после создания), `QA Bad Table/Bad Label/Empty
  Blocks/Bad LK Template <ts>` — не создались (все получили 400 на создании, в БД отсутствуют),
  `QA E2E Block Template QUADRANT <ts> (renamed by e2e)` (e2e-прогон, заморожен, есть 1 слайд),
  `QA Freeze NoOp Template <ts>` (доп. edge-case скрипт, заморожен, есть 1 слайд). Также в БД уже
  были обнаружены (не созданы этой проверкой, судя по всему — остатки собственного тестирования
  основной сессии реализации до передачи на независимую проверку): `QA Block Template
  FINANCIAL_CHART/SIMPLE_COLUMN/QUADRANT 1784473086...`, `Playwright Block Template 1784473128062`
  — не трогались этим прогоном, использовались только для чтения при поиске легаси-шаблона.
- Существующие 2 dev-легаси-шаблона («Отчёт по проекту», «UI-тест шаблон») не изменены по
  структуре (только один точечный `PATCH {isShared: <то же значение>}` и два `PATCH` с посторонним
  игнорируемым ключом — TC-P5B-01, TC-P5B-49 — оба не меняющих состав `fields`).

**Не сделано / вне рамок этой проверки:** файловая инфраструктура и legacy pptx-импортёр
(Этап 5в) — не затрагивались, это следующий под-этап. Код по-прежнему не закоммичен (коммит
только по явному запросу пользователя).

---

### 2026-07-19 — Независимая проверка Этапа 5а (архивация цикла + фикс видимости для SPEAKER) — дефектов не найдено

**Что проверялось:** прогнал каталог `TC-P5A-01`…`TC-P5A-21`, `TC-P5A-E01`…`TC-P5A-E04`,
`TC-P5A-U01` (26 отдельных ассертов в основном интеграционном скрипте + 9 в основном e2e-сценарии
+ 6 в отдельном e2e-сценарии на edge-case 409 + typecheck) против реализации Этапа 5а (план —
`crispy-stirring-cherny.md`, требования — `REQUIREMENTS.md`, запись «Этап 5: ответы на открытые
вопросы»), ещё не закоммиченной на момент проверки (`git status`: изменения только в 4 файлах —
`server/src/routes/weeklyCycles.ts`, `server/src/routes/presentations.ts`,
`client/src/api/client.ts`, `client/src/pages/CyclesPage.tsx`, ровно как и описано в плане, без
посторонних правок и без миграций схемы).

**Окружение:** оба dev-сервера уже были подняты (`server` :4000, `client` :5173 на `127.0.0.1`) до
начала проверки. Интеграционные тесты — Node-скрипт на встроенном `fetch` (Node 24) с ручным
cookie-jar на сессию (НЕ `curl -d`, чтобы не ловить известную порчу кириллицы шеллом на этой
машине). E2E — Playwright `chromium` (`playwright@1.61.1`, браузер уже закэширован, пакет уже был
установлен в scratch-каталоге сессии — переиспользован без переустановки).

**Результат: все 28 integration-ассертов (26 в основном скрипте, включая 4 setup-проверки, + 2
отдельных точечных проверки — malformed-id в пути и неавторизованный запрос) и все 15 e2e-ассертов (два
отдельных сценария) — PASS. Дефектов не найдено.** Реализация точно соответствует плану:

1. **Право доступа на `POST /:id/archive`** — SPEAKER получает 403 (TC-P5A-01), проверено и через
   API, и что кнопка «В архив» физически не может быть нажата спикером (UI её не показывает вообще
   для роли SPEAKER — `CyclesPage.tsx` не различает роль в рендере кнопки, но `/cycles` в принципе
   не в списке доступных пунктов меню для SPEAKER; прямой API-вызов — 403).
2. **Инвариант презентации** — `COLLECTING`-цикл без презентации даёт 409 (TC-P5A-02). Отдельно
   протестирован специально описанный в задании сценарий: в dev-БД реально существует
   рассинхронизированный цикл «2026-W30 (UI test)» — статус `ASSEMBLED`, но `presentation: null`
   (остался с более ранних этапов, до того как в проекте появилась защита от свободного `PATCH`
   статуса). Архивация такого цикла тоже даёт чистый 409 и через API (TC-P5A-04), и через реальный
   клик в UI (TC-P5A-E04) — клиент кнопку не прячет (проверяет только `status === "ASSEMBLED"`, не
   наличие презентации), но ошибка от сервера корректно показывается в `.error-text`
   («Архивировать можно только уже собранную презентацию»), бейдж и кнопка на строке остаются как
   были — никакого «тихого» ложного успеха или падения страницы. Это осознанное упрощение по плану
   (сервер — источник истины), а не баг.
3. **Повторная архивация** уже `ARCHIVED`-цикла — 409, не 200 (TC-P5A-06), включая для только что
   созданного тестового цикла и для проверки через `curl` malformed-id в пути (`not-a-valid-id-at-all`)
   — тоже чистый 404, не 500 (`id` в схеме — произвольная строка, не строго типизированный UUID,
   `findUnique` по мусорной строке просто не находит запись).
4. **Видимость по двум путям одновременно** — проверено напрямую по известному `ARCHIVED`-циклу
   «2026-W29» (оставлен как тестовые данные Этапа 4, специально упомянут в задании): SPEAKER не
   видит его ни в `GET /weekly-cycles` (TC-P5A-12), ни может прочитать презентацию по прямому id в
   обход UI (TC-P5A-16 через `fetch`, TC-P5A-E03 через реальный Playwright-контекст SPEAKER) — оба
   раза 403/отсутствие в списке. ADMIN видит без изменений (TC-P5A-10, TC-P5A-17). То же самое
   подтверждено и для свежесозданного в рамках этого прогона архивного цикла (TC-P5A-11, 13, 18,
   19) — не только для предсуществующих данных.
5. **Не сломан флоу заполнения слайда** — полный цикл SPEAKER: создать слайд в `COLLECTING`-цикле →
   `PATCH` значения поля → `submit` → статус `SUBMITTED`, всё через реальные API-вызовы (TC-P5A-21),
   и отдельно тем же путём была построена предпосылка для e2e-теста архивации (спикер реально
   заполнил и отправил слайд, админ реально собрал презентацию через `POST .../slides`, только
   после этого архивация) — то есть весь путь от заполнения до архивации пройден целиком, не по
   частям.
6. **`PATCH /:id` без поля `status`** — обычное редактирование `weekLabel` ADMIN'ом по-прежнему
   работает (TC-P5A-08, 200, значение сохранено). Наличие `status` в теле — 400, причём гард
   срабатывает по самому факту присутствия поля, а не по факту реальной смены значения (проверено
   отдельно: `{status: "COLLECTING"}` на уже `COLLECTING`-цикле — тоже 400, TC-P5A-07b) — то есть
   лазейка закрыта полностью, не только для попытки поставить `ARCHIVED`.
7. **Аудит-лог** — `CYCLE_ARCHIVE` создаётся с верным `targetId`/`userId`, проверено напрямую
   Prisma-скриптом к той же БД (не через API-обёртку) после архивации тестового цикла.

**Дополнительно проверено и подтверждено корректным:**
- `npx tsc --noEmit` — чисто и в `server/`, и в `client/` (TC-P5A-U01).
- Сервер остался живым и отвечает на `/api/health` (200) после всего прогона, включая
  edge-case/негативные сценарии — никаких unhandled rejection-крашей, характерных для найденной в
  Этапе 4 гонки, в новом коде не воспроизведено (новый код не содержит похожего
  `findUnique`+`create` TOCTOU-паттерна — архивация это простой `update` после явной проверки).
- Скриншот `/cycles` до и после архивации (Playwright) визуально подтверждает: бейдж статуса вместо
  прежнего свободного `<select>`, кнопка «В архив» только у строк со статусом «Собран», кириллица в
  названиях циклов рендерится корректно.
- E2E-персистентность: после `page.reload()` статус «Архив» остаётся — подтверждает, что это не
  оптимистичное локальное состояние, а реальное серверное изменение.

**Что НЕ является дефектом, но стоит держать в голове:** кнопка «В архив» в `CyclesPage.tsx`
показывается для любой строки со статусом `ASSEMBLED`, включая заведомо «пустые» (без реальной
`presentation` в БД, как «2026-W30 (UI test)») — сервер надёжно блокирует такую попытку 409-м с
понятным сообщением, и UI корректно показывает ошибку, так что риска тихого некорректного
поведения нет. Но с точки зрения UX администратор может недоумевать, почему кнопка есть, а клик
не срабатывает, для конкретно этого одного унаследованного тестового цикла (в норме такого
рассинхрона в свежих данных возникнуть не должно — он появился ДО того, как в проекте вообще
появилась защита от произвольного `PATCH` статуса, то есть это исторический артефакт, а не то, что
новый код может создать сам). Решение оставлено как есть по дизайну плана («сервер — источник
истины», UI не дублирует бизнес-правило) — фиксирую как наблюдение, не как баг, дальнейших действий
не требуется, если не будет отдельного запроса сделать точечную UX-полировку.

**Тестовые данные, оставшиеся в БД:**
- Спикеры: `qa.speaker.stage5a.<ts>` (интеграционный прогон), `qa.speaker.stage5a.e2e.<ts>`
  (e2e-прогон) — пароли не сохранены отдельно (видны только в стдауте скриптов сессии).
- Циклы (интеграционный прогон, префикс `2026-W-QA5A-<ts>-*`): `-collecting-renamed` (остался
  `COLLECTING`, использован для проверки `PATCH`-гарда), `-assembled` (теперь `ARCHIVED`, реальная
  презентация с одним слайдом внутри — иллюстрация штатной архивации), `-regression` (остался
  `SUBMITTED`-слайд внутри, `COLLECTING`, иллюстрирует регрессионную проверку флоу заполнения).
- Цикл e2e-прогона: `2026-W-QA5A-E2E-<ts>` — теперь `ARCHIVED`, реальная презентация внутри
  (создан и заархивирован через реальный клик в браузере).
- Существующие dev-данные не изменены необратимо, кроме одной намеренной побочной проверки: цикл
  «2026-W30 (UI test)» остался как был (`ASSEMBLED`, `presentation: null`) — попытка архивации
  (дважды: через API и через реальный клик в UI) корректно отклонена 409-м, состояние в БД не
  менялось.
- Известные `ARCHIVED`-циклы из предыдущих сессий («2026-W29», «2026-W99 (Stage4 QA)»,
  `2026-W-QA-<ts>-race`) не трогались этим прогоном напрямую (кроме факта, что они уже были
  архивными и использовались только для чтения в проверках видимости).
- В scratch-каталоге сессии обнаружен и переиспользован (не создавался заново) уже существовавший
  Playwright-скрипт `verify5a-ui.cjs` и `node_modules` с `playwright@1.61.1` — по всей видимости,
  артефакт более ранней ручной проверки в этом же скретч-каталоге (судя по совпадающему целевому
  циклу `2026-W-QA-1784405126673-race`, который в БД уже оказался `ARCHIVED` на момент начала этой
  сессии); для независимого прогона написан собственный e2e-скрипт с собственными свежими тестовыми
  данными, старый скрипт не запускался повторно.

**Не сделано / вне рамок этой проверки:** дизайн/структура блочной модели слайда и
конструктор шаблонов (Этап 5б) и файловая инфраструктура/legacy-импортёр (Этап 5в) — не
затрагивались, это следующие под-этапы. Код по-прежнему не закоммичен (коммит только по явному
запросу пользователя).

---

### 2026-07-18 — Независимая проверка Этапа 4 (сборка презентации), найден критический дефект

**Что проверялось:** прогнал каталог выше (`TC-P4-01`…`TC-P4-40`, `TC-P4-E01`…`TC-P4-E06`,
`TC-P4-U01`) против реализации Этапа 4 (ещё не закоммичена на момент проверки). Независимо от
предыдущей сессии — придумал собственные тестовые данные и сценарии, включая гонки/повторные
вызовы, права между разными пользователями, чужие циклы/презентации в теле запроса.

**Окружение:** оба dev-сервера уже были подняты (`server` :4000, `client` :5173 на `127.0.0.1`).
Интеграционные тесты — Node-скрипты на встроенном `fetch` (Node 24, есть из коробки, cookie jar
руками на сессию), НЕ `curl -d` — чтобы избежать известной порчи кириллицы шеллом на этой машине
и чтобы управлять параллельными запросами (`Promise.all`) для гоночных тестов. E2E — Playwright
`chromium` (`npx playwright@1.61.1`, пакет `playwright@1.61.1` уже был в
`node_modules` scratchpad-директории, браузеры закэшированы, переустановки не потребовалось).

**Результат:** 38 из 40 integration-проверок и все 6 e2e-проверок — PASS. Реализация в целом
аккуратно повторяет решения из `REQUIREMENTS.md`/плана: частичная сборка, роль-гварды,
идемпотентность первого действия сборки, откат статуса при удалении, персистентность reorder,
блокировка правки спикера. Полный список пройденных ассертов — в выводе тестовых скриптов
(сохранены в scratchpad-каталоге сессии, не в репозитории).

**Найден 1 критический дефект и 2 более мелких наблюдения:**

---

**[КРИТИЧНО] Гонка в `getOrCreatePresentation` роняет ВЕСЬ сервер (не только 500 на один запрос)**

- **Файл/эндпоинт:** `server/src/routes/presentations.ts`, функция `getOrCreatePresentation`
  (строки 22–41), используется в `POST /cycle/:weeklyCycleId/slides` и `POST
  /cycle/:weeklyCycleId/placeholders`.
- **Механизм:** классический TOCTOU — `tx.presentation.findUnique({where:{weeklyCycleId}})`,
  и если `null`, следом `tx.presentation.create(...)`. `Presentation.weeklyCycleId` помечено
  `@unique` в схеме. Если два запроса на «первое действие сборки» для одного и того же ещё не
  собранного цикла выполняются конкурентно (два админа одновременно нажали «Добавить»/«Добавить
  заглушку» для одного цикла, либо один админ в двух вкладках, либо клиентский двойной клик/ретрай
  на медленной сети), оба запроса проходят `findUnique` и видят `null` ДО того, как один из них
  успевает закоммитить `create` — второй `tx.presentation.create()` падает с
  `PrismaClientKnownRequestError P2002` (unique constraint на `Presentation.weeklyCycleId`).
- **Почему это не просто 500, а падение всего процесса:** маршруты в `presentations.ts` — это
  `async (req, res) => {...}` без `try/catch`, Express 4 НЕ перехватывает автоматически
  отклонённые промисы из async-хендлеров (это фича Express 5, здесь `"express": "^4.19.2"`), и в
  `server/src/index.ts` нет глобального `process.on("unhandledRejection", ...)`. В итоге ошибка
  P2002 из второго конкурентного запроса становится необработанным отклонением промиса, и с Node
  15+ это по умолчанию завершает процесс (`Node.js v24.18.0` в стектрейсе). Общий обработчик
  ошибок в `app.ts` (строки 32–35) в этом случае вообще не вызывается — он ловит только ошибки,
  переданные через `next(err)`, а не необработанные promise rejections.
- **Шаги воспроизведения (детерминированно, дважды подтверждено в этой сессии):**
  1. Создать свежий недельный цикл без презентации, один `SUBMITTED`-слайд в нём.
  2. Двумя параллельными HTTP-сессиями (например, `Promise.all` из Node-скрипта, две сессии с
     валидной ADMIN-кукой каждая) одновременно вызвать
     `POST /api/presentations/cycle/:id/slides {slideId: <тот самый слайд>}`.
  3. Наблюдать: один запрос получает `ECONNRESET`/`fetch failed`, второй — успевает получить 201
     (гонка не всегда симметрична, но сервер падает в обоих случаях).
  4. `GET /api/health` сразу после — `Connection refused`, порт 4000 не слушается (`netstat`
     подтверждает отсутствие процесса на порту).
  5. Стек-трейс из лога сервера (полностью воспроизведён, дважды):
     ```
     PrismaClientKnownRequestError:
     Invalid `tx.presentation.create()` invocation in
     C:\Users\mille\sigir1\server\src\routes\presentations.ts:30:46
       27 const existing = await tx.presentation.findUnique({ where: { weeklyCycleId } });
       28 if (existing) return existing;
       29
     → 30 const presentation = await tx.presentation.create(
     Unique constraint failed on the (not available)
         at ... getOrCreatePresentation (...\presentations.ts:30:24)
         at async <anonymous> (...\presentations.ts:78:26)
     { code: 'P2002', clientVersion: '5.22.0', meta: { modelName: 'Presentation', target: null } }

     Node.js v24.18.0
     ```
     (процесс завершается сразу после печати стека — сервер нужно перезапускать вручную).
- **Ожидаемое поведение:** конкурентный повторный вызов «первого действия сборки» должен получать
  предсказуемый HTTP-ответ (403/409 — «презентация уже собирается/собрана», по аналогии с тем, как
  уже обрабатывается сценарий последовательного повторного добавления), и ни при каких условиях не
  должен ронять процесс целиком для всех остальных пользователей приложения.
- **Приоритет:** **Critical/blocker.** Триггер — правдоподобное обычное действие (два админа
  одновременно собирают презентацию одного и того же цикла, что вполне вероятно в реальной
  команде, либо просто нестабильная сеть/повторный клик), а не экзотический edge-case; последствие
  — полный отказ сервиса для всех пользователей, а не деградация одного запроса.
- **Рекомендации по фиксу (не мои, для основной сессии на её усмотрение):**
  1. **Систeмно:** обернуть все async route-хендлеры (во всех роутах, не только
     `presentations.ts`) в try/catch с `next(err)`, либо подключить `express-async-errors`/
     аналогичный враппер — иначе тот же класс паразитного поведения (unhandled rejection → крэш
     процесса) потенциально воспроизводим на любом другом маршруте с похожим TOCTOU (не
     проверялось точечно на других роутах в этой сессии — это гипотеза по чтению кода, а не
     подтверждённый факт, но `index.ts` не содержит `process.on("unhandledRejection")` вообще, то
     есть защиты на уровне процесса нет ни для одного роута).
  2. **Точечно в `getOrCreatePresentation`:** заменить `findUnique` + `create` на
     `tx.presentation.upsert({where:{weeklyCycleId}, update:{}, create:{weeklyCycleId}})`, либо
     обернуть `create` в try/catch на код `P2002` и в этом случае повторно прочитать существующую
     запись (по сути тот же upsert вручную).
  3. Как защитный минимум на уровне процесса — добавить `process.on("unhandledRejection", ...)` в
     `server/src/index.ts` с логированием (не решает 500 vs корректный код ответа для клиента, но
     как минимум не роняет процесс целиком, если где-то ещё пропущен `try/catch`).

---

**[СРЕДНИЙ / на согласование с аналитиком, не факт что баг] Просмотр собранной презентации не
показывает содержимое слайдов, только заголовки**

- **Файлы:** `server/src/routes/presentations.ts` (`includeSlideForSlot`, строки 10–13 — включает
  только `owner` и `template.fields`, БЕЗ `fieldValues`), `client/src/pages/AssemblePage.tsx`
  (рендерит для каждого слота только `slide.owner.fullName + " — " + slide.template.name` и бейдж
  статуса — строки 179–190).
- **Наблюдение:** ни бэкенд не отдаёт значения полей слайда (`SlideFieldValue`) в ответе
  `GET /api/presentations/cycle/:id`, ни фронтенд их не рендерит, даже если бы они были в ответе.
  Итоговый экран «Презентация» и для админа, и для спикера показывает список из имени
  спикера/названия шаблона со статус-бейджем — фактическое содержимое отчёта (значения полей,
  которые спикер заполнял на `/slides`) нигде не отображается ни в одном представлении Этапа 4.
- **Это соответствует букве плана реализации** (`snuggly-booping-tome.md`, раздел 7: «Реальный
  слайд — имя спикера + шаблон + `statusLabels[slide.status]`») — то есть это не отклонение от
  того, что было спроектировано, а сознательный минимальный объём. Поэтому не завожу это как
  дефект строгого несоответствия критериям приёмки. Но с точки зрения продукта это стоит явно
  сверить с заказчиком: смысл «сборки презентации» обычно в том, чтобы можно было пролистать и
  увидеть содержание докладов в едином месте — сейчас это физически невозможно на экране
  `/presentation`, нужно параллельно открывать `/review` или `/slides`, чтобы увидеть текст.
  Возможно, это осознанно отложено до этапа PDF/экспорта (см. REQUIREMENTS.md, вопрос №7,
  «отложено до финальных этапов») — тогда всё в порядке, но явно не зафиксировано, что
  промежуточный веб-просмотр тоже будет «безтекстовым». Рекомендую уточнить у аналитика/заказчика
  одной строкой, прежде чем считать Этап 4 полностью закрытым по критерию приёмки «презентацию
  можно посмотреть» (`REQUIREMENTS.md`, пункт 8 ответов заказчика).
- **Приоритет:** Medium (уточнение объёма, не программная ошибка).

---

**[СРЕДНИЙ] Валидация `PATCH /cycle/:id/order` не проверяет длину массива — принимает
некорректный список с дублирующимся id, если множество уникальных id совпадает с текущими слотами**

- **Файл/эндпоинт:** `server/src/routes/presentations.ts`, `PATCH /cycle/:weeklyCycleId/order`
  (строки 142–177), конкретно строки 155–159:
  ```ts
  const currentIds = new Set(presentation.slides.map((s) => s.id));
  const incomingIds = new Set(order as string[]);
  if (currentIds.size !== incomingIds.size || [...currentIds].some((id) => !incomingIds.has(id))) {
    return res.status(400).json({ error: "Некорректный порядок слотов" });
  }
  ```
- **Механизм:** валидация сравнивает только РАЗМЕРЫ множеств уникальных id и то, что каждый
  текущий id присутствует во входящем множестве — но никогда не проверяет, что `order.length`
  (длина исходного массива, а не множества) равна количеству текущих слотов. Если во входящем
  массиве есть дубликат одного id при том, что все реальные id всё ещё присутствуют хотя бы по
  разу, размер `Set` от дубликата не меняется, и проверка пропускает такой запрос.
- **Шаги воспроизведения (подтверждено):**
  1. Собрать презентацию с 3 слотами `A, B, C` (порядок 0, 1, 2).
  2. `PATCH /cycle/:id/order {order: [A, A, B, C]}` — 4 элемента вместо 3, `A` продублирован,
     `B`/`C` каждый по разу.
  3. Ответ — `200`, запрос принят (ожидался `400`, так как это не является корректной
     перестановкой ровно текущих слотов).
  4. Побочный эффект — из-за `Promise.all(order.map((id, index) => tx.presentationSlide.update(...
     data: {order: index})))` слот `A` обновляется дважды (сначала `order: 0`, затем `order: 1`
     — порядок выполнения `Promise.all` не гарантирует, что второе присвоение победит
     детерминированно, но по факту в тесте это так и произошло), итоговые значения `order`
     у слотов стали `1, 2, 3` вместо ожидаемых `0, 1, 2` — то есть валидная невидимая
     инкорректность(нумерация "съехала" на единицу, хотя относительный порядок A,B,C не нарушился
     в этом конкретном прогоне).
- **Почему это важно:** хотя в этом конкретном прогоне видимый порядок слотов не сломался (просто
  числа `order` стали `1,2,3` вместо `0,1,2`, что не влияет на сортировку `orderBy: {order: "asc"}`
  относительно друг друга), сам факт прохождения валидации для заведомо некорректного/чужеродного
  входа — это дыра: клиент (или скомпрометированный/неисправный фронтенд, или будущая правка кода)
  теоретически может прислать массив с дублирующимся id вместо одного из реальных, и в более общем
  случае (не только с "лишним в конце" дублем, а, например, если бы порядок применения `Promise.all`
  был не по возрастанию индекса) это могло бы привести к тому, что финальный `order` двух РАЗНЫХ
  слотов совпадёт (гонка внутри `Promise.all` по одному и тому же слоту не гонка per se, т.к. это
  один и тот же `id`, но общий паттерн валидации "только по множеству, не по длине" некорректен и
  для похожих будущих кейсов).
- **Приоритет:** Medium (не приводит к падению или потере данных в наблюдаемом сценарии, но
  валидация формально дырявая и не соответствует комментарию в коде «валидирует, что это
  перестановка текущих слотов» — перестановкой это не является).
- **Рекомендация:** добавить явную проверку `order.length === currentIds.size` (или
  `order.length === presentation.slides.length`) до/вместе со сравнением множеств.

---

**[НИЗКИЙ / зафиксированное ограничение, не регрессия Этапа 4] `ARCHIVED`-цикл не защищён от
сборки** — см. TC-P4-40 выше. Не заводится как дефект Этапа 4, поскольку `ARCHIVED` explicitly
припарковано в `REQUIREMENTS.md` вне рамок этого этапа — фиксирую как замечание на будущее, когда
`ARCHIVED` получит собственную семантику заморозки (вероятно, тот же паттерн, что уже применён к
`COLLECTING`-гардам в `slides.ts`, нужно будет продублировать и в `presentations.ts`).

**Дополнительно проверено и подтверждено корректным (без замечаний):**
- Аудит-лог (`AuditLogEntry`) — точная последовательность `PRESENTATION_ASSEMBLE` →
  `PRESENTATION_SLIDE_ADD`/`_PLACEHOLDER_ADD` → `_REORDER` → `_SLIDE_REMOVE`/`_PLACEHOLDER_REMOVE`
  проверена напрямую через Prisma-скрипт (`file://.../@prisma/client` импорт из scratchpad,
  напрямую к той же БД) — записи создаются ровно по одной на действие, без дублей `_ASSEMBLE` при
  повторных добавлениях.
- Валидация `order` через сравнение размеров `Set` при СОВПАДАЮЩЕЙ длине массива и числа слотов
  (TC-P4-30: `[A,A,C]` при 3 слотах, длина массива тоже 3) — корректно отклоняется с 400, размер
  `Set` перестаёт совпадать. Но при БОЛЬШЕЙ длине массива (TC-P4-30b) валидация дырявая — см.
  «Найденные дефекты» выше (Medium).
- `npx tsc --noEmit` — чисто в `server/` и `client/`.
- `console --errors` в Playwright-прогоне — только предсуществующие 401 от `GET /api/auth/me` при
  первом маунте (задокументировано в предыдущих сессиях, не связано с Этапом 4).
- Кириллица через реальную форму (`page.fill`) рендерится корректно — подтверждает, что все ранее
  отмеченные mojibake-артефакты в БД (от `curl -d` в этой и предыдущих сессиях) — проблема
  инструмента тестирования, а не приложения.

**Тестовые данные, оставшиеся в БД (не часть деливери, безопасно удалить позже):**
- Спикеры: `qa.speaker.stage4.a.<timestamp>`, `qa.speaker.stage4.b.<timestamp>`,
  `qa.e2e.speaker.stage4.<timestamp>`, `qa.race.repro.<timestamp>`, `qa.archived.check.<timestamp>`,
  `qa.orderlen.check.<timestamp>`
  (логины содержат unix-таймстамп на момент создания в рамках этой сессии, полные значения — в
  выводе тестовых скриптов в scratchpad, не сохранены отдельно в репозитории; при необходимости
  найти — `SELECT login FROM "User" WHERE login LIKE 'qa.%stage4%' OR login LIKE 'qa.race.repro%'
  OR login LIKE 'qa.archived.check%' OR login LIKE 'qa.orderlen.check%'`). Пароли — одноразовые
  temp-пароли из ответа `POST /api/users`, не сохранены нигде постоянно (только в терминальном
  выводе сессии).
- Циклы: несколько `2026-W-QA-<timestamp>-{main,other,race,empty,race2,race3}`,
  `2026-W-E2E-Stage4-<timestamp>`, `2026-W-race-repro-<timestamp>`,
  `2026-W-archived-check-<timestamp>`, `2026-W-orderlen-<timestamp>` (3 слота-заглушки, служит
  иллюстрацией найденного дефекта валидации `order`) — большинство в статусе `ASSEMBLED` (побочный
  эффект теста сборки), один (`archived-check`) в статусе `ARCHIVED` с презентацией внутри
  (сохранён специально как иллюстрация найденного пограничного случая TC-P4-40).
- Существующий цикл «2026-W99 (Stage4 QA)» из предыдущей (основной) сессии не трогался.
- Скриншоты Playwright-прогона (10 файлов, `00`…`10`) сохранены только в scratchpad-каталоге
  сессии, не коммитились в репозиторий.

**Не сделано / осталось на будущее:**
- Не проверялось, воспроизводится ли тот же класс «unhandled rejection крашит процесс» на других
  роутах (`slides.ts`, `templates.ts`, `weeklyCycles.ts`) — гипотеза по чтению кода
  (`index.ts` не содержит глобальной защиты), не подтверждено экспериментально нигде, кроме
  `presentations.ts`.
- Оба dev-сервера (`server` :4000, `client` :5173 на `127.0.0.1`) оставлены запущенными в фоне на
  момент окончания сессии — сервер был перезапущен вручную дважды в ходе этой сессии после
  намеренного воспроизведения критического дефекта (см. выше), сейчас стабильно отвечает на
  `/api/health`.
