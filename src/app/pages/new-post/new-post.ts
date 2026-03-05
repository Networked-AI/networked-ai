import { Pagination } from 'swiper/modules';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Chip } from '@/components/common/chip';
import { Button } from '@/components/form/button';
import { ModalService } from '@/services/modal.service';
import { FeedService } from '@/services/feed.service';
import { ToasterService } from '@/services/toaster.service';
import { AuthService } from '@/services/auth.service';
import { MediaService } from '@/services/media.service';
import { UserService } from '@/services/user.service';
import { PostEventCard } from '@/components/card/post-event-card';
import { Mentions } from '@/components/common/mentions';
import { OverlayModule } from '@angular/cdk/overlay';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  Component,
  inject,
  signal,
  viewChild,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
  computed,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA
} from '@angular/core';
import { Router } from '@angular/router';
import { IonToolbar, IonHeader, IonContent, NavController, IonFooter, IonIcon, IonicSlides } from '@ionic/angular/standalone';
import { FeedPost } from '@/interfaces/IFeed';
import { IUser } from '@/interfaces/IUser';
import { SwiperContainer } from 'swiper/element';
import { onImageError, getImageUrlOrDefault } from '@/utils/helper';
import { VideoJsPlayerComponent } from '@/components/common/video-js-player';
import { TextareaModule } from 'primeng/textarea';

@Component({
  selector: 'new-post',
  styleUrl: './new-post.scss',
  templateUrl: './new-post.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    Chip,
    Button,
    IonIcon,
    IonHeader,
    IonFooter,
    IonContent,
    IonToolbar,
    CommonModule,
    PostEventCard,
    DragDropModule,
    ReactiveFormsModule,
    NgOptimizedImage,
    Mentions,
    TextareaModule,
    OverlayModule,
    VideoJsPlayerComponent
  ]
})
export class NewPost implements OnInit {
  @ViewChild('textareaEl') textareaRef!: ElementRef<HTMLTextAreaElement>;
  fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  cd = inject(ChangeDetectorRef);
  navCtrl = inject(NavController);
  router = inject(Router);
  private fb = inject(FormBuilder);
  modalService = inject(ModalService);
  feedService = inject(FeedService);
  toasterService = inject(ToasterService);
  authService = inject(AuthService);
  mediaService = inject(MediaService);
  userService = inject(UserService);

  text = '';
  swiperModules = [IonicSlides, Pagination];
  postMediaSwiperEl = viewChild<ElementRef<SwiperContainer>>('postMediaSwiper');
  textCtrl: FormControl = new FormControl('');

  // Track mentioned users: username -> user ID
  private mentionedUsers = new Map<string, string>();

  currentSlide = signal(0);
  loading = signal<boolean>(false);
  mediaItems = signal<any[]>([]);
  isLoading = signal<boolean>(false);
  postLoading = signal<boolean>(false);
  visibility = signal<'public' | 'private'>('public');
  eventsCount = signal<number>(0);

  // Edit mode
  postId = signal<string | null>(null);
  isEditMode = computed(() => !!this.postId());

  // Reactive text content signal
  textContent = signal<string>('');

  // Computed signal to check if post can be submitted
  // At least one of: text content, media, or event is required
  isPostDisabled = computed(() => {
    const hasContent = this.textContent()?.trim().length > 0;
    const hasMedia = this.mediaItems().length > 0;
    const hasEvent = this.eventsCount() > 0;

    // Post is disabled if none of the three conditions are met
    return !(hasContent || hasMedia || hasEvent);
  });

  // Current user data
  currentUser = this.authService.currentUser;
  currentUserName = computed(() => this.currentUser()?.name || this.currentUser()?.username || '');
  currentUserImage = computed(() => {
    const user = this.currentUser();
    const imageUrl = user?.thumbnail_url;
    return getImageUrlOrDefault(imageUrl);
  });

  form = signal<FormGroup>(
    this.fb.group({
      location: [''],
      latitude: [''],
      longitude: [''],
      events: this.fb.array([])
    })
  );

  ngOnInit() {
    const navigationState: any = this.router.currentNavigation()?.extras?.state;
    if (navigationState?.defaultVisibility === 'networked') {
      this.visibility.set('private');
    } else {
      this.visibility.set('public');
    }
    if (navigationState?.postId && navigationState?.post) {
      this.postId.set(navigationState.postId);
      this.loadPostData(navigationState.post);
    }

    this.textCtrl.valueChanges.subscribe((content) => {
      this.textContent.set(content || '');
    });

    // Initialize textContent with current value
    this.textContent.set(this.textCtrl.value || '');
  }

