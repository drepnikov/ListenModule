function handle_capture_started() {
  if (this.player_is_playing) {
    this.logger("Остановили запись, потому-что задетектили голос абонента");
    this.created_player.stop();
  }

  this.logger("Перезапустим счётчик, потому-что возможно result будет идти долго");

  this.reset_timer(this.settings.timeout_after_capture_started);
}

function handle_result(e) {
  this.clean_up();

  this.received_data.text = e.text;
  this.received_data.confidence.push(e.confidence);

  this.on_input_complete(this.received_data);
}

const result = {
  handle_result,
  handle_capture_started
};

export { result };
