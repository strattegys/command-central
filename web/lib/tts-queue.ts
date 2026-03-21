/**
 * Client-side TTS queue: splits text into sentences, fires TTS requests
 * in parallel, and plays audio chunks sequentially as they resolve.
 *
 * Usage:
 *   const queue = new TtsQueue("Zephyr");
 *   // Call as streaming chunks arrive:
 *   queue.push("Hello there. How are you?");
 *   queue.push(" I'm doing well.");
 *   // When streaming is done:
 *   queue.flush();
 */

const SENTENCE_RE = /(?<=[.!?])\s+/;

export class TtsQueue {
  private voice: string;
  private buffer = "";
  private audioQueue: Promise<Blob | null>[] = [];
  private playing = false;
  private flushed = false;
  private playIndex = 0;

  constructor(voice: string) {
    this.voice = voice;
  }

  /** Feed streaming text chunks. Sentences are detected and sent to TTS. */
  push(chunk: string) {
    this.buffer += chunk;
    this.drainSentences();
  }

  /** Signal that streaming is done — send any remaining text. */
  flush() {
    this.flushed = true;
    const remaining = this.buffer.trim();
    if (remaining) {
      this.buffer = "";
      this.enqueue(remaining);
    }
    this.tryPlay();
  }

  /** Stop all playback and clear the queue. */
  stop() {
    this.flushed = true;
    this.buffer = "";
    this.audioQueue = [];
    this.playing = false;
  }

  private drainSentences() {
    // Extract complete sentences from buffer
    const parts = this.buffer.split(SENTENCE_RE);
    if (parts.length > 1) {
      // All but the last part are complete sentences
      const completeSentences = parts.slice(0, -1).join(" ").trim();
      this.buffer = parts[parts.length - 1];
      if (completeSentences) {
        this.enqueue(completeSentences);
      }
    }
  }

  private enqueue(text: string) {
    const promise = fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: this.voice }),
    })
      .then((res) => (res.ok ? res.blob() : null))
      .catch(() => null);

    this.audioQueue.push(promise);
    this.tryPlay();
  }

  private async tryPlay() {
    if (this.playing) return;
    if (this.playIndex >= this.audioQueue.length) return;

    this.playing = true;

    while (this.playIndex < this.audioQueue.length) {
      const blob = await this.audioQueue[this.playIndex];
      this.playIndex++;

      if (!blob) continue;

      const url = URL.createObjectURL(blob);
      try {
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(url);
          audio.onended = () => resolve();
          audio.onerror = () => reject();
          audio.play().catch(reject);
        });
      } catch {
        // skip failed chunks
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    this.playing = false;
  }
}
