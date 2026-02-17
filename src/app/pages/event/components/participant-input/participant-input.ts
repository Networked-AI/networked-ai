import { IUser } from '@/interfaces/IUser';
import { Button } from '@/components/form/button';
import { UserService } from '@/services/user.service';
import { Searchbar } from '@/components/common/searchbar';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { Component, input, output, signal, ChangeDetectionStrategy, effect, inject, OnDestroy } from '@angular/core';

@Component({
  selector: 'participant-input',
  styleUrl: './participant-input.scss',
  templateUrl: './participant-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, Button, Searchbar, NgOptimizedImage]
})
export class ParticipantInput implements OnDestroy {
  private userService = inject(UserService);
  private searchTimeout?: ReturnType<typeof setTimeout>;

  label = input<string>('');
  type = input<'CoHost' | 'Sponsor' | 'Speaker'>('CoHost');
  selectedUsers = input<IUser[]>([]);

  usersChange = output<IUser[]>();

  users = signal<IUser[]>([]);
  searchQuery = signal<string>('');
  filteredUsers = signal<IUser[]>([]);
  isSearching = signal<boolean>(false);
  showSearch = signal<boolean>(false);

  constructor() {
    effect(() => {
      const selectedUsers = this.selectedUsers();
      this.users.set([...selectedUsers]);
    });
  }

  onAddClick(): void {
    this.showSearch.set(true);
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!value || value.trim() === '') {
      this.filteredUsers.set([]);
      this.isSearching.set(false);
      return;
    }

    this.isSearching.set(true);

    this.searchTimeout = setTimeout(async () => {
      try {
        const searchTerm = value.trim();
        if (!searchTerm) {
          this.filteredUsers.set([]);
          this.isSearching.set(false);
          return;
        }

        const searchResults = await this.userService.searchUsers(searchTerm);
        const mappedUsers = this.mapIUserToUser(searchResults.users);
        const currentUserIds = new Set(this.users().map((u) => u.id));
        const filtered = mappedUsers.filter((user) => user.id && !currentUserIds.has(user.id));

        this.filteredUsers.set(filtered);
        this.isSearching.set(false);
      } catch (error) {
        console.error('Error searching users:', error);
        this.filteredUsers.set([]);
        this.isSearching.set(false);
      }
    }, 300);
  }

  private mapIUserToUser(users: IUser[]): IUser[] {
    return users.map((user) => ({
      id: user.id,
      name: user.name || 'User',
      thumbnail_url: user.thumbnail_url || 'assets/images/profile.jpeg',
      email: user.email || undefined,
      phone: user.mobile || undefined
    }));
  }

  onSelectUser(user: any): void {
    const currentUsers = this.users();
    const { id, ...rest } = user;
    const normalizedUser: IUser = {
      ...rest,
      user_id: user.user_id ?? id
    };
    const isAlreadySelected = currentUsers.some((u) => u.user_id === normalizedUser.user_id);
    if (isAlreadySelected) return;

    const updatedUsers = [...currentUsers, normalizedUser];

    this.users.set(updatedUsers);
    this.searchQuery.set('');
    this.filteredUsers.set([]);
    this.showSearch.set(false);

    this.usersChange.emit(updatedUsers);
  }

  onRemoveUser(userId: string): void {
    const updatedUsers = this.users().filter((u) => u.user_id !== userId);
    this.users.set(updatedUsers);
    this.usersChange.emit(updatedUsers);
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }
}
