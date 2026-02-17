import {
  effect,
  inject,
  input,
  OnInit,
  signal,
  computed,
  Component,
  viewChild,
  ElementRef,
  DestroyRef,
  ChangeDetectorRef,
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy
} from '@angular/core';
import { Pagination } from 'swiper/modules';
import { SwiperContainer } from 'swiper/element';
import { Button } from '@/components/form/button';
import { CheckboxModule } from 'primeng/checkbox';
import { UserService } from '@/services/user.service';
import { EventService } from '@/services/event.service';
import { ModalService } from '@/services/modal.service';
import { IonicSlides } from '@ionic/angular/standalone';
import { ToasterService } from '@/services/toaster.service';
import { EventCategory, Vibe } from '@/interfaces/event';
import { TextInput } from '@/components/form/text-input';
import { EditorInput } from '@/components/form/editor-input';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NetworkTag } from '@/components/modal/network-tag-modal';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { CommonModule, DOCUMENT, NgOptimizedImage } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { DescriptionGeneratorService } from '@/services/description-generator.service';

@Component({
  selector: 'event-details',
  styleUrl: './event-details.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './event-details.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, TextInput, EditorInput, DragDropModule, CheckboxModule, ReactiveFormsModule, CommonModule, NgOptimizedImage]
})
export class EventDetails implements OnInit {
  eventForm = input.required<FormGroup>();
  isSubmitted = input(false);
  maxDescriptionLength = 2500;

  userService = inject(UserService);
  modalService = inject(ModalService);
  cd = inject(ChangeDetectorRef);
  document = inject(DOCUMENT);
  eventService = inject(EventService);
  descriptionGenerator = inject(DescriptionGeneratorService);
  toasterService = inject(ToasterService);
  private destroyRef = inject(DestroyRef);

  currentSlide = signal(0);
  swiperModules = [IonicSlides, Pagination];
  eventMediaSwiperEl = viewChild<ElementRef<SwiperContainer>>('eventMediaSwiper');

  // Signals
  mediaItems = signal<Array<{ type: string; file?: File; url: string; order?: number }>>([]);
  isCustomize = signal(false);
  descriptionLength = signal(0);
  selectedMetaTags = signal<Set<string>>(new Set());
  eventCategories = signal<EventCategory[]>([]);
  vibes = signal<Vibe[]>([]);
  isGeneratingDescription = signal<boolean>(false);

  selectedCategoryName = computed(() => {
    const form = this.eventForm();
    const categoryId = form.get('category_id')?.value;
    if (!categoryId) return '';

    const category = this.eventCategories().find((cat) => cat.id === categoryId);
    return category?.name || '';
  });

  categoryIdForApi = signal<string>('');

  metaTagOptions = computed(() => {
    return this.vibes().map((vibe) => ({
      name: vibe.name,
      icon: vibe.icon || '🏷️',
      value: vibe.id
    }));
  });

  isMetaTagsInvalid = computed(() => {
    const form = this.eventForm();
    const metaTagsControl = form.get('vibes');
    const hasSelectedTags = this.selectedMetaTags().size > 0;
    const controlValue = metaTagsControl?.value || [];
    const hasControlValue = Array.isArray(controlValue) && controlValue.length > 0;

    if (hasSelectedTags || hasControlValue) {
      return false;
    }

    return !!(metaTagsControl?.invalid && (metaTagsControl?.touched || this.isSubmitted()));
  });

  extractPlainText(html: string): string {
    const tempDiv = this.document.createElement('div');
    tempDiv.innerHTML = html;
    return (tempDiv.textContent || tempDiv.innerText || '').trim();
  }

  updateDescriptionLength(html: string | null): void {
    const length = html ? this.extractPlainText(html).length : 0;
    this.descriptionLength.set(length);
  }

  constructor() {
    this.syncFormToSignal('medias', this.mediaItems);
    this.syncFormToSignal('vibes', this.selectedMetaTags);

    effect(() => {
      this.eventForm().get('medias')?.setValue(this.mediaItems());
    });

    effect(() => {
      const tags = Array.from(this.selectedMetaTags());
      this.eventForm().get('vibes')?.setValue(tags);
    });

    effect(() => {
      const form = this.eventForm();
      const categoryControl = form.get('category');
      const categoryIdControl = form.get('category_id');
      const categoryId = this.categoryIdForApi() || categoryIdControl?.value;

      if (categoryId && categoryControl && this.eventCategories().length > 0) {
        const category = this.eventCategories().find((cat) => cat.id === categoryId);
        if (category?.name) {
          categoryControl.setValue(`${category.icon}   ${category.name}`, { emitEvent: true });
        }
      }
    });
  }

