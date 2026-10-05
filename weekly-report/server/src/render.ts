// Движок рендера — порт того же block-tree из Claude-артефакта (app.html), без DOM:
// каждая функция просто строит HTML-строку. ВАЖНО: публичная страница (renderPageHtml)
// не содержит никаких ссылок/кнопок редактирования — токен-ссылка живёт только у того,
// кому её выдали лично, и никогда не появляется в разметке, которую видят все.

import { renderBodyEditor, renderFooterInputs, type WeekRecord } from "./fields.js";
export type { WeekRecord };

export type Block = any;
export type Dept = any;

export const WEEK = {
  weekNumber: 39,
  periodLabel: "21–27 сентября 2026",
  meetingLabel: "28 сентября 2026",
  deptCount: 16,
};

export const WEEK_ID = "w39";

// Отделы, у которых есть реальный контент для редактирования (все, кроме пяти
// "без письменного отчёта"-заглушек — для них редактировать пока нечего, см.
// SESSION_LOG.md от 04.10.2026 (продолжение, тест "все 16 отделов локально")).
export const EDITABLE_IDS = [
  "perevozki", "terminal", "engineering", "operations", "cs-terminals",
  "cs-sl", "sales", "contractors", "peo", "hr", "it",
];

export const DEPARTMENTS: Dept[] = [
  { id:"finance", group:"Финансы и коммерция", name:"Финансы", role:"Соколовская А.",
    status:"no_report" },

  { id:"perevozki", name:"Директор по перевозкам", role:"Отправки КП в адрес терминала",
    status:"reported",
    body:[ {t:"row2", a:[
        {t:"table", title:"План на месяц", cols:["Оператор","План","Факт"], rightFrom:1,
          rows:[["Бизнес Актив","5","4"],["Силикатная ФИТ","11","11"],["Владивосток ФИТ","4","2"],
                ["Санкт-Петербург ФИТ","1","1"],["СКЛ","1","1"],["Транзит","1","1"],
                ["Перегруз ФИТ","2","2"],["Свифт (ВЭ)","3","2"]],
          total:["Итого","28","24"]},
        {t:"meterRow", meters:[{label:"Исполнение плана месяца", val:"86%", pct:86}], mt:14}
      ], b:[
        {t:"table", title:"Текущая неделя", cols:["Оператор","План","Факт"], rightFrom:1,
          rows:[["Бизнес Актив","0","0"],["Силикатная ФИТ","3","3"],["Владивосток ФИТ","1","0"],
                ["Санкт-Петербург ФИТ","1","1"],["СКЛ","0","0"],["Транзит","0","0"],
                ["Перегруз ФИТ","0","1"],["Свифт (ВЭ)","1","0"]],
          total:["Итого","6","5"]}
      ]}
    ],
    footer:{label:"Отдел", empty:"На этой неделе — без записей по событиям, планам, отпускам и найму."} },

  { id:"terminal", name:"Терминал Красноярск", role:"Ковалёв Б. В.", status:"reported",
    body:[
      {t:"row2", a:[
        {t:"bullets", title:"Ключевые события прошлой недели", items:[
          "Снижение занятости путей / обмен поездами",
          "Выдали СИЗ (зима) — грузовой двор, производственный отдел",
          "Провели встречу со специалистом по ОТ (организация обучения по ОТ)",
          "Приняли участие с АФТО на станции Базаиха, 22.09.2026",
          "Завершили ремонт кабинета руководства СЛ на терминале"]}
      ], b:[
        {t:"bullets", title:"Ключевые планы новой недели", items:[
          "Снижение занятости путей / обмен поездами",
          "Рабочая встреча с зам. начальника дороги по территориальному управлению, 28.09",
          "Рабочая встреча с ДС станции Базаиха",
          "Оштукатуривание и утепление стены гаража СЛ",
          "Оснащение комнаты приёма пищи машинистов мебелью и бытовой техникой",
          "Приступаем к обучению составителей и машинистов на право выезда",
          "Оплачиваем СИЗ (зима) для ж/д цеха и КПП"]}
      ]},
      {t:"block", mt:16, title:"Метрики, достижения, показатели", body:[
        {t:"row2", a:[
          {t:"meterRow", meters:[{label:"Занятость ж/д путей (среднее)", val:"104%", pct:80, status:"serious", over:true}]},
          {t:"table", mt:8, cols:["Поезда","Неделя","Месяц","План"], rightFrom:1,
            rows:[["Вход, гружёных","7","28","27"],["Вход, порожних","0","0","—"],
                  ["Выход, гружёных","6","17","19"],["Выход, порожних","3","11","—"]]},
          {t:"kv", mt:8, mb0:true, items:[["Снятие ТС","13 мин"],["Постановка ТС","29 мин"]]}
        ], b:[
          {t:"text", cls:"block-title", style:"font-size:.78rem;margin-bottom:6px", html:"Занятость контейнерной площадки, ср. TEU"},
          {t:"meterRow", meters:[
            {label:"Груж. КТК прибытие", val:"660 · 56%", pct:56},
            {label:"Груж. КТК отправление", val:"419 · 37%", pct:37},
            {label:"Порожние КТК", val:"2 291 · 74%", pct:74}]}
        ]}
      ]}
    ],
    footer:{label:"Отдел", stats:[["Фактическая численность","70"],["Больничные","0"],["Отпуска","5"]],
      notes:[["Вакансия","оператор РИЧ"],["Трудоустройство","мастер автовывоза"],["Увольнения","приёмосдатчик груза и багажа"]]} },

  { id:"engineering", group:"Операции и инфраструктура", name:"Главный инженер", role:"Арутюнян Г.",
    status:"reported",
    body:[
      {t:"row2", a:[
        {t:"bullets", title:"Ключевые события прошлой недели", items:[
          "Выверка норм выдачи СИЗ по СТ", "Внесение изменений в приказ по выдаче СИЗ по СТ"]}
      ], b:[
        {t:"bullets", title:"Ключевые планы новой недели", items:[
          "Корректировка приказов по выдаче СИЗ по СТ",
          "СТ — запуск обучения, ознакомление работников с документами",
          "СЛ — составление заявки на обучение работников"]}
      ]},
      {t:"block", mt:26, title:"Документооборот — разработка локально-нормативных документов",
        body:[{t:"meterRow", meters:[
          {label:"СЛ", val:"83 / 96", pct:86}, {label:"СТ", val:"86 / 96", pct:90}]}]}
    ],
    footer:{label:"Отдел", stats:[["Болеет","0"],["В отпуске / командировке","0"],["Увольняются","0"],["Ещё не наняты","0"]]} },

  { id:"operations", name:"Операционный отдел СЛ", role:"Арутюнян Г. Ю.", status:"reported",
    body:[ {t:"row2", a:[
        {t:"table", title:"Метрики, достижения, показатели", cols:["Площадка","КТГ","ТС в работе","В ремонте"], rightFrom:1,
          rows:[["Москва","77%","7","2"],["Красноярск","86%","14","2"]]}
      ], b:[
        {t:"table", title:"Рейсы, 21.09–27.09.2026", cols:["Площадка","Неделя","Свои","Наём","Итого сентябрь"], rightFrom:1, wrapLast:true,
          rows:[["Москва","43","37","6","171 (свои 148 / наём 23)"],
                ["Красноярск — по городу","106","—","—","331 всего"],
                ["Красноярск — межгород","11","—","—","по городу 280 / межгород 47"],
                ["Красноярск — по терминалу","0","—","1","по терминалу 4 / наём 5"]]}
      ]}
    ],
    footer:{label:"Отдел", notes:[["Отпуска","1 водитель МСК, 1 водитель выходной"],["Больничные","2, Красноярск"],
      ["Набор","приём 2 водителя КРСК, 28.09"],["Увольнения","нет"]]} },

  { id:"cs-terminals", group:"Клиентский сервис", name:"Клиентский сервис Сигир Терминалс", role:"Челядинова К.",
    status:"reported",
    body:[
      {t:"row2", a:[
        {t:"bullets", title:"Ключевые события прошлой недели", items:["Подали план поступлений на октябрь"]}
      ], b:[
        {t:"bullets", title:"Ключевые планы новой недели", items:[
          "Обработка входящих и исходящих КП", "Текущая работа",
          "Занимаемся закрытием сентября: выставляем счета, отрабатываем БДР, подписываем УПД с клиентами",
          "Готовимся к ежегодной индексации — направить уведомление всем клиентам"]}
      ]},
      {t:"block", mt:26, title:"Метрики, достижения, показатели", body:[
        {t:"statRow", title:"Показатель ПДЗ", stats:[["ПДЗ","35%",{kind:"good",text:"▼ было 60%"}]]},
        {t:"text", cls:"tbl-caption", html:"Документооборот"},
        {t:"bullets", tight:true, items:[
          "Восстановление оригиналов документов — 53 документа к восстановлению",
          "Подписано 44 ДС; на подписании 8 из 127 ДС по форс-мажору",
          "Просроченных задач нет", "На согласовании — 3 ПР", "На подписании — 1 договор, подписаны 2 договора"]},
        {t:"kv", title:"Склад", mt:14, items:[["Отгружено","18 паллет"],["Остатки на складе","206 мешков · 86 паллет"]]},
        {t:"kv", title:"Ремонт контейнеров", items:[["Отремонтировано КТК (пред. неделя)","4"],["В ремонте","2"]]}
      ]}
    ],
    footer:{label:"Отдел — отпуска", notes:[["Старовойтова В.","21.09–06.10"],["Кулешова Е.","24.09–01.10"]]} },

  { id:"cs-sl", name:"КС СЛ", role:"Клиентский сервис", status:"reported",
    body:[
      {t:"block", title:"Метрики, достижения, показатели", body:[
        {t:"statRow", stats:[["ПДЗ","30,04%",{kind:"good",text:"▼ было 42,4%"}],
          ["Просроченные задачи в ДО","212",{kind:"bad",text:"▲ было 169"}],
          ["Закрыто перевозок КТК за неделю","110",{kind:"flat",text:"отправлено 61"}]]},
        {t:"text", cls:"hero-chip", style:"margin-bottom:18px", html:"100% заявок отработано"},
        {t:"text", cls:"tbl-caption", html:"Подписание ДС"},
        {t:"statRow", stats:[["ЭПД — подготовлено 139","51",{kind:"good",text:"▲ было 32"}],
          ["Форс-мажоры — подготовлено 98","43",{kind:"good",text:"▲ было 31"}]]},
        {t:"text", cls:"tbl-caption", html:"ЭТрН, 21–27.09"},
        {t:"bullets", tight:true, items:["На бумаге — 56 рейсов (они же ЭТрН)",
          "ЭТрН — 99 (не завершено: 2 по Красноярску, 6 по Москве)"]}
      ]},
      {t:"block", title:"Ключевые планы новой недели", body:[
        {t:"bullets", items:["Отправить 32 КТК — Красноярск, 1 КТК — Владивосток"]}
      ]}
    ],
    footer:{label:"Отдел — отпуска / больничные", notes:[["Старовойтова Вероника","21.09–06.10"],
      ["Соколова Ольга","22.09–09.10"],["Артемьева Елена","21.09–30.09"]]} },

  { id:"sales", group:"Коммерция", name:"Отдел продаж — Экспорт / ВРП", role:"Капустин В. В.",
    status:"reported",
    body:[
      {t:"row2", a:[
        {t:"table", title:"ВРП по направлениям — сентябрь (план &gt; остаток) и октябрь (план)",
          cols:["Направление","Сентябрь","Октябрь"], rightFrom:1,
          rows:[["Москва — Красноярск","312 &gt; 18","150"],["Москва — Иркутск","0","0"],
                ["Москва — Екатеринбург","35 &gt; 18","12"],["Москва — Новосибирск","2","0"],
                ["Москва — Дальний Восток","0","0"],["Красноярск — ДВ (ПСЖВС)","5","5"],
                ["Москва — Омск","0","0"],["СПб — Красноярск","0","0"]],
          total:["Итого, контейнеров","план 354 / факт 303","план 167 / факт 0"]},
        {t:"meterRow", mt:14, meters:[{label:"Исполнение плана сентября", val:"86%", pct:86}]}
      ], b:[
        {t:"taglist", title:"Экспорт — план сентября (поезда)", tags:[
          "233EXPSL — УИ–ЗУ","237EXPSL — БЗХ–ЗБК","238EXPSL — БЗХ–ЗБК (горох)","239EXPSL — БЗХ–ЗУ",
          "240EXPSL — Малая Вишера–ЗБК","241EXPSL — БЗХ–ЗБК","242EXPSL — Нигозеро–МС"]},
        {t:"kv", mt:14, items:[["Под погрузкой","2 КП"],["Отправлено","5 КП"],["В разработке","0 КП"]]}
      ]},
      {t:"subcard", mt:16, title:"События недели", body:[{t:"row2", a:[
        {t:"subgroup", title:"Квоты и заполнение поездов", items:[
          "Заполнение поездов, продажа согласованных объёмов/квот: реализовано за неделю 55 контейнеров",
          "Согласование доп. квот на COC (сентябрь) — согласовано 18 мест на COC",
          "Работа над согласованием поездов и квот на октябрь"]},
        {t:"subgroup", title:"Клиенты", items:[
          "Работа по клиентской базе (сельхозпродукция) по Красноярску",
          "Работа по вопросам отклонения ГУ-12 по Красноярску (горох)",
          "Проработка и согласование КП с ЛДК 1",
          "Расширение клиентской базы по Красноярску: АО «Май Брендс», Леман Про, Водолей"]}
      ], b:[
        {t:"subgroup", title:"ЭПД", items:["Подписание и тестирование ЭПЭ — итог 104 из 238 заявок"]},
        {t:"subgroup", title:"Операторы, ставки, подсылы", items:[
          "Работа с операторами по привлечению вагонов SOC на октябрь (ТС, СКЛ, РЖДБА, ВЭ)",
          "Участие в тендерных процедурах: УЛК, ВЛП, Тайга, ЛузаЛес",
          "Встреча с ТК (Красноярский филиал)"]}
      ]}]},
      {t:"subcard", mt:14, title:"Планы новой недели", body:[{t:"row2", a:[
        {t:"subgroup", title:"Квоты и заполнение поездов", items:[
          "План поездов октября, согласование квот на SOC и COC",
          "Заполнение поездов, продажа согласованных объёмов/квот",
          "Продажа клиентам поездов и согласование обеспечения составов на октябрь (БЗХ, ВСЖД)",
          "Привлечение вагонов SOC на октябрь (СКЛ, РЖДБА, ВЭ) по Красноярску",
          "Работа над реализацией контейнеров с Красноярска"]}
      ], b:[
        {t:"subgroup", title:"Клиенты", items:[
          "Детальная работа по клиентам: Водолей, Холдинг Протэк, Красноярский водочный завод, ТГ Азия, СК Транс, РМС Черноземье, АО «Май Брендс»",
          "Оперативные вопросы по проданным квотам", "Работа с потенциальной клиентской базой"]},
        {t:"subgroup", title:"ЭПД", items:["Консультирование клиентов по ЭПД; заполнение и подписание ЭПЭ"]},
        {t:"subgroup", title:"Логистика и передача дел", items:[
          "Отправка КП с использованием сервиса ТК", "Передача дел Спиридоновой А."]}
      ]}]},
      {t:"subcard", mt:14, title:"Риски", body:[{t:"risk", html:"Нестабильная ситуация на рынке, влияние санкций"}]}
    ],
    footer:{label:"Отдел", stats:[["Отпуск","1"],["Командировки","0"],["Болеет","нет"],["Увольняются","0"],["Ещё не наняты","0"]]} },

  { id:"contractors", name:"Отдел по работе с подрядчиками", role:"Коротчикова М. Е. · неделя 39",
    status:"reported",
    body:[
      {t:"raw", html:
        '<div class="block chart-card"><div class="chart-head"><h4>Динамика отправок ВРП 2026, направление Москва — Красноярск</h4></div>'+
        '<svg class="linechart" viewBox="0 0 560 180" preserveAspectRatio="xMidYMid meet" style="max-width:480px">'+
        '<line class="grid-line" x1="0" y1="20" x2="560" y2="20"></line>'+
        '<line class="grid-line" x1="0" y1="160" x2="560" y2="160"></line>'+
        '<polygon class="area" points="0,125.4 80,67.7 160,80.8 240,34.0 320,30.9 400,30.5 480,25.7 560,25.25 560,160 0,160"></polygon>'+
        '<polyline class="line" points="0,125.4 80,67.7 160,80.8 240,34.0 320,30.9 400,30.5 480,25.7 560,25.25"></polyline>'+
        '<circle class="dot" cx="0" cy="125.4" r="4"></circle><circle class="dot" cx="80" cy="67.7" r="4"></circle>'+
        '<circle class="dot" cx="160" cy="80.8" r="4"></circle><circle class="dot" cx="240" cy="34.0" r="4"></circle>'+
        '<circle class="dot" cx="320" cy="30.9" r="4"></circle><circle class="dot" cx="400" cy="30.5" r="4"></circle>'+
        '<circle class="dot" cx="480" cy="25.7" r="4"></circle><circle class="dot end" cx="560" cy="25.25" r="5"></circle>'+
        '<text class="end-label" x="500" y="16" text-anchor="start">308</text>'+
        '<text x="0" y="174" text-anchor="start">янв</text><text x="80" y="174" text-anchor="middle">фев</text>'+
        '<text x="160" y="174" text-anchor="middle">мар</text><text x="240" y="174" text-anchor="middle">апр</text>'+
        '<text x="320" y="174" text-anchor="middle">май</text><text x="400" y="174" text-anchor="middle">июн</text>'+
        '<text x="480" y="174" text-anchor="middle">июл</text><text x="555" y="174" text-anchor="end">авг</text></svg>'+
        '<p style="font-size:.74rem;color:var(--muted);margin-top:6px">контейнеров/мес · 79 → 308, рост непрерывный с апреля</p></div>'},
      {t:"cols3", items:[
        [{t:"table", title:"Ожидание погрузки, сут.", cols:["Нед. 36","Нед. 37","Нед. 38","Нед. 39","Месяц"], allNum:true,
          rows:[["18","9","12","14","13"]]}],
        [{t:"table", title:"Использовано КТК, август", cols:["Канал","Всего","Привл.","Соб."], rightFrom:1,
          rows:[["ВРП","194","190","4"],["Экспорт","178","178","0"],["Импорт","0","0","0"],["Аренда","134","0","134"]]}],
        [{t:"table", title:"Использовано КТК, сентябрь по неделям", cols:["Неделя","ВРП","Экс.","Имп."], rightFrom:1,
          rows:[["36","41","76","0"],["37","88","76","0"],["38","71","78","0"],["39","32","0","0"]],
          total:["Всего","232","230","0"]}]
      ]},
      {t:"block", mt:16, body:[
        {t:"text", cls:"tbl-caption", html:"ВРП, бронь / факт по направлениям — август (исполнение 100%) и сентябрь (исполнение 96%)"},
        {t:"table", cols:["Направление","Авг · бронь SOC","Авг · бронь СОС","Авг · факт SOC","Авг · факт СОС",
            "Сен · бронь SOC","Сен · бронь СОС","Сен · факт SOC","Сен · факт СОС"], rightFrom:1,
          rows:[["Москва — Красноярск","220","88","220","88","224","97","213","93"],
                ["Москва — Екатеринбург","—","26","—","26","—","30","—","30"],
                ["Красноярск — ВЛД/ПСЖВС","—","13","—","13","—","2","—","2"],
                ["Москва — Новосибирск","—","2","—","1","—","2","—","2"]],
          total:["Итого","220","129","220","128","224","131","213","127"]}
      ]},
      {t:"cols3", mt:16, items:[
        [{t:"text", cls:"block-title", html:"КТК в оперировании"},
         {t:"kv", items:[["Итого","948"]]}, {t:"kv", items:[["Собственные","66"],["Привлечённые","882"]]}],
        [{t:"table", title:"Наёмный автотранспорт, по неделям", cols:["","35","36","37","38","39"], rightFrom:1,
          rows:[["Москва","21","5","7","6","6"],["Регионы","8","16","25","10","3"]],
          total:["Итого","29","21","32","16","9"]}],
        [{t:"text", cls:"block-title", html:"Собственные КТК в аренде"},
         {t:"text", cls:"hero-figure num", style:"font-size:1.9rem", html:"134"},
         {t:"text", style:"font-size:.82rem;color:var(--muted)", html:"все 134 — собственные контейнеры, переданные в аренду"}]
      ]},
      {t:"block", mt:16, title:"Новые контрагенты по сегментам", body:[
        {t:"segments", pairs:[
          ["Линии","СК Транзит СВ"],
          ["Автотранспорт","Полезный актив, Ирктранс, Логистические решения, АМД Трейд"],
          ["Контейнеры","RBS Logistics, Henan Huanhong Logistics"],
          ["Операторы","Райнолоджистик, Трансконтейнер по Северной ж/д, Универсальный транспортный оператор, Восточный Экспресс"],
          ["Терминалы","Единый Оператор, XMH, Рексервис, ИП Солянкин, ТСГ, КрасТрансКом, СИТ-Сибири-Сервис, ТК Магистраль, Контмэн"],
          ["Субсидии","Zhejiang Sanling Supply Chain Management, Yiwu to Europe Logistics"],
          ["Прочие","ЧОП Феликс"], ["Аренда КТК","Практика"]]}
      ]},
      {t:"row2", mt:8, a:[{t:"subcard", title:"Итоги прошедшей недели", body:[{t:"bullets", tight:true, items:[
        "Обеспечение контейнерами ВРП/Экспорт/Импорт","Спец-тарифы в поездах ВРП","Тарифы операторов",
        "Аренда собственных контейнеров","Наёмный автотранспорт, первая/последняя миля","Договоры с новыми контрагентами",
        "Задачи в ДО","Первичные и бухгалтерские документы","Счета за доставку контейнеров","Дебиторская задолженность",
        "Кредиторская задолженность СЛ","BPMN-процессы отдела, ввод ЭПД","«Поезд» и реестр поезда в УАТ",
        "Заявка подрядчику/перевозчику в УАТ","Переход на ЭТрН, ЭЗЗ, ЭПЭ","ДС по ЭПД"]}]}],
       b:[{t:"subcard", title:"Планы новой недели", body:[{t:"bullets", tight:true, items:[
        "Актуализация информации о публичных поездах операторов во внутрироссийском сообщении: тарифы, свободные места",
        "Обеспечение контейнерами объёмов текущей недели, подготовка к следующей",
        "Актуализация расписания и мониторинг тарифов операторов в международном сообщении",
        "Заключение договоров с подрядчиками в рамках расширения базы по востребованным направлениям",
        "Получение, проверка и передача к учёту закрывающих документов",
        "Актуализация кредиторской задолженности перед подрядчиками",
        "Работа с ДЗ за возврат контейнеров в Китай",
        "Актуализация BPMN «как есть»/«как будет» с учётом обновления функционала",
        "АОП за отчётный период; ДС с КА по ЭПЭ; обновление RACI"]}]}]},
      {t:"text", cls:"risk", style:"margin-top:14px;font-size:.78rem;padding:9px 14px;display:inline-block",
        html:'<b style="font-weight:700">Риски, просьбы:</b> нестабильная ситуация на рынке (влияние санкций) · задержки оплат · курс валют ($, ¥)'}
    ],
    footer:{label:"Отдел", stats:[["Отпуск","0"],["Командировки","0"],["Болеет","0"],["Увольняются","0"],["Ещё не наняты","0"]]} },

  { id:"commercial", name:"Коммерческий директор", status:"no_report" },

  { id:"peo", group:"Финансы, право, учёт", name:"ПЭО", role:"Степанова Е.", status:"reported",
    body:[{t:"row2", a:[
      {t:"bullets", title:"Ключевые события прошлой недели", items:[
        "Еженедельный сбор управленческой отчётности", "Работа с консолидированной базой 1С"]}
    ], b:[
      {t:"bullets", title:"Ключевые планы новой недели", items:[
        "Подготовка форм для заполнения по отделам планов по Бюджету 2027", "Дашборд 2027"]}
    ]}],
    footer:{label:"Отдел", empty:"На этой неделе — без записей по отпускам, командировкам и найму."} },

  { id:"legal", name:"Юридический отдел", status:"no_report" },
  { id:"accounting", name:"Главный бухгалтер", status:"no_report" },

  { id:"hr", group:"HR и IT", name:"HR", role:"Пласковицкая Екатерина", status:"reported",
    body:[
      {t:"block", title:"Открытые вакансии", body:[{t:"taglist", tags:["Оператор контейнерного погрузчика"]}]},
      {t:"row2", a:[{t:"bullets", title:"Выходы на работу и найм", tight:true, items:[
        '<b>Макарычева Марго</b> — менеджер по работе с клиентами ВРП (СПб), выход на прошлой неделе',
        '<b>Максим Беляев</b> — логист (СПб), выход на прошлой неделе',
        "2 сотрудника — водитель категории Е (Красноярск), с 28.09"]}
      ], b:[{t:"bullets", title:"Увольнения", tight:true, items:['<b>Шишлевская Д.</b> — логист, 5.10']}]}],
    extra:[
      {t:"block", title:"Внутренний перевод", body:[{t:"bullets", tight:true, items:[
        '<b>Гущина Ксения</b> — с менеджера КС СПб на менеджера отдела продаж (ВРП), с 01.10']}]},
      {t:"block", title:"Текущие активности — подготовка к новогодним подаркам", body:[{t:"bullets", tight:true, items:[
        "Детские новогодние подарки", "Календари, ежедневники, ручки"]}]}
    ],
    footer:{label:"Отдел — отсутствия", notes:[
      ["Дарья Репина","отсутствует 21.09–16.10, замещает Каневская Анастасия (по ГПХ)"],
      ["Ирина Богун","отсутствует 30.09–11.10, замещает Черноярова Ася"]]} },

  { id:"it", name:"IT / IS", role:"Михаил Дударев", status:"reported",
    body:[
      {t:"statRow", stats:[["Скорость разработки","99%",null,"good"],["Просроченные Helpdesk","3"],
        ["Простой сервисов за неделю","0",null,"good"],["Прогресс оптимизации","100%",null,"good"]]},
      {t:"cols3", items:[
        [{t:"text", cls:"block-title", html:"Максбот"},
         {t:"text", cls:"status-tag done", html:"Сделали"},
         {t:"bullets", tight:true, items:[
          "Алармы по ЭПЭ и ЭЭР добавлены для Astral (были только СБИС)",
          "Изучили интеграцию со СБИС — есть плюсы и минусы (например, нет прямого серверного автоподписания)",
          "Аудит печатных форм, исправление неточностей", "Добавили слежение за «Сигир Групп»"]},
         {t:"text", cls:"status-tag progress", style:"margin-top:12px", html:"Решаем"},
         {t:"bullets", tight:true, items:["Дубликация водителей при входящем Т1 — тикет у Немыкина, ждём середины октября"]}],
        [{t:"text", cls:"block-title", html:"1С"}, {t:"text", cls:"status-tag progress", html:"Решаем"},
         {t:"bullets", tight:true, items:["Новая синхронизация — готова к запуску",
          "Перебои с дислокацией — Игорь на финальной стадии (вышел из отпуска)",
          "База МЭ — этап финального согласования мокапа"]}],
        [{t:"text", cls:"block-title", html:"Прочее"},
         {t:"bullets", tight:true, items:[
          "Самостоятельно пофиксили ряд проблем в расширении Astral УАТ — всё работает, с недочётами, но без критики",
          "Готовы перейти на Astral полностью, но есть пожелания по гибкости от КА и руководителей",
          "Стратегически до конца 2026: работаем и в Astral, и в СБИС — ЭПЭ и ЭЭР; только в Astral — ЭТрН, ЭЗЗ, ЭПЛ"]}]
      ]}
    ],
    footer:{label:"Отдел", empty:"На этой неделе — без записей по отпускам, командировкам и найму."} },

  { id:"leadership", name:"Исполнительный директор · Генеральный директор", status:"no_report",
    emptyText:"Заключительное слово — на собрании" },
];

