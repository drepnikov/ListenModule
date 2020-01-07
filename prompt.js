export function prompt() {
  const {
    settings: { type, say, play },
    constructor: { types }
  } = this;

  this.player_is_playing = true;

  if (say) {
    this.logger("Данный IVR использует синтез. Создаём.");

    this.created_player = VoxEngine.createTTSPlayer(say.text, say.lang);
  } else if (play) {
    this.logger("Данный IVR использует mp3-плеер. Создаём.");

    this.created_player = VoxEngine.createURLPlayer(play.url);
  } else {
    this.logger("Данный IVR не использует вводного плеера (say или play не найдены).");

    this.player_is_stopped();

    if (this.settings.asr) {
      this.logger("Начинаем слушать абонента прямо сейчас");
      this.call.sendMediaTo(this.asr);
    }

    return;
  }

  this.created_player.sendMediaTo(this.call);

  if (this.settings.asr) {
    const { marker_time } = this.settings.asr;

    this.created_player.addMarker(marker_time);

    if (type === types.smart_result) {
      this.logger(
        `Warning! При типе ${types.smart_result}, marker_time будет означать с какого момента ответ абонента не будет проходить дополнительную проверку. А слушать, мы начинаем его прямо сейчас.`,
        true
      );

      this.logger(
        `Так же, желательно, чтобы marker_time был как можно ближе к концу записи, например около -100, полученный marker_time: ${marker_time}`,
        true
      );

      this.call.sendMediaTo(this.asr);
    } else {
      this.logger(
        `Начнем слушать абонента ${
          marker_time >= 0
            ? `через ${marker_time}мс после начала`
            : `за ${Math.abs(marker_time)}мс до конца`
        } записи`,
        true
      );
    }

    this.created_player.addEventListener(PlayerEvents.PlaybackMarkerReached, e => {
      this.logger(`marker_time ${e.offset}мс достигнут!`, true);

      if (type === types.smart_result) {
        this.logger(
          `Именно с этого момента ${types.smart_result} будет любой result обрабатывать как обычно, без предварительной проверки`
        );

        this.player_is_playing = false; // просто устанавливаем то что запись закончилась
      } else {
        this.logger("Начинаем слушать абонента");
        this.call.sendMediaTo(this.asr);
      }
    });
  }

  this.created_player.addEventListener(PlayerEvents.Started, e => {
    if (this.settings.asr) {
      if (e.duration - Math.abs(this.settings.asr.marker_time) < 0)
        this.logger(
          "Warning! marker_time больше продолжительности записи. Это приведет к багам распознавания",
          true
        );
    }
  });
  this.created_player.addEventListener(PlayerEvents.PlaybackFinished, () => {
    this.player_is_stopped();
  });
}

export function player_is_stopped() {
  this.player_is_playing = false;

  this.logger("Воспроизведение вводного вопроса завершено (или он отсуствовал)");

  this.reset_timer();
}