  private loadPostData(post: FeedPost): void {
    // Load mentions - store user mappings for mention_ids extraction
    if (post.mentions && post.mentions.length > 0) {
      post.mentions.forEach((mention) => {
        if (mention.username && mention.id) {
          this.mentionedUsers.set(mention.username.toLowerCase(), mention.id);
        }
      });
    }

    // Set content
    if (post.content) {
      this.textCtrl.setValue(post.content);
      this.textContent.set(post.content);
    }

    // Load visibility
    this.visibility.set(post.is_public ? 'public' : 'private');

    // Load location
    this.form().patchValue({
      location: post.address,
      latitude: post.latitude || '',
      longitude: post.longitude || ''
    });

    // Load events
    if (post.events && post.events.length > 0) {
      const eventFormArray = this.eventsArray();
      post.events.forEach((event) => {
        if (event.id) {
          eventFormArray.push(this.fb.control(event));
        }
      });
      this.eventsCount.set(eventFormArray.controls.length);
    }

    // Load medias (sort by order)
    if (post.medias && post.medias.length > 0) {
      const mediaItems = post.medias
        .slice() // Create a copy to avoid mutating the original array
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) // Sort by order
        .map((media) => ({
          id: crypto.randomUUID(),
          type: media.media_type === 'Video' ? 'video' : 'image',
          url: media.media_url || ''
        }));
      this.mediaItems.set(mediaItems);
    }