// -------- render engine (чистые строковые функции, без DOM) --------

function cellClass(b:Block, i:number, len:number):string{
  const classes:string[] = [];
  if (i>=(b.rightFrom ?? 1) || b.allNum) classes.push('num');
  if (b.wrapLast && i===len-1) classes.push('wrap');
  return classes.length ? ` class="${classes.join(' ')}"` : '';
}
function tbl(b:Block){
  const thead = `<thead><tr>${b.cols.map((c:string,i:number)=>`<th${cellClass(b,i,b.cols.length)}>${c}</th>`).join('')}</tr></thead>`;
  const rowHtml = (r:string[]) => `<tr>${r.map((c,i)=>`<td${cellClass(b,i,r.length)}>${c}</td>`).join('')}</tr>`;
  const body = b.rows.map(rowHtml).join('') + (b.total?`<tr class="total">${rowHtml(b.total).replace('<tr>','').replace('</tr>','')}</tr>`:'');
  const cap = b.title?`<p class="block-title">${b.title}</p>`:'';
  return `${cap}<div class="tbl-wrap"><table class="tbl">${thead}<tbody>${body}</tbody></table></div>`;
}
function bulletsHtml(b:Block){
  const cap = b.title?`<p class="block-title">${b.title}</p>`:'';
  return `<div class="block">${cap}<ul class="bullets${b.tight?' tight':''}">${b.items.map((i:string)=>`<li>${i}</li>`).join('')}</ul></div>`;
}
function meterRowHtml(b:Block){
  const meters = b.meters.map((m:any)=>{
    const trackCls = m.over ? 'meter-track over' : 'meter-track';
    const fillCls = 'meter-fill' + (m.status?` status-${m.status}`:'');
    return `<div class="meter"><span class="meter-label">${m.label}</span><span class="meter-val">${m.val}</span>`+
      `<div class="${trackCls}"><div class="${fillCls}" style="width:${m.pct}%"></div></div></div>`;
  }).join('');
  return `<div class="meter-row"${b.mt?` style="margin-top:${b.mt}px"`:''}>${meters}</div>`;
}
function statRowHtml(b:Block){
  const stats = b.stats.map(([label,value,delta,color]:any)=>{
    const valStyle = color?` style="color:var(--${color})"`:'';
    const deltaHtml = delta?`<p class="stat-delta ${delta.kind}">${delta.text}</p>`:'';
    return `<div class="stat"><p class="stat-label">${label}</p><p class="stat-value num"${valStyle}>${value}</p>${deltaHtml}</div>`;
  }).join('');
  return `<div class="stat-row">${stats}</div>`;
}
function kvHtml(b:Block){
  const items = b.items.map(([l,v]:any)=>`<div class="item">${l}<b>${v}</b></div>`).join('');
  const style = [b.mt?`margin-top:${b.mt}px`:'', b.mb0?'margin-bottom:0':''].filter(Boolean).join(';');
  return `<div class="kv"${style?` style="${style}"`:''}>${items}</div>`;
}
function taglistHtml(b:Block){
  const cap = b.title?`<p class="block-title">${b.title}</p>`:'';
  return `${cap}<div class="taglist">${b.tags.map((t:string)=>`<span class="tag">${t}</span>`).join('')}</div>`;
}
function segmentsHtml(b:Block){
  const cap = b.title?`<p class="block-title">${b.title}</p>`:'';
  return `${cap}<dl class="segments">${b.pairs.map(([dt,dd]:any)=>`<div><dt>${dt}</dt><dd>${dd}</dd></div>`).join('')}</dl>`;
}
function subgroupHtml(b:Block){
  return `<div class="subgroup"><p class="subgroup-title">${b.title}</p><ul class="bullets tight">${b.items.map((i:string)=>`<li>${i}</li>`).join('')}</ul></div>`;
}
function textHtml(b:Block){
  const style = b.style?` style="${b.style}"`:'';
  return `<p class="${b.cls||''}"${style}>${b.html}</p>`;
}
function riskHtml(b:Block){ return `<p class="risk">${b.html}</p>`; }

