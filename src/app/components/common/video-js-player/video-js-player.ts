import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';

@Component({
  selector: 'video-js-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './video-js-player.html',
  styleUrl: './video-js-player.scss'
})
export class VideoJsPlayerComponent implements AfterViewInit {
  videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');

  src = input<string | null>(null);
  pauseOthers = input<boolean>(false);
  groupId = signal('default');

  private player: Player | null = null;
  private static groups = new Map<string, Set<Player>>();

  constructor() {
    effect(() => {
      const url = this.src();
      if (this.player && url) this.player.src({ src: url, type: 'video/mp4' });
    });
  }

  ngAfterViewInit(): void {
    const el = this.videoEl()?.nativeElement;
    if (!el) return;

    const options = {
      controls: true,
      muted: false,
      loop: false,
      fluid: true,
      responsive: true,
      preload: 'metadata' as const,
      sources: this.src() ? [{ src: this.src()!, type: 'video/mp4' }] : []
    };

    this.player = videojs(el, options);

    if (this.pauseOthers()) {
      this.register(this.player, this.groupId());
      this.player.on('play', () => this.onPlay(this.player!, this.groupId()));
    }
  }

  register(player: Player, groupId = 'default'): void {
    let set = VideoJsPlayerComponent.groups.get(groupId);
    if (!set) {
      set = new Set();
      VideoJsPlayerComponent.groups.set(groupId, set);
    }
    set.add(player);
  }

  onPlay(currentPlayer: Player, groupId = 'default'): void {
    const set = VideoJsPlayerComponent.groups.get(groupId);
    if (!set) return;

    set.forEach((p) => {
      if (p !== currentPlayer && !p.paused()) p.pause();
    });
  }
}