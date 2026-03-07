import { IUser } from '@/interfaces/IUser';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { NgOptimizedImage } from '@angular/common';
import { Button } from '@/components/form/button';
import { UserService } from '@/services/user.service';
import { ModalService } from '@/services/modal.service';
import { EventService } from '@/services/event.service';
import { Searchbar } from '@/components/common/searchbar';
import { ToasterService } from '@/services/toaster.service';
import { PopoverService } from '@/services/popover.service';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { IonHeader, IonToolbar, IonContent, IonFooter } from '@ionic/angular/standalone';
import { FormGroup, FormArray, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Input, inject, signal, OnInit, Component, ChangeDetectionStrategy, computed } from '@angular/core';
@Component({
  selector: 'manage-role-modal',
  styleUrl: './manage-role-modal.scss',
  templateUrl: './manage-role-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonFooter, IonContent, IonHeader, IonToolbar, SelectModule, ReactiveFormsModule, Searchbar, ButtonModule, NgOptimizedImage, Button]
})
export class ManageRoleModal implements OnInit {
  // services
  private fb = inject(FormBuilder);
  private modalService = inject(ModalService);
  private eventService = inject(EventService);
  private userService = inject(UserService);
  private toasterService = inject(ToasterService);
  popoverService = inject(PopoverService);
  searchQuery = signal<string>('');
  isAddMode = signal<boolean>(false);
  selectedRole = signal<string>('');
  filteredUsers = signal<IUser[]>([]);
  isLoading = signal<boolean>(false);
  isLoadingRoles = signal<boolean>(false);
  isSearching = signal<boolean>(false);
  selectedMembers = signal<IUser[]>([]);

  // inputs
  @Input() eventId: string = '';

  // signals
  form = signal<FormGroup>(
    this.fb.group({
      users: this.fb.array([])
    })
  );

  roles = signal([
    { name: 'None', value: 'None' },
    { name: 'Staff', value: 'Staff' },
    { name: 'Cohost', value: 'CoHost' },
    { name: 'Sponsor', value: 'Sponsor' },
    { name: 'Speaker', value: 'Speaker' }
  ]);

  items = [
    {
      label: 'Add Cohost',
      icon: 'pi pi-plus',
      command: () => this.addParticipant('CoHost')
    },
    {
      label: 'Add Sponsor',
      icon: 'pi pi-plus',
      command: () => this.addParticipant('Sponsor')
    },
    {
      label: 'Add Speaker',
      icon: 'pi pi-plus',
      command: () => this.addParticipant('Speaker')
    },
    {
      label: 'Add Staff',
      icon: 'pi pi-plus',
      command: () => this.addParticipant('Staff')
    }
  ];

  title = computed(() => {
    return this.isAddMode() ? `Add ${this.selectedRole()}` : 'Manage Roles';
  });

  async ngOnInit() {
    this.isLoadingRoles.set(true);
    const eventData = await this.eventService.getEventById(this.eventId);
    this.form.set(
      this.fb.group({
        users: this.fb.array(
          eventData.participants
            .filter((user: any) => user.role !== 'Host')
            .map((user: any) =>
              this.fb.group({
                id: [user.user_id],
                name: [user.user.name],
                username: [user.user.username],
                image: [user.user.thumbnail_url],
                role: [user.role ?? 'None']
              })
            )
        )
      })
    );
    this.isLoadingRoles.set(false);
  }

  get usersFormArray(): FormArray {
    return this.form().get('users') as FormArray;
  }

  filteredParticipants = computed(() => {
    const query = this.searchQuery().toLowerCase();

    return this.usersFormArray.controls.filter((user) => {
      const username = user.value.username;

      // skip users without username
      if (!username) return false;

      return username.toLowerCase().includes(query);
    });
  });

  ChangeMode(): void {
    this.isAddMode.set(false);
    this.selectedRole.set('');
    this.searchQuery.set('');
    this.filteredUsers.set([]);
    this.isSearching.set(false);
    this.selectedMembers.set([]);
  }

  searchUsers(value: string): void {
    this.searchQuery.set(value);

    if (!value || value.trim() === '') {
      this.filteredUsers.set([]);
      this.isSearching.set(false);
      return;
    }

    this.isSearching.set(true);

    setTimeout(async () => {
      try {
        const searchTerm = value.trim();
        if (!searchTerm) {
          this.filteredUsers.set([]);
          this.isSearching.set(false);
          return;
        }

        const searchResults = await this.userService.searchUsers(searchTerm);
        this.filteredUsers.set(searchResults.users);
        this.isSearching.set(false);
      } catch (error) {
        console.error('Error searching users:', error);
        this.filteredUsers.set([]);
        this.isSearching.set(false);
      }
    }, 300);
  }

  close() {
    this.modalService.close();
  }

  async changeRole(index: number, role: string): Promise<void> {
    this.isLoading.set(true);
    const payload = this.usersFormArray.at(index).value;

    const response = await this.eventService.manageRoles(this.eventId, { user_id: payload.id, role: role });
    if (response) {
      this.toasterService.showSuccess('Role updated successfully');
      this.usersFormArray.at(index).get('role')?.setValue(role);
    } else {
      this.toasterService.showError('Failed to update role');
    }
    this.isLoading.set(false);
  }

  addParticipant(role: string) {
    this.isAddMode.set(true);
    this.selectedRole.set(role);
    this.searchUsers('a');
    this.closePopover();
  }

  isAlreadyInGroup(userId: string): boolean {
    return this.usersFormArray.controls.some((user) => user.value.id === userId);
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  getDiamondPath(user: IUser): string {
    const points = user?.total_gamification_points || 0;
    if (points >= 50000) return '/assets/svg/gamification/diamond-50k.svg';
    if (points >= 40000) return '/assets/svg/gamification/diamond-40k.svg';
    if (points >= 30000) return '/assets/svg/gamification/diamond-30k.svg';
    if (points >= 20000) return '/assets/svg/gamification/diamond-20k.svg';
    if (points >= 10000) return '/assets/svg/gamification/diamond-10k.svg';
    if (points >= 5000) return '/assets/svg/gamification/diamond-5k.svg';
    return '/assets/svg/gamification/diamond-1k.svg';
  }

  removeMember(user: IUser): void {
    this.selectedMembers.update((list) => list.filter((u) => u.id !== user.id));
  }

  isSelected(id: string): boolean {
    return this.selectedMembers().some((u) => u.id === id);
  }

  toggleMember(user: IUser): void {
    if (this.isAlreadyInGroup(user.id)) {
      return;
    }

    const isAlreadySelected = this.selectedMembers().some((u) => u.id === user.id);
    if (isAlreadySelected) {
      this.selectedMembers.update((list) => list.filter((u) => u.id !== user.id));
    } else {
      this.selectedMembers.update((list) => [...list, user]);
    }
  }

  addAndSave(): void {
    this.selectedMembers().forEach((member) => {
      this.usersFormArray.push(
        this.fb.group({
          id: [member.id],
          name: [member.name],
          username: [member.username],
          image: [member.thumbnail_url],
          role: [this.selectedRole()]
        })
      );

      this.changeRole(this.usersFormArray.controls.length - 1, this.selectedRole());
    });
    this.ChangeMode();
  }

  openPopover(event: Event): void {
    this.popoverService.openCommonPopover(event, this.items);
  }

  closePopover(): void {
    this.popoverService.close();
  }
}