function renderBlock(b:Block):string{
  switch(b.t){
    case "table": return tbl(b);
    case "bullets": return bulletsHtml(b);
    case "meterRow": return meterRowHtml(b);
    case "statRow": return statRowHtml(b);
    case "kv": return kvHtml(b);
    case "taglist": return taglistHtml(b);
    case "segments": return segmentsHtml(b);
    case "subgroup": return subgroupHtml(b);
    case "text": return textHtml(b);
    case "risk": return riskHtml(b);
    case "raw": return b.html;
    case "row2": return `<div class="row2"${b.mt?` style="margin-top:${b.mt}px"`:''}><div>${b.a.map(renderBlock).join('')}</div><div>${b.b.map(renderBlock).join('')}</div></div>`;
    case "cols3": return `<div class="cols3"${b.mt?` style="margin-top:${b.mt}px"`:''}>${b.items.map((col:Block[])=>`<div>${col.map(renderBlock).join('')}</div>`).join('')}</div>`;
    case "subcard": return `<div class="subcard"${b.mt?` style="margin-top:${b.mt}px"`:''}><h5>${b.title}</h5>${b.body.map(renderBlock).join('')}</div>`;
    case "block": {
      const cap = b.title?`<p class="block-title">${b.title}</p>`:'';
      return `<div class="block"${b.mt?` style="margin-top:${b.mt}px"`:''}>${cap}${b.body.map(renderBlock).join('')}</div>`;
    }
    default: return '';
  }
}