  syncFormToSignal(formControlName: string, signalRef: ReturnType<typeof signal<any[] | Set<any>>>): void {
    const isEmpty = () => {
      const current = signalRef();
      return current instanceof Set ? current.size === 0 : (current as any[]).length === 0;
    };

    effect(() => {
      const form = this.eventForm();
      const control = form.get(formControlName);

      if (control) {
        const formValue = control.value;
        if (formValue && isEmpty()) {
          if (formValue instanceof Set || (Array.isArray(formValue) && formValue.length > 0)) {
            signalRef.set(formValue as any);
          }
        }

        control.valueChanges.subscribe((value) => {
          if (value && isEmpty()) {
            if (value instanceof Set || (Array.isArray(value) && value.length > 0)) {
              signalRef.set(value as any);
            }
          }
        });
      }
    });
  }

  onSlideChange(event: Event) {
    const { activeIndex } = (event.target as SwiperContainer).swiper;
    this.currentSlide.set(activeIndex);
  }

  goToSlide(index: number) {
    const swiper = this.eventMediaSwiperEl()?.nativeElement?.swiper;
    if (!swiper || index < 0) return;

    this.currentSlide.set(index);
    swiper.slideTo(index, 100);
  }

  goToLastSlide() {
    const swiper = this.eventMediaSwiperEl()?.nativeElement?.swiper;
    if (!swiper) return;

    const lastIndex = swiper.slides.length - 1;
    if (lastIndex < 0) return;

    this.currentSlide.set(lastIndex);
    swiper!.slideTo(lastIndex, 0);
  }

  deleteMedia(index: number) {
    this.mediaItems.update((items) => {
      const newItems = [...items];
      newItems.splice(index, 1);
      return newItems.map((item, idx) => ({
        ...item,
        order: idx + 1
      }));
    });
    this.goToSlide(index - 1);
  }

  drop(event: CdkDragDrop<Array<{ id: string; type: string; file?: File; url: string; order?: number }>>) {
    this.mediaItems.update((items) => {
      const reordered = [...items];
      moveItemInArray(reordered, event.previousIndex, event.currentIndex);
      return reordered.map((item, index) => ({
        ...item,
        order: index + 1
      }));
    });
  }

  onBrowseFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const currentItems = this.mediaItems();
    const newItems = Array.from(input.files).map((file, index) =>
      this.createMediaItem(file, file.type.startsWith('video') ? 'video' : 'image', currentItems.length + index + 1)
    );
    this.mediaItems.update((list) => {
      const updated = [...list, ...newItems];
      return updated.map((item, idx) => ({
        ...item,
        order: idx + 1
      }));
    });
    input.value = '';
    this.goToLastSlide();
  }

  createMediaItem(
    fileOrUrl: File | string,
    type: 'image' | 'video' | 'gif',
    order?: number
  ): { type: string; file?: File; url: string; order?: number } {
    const isFile = fileOrUrl instanceof File;
    return {
      type,
      file: isFile ? fileOrUrl : undefined,
      url: isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl,
      order: order
    };
  }

  async openNetworkedGallery(): Promise<void> {
    const data = await this.modalService.openImageGalleryModal();
    if (!data) return;

    const currentItems = this.mediaItems();
    const items = this.toArray(data).map((url, index) => this.createMediaItem(url, 'image', currentItems.length + index + 1));
    this.mediaItems.update((list) => {
      const updated = [...list, ...items];
      return updated.map((item, idx) => ({
        ...item,
        order: idx + 1
      }));
    });
    this.goToLastSlide();
  }

  async openNetworkedGIFs(): Promise<void> {
    const data = await this.modalService.openGifGalleryModal();
    if (!data) return;

    const currentItems = this.mediaItems();
    const items = this.toArray(data).map((url, index) => this.createMediaItem(url, 'gif', currentItems.length + index + 1));
    this.mediaItems.update((list) => {
      const updated = [...list, ...items];
      return updated.map((item, idx) => ({
        ...item,
        order: idx + 1
      }));
    });
    this.goToLastSlide();
  }

  toArray(value: string | string[]): string[] {
    return Array.isArray(value) ? value : [value];
  }

  private getTodayDate(): string {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`; // LOCAL YYYY-MM-DD
  }

  async openDateModal(): Promise<void> {
    const form = this.eventForm();
    const currentDate = form.get('date')?.value || '';

    const minDate = this.getTodayDate();

    const date = await this.modalService.openDateTimeModal('date', currentDate, minDate);

    if (date) {
      form.patchValue({ date });
    }
  }

  async openTimeModal(type: 'start_time' | 'end_time'): Promise<void> {
    const form = this.eventForm();
    const currentTime = form.get(type)?.value || '';
    const startTime = form.get('start_time')?.value;
    const selectedDate = form.get('date')?.value || '';

    let min: string | undefined = undefined;

    if (type === 'end_time' && startTime) {
      min = this.addMinutesToTime(startTime, 30);
    }

    // If date is today, ensure time is after current time
    if (selectedDate && this.isToday(selectedDate)) {
      const currentTimeStr = this.getCurrentTime();
      if (!min || this.isTimeAfter(currentTimeStr, min)) {
        min = currentTimeStr;
      }
    }

    const time = await this.modalService.openDateTimeModal('time', currentTime, min);
    if (time) {
      form.patchValue({ [type]: time });
    }
  }

  async openLocationModal(): Promise<void> {
    const locationData = await this.modalService.openLocationModal();
    if (locationData) {
      this.eventForm().patchValue({
        address: locationData.address || '',
        latitude: locationData.latitude || '',
        longitude: locationData.longitude || '',
        city: locationData.city || '',
        state: locationData.state || '',
        country: locationData.country || ''
      });
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      const [categories, vibes] = await Promise.all([this.eventService.getEventCategories(), this.userService.getVibes()]);

      this.eventCategories.set(categories || []);
      this.vibes.set(vibes || []);

      const form = this.eventForm();
      const existingCategoryId = form.get('category_id')?.value || form.get('category')?.value;

      if (existingCategoryId) {
        const isUUID = typeof existingCategoryId === 'string' && existingCategoryId.length > 10 && existingCategoryId.includes('-');
        if (isUUID) {
          this.categoryIdForApi.set(existingCategoryId);
        } else if (categories.length > 0) {
          const matchingCategory = categories.find((cat) => cat.name === existingCategoryId || cat.id === existingCategoryId);
          if (matchingCategory) {
            this.categoryIdForApi.set(matchingCategory.id);
          }
        }
      } else if (categories.length > 0) {
        const firstCategory = categories[0];
        this.categoryIdForApi.set(firstCategory.id);

        const categoryIdControl = form.get('category_id');
        if (categoryIdControl) {
          categoryIdControl.setValue(firstCategory.id);
        }
        form.get('category')?.setValue(firstCategory.name, { emitEvent: true });
      }

      const existingMetaTags = form.get('vibes')?.value || [];
      if (Array.isArray(existingMetaTags) && existingMetaTags.length > 0) {
        this.selectedMetaTags.set(new Set(existingMetaTags));
      }

      setTimeout(() => {
        const descriptionControl = form.get('description');
        if (descriptionControl) {
          const currentValue = descriptionControl.value;
          if (currentValue) {
            this.updateDescriptionLength(currentValue);
          }

          descriptionControl.valueChanges.subscribe((value) => {
            this.updateDescriptionLength(value);
          });
        }
      }, 0);
    } catch (error) {
      console.error('Failed to load event categories or vibes:', error);
    }
  }

  async openEventCategoryModal(): Promise<void> {
    const form = this.eventForm();
    const currentCategoryId = this.categoryIdForApi() || form.get('category_id')?.value || '';
    const categories = this.eventCategories();

    const selectedCategoryId = await this.modalService.openEventCategoryModal(currentCategoryId, categories);
    if (selectedCategoryId) {
      this.categoryIdForApi.set(selectedCategoryId);

      const categoryIdControl = form.get('category_id');
      if (categoryIdControl) {
        categoryIdControl.setValue(selectedCategoryId);
      }

      const selectedCategory = categories.find((cat) => cat.id === selectedCategoryId);
      if (selectedCategory?.name) {
        form.get('category')?.setValue(selectedCategory.name, { emitEvent: true });
      }
    }
  }

  async openNetworkTagModal() {
    const form = this.eventForm();
    const metaTagsControl = form.get('vibes');
    const currentSelected = metaTagsControl?.value || [];

    const data = await this.modalService.openNetworkTagModal(this.metaTagOptions(), currentSelected);
    if (data && Array.isArray(data)) {
      const selectedSet = new Set(data);
      this.selectedMetaTags.set(selectedSet);

      if (metaTagsControl) {
        metaTagsControl.setValue(data, { emitEvent: true });
        metaTagsControl.markAsTouched();
        metaTagsControl.updateValueAndValidity({ emitEvent: true });
        this.cd.markForCheck();
      }
    }
  }

  getSelectedTagValues(): string[] {
    return Array.from(this.selectedMetaTags());
  }

  getTagByName(value: string): NetworkTag | undefined {
    const vibe = this.vibes().find((v) => v.id === value);
    if (vibe) {
      return {
        name: vibe.name,
        icon: vibe.icon || '🏷️',
        value: vibe.id
      };
    }
    return undefined;
  }

  getFieldValue<T>(field: string): T | null {
    return this.eventForm().get(field)?.value ?? null;
  }

  addMinutesToTime(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, mins + minutes, 0, 0);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  isToday(dateString: string): boolean {
    if (!dateString) return false;
    const today = new Date();
    const date = new Date(dateString);
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  }

  getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  isTimeAfter(time1: string, time2: string): boolean {
    const [hours1, mins1] = time1.split(':').map(Number);
    const [hours2, mins2] = time2.split(':').map(Number);
    const totalMins1 = hours1 * 60 + mins1;
    const totalMins2 = hours2 * 60 + mins2;
    return totalMins1 > totalMins2;
  }

  handleGenerateClick = (): void => {
    if (this.isCustomize()) {
      this.openAIPromptModal();
    } else {
      this.generateDescription();
    }
  };

  async generateDescription(): Promise<void> {
    const form = this.eventForm();
    const descriptionControl = form.get('description');

    if (!descriptionControl) return;

    this.isGeneratingDescription.set(true);

    try {
      // Get form values
      const title = form.get('title')?.value || '';
      const categoryControl = form.get('category')?.value || '';
      // Extract category name (remove icon if present)
      const category = categoryControl.replace(/^[^\w\s]+/, '').trim() || '';
      const location = form.get('location')?.value || '';
      const address = form.get('address')?.value || '';
      const date = form.get('date')?.value || '';
      const startTime = form.get('start_time')?.value || '';
      const endTime = form.get('end_time')?.value || '';

      // Build zoned times if date and times are available
      let zonedStartTime: string | undefined;
      let zonedEndTime: string | undefined;

      if (date && startTime) {
        zonedStartTime = `${date}T${startTime}`;
      }
      if (date && endTime) {
        zonedEndTime = `${date}T${endTime}`;
      }

      // Generate description using the service
      const generatedDescription = await this.descriptionGenerator.generateEventDescription({
        event: {
          title: title || undefined,
          category: category || undefined,
          location: location || undefined,
          address: address || undefined,
          dates: date
            ? [
                {
                  start: zonedStartTime,
                  end: zonedEndTime
                }
              ]
            : undefined
        },
        zonedStartTime,
        zonedEndTime
      });

      descriptionControl.setValue(generatedDescription);
      descriptionControl.markAsTouched();
      this.updateDescriptionLength(generatedDescription);
      this.isCustomize.set(true);
    } catch (error: any) {
      console.error('Error generating description:', error);
      this.toasterService.showError(error?.message || 'Failed to generate description. Please try again.');

      // Set a fallback description on error
      const fallbackDescription =
        '<p>This is a generated event description. You can customize this content to better match your event details and requirements.</p>';
      descriptionControl.setValue(fallbackDescription);
      descriptionControl.markAsTouched();
      this.updateDescriptionLength(fallbackDescription);
      this.isCustomize.set(true);
    } finally {
      this.isGeneratingDescription.set(false);
    }
  }

  async openAIPromptModal(): Promise<void> {
    const conversation = signal<Array<{ role: string; content: string }>>([]);
    const data = await this.modalService.openAIPromptModal(conversation(), true);

    if (data?.type === 'value' && data.data) {
      const descriptionControl = this.eventForm().get('description');
      if (descriptionControl) {
        descriptionControl.setValue(data.data);
        this.updateDescriptionLength(data.data);
        this.isCustomize.set(true);
      }
    }
  }

  getImageUrl(imageUrl = ''): string {
    // Don't process blob URLs - return default instead
    if (this.isBlobUrl(imageUrl)) {
      return 'assets/images/profile.jpeg';
    }
    return getImageUrlOrDefault(imageUrl);
  }

  isBlobUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }
    return url.startsWith('blob:');
  }

  onImageError(event: Event): void {
    onImageError(event);
  }
}
