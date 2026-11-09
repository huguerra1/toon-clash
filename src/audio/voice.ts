export function announcerText(text: string): string {
  return text
    .trim()
    .replace(/\bK\s*\.?\s*O\.?(?=[!?\s]|$)/gi, 'Nocaute')
    .replace(/\bTOONALITY\b/gi, 'Tunáliti');
}

/** Fila pequena para chamadas próximas não se interromperem nem acumularem atraso. */
export class Announcer {
  private queue: string[] = [];
  private active?: SpeechSynthesisUtterance;
  private level = 1;

  say(text: string, volume: number): void {
    try {
      if (!globalThis.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return;
      const normalized = announcerText(text);
      if (!normalized || volume <= 0) return;
      this.level = volume;
      if (this.queue.length >= 3) this.queue.shift();
      this.queue.push(normalized);
      this.next();
    } catch {
      this.queue = [];
      this.active = undefined;
    }
  }

  setVolume(volume: number): void {
    this.level = volume;
    if (volume <= 0) this.cancel();
    else if (this.active) this.active.volume = volume;
  }

  cancel(): void {
    this.queue = [];
    const wasActive = this.active !== undefined;
    this.active = undefined;
    try {
      if (wasActive) globalThis.speechSynthesis?.cancel();
    } catch {
      /* Locução indisponível: permanece em silêncio. */
    }
  }

  private next(): void {
    if (this.active) return;
    const text = this.queue.shift();
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.volume = this.level;
    const voice = globalThis.speechSynthesis
      .getVoices()
      .find((voice) => /^pt[-_]BR$/i.test(voice.lang));
    if (voice) utterance.voice = voice;
    const finish = () => {
      if (this.active !== utterance) return;
      this.active = undefined;
      try {
        this.next();
      } catch {
        this.queue = [];
        this.active = undefined;
      }
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    this.active = utterance;
    globalThis.speechSynthesis.speak(utterance);
  }
}
