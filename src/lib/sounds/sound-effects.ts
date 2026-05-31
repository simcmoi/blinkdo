/**
 * Générateur de sons synthétiques pour les effets sonores de l'app
 */

import type { SoundSettings } from '@/types/todo'

export type SoundType = 'add' | 'delete' | 'complete' | 'toggle'

class SoundEffects {
  private audioContext: AudioContext | null = null
  private settings: SoundSettings = {
    enabled: true,
    onCreate: true,
    onComplete: true,
    onDelete: true,
  }

  constructor() {
    // AudioContext créé paresseusement au premier son
  }

  private ensureContext(): AudioContext | null {
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume()
      }
      return this.audioContext
    }

    if (typeof window === 'undefined') return null

    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      this.audioContext = new Ctor()
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume()
      }
    } catch (error) {
      console.warn('AudioContext not supported:', error)
      return null
    }

    return this.audioContext
  }

  setSettings(settings: SoundSettings): void {
    this.settings = settings
  }

  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3): void {
    const ctx = this.ensureContext()
    if (!this.settings.enabled || !ctx) return

    try {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = frequency
      oscillator.type = type

      const now = ctx.currentTime
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration)

      oscillator.start(now)
      oscillator.stop(now + duration)
    } catch (error) {
      console.warn('Failed to play sound:', error)
    }
  }

  playAdd(): void {
    if (!this.settings.enabled || !this.settings.onCreate) return
    this.playTone(440, 0.05, 'sine', 0.15)
    setTimeout(() => this.playTone(554, 0.08, 'sine', 0.2), 30)
  }

  playDelete(): void {
    if (!this.settings.enabled || !this.settings.onDelete) return
    this.playTone(660, 0.06, 'sine', 0.2)
    setTimeout(() => this.playTone(440, 0.08, 'sine', 0.15), 20)
  }

  playComplete(): void {
    if (!this.settings.enabled || !this.settings.onComplete) return
    this.playTone(523, 0.06, 'sine', 0.15)
    setTimeout(() => this.playTone(659, 0.06, 'sine', 0.15), 40)
    setTimeout(() => this.playTone(784, 0.12, 'sine', 0.2), 80)
  }

  playToggle(): void {
    if (!this.settings.enabled || !this.settings.onComplete) return
    this.playTone(440, 0.08, 'sine', 0.15)
  }

  play(type: SoundType): void {
    switch (type) {
      case 'add':
        this.playAdd()
        break
      case 'delete':
        this.playDelete()
        break
      case 'complete':
        this.playComplete()
        break
      case 'toggle':
        this.playToggle()
        break
    }
  }
}

// Instance singleton
export const soundEffects = new SoundEffects()
