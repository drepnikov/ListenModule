function handle_capture_started() {
  if (this.player_is_playing) {
    this.with_validation = true;

    this.logger(
      "Capture Started сработал во время вопроса, таймер не устанавливаем, требование валидации не снимаем"
    );
  } else {
    this.logger("Capture Started сработал после вопроса, снимаем требование валидации");

    this.with_validation = false;

    this.logger("Перезапустим счётчик, потому-что возможно result будет идти долго");

    this.reset_timer(this.settings.timeout_after_capture_started);
  }
}

function handle_result(e) {
  if (this.with_validation) {
    this.logger(
      "Требование валидации активно - сначала проверим по ней наговоренное пользователем, если получим true - принимаем во внимание этот result"
    );

    this.logger("Так же не забывай, что на активность валидации влияет событие interimResults");

    if (!this.settings.validation(e.text)) {
      this.logger("Result валидацию не прошёл. Игнорируем его!", true);

      return;
    } else {
      this.logger("Result прошёл валидацию!", true);
    }
  }

  this.clean_up();

  this.received_data.text = e.text;
  this.received_data.confidence.push(e.confidence);

  this.on_input_complete(this.received_data);
}

function handle_interimResults() {
  if (this.player_is_playing) {
    this.with_validation = true;
  } else {
    this.with_validation = false;
  }
}

const smart_result = {
  handle_result,
  handle_capture_started,
  handle_interimResults
};

export { smart_result };
