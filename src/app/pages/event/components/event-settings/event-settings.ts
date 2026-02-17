import { IUser } from '@/interfaces/IUser';
import { CommonModule } from '@angular/common';
import { Chip } from '@/components/common/chip';
import { ModalService } from '@/services/modal.service';
import { ToggleInput } from '@/components/form/toggle-input';
import { RepeatingFrequencyType } from '@/interfaces/event';
import { NumberInput } from '@/components/form/number-input';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ParticipantInput } from '@/pages/event/components/participant-input';
import { RepeatingEventItem } from '@/pages/event/components/repeating-event-item';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, input, output, signal, effect, DestroyRef, computed } from '@angular/core';
@Component({
  selector: 'event-settings',
  styleUrl: './event-settings.scss',
  templateUrl: './event-settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chip, ToggleInput, NumberInput, ParticipantInput, RepeatingEventItem, ReactiveFormsModule, CommonModule]
})
export class EventSettings {
  // Inputs
  eventForm = input.required<FormGroup>();
  isModalMode = input<boolean>(false);
  isEditMode = input<boolean>(false);
  openConfirmModal = input.required<(message: string) => Promise<boolean>>();

  // Outputs
  generateRepeatingEvents = output<void>();

  // Services
  modalService = inject(ModalService);
  cd = inject(ChangeDetectorRef);
  destroyRef = inject(DestroyRef);

  coHosts = signal<IUser[]>([]);
  sponsors = signal<IUser[]>([]);
  speakers = signal<IUser[]>([]);
  isPublic = signal<boolean>(true);
  repeatingEvents = signal<Array<Record<string, unknown>>>([]);

  // Signals
  repeatOptions = signal<Array<{ label: string; value: RepeatingFrequencyType }>>([
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' }
    // { label: 'Custom', value: 'custom' }
  ]);

  repeatCountOptions = signal<Array<{ label: string; value: number | 'custom' }>>([
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
    { label: 'Custom', value: 'custom' }
  ]);

  sections = signal<Array<{ type: 'pre-event' | 'post-event'; label: string; placeholder: string }>>([
    { type: 'pre-event', label: 'Pre-Event', placeholder: 'Displayed when user signs up for the event.' },
    { type: 'post-event', label: 'Post-Event', placeholder: 'A feedback survey after the event has concluded.' }
  ]);

  // Main event signal from form data (reactive to form changes)
  mainEvent = signal<Record<string, unknown>>({
    id: 'main-event',
    eventNumber: 1
  });

