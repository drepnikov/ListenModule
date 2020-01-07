import { result } from "./handlers/asr/result";
import { multiply_results } from "./handlers/asr/multiply_results";
import { smart_result } from "./handlers/asr/smart_result";

export function add_listeners_for_asr(type) {
  const {
    constructor: { types }
  } = this;

  if (type == types.result) {
    const events = this.bind_handlers(result);

    this.asr.addEventListener(ASREvents.CaptureStarted, events.handle_capture_started);
    this.asr.addEventListener(ASREvents.Result, events.handle_result);
  } else if (type == types.multiply_results) {
    const events = this.bind_handlers(multiply_results);

    this.asr.addEventListener(ASREvents.CaptureStarted, events.handle_capture_started);
    this.asr.addEventListener(ASREvents.InterimResult, events.handle_interimResults);
    this.asr.addEventListener(ASREvents.Result, events.handle_result);
  } else if (type == types.smart_result) {
    const events = this.bind_handlers(smart_result);

    this.asr.addEventListener(ASREvents.CaptureStarted, events.handle_capture_started);
    this.asr.addEventListener(ASREvents.InterimResult, events.handle_interimResults);
    this.asr.addEventListener(ASREvents.Result, events.handle_result);
  } else {
    throw new Error(`add_listenets_for_asr: что-то пошло не так. Не верный type: ${type}`);
  }
}
