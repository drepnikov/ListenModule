import { start } from "./start";
import { prompt, player_is_stopped } from "./prompt";
import { add_listeners_for_asr } from "./add_listeners_for_asr";

class Listen {
  constructor(settings, on_input_complete, on_timeout) {
    const { error_messages } = Listen;

    if (!settings || !on_input_complete || !on_timeout) {
      this.throw_error(error_messages.missing_basic_parameters);
    }

    this.settings = settings;
    this.on_input_complete = on_input_complete;
    this.on_timeout = on_timeout;

    this.asr = null;
    this.created_player = null;

    this.timer = null;
    this.interim_results_timer = null;
    this.max_duration_timer = null;
    this.dtmf_timer = null;

    // пара возможных, скрытых настроек

    this.settings.timeout_after_capture_started = isNaN(this.settings.timeout_after_capture_started)
      ? 5000
      : this.settings.timeout_after_capture_started; // заводится при capture started, в случае если ответ от гугла долго идет
    this.settings.timeout_dtmf_input = isNaN(this.settings.timeout_dtmf_input)
      ? 50
      : this.settings.timeout_dtmf_input; // заводится между нажатиями клавиш

    // -- --

    this.received_data = {
      text: "",
      confidence: [],
      dtmf: ""
    };

    try {
      this.check_settings();
    } catch (e) {
      this.throw_error(e.message);
    }

    this.logger(
      "Настройка IVR завершена. Итоговые settings:\n" + JSON.stringify(this.settings, null, 2)
    );
  }

  bind_handlers(handlers) {
    const result = {};

    Object.keys(handlers).forEach(handler => {
      result[handler] = handlers[handler].bind(this);
    });

    return result;
  }

  static create_asr_object(settings, type) {
    const result = {
      lang: settings.lang
    };

    if (type === Listen.types.multiply_results) result.interimResults = true;
    if (type === Listen.types.smart_result) result.interimResults = true;

    if (settings.dict) result.dict = settings.dict;
    if (settings.interimResults) result.interimResults = true;
    if (settings.enhanced) result.enhanced = true;
    if (settings.model) result.model = settings.model;

    return result;
  }

  reset_timer(ms) {
    clearTimeout(this.timer);

    ms = ms ? ms : this.settings.timeout;

    this.logger(`Перезагружаем таймер на выполнение on_timeout - коллбэка. Заводим на ${ms}ms`);
    this.timer = setTimeout(() => {
      this.logger(`Таймер на тишину в размере ${ms} достигнут`, true);

      this.clean_up();

      this.on_timeout();
    }, ms);
  }

  reset_interim_results_timer() {
    if (this.interim_results_timer === null) {
      this.logger(
        `Пришёл первый interimResults, очищаем таймер на тишину и устанавливаем максимально возможную длину разговора в размере ${this.settings.max_asr_duration}`,
        true
      );

      clearTimeout(this.timer);

      this.max_duration_timer = setTimeout(() => {
        this.logger(
          `Максимально возможная длительность разговора в размере ${this.settings.max_asr_duration} достигнута. Перестаем слушать абонента`,
          true
        );

        this.call.stopMediaTo(this.asr);
      }, this.settings.max_asr_duration);
    }

    clearTimeout(this.interim_results_timer);

    this.logger(
      `Клиент разговаривает. Перезагружаем таймер interim_result_timer на ${this.settings.interim_result_timeout}ms`
    );
    this.interim_results_timer = setTimeout(() => {
      this.logger(
        `Interim Results - таймаут в размере ${this.settings.interim_result_timeout} достигнут. Значит клиент перестал разговаривать. Ждём последний Result и обрабатываем`
      );

      this.multiply_results_last_result = true;

      if (!this.interim_flag) {
        this.clean_up();

        this.on_input_complete(this.received_data);
      }
    }, this.settings.interim_result_timeout);
  }

  reset_dtmf_timer() {
    clearTimeout(this.dtmf_timer);

    this.logger(`Ждём нажатие следующей клавиши ${this.settings.timeout_dtmf_input}ms`);

    this.dtmf_timer = setTimeout(() => {
      this.logger(`Абонент перестал нажимать клавиши`);

      this.clean_dtmf_handlers();

      this.on_input_complete(this.received_data);
    }, this.settings.timeout_dtmf_input);
  }

  clean_up(without_dtmf_cleaning = false) {
    this.logger("Убираемся в IVR, чистим таймауты и снимаем все обработчики");

    clearTimeout(this.timer);
    clearTimeout(this.interim_results_timer);
    clearTimeout(this.max_duration_timer);

    this.logger("Таймауты очищены");

    if (this.asr) {
      this.asr.removeEventListener(ASREvents.CaptureStarted);

      this.asr.removeEventListener(ASREvents.Result);

      this.asr.removeEventListener(ASREvents.InterimResult);

      this.asr.stop();

      this.logger("Убраны все обработчики у asr. И остановили его");
    }

    if (this.created_player) {
      this.created_player.removeEventListener(PlayerEvents.Started);
      this.created_player.removeEventListener(PlayerEvents.PlaybackMarkerReached);
      this.created_player.removeEventListener(PlayerEvents.PlaybackFinished);

      this.logger("Убраны все обработчики у player");
    }

    if (this.settings.dtmf && !without_dtmf_cleaning) {
      this.clean_dtmf_handlers();
    } else {
      this.logger(
        "Не стали чистить dtmf - обработку. Должно быть мы ждём последующие нажатия клавиш, прежде чем завершить IVR"
      );
    }
  }

