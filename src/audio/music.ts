import { createScore } from './score';
import type { MusicScore } from './score';
import type { Synth } from './synth';
import type { MusicTrack } from './types';

export const CROSSFADE_SECONDS = 0.15;

interface PlayingTrack {
  output: GainNode;
  score: MusicScore;
  step: number;
  nextTime: number;
  timer?: ReturnType<typeof setInterval>;
}

export class MusicPlayer {
  private track?: MusicTrack;
  private playing?: PlayingTrack;

  constructor(private synth: Synth) {}

  play(track: MusicTrack): void {
    if (this.track === track) return;
    this.stop();
    this.track = track;
    const now = this.synth.context.currentTime;
    const output = this.synth.context.createGain();
    output.gain.setValueAtTime(0, now);
    output.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
    output.connect(this.synth.music);
    const playing: PlayingTrack = {
      output,
      score: createScore(track),
      step: 0,
      nextTime: now + 0.02,
    };
    this.playing = playing;
    this.schedule(playing);
    playing.timer = setInterval(() => this.schedule(playing), 25);
  }

  stop(): void {
    this.track = undefined;
    const playing = this.playing;
    if (!playing) return;
    this.playing = undefined;
    clearInterval(playing.timer);
    const now = this.synth.context.currentTime;
    const gain = playing.output.gain;
    gain.cancelAndHoldAtTime(now);
    gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS);
    this.synth.stopOutput(playing.output, now + CROSSFADE_SECONDS);
    setTimeout(
      () => {
        this.synth.stopOutput(playing.output);
        playing.output.disconnect();
      },
      CROSSFADE_SECONDS * 1000 + 25,
    );
  }

  private schedule(playing: PlayingTrack): void {
    const context = this.synth.context;
    if (context.state === 'closed') {
      clearInterval(playing.timer);
      return;
    }
    // Retoma no tempo atual depois de uma aba em segundo plano, sem rajada de notas atrasadas.
    playing.nextTime = Math.max(playing.nextTime, context.currentTime);
    while (playing.nextTime < context.currentTime + 0.12) {
      const voices = playing.score.steps[playing.step];
      if (!voices) {
        clearInterval(playing.timer);
        return;
      }
      this.synth.play(voices, playing.output, playing.nextTime);
      playing.nextTime += playing.score.stepSeconds;
      playing.step++;
      if (playing.score.loop) playing.step %= playing.score.steps.length;
    }
  }
}
