import { handle_tone_received } from "./handlers/dtmf";

export function start(call) {
  const {
    constructor: { create_asr_object },
    settings: { asr, type, dtmf }
  } = this;

  this.call = call;

  if (asr) {
    this.logger("Данный IVR использует asr. Создаём.");

    const asr_object = create_asr_object(asr, type);

    this.logger(`asr-аргументы: ${JSON.stringify(asr_object)}`);

    this.asr = VoxEngine.createASR(asr_object);

    this.add_listeners_for_asr(type);
  } else {
    this.logger("Данный IVR не использует asr");
  }

  if (dtmf) {
    this.call.handleTones(true);

    this.call.addEventListener(CallEvents.ToneReceived, handle_tone_received.bind(this));

    this.logger("Включили dtmf - функционал");
  }

  this.prompt();
}
