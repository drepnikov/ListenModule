function handle_capture_started() {
  if (this.player_is_playing) {
    this.logger("Остановили запись, потому-что задетектили голос абонента");
    this.created_player.stop();
  }

  if (this.interim_results_timer === null) {
    this.logger(
      "Это первый capture_started (interimResults ещё не происходило). Перезапустим счётчик на тишину, потому-что возможно interimResult'a и Result'a не будет"
    );

    this.reset_timer(this.settings.timeout_after_capture_started);
  }
}

function handle_result(e) {
  this.received_data.text += this.received_data.text.length ? ` ${e.text}` : e.text;

  this.received_data.confidence.push(e.confidence);

  if (this.interim_results_timer === null) {
    this.logger(
      "Пришёл result, без interimResults. Данный result будем считать за interimResults. И также перезагрузим счетчик"
    );

    this.reset_interim_results_timer();
  }

  if (this.multiply_results_last_result) {
    this.clean_up();

    this.on_input_complete(this.received_data);
  } else {
    this.interim_flag = false;
  }
}

function handle_interimResults() {
  if (!this.multiply_results_last_result) {
    this.interim_flag = true;
    this.reset_interim_results_timer();
  }
}

const multiply_results = {
  handle_result,
  handle_capture_started,
  handle_interimResults
};

export { multiply_results };