function renderFooter(f:any):string{
  if(!f) return '';
  if(f.empty) return `<div class="dept-footer"><p class="dept-footer-label">${f.label}</p><p class="dept-footer-empty">${f.empty}</p></div>`;
  const stats = (f.stats||[]).map(([dt,dd]:any)=>`<div class="dept-footer-stat"><p class="dt">${dt}</p><p class="dd">${dd}</p></div>`).join('');
  const notes = (f.notes||[]).map(([b,text]:any)=>`<p class="dept-footer-note"><b>${b}</b> — ${text}</p>`).join('');
  return `<div class="dept-footer"><p class="dept-footer-label">${f.label}</p><div class="dept-footer-row">${stats}${notes}</div></div>`;
}

// Публичная карточка отдела — БЕЗ кнопок/ссылок редактирования: эта страница видна
// всем, токен не должен в ней ни в каком виде проявляться.
function renderDeptPublic(d:Dept):string{
  if(d.status==="no_report"){
    return `<div class="divider-dept" id="${d.id}"><h3>${d.name}${d.role?` — ${d.role}`:''}</h3>`+
      `<span class="tag-empty">${d.emptyText||"Без письменного отчёта на этой неделе"}</span></div>`;
  }
  const body = (d.body||[]).map(renderBlock).join('') + (d.extra||[]).map(renderBlock).join('');
  return `<section class="dept" id="${d.id}"><div class="dept-head"><h2>${d.name}</h2>`+
    (d.role?`<p class="role">${d.role}</p>`:'')+`</div>${body}${renderFooter(d.footer)}</section>`;
}