  constructor() {
    this.syncParticipantsToSignals();

    effect(() => {
      const form = this.eventForm();
      const formIsPublic = form.get('is_public')?.value;
      if (formIsPublic !== null && formIsPublic !== undefined) {
        this.isPublic.set(formIsPublic);
      }
      const currentParticipants = form.get('participants')?.value || [];

      const existingHosts = currentParticipants.filter((p: any) => {
        return p.role === 'Host';
      });

      const participants: Array<{ id: string; user_id?: string; role: string; thumbnail_url?: string; name?: string }> = [...existingHosts];

      this.coHosts().forEach((user) => {
        if (user.user_id) {
          participants.push({
            id: user.id,
            user_id: user.user_id,
            role: 'CoHost',
            thumbnail_url: user.thumbnail_url,
            name: user.name
          });
        }
      });

      this.sponsors().forEach((user) => {
        if (user.user_id) {
          participants.push({
            id: user.id,
            user_id: user.user_id,
            role: 'Sponsor',
            thumbnail_url: user.thumbnail_url,
            name: user.name
          });
        }
      });

      // Add speakers
      this.speakers().forEach((user) => {
        if (user.user_id) {
          participants.push({
            id: user.id,
            user_id: user.user_id,
            role: 'Speaker',
            thumbnail_url: user.thumbnail_url,
            name: user.name
          });
        }
      });

      const currentStr = JSON.stringify(currentParticipants.sort((a: any, b: any) => a.user_id?.localeCompare(b.user_id) || 0));
      const newStr = JSON.stringify(participants.sort((a: any, b: any) => a.user_id?.localeCompare(b.user_id) || 0));
      if (currentStr !== newStr) {
        form.get('participants')?.setValue(participants);
      }
    });

    effect(() => {
      const isPublic = this.isPublic();
      this.eventForm().get('is_public')?.setValue(isPublic);
    });

    effect(() => {
      const events = this.repeatingEvents();
      this.eventForm().get('repeating_events')?.setValue(events);
    });

    effect(() => {
      const form = this.eventForm();
      const repeatingEventsControl = form.get('repeating_events');
      if (!repeatingEventsControl) return;

      repeatingEventsControl.valueChanges.subscribe((formEvents) => {
        if (Array.isArray(formEvents)) {
          const currentEvents = this.repeatingEvents();
          const formEventsStr = JSON.stringify(formEvents);
          const currentEventsStr = JSON.stringify(currentEvents);
          if (formEventsStr !== currentEventsStr) {
            this.repeatingEvents.set(formEvents);
            this.cd.markForCheck();
          }
        }
      });

      const formEvents = repeatingEventsControl.value;
      if (Array.isArray(formEvents) && formEvents.length > 0 && this.repeatingEvents().length === 0) {
        this.repeatingEvents.set(formEvents.map((e) => ({ ...e })));
        this.cd.markForCheck();
      }
    });

    // Sync form data to mainEvent signal (reactive to form changes)
    effect(() => {
      const form = this.eventForm();

      // Initial update
      const updateMainEvent = () => {
        const formValues = form.getRawValue();
        this.mainEvent.set({
          ...formValues,
          id: 'main-event',
          eventNumber: 1,
          date: formValues.date || ''
        });
        this.cd.markForCheck();
      };

      // Initial value
      updateMainEvent();

      // Subscribe to form value changes
      const subscription = form.valueChanges.subscribe(() => {
        updateMainEvent();
      });

      // Cleanup subscription when effect re-runs or component is destroyed
      return () => {
        subscription.unsubscribe();
      };
    });
  }

  private syncParticipantsToSignals(): void {
    effect(() => {
      const form = this.eventForm();
      const control = form.get('participants');

      if (control) {
        const participants = control.value || [];

        if (Array.isArray(participants)) {
          const coHosts: IUser[] = [];
          const sponsors: IUser[] = [];
          const speakers: IUser[] = [];

          participants.forEach((p: any) => {
            const role = (p.role || '').trim();
            const user: IUser = {
              id: p.id,
              user_id: p.user_id,
              name: p.name || '',
              thumbnail_url: p.thumbnail_url
            };

            if (role === 'CoHost') {
              coHosts.push(user);
            } else if (role === 'Sponsor') {
              sponsors.push(user);
            } else if (role === 'Speaker') {
              speakers.push(user);
            }
          });

          this.coHosts.set(coHosts);
          this.sponsors.set(sponsors);
          this.speakers.set(speakers);
        }

        control.valueChanges.subscribe((value) => {
          const participants = value || [];
          if (Array.isArray(participants)) {
            const coHosts: IUser[] = [];
            const sponsors: IUser[] = [];
            const speakers: IUser[] = [];

            participants.forEach((p: any) => {
              const role = (p.role || '').trim();
              const user: IUser = {
                id: p.id,
                user_id: p.user_id,
                name: p.name || '',
                thumbnail_url: p.thumbnail_url
              };

              if (role === 'CoHost') {
                coHosts.push(user);
              } else if (role === 'Sponsor') {
                sponsors.push(user);
              } else if (role === 'Speaker') {
                speakers.push(user);
              }
            });

            this.coHosts.set(coHosts);
            this.sponsors.set(sponsors);
            this.speakers.set(speakers);
          }
        });
      }
    });
  }

  getFieldValue<T>(field: string): T | null {
    return this.eventForm().get(field)?.value ?? null;
  }

  getSectionQuestions(type: string): Array<{ id: string; question: string }> {
    const questionnaire = this.getFieldValue<Array<any>>('questionnaire');
    if (!questionnaire || !Array.isArray(questionnaire) || questionnaire.length === 0) return [];

    const eventPhase = type === 'pre-event' ? 'PreEvent' : 'PostEvent';
    return questionnaire
      .filter((q: any) => q.event_phase === eventPhase)
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
      .map((q: any, index: number) => ({
        id: q.id || `question-${index}`,
        question: q.question
      }));
  }

