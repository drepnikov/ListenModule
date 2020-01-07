export function handle_tone_received(e) {
  if (this.player_is_playing) {
    this.logger("Остановили запись, потому-что задетектили нажатие клавиш");
    this.created_player.stop();
  }

  if (this.dtmf_timer === null) {
    this.logger(
      "Задетектили первое нажатие клавиши, подчищаем IVR (удаляем обработчики), оставляя только логику нажатия клавиш"
    );

    this.clean_up(true);
  }

  this.received_data.dtmf += e.tone;

  this.logger(`Набранный dtmf: ${this.received_data.dtmf}`, true);

  this.reset_dtmf_timer();
}