const FONTS_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Golos+Text:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">`;

export function renderPageHtml(week:typeof WEEK, departments:Dept[]):string{
  const nav = departments.map(d=>`<a class="nav-link" href="#${d.id}">${d.navLabel||d.name}</a>`).join('');
  let main = '';
  const seenGroups = new Set<string>();
  departments.forEach(d=>{
    if(d.group && !seenGroups.has(d.group)){
      seenGroups.add(d.group);
      main += `<p class="group-title"${seenGroups.size===1?' style="padding-top:44px"':''}>${d.group}</p>`;
    }
    main += renderDeptPublic(d);
  });
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Свод недели SIGIR</title>
${FONTS_HEAD}
</head><body>
<header class="masthead"><div class="wrap">
  <p class="eyebrow">Еженедельное собрание · <span class="brand-mark">SIGIR</span></p>
  <h1>Неделя ${week.weekNumber}</h1>
  <div class="masthead-meta">
    <span><b>${week.periodLabel}</b> — отчётный период</span>
    <span>Собрание <b>${week.meetingLabel}</b></span>
    <span>Свод по <b>${week.deptCount}</b> подразделениям</span>
  </div>
  <div class="masthead-rule"></div>
</div></header>
<nav class="subnav" aria-label="Разделы свода"><div class="wrap" id="subnavWrap">${nav}</div></nav>
<main class="wrap">${main}</main>
<footer><div class="wrap"><p class="wordmark">SIGIR</p>
<p>Свод еженедельного собрания · неделя ${week.weekNumber} · собрание ${week.meetingLabel} · подготовлено из отчётов руководителей подразделений.</p>
</div></footer>
<script>
(function(){
  var els = document.querySelectorAll('#subnavWrap, .tbl-wrap');
  els.forEach(function(el){
    el.addEventListener('wheel', function(e){
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }, {passive:false});
  });
})();
</script>
</body></html>`;
}

// -------- значения для редактируемых отделов (peo, engineering) --------

export function mergeOverlay(dept:Dept, overlay?:WeekRecord):Dept{
  if(!overlay) return dept;
  return Object.assign({}, dept, {
    status: overlay.status,
    role: overlay.role ?? dept.role,
    body: overlay.body,
    extra: overlay.extra,
    footer: overlay.footer,
  });
}

// -------- страница редактирования по токену (без ссылок на другие разделы) --------
// Generic-движок (fields.ts): один обход дерева body/extra находит каждый
// редактируемый лист и строит под него текстовое поле; структура/заголовки
// остаются из шаблона — редактируется только контент.

export function renderEditFormHtml(dept:Dept, rec:WeekRecord, saved:boolean):string{
  const bodyHtml = renderBodyEditor(rec);
  const footerHtml = renderFooterInputs(rec.footer);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Редактирование — ${dept.name}</title>
${FONTS_HEAD}
<style>body{padding:32px 20px 60px;max-width:720px;margin:0 auto}</style>
</head><body>
<p class="eyebrow">SIGIR · Свод недели</p>
<h2 style="margin:8px 0 2px">${dept.name}</h2>
<p class="role" style="margin-bottom:24px">${rec.role||''}</p>
${saved?'<p style="color:var(--good);font-weight:600;margin-bottom:16px">Сохранено ✓ — изменения уже видны всем в своде.</p>':''}
<p class="edit-hint" style="margin-bottom:18px">Поля и целые разделы можно перетаскивать за значок ⠿⠿, чтобы изменить порядок. Кнопка ✕ убирает поле/раздел из свода на этой неделе (можно вернуть кнопкой ↺ до сохранения).</p>
<form method="post" class="edit-panel" style="margin:0">
  <div class="edit-row"><label>Статус недели</label>
    <select name="status">
      <option value="reported"${rec.status==='reported'?' selected':''}>Есть отчёт</option>
      <option value="no_report"${rec.status==='no_report'?' selected':''}>Без отчёта на этой неделе</option>
    </select></div>
  <div class="edit-row"><label>Кто отчитывается (ФИО/роль)</label>
    <input type="text" name="role" value="${(rec.role||'').replace(/"/g,'&quot;')}"></div>
  ${bodyHtml}
  ${footerHtml}
  <div class="edit-actions"><button type="submit" class="edit-btn primary">Сохранить</button></div>
</form>
<script>${EDIT_SORT_SCRIPT}</script>
</body></html>`;
}