  clean_dtmf_handlers() {
    clearTimeout(this.dtmf_timer);

    this.call.handleTones(false);

    this.call.removeEventListener(CallEvents.ToneReceived);

    this.logger("Отключена возможность нажатия клавиш, и убран обработчик на ToneReceived");
  }

  logger(message, important = false) {
    if (this.settings.debug || important) {
      Logger.write(`Listen ( ${this.settings.name} _ ${this.settings.type} ): ${message}`);
    }
  }

  // Ниже - зона валидации

  throw_error(message) {
    let update_message = `Listen${
      this.settings && this.settings.name ? ` (${this.settings.name})` : ""
    }: ${message}`;

    throw new Error(update_message);
  }

  check_settings() {
    const { settings } = this;

    const { type } = settings;

    const { main, asr, say, play } = Listen.requires_settings;

    function compare(necessary, received, doc_object, name) {
      let result = necessary.every(neces => received.includes(neces));

      if (result) return true;

      throw new Error(`${name} должны иметь:\n${JSON.stringify(doc_object, null, 2)}`);
    }

    compare(Object.keys(main), Object.keys(settings), main, "Корневые параметры");

    if (settings.asr !== false) {
      compare(Object.keys(asr), Object.keys(settings.asr), asr, "Параметры asr");
    }

    if (settings.play && settings.say) {
      throw new Error("Определись: либо say, либо play");
    }

    if (settings.say) {
      compare(Object.keys(say), Object.keys(settings.say), say, "Параметры say");
    }

    if (settings.play) {
      compare(Object.keys(play), Object.keys(settings.play), play, "Параметры play");
    }

    if (!(type in Listen.types)) {
      throw new Error(
        "Не известный type. Возможные значения: " +
          Object.keys(Listen.types).reduce((acc, item) => {
            acc += `, ${item}`;
            return acc;
          })
      );
    }

    const additional_type_settings = Listen.requires_settings[Listen.types[type]];

    compare(
      Object.keys(additional_type_settings),
      Object.keys(settings),
      additional_type_settings,
      `Дополнительные параметры "${type}"`
    );

    if (
      type === Listen.types.multiply_results ||
      type === Listen.types.result ||
      type === Listen.types.smart_result
    ) {
      if (!settings.asr) throw new Error(`${type} обязан иметь найстройки для asr - распознавания`);
    }

    if (type === Listen.types.smart_result) {
      if (!settings.say && !settings.play) {
        throw new Error(
          `${type} обязан иметь вводный вопрос (say или play) ведь в этом смысл. Без вводного вопроса используй result`
        );
      }
    }

    if (type === Listen.types.only_dtmf) {
      if (settings.asr) {
        this.logger(
          `Warning! При ${type} asr быть не должно, параметры которые мы получили для него, использоваться не будут`,
          true
        );
        settings.asr = false;
      }

      if (!settings.dtmf) {
        throw new Error(`При ${type} параметр dtmf должен быть true`);
      }
    }
  }
}

Listen.prototype.start = start;
Listen.prototype.prompt = prompt;
Listen.prototype.player_is_stopped = player_is_stopped;
Listen.prototype.add_listeners_for_asr = add_listeners_for_asr;

Listen.error_messages = {
  missing_basic_parameters: "Необходимые аргументы: settings, on_input_complete, on_timeout",

  missing_type: "Отсуствует поле type",
  invalid_type: "Не валидный type"
};
Listen.types = {
  result: "result",
  multiply_results: "multiply_results",
  smart_result: "smart_result",
  only_dtmf: "only_dtmf"
};
Listen.requires_settings = {
  main: {
    name: "Имя IVR",
    type: "Тип IVR",
    timeout: "Таймут ожидания ответа",

    asr: "Распознавание (можно выставить false)",
    dtmf: "Ввод с помощью клавиш (можно выставить false)"
  },
  asr: {
    lang: "Язык распознавания",
    marker_time: "Момент распознавания",

    dict: "Словарь (можно выставить false)"
  },

  say: {
    text: "Текст синтеза",
    lang: "Язык синтеза"
  },
  play: {
    url: "URL записи"
  },

  [Listen.types.result]: {},
  [Listen.types.multiply_results]: {
    interim_result_timeout: "Пауза в разговоре, по которому мы посчитаем что разговор закончился",
    max_asr_duration: "Максимально возможная продолжительность разговора"
  },
  [Listen.types.smart_result]: {
    asr: `При типе ${Listen.types.smart_result} распознавание - обязательно`,
    validation:
      "Функция, которая должна вернуть булево значение, определяющая, будет ли мы брать во внимание полученный result от абонента во время воспроизведения записи"
  },
  [Listen.types.only_dtmf]: {}
};

export { Listen };
