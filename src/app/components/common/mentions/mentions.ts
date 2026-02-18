import { Component, input, output, effect, signal, computed, ElementRef, inject, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OverlayModule, ConnectedPosition, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { NgOptimizedImage } from '@angular/common';
import { UserService } from '@/services/user.service';
import { IUser } from '@/interfaces/IUser';
import { onImageError, getImageUrlOrDefault } from '@/utils/helper';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of, from } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { HapticService } from '@/services/haptic.service';
@Component({
  selector: 'mentions',
  standalone: true,
  imports: [CommonModule, OverlayModule, NgOptimizedImage],
  templateUrl: './mentions.html',
  styleUrl: './mentions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Mentions {
  // Inputs
  textareaRef = input.required<ElementRef<HTMLTextAreaElement>>();
  control = input<FormControl>();
  overlayOrigin = input.required<CdkOverlayOrigin>();
  position = input<'above' | 'below'>('below'); // 'above' for comments, 'below' for new-post

  // Outputs
  userSelected = output<IUser>();

  // Services
  private userService = inject(UserService);
  private destroyRef = inject(DestroyRef);
  private searchSubject = new Subject<string>();
  hapticService = inject(HapticService);
  // Signals
  showMentions = signal(false);
  activeIndex = signal(0);
  mentionQuery = signal('');
  allUsers = signal<IUser[]>([]);
  isLoading = signal(false);

  // Overlay positions - computed based on position input
  positions = computed<ConnectedPosition[]>(() => {
    const pos = this.position();
    if (pos === 'above') {
      return [
        {
          originX: 'start',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'bottom',
          offsetY: -1
        }
      ];
    } else {
      return [
        {
          originX: 'start',
          originY: 'bottom',
          overlayX: 'start',
          overlayY: 'top'
        }
      ];
    }
  });

  constructor() {
    // Setup debounced user search
    this.searchSubject
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((searchText: string) => {
          if (!searchText || searchText.trim() === '') {
            this.allUsers.set([]);
            this.isLoading.set(false);
            return of({ users: [], pagination: { totalCount: 0, currentPage: 1, totalPages: 0 } });
          }

          this.isLoading.set(true);

          return from(this.userService.searchUsers(searchText.trim(), 1, 20)).pipe(
            catchError((error) => {
              console.error('Error searching users:', error);
              this.isLoading.set(false);
              return of({ users: [], pagination: { totalCount: 0, currentPage: 1, totalPages: 0 } });
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.allUsers.set(response.users || []);
        this.isLoading.set(false);
      });

    // Watch for textarea input changes
    effect(() => {
      const textarea = this.textareaRef()?.nativeElement;
      if (!textarea) return;

      const handleInput = (event: Event) => this.onTextInput(event);

      textarea.addEventListener('input', handleInput);

      return () => {
        textarea.removeEventListener('input', handleInput);
      };
    });
  }

  onTextInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const value = textarea.value;

    // Match @username including dots, underscores, and hyphens (allow empty for just @)
    const match = value.match(/@([\w.]*)$/);

    if (match) {
      const query = match[1] || '';
      this.mentionQuery.set(query);
      this.showMentions.set(true);
      this.activeIndex.set(0);

      if (query.trim()) {
        this.searchSubject.next(query);
      } else {
        this.searchSubject.next('a'); // Use 'a' to get initial results when just @ is typed
      }
    } else {
      this.showMentions.set(false);
    }
  }

  selectMention(user: IUser): void {
    console.log(user);
    const textarea = this.textareaRef()?.nativeElement;
    if (!textarea) return;

    const currentValue = textarea.value;
    console.log('currentValue:', currentValue);

    // Match @username including dots (allow empty for just @)
    const match = currentValue.match(/@([\w.]*)$/);
    console.log('match:', match);

    if (match) {
      const beforeAt = currentValue.substring(0, match.index);
      const afterAt = currentValue.substring(match.index! + match[0].length);
      const username = user.username || '';
      const newValue = `${beforeAt}@${username} ${afterAt}`;

      textarea.value = newValue;

      // Update form control if provided
      const formCtrl = this.control();
      if (formCtrl) {
        formCtrl.setValue(newValue);
      }

      // Set cursor position after the inserted mention
      const cursorPosition = beforeAt.length + username.length + 2; // +2 for @ and space
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    }

    this.showMentions.set(false);
    this.userSelected.emit(user);
    this.allUsers.set([]);
    this.searchSubject.next('');
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  onImageError(event: Event): void {
    onImageError(event);
  }
}