// Ванильный drag-and-drop (без библиотек) + удаление/восстановление полей и разделов.
// Перетаскивание ТОЛЬКО внутри одного .sortable-list (нельзя перетащить поле из одного
// раздела в другой) — переставляет .sortable-item (включая статичные row2/cols3-обёртки
// и раздел-блоки целиком), затем пересобирает order_<containerId> из текущего DOM-порядка.
const EDIT_SORT_SCRIPT = `(function(){
  function syncOrder(list){
    var ids=[];
    Array.prototype.forEach.call(list.children, function(el){
      if(el.classList && el.classList.contains('sortable-item')) ids.push(el.dataset.id);
    });
    var input=list.querySelector(':scope > input.order-input');
    if(input) input.value=ids.join(',');
  }
  function afterElement(list,y){
    var items=Array.prototype.filter.call(list.children, function(el){
      return el.classList && el.classList.contains('sortable-item') && !el.classList.contains('dragging');
    });
    var closest={offset:-Infinity, element:null};
    items.forEach(function(child){
      var box=child.getBoundingClientRect();
      var offset=y-box.top-box.height/2;
      if(offset<0 && offset>closest.offset){ closest={offset:offset, element:child}; }
    });
    return closest.element;
  }
  document.querySelectorAll('.sortable-item[draggable="true"]').forEach(function(item){
    item.addEventListener('dragstart', function(){ item.classList.add('dragging'); });
    item.addEventListener('dragend', function(){
      item.classList.remove('dragging');
      var list=item.closest('.sortable-list');
      if(list) syncOrder(list);
    });
  });
  document.querySelectorAll('.sortable-list').forEach(function(list){
    list.addEventListener('dragover', function(e){
      var dragging=list.querySelector('.sortable-item.dragging');
      if(!dragging || dragging.closest('.sortable-list')!==list) return;
      e.preventDefault();
      var after=afterElement(list, e.clientY);
      var anchor=list.querySelector(':scope > input.order-input');
      if(after==null) list.insertBefore(dragging, anchor);
      else list.insertBefore(dragging, after);
    });
  });
  document.querySelectorAll('.remove-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var item=btn.closest('.sortable-item');
      var removed=item.classList.toggle('removed');
      var isSection=item.classList.contains('section');
      btn.textContent=removed ? '↺ вернуть' : (isSection ? '✕ раздел' : '✕');
      var hidden=item.querySelector(':scope > input.removed-input');
      if(!hidden){
        hidden=document.createElement('input');
        hidden.type='hidden'; hidden.className='removed-input';
        hidden.name='removed_'+btn.dataset.id;
        item.appendChild(hidden);
      }
      hidden.value=removed?'1':'0';
    });
  });
})();`;

export function renderNotFoundHtml():string{
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Не найдено</title>${FONTS_HEAD}
<style>body{padding:60px 20px;max-width:480px;margin:0 auto;text-align:center}</style></head>
<body><p class="eyebrow">SIGIR</p><h2>Ссылка не найдена</h2>
<p style="color:var(--muted)">Проверьте, что вставили ссылку целиком, без обрезки.</p></body></html>`;
}

export function renderComingSoonHtml(deptName:string):string{
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${deptName}</title>${FONTS_HEAD}
<style>body{padding:60px 20px;max-width:480px;margin:0 auto;text-align:center}</style></head>
<body><p class="eyebrow">SIGIR</p><h2>${deptName}</h2>
<p style="color:var(--muted)">Форма для этого раздела ещё не готова — пока присылайте данные как обычно.</p></body></html>`;
}