    this.cd.detectChanges();
  }

  onSlideChange(event: Event) {
    const { activeIndex } = (event.target as SwiperContainer).swiper;
    this.currentSlide.set(activeIndex);
  }

  setVisibility(type: 'public' | 'private') {
    this.visibility.set(type);
  }

  drop(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.mediaItems(), event.previousIndex, event.currentIndex);
  }

  openFilePicker() {
    this.fileInput()?.nativeElement.click();
  }

  async openLocationModal() {
    const { address, latitude, longitude } = await this.modalService.openLocationModal();
    if (address) {
      this.form().patchValue({
        location: address,
        latitude: latitude || '',
        longitude: longitude || ''
      });
    }
    this.cd.detectChanges();
  }

  onBrowseFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const files = Array.from(input.files);

    const newItems = files.map((file) => ({
      id: crypto.randomUUID(),
      type: file.type.startsWith('video') ? 'video' : 'image',
      file,
      url: URL.createObjectURL(file)
    }));

    this.mediaItems.update((list) => [...list, ...newItems]);
    input.value = '';

    this.goToLastSlide();
  }

  async openEventModal() {
    const data = await this.modalService.openPostEventModal();
    if (!data) return;

    const exists = this.eventsArray().controls.some((ctrl) => ctrl.value.id === data.id);

    if (!exists) {
      this.eventsArray().push(this.fb.control(data));
      this.eventsCount.set(this.eventsArray().controls.length);
    }
    this.cd.detectChanges();
  }

  autoResize(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  async openNetworkedGallery(): Promise<void> {
    const data = await this.modalService.openImageGalleryModal();
    if (!data) return;

    const urls = this.toArray(data);

    const items = urls.map((url) => ({
      id: crypto.randomUUID(),
      type: 'image',
      url
    }));

    this.mediaItems.update((list) => [...list, ...items]);
    this.goToLastSlide();
  }

  toArray(value: string | string[]): string[] {
    return Array.isArray(value) ? value : [value];
  }

  deleteMedia(index: number) {
    this.mediaItems.update((items) => {
      items.splice(index, 1);
      return [...items];
    });

    this.goToSlide(index - 1);
  }

  goToSlide(index: number) {
    const swiper = this.postMediaSwiperEl()?.nativeElement?.swiper;
    if (!swiper || index < 0) return;

    this.currentSlide.set(index);
    swiper.slideTo(index, 100);
  }

  goToLastSlide() {
    const swiper = this.postMediaSwiperEl()?.nativeElement?.swiper;
    if (!swiper) return;

    const lastIndex = swiper.slides.length - 1;
    if (lastIndex < 0) return;

    this.currentSlide.set(lastIndex);
    swiper.slideTo(lastIndex, 0);
  }

  get eventsArray(): () => FormArray {
    return () => this.form().get('events') as FormArray;
  }

  onRemoveEvent(event: any) {
    const index = this.eventsArray().controls.findIndex((ctrl) => ctrl.value.id === event.id);

    if (index !== -1) {
      this.eventsArray().removeAt(index);
      this.eventsCount.set(this.eventsArray().controls.length);
    }
  }

  async handleCreatePost() {
    const content = this.textCtrl.value?.trim() || '';

    try {
      this.postLoading.set(true);

      const eventIds = this.eventsArray()
        .controls.map((ctrl) => ctrl.value.id)
        .filter((id) => id);
      const medias = await this.processMediaItems();

      // Extract mention IDs from the content text
      const mentionIds = this.extractMentionIds(content);

      const payload: Partial<FeedPost> & { content: string; is_public: boolean } = {
        event_ids: eventIds,
        address: this.form().get('location')?.value || '',
        latitude: this.form().get('latitude')?.value || '',
        longitude: this.form().get('longitude')?.value || '',
        content: content,
        is_public: this.visibility() === 'public',
        medias: medias
      };

      // Only include mention_ids if there are mentions
      if (mentionIds.length > 0) payload.mention_ids = mentionIds;

      const postId = this.postId();
      let response;

      if (postId) {
        response = await this.feedService.updatePost(postId, payload);
        this.toasterService.showSuccess(response.message || 'Post updated successfully');
      } else {
        response = await this.feedService.createPost(payload);
        this.toasterService.showSuccess(response.message || 'Post created successfully');
      }

      this.navCtrl.back();
    } catch (error: any) {
      console.error('Error saving post:', error);
      const errorMessage =
        error?.message || (this.isEditMode() ? 'Failed to update post. Please try again.' : 'Failed to create post. Please try again.');
      this.toasterService.showError(errorMessage);
    } finally {
      this.postLoading.set(false);
    }
  }

  private async processMediaItems(): Promise<Array<{ media_url: string; media_type: 'Image' | 'Video'; order: number }>> {
    const mediaItems = this.mediaItems();
    if (mediaItems.length === 0) return [];

    // Upload files that need upload (only blob URLs or files)
    const filesToUpload = mediaItems.filter((item) => item.file).map((item) => item.file);
    const uploadedResults = filesToUpload.length > 0 ? await this.mediaService.uploadMedia('Post', filesToUpload).then((res) => res?.data || []) : [];

    // Build medias array maintaining original order
    const medias: Array<{ media_url: string; media_type: 'Image' | 'Video'; order: number }> = [];
    let uploadedIndex = 0;

    for (const item of mediaItems) {
      let mediaUrl: string | undefined;
      let mediaType: 'Image' | 'Video' | undefined;

      if (item.file) {
        // Use uploaded URL (new file)
        const uploaded = uploadedResults[uploadedIndex++];
        if (!uploaded?.url) continue;
        mediaUrl = uploaded.url;
        mediaType = this.getMediaTypeFromMimetype(uploaded.mimetype);
      } else if (item.url) {
        // Use existing URL (from gallery or existing post media)
        // Skip blob URLs as they're temporary
        if (this.isBlobUrl(item.url)) continue;
        mediaUrl = item.url;
        mediaType = item.type === 'video' ? 'Video' : 'Image';
      }

      if (mediaUrl && mediaType) {
        medias.push({
          media_url: mediaUrl,
          media_type: mediaType,
          order: medias.length + 1
        });
      }
    }

    return medias;
  }

  private getMediaTypeFromMimetype(mimetype?: string): 'Image' | 'Video' {
    return mimetype?.startsWith('video') ? 'Video' : 'Image';
  }

  onMentionSelected(user: IUser): void {
    // Store username -> user ID mapping for extracting mention IDs later
    if (user.username && user.id) {
      this.mentionedUsers.set(user.username.toLowerCase(), user.id);
    }
  }

  private extractMentionIds(content: string): string[] {
    const mentionRegex = /@([\w.]+)/g;
    const matches = content.matchAll(mentionRegex);
    const mentionIds: string[] = [];

    for (const match of matches) {
      const username = match[1].toLowerCase();
      const userId = this.mentionedUsers.get(username);
      if (userId && !mentionIds.includes(userId)) {
        mentionIds.push(userId);
      }
      console.log('mentionIds:', mentionIds);
    }

    return mentionIds;
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  isBlobUrl(url: string): boolean {
    return url.startsWith('blob:');
  }

  onImageError(event: Event): void {
    onImageError(event, 'assets/images/profile.jpeg');
  }
}