  getSectionQuestionsForEdit(type: string): Array<any> {
    const questionnaire = this.getFieldValue<Array<any>>('questionnaire');
    if (!questionnaire || !Array.isArray(questionnaire) || questionnaire.length === 0) return [];

    const eventPhase = type === 'pre-event' ? 'PreEvent' : 'PostEvent';
    return questionnaire.filter((q: any) => q.event_phase === eventPhase).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  }

  hasQuestions(type: string): boolean {
    return this.getSectionQuestions(type).length > 0;
  }

  onUsersChange(users: IUser[], field: 'co_hosts' | 'sponsors' | 'speakers'): void {
    if (field === 'co_hosts') {
      this.coHosts.set(users);
    } else if (field === 'sponsors') {
      this.sponsors.set(users);
    } else if (field === 'speakers') {
      this.speakers.set(users);
    }
  }

  updateFormField(field: string, value: unknown): void {
    this.eventForm().patchValue({ [field]: value });
    this.cd.markForCheck();
  }

  setVisibility(isPublic: boolean): void {
    this.isPublic.set(isPublic);
  }

  setPlusCount(count: number): void {
    this.updateFormField('max_attendees_per_user', count);
  }

  setRepeatFrequency(frequency: RepeatingFrequencyType): void {
    this.updateFormField('repeating_frequency', frequency);

    this.generateRepeatingEvents.emit();
  }

  handleRepeatCountClick(value: number | 'custom'): void {
    this.updateFormField('repeat_count', value);
    if (value !== 'custom') {
      this.generateRepeatingEvents.emit();
    }
  }

  async editRepeatingEvent(event: Record<string, unknown>): Promise<void> {
    const result = await this.modalService.openRepeatingEventModal(event);
    if (!result || result.role !== 'save') return;

    const eventId = event['id'];
    const updatedEvents = this.repeatingEvents().map((e) => (e['id'] === eventId ? { ...e, ...result.data } : e));
    this.updateRepeatingEvents(updatedEvents);
  }

  async deleteRepeatingEvent(eventId: string | unknown): Promise<void> {
    const confirmed = await this.confirmDelete('This event occurrence will be permanently removed.');
    if (!confirmed) return;

    const id = String(eventId);
    const updatedEvents = this.repeatingEvents().filter((e) => String(e['id']) !== id);
    this.updateRepeatingEvents(updatedEvents);
  }

  updateRepeatingEvents(events: Array<Record<string, unknown>>): void {
    this.repeatingEvents.set(events);
  }

  async confirmDelete(message: string): Promise<boolean> {
    return this.openConfirmModal()(message);
  }

  async openQuestionnaireModal(type: 'pre-event' | 'post-event'): Promise<void> {
    const currentQuestions = this.getSectionQuestionsForEdit(type);
    const result = await this.modalService.openQuestionnaireFormModal(type, currentQuestions.length > 0 ? currentQuestions : undefined);

    if (result?.questions) {
      const form = this.eventForm();
      const questionnaireControl = form.get('questionnaire');
      const existingQuestions = (questionnaireControl?.value as Array<any>) || [];

      const eventPhase = type === 'pre-event' ? 'PreEvent' : 'PostEvent';
      const filteredQuestions = existingQuestions.filter((q: any) => q.event_phase !== eventPhase);

      const updatedQuestions = [...filteredQuestions, ...result.questions];

      questionnaireControl?.setValue(updatedQuestions);
      this.cd.markForCheck();
    }
  }

  deleteEventQuestionnaire(type: 'pre-event' | 'post-event'): void {
    const form = this.eventForm();
    const questionnaireControl = form.get('questionnaire');
    const existingQuestions = (questionnaireControl?.value as Array<any>) || [];

    const eventPhase = type === 'pre-event' ? 'PreEvent' : 'PostEvent';
    const filteredQuestions = existingQuestions.filter((q: any) => q.event_phase !== eventPhase);

    questionnaireControl?.setValue(filteredQuestions);
    this.cd.markForCheck();
  }
}
