import { IonIcon } from '@ionic/angular/standalone';
import { AnalyticsQuestion } from '@/interfaces/event';
import { Component, inject, input } from '@angular/core';
import { EmptyState } from '@/components/common/empty-state';
import { NavigationService } from '@/services/navigation.service';

@Component({
  selector: 'questionnaire-analytics',
  imports: [IonIcon, EmptyState],
  templateUrl: './questionnaire-analytics.html',
  styleUrl: './questionnaire-analytics.scss'
})
export class QuestionnaireAnalytics {
  navigationService = inject(NavigationService);
  analytics = input<any[]>([]);

  navigateToUserList(item: AnalyticsQuestion, opt: any) {
    if (opt.selected_count <= 0) return;
    this.navigationService.navigateForward(`/event/questionnaire-response/guests/${opt.id}`, false, { questionOption: item, option: opt });
  }

  getMax(options: any[]) {
    return Math.max(...options.map((o) => o.selected_count));
  }

  getChartData(item: any) {
    if (item.question_type === 'Rating') {
      return item.rating_scale || [];
    }

    if (item.question_type === 'SingleChoice') {
      return item.options || [];
    }

    return [];
  }

  getMaxCount(item: any): number {
    const data = this.getChartData(item);
    return Math.max(...data.map((d: any) => d.selected_count), 1);
  }

  getBarHeight(count: number, item: any): number {
    return (count / this.getMaxCount(item)) * 120; // 120px max height
  }

  getOptionPercentage(count: number, options: any[]): number {
    const total = options.reduce((sum, o) => sum + o.selected_count, 0);
    if (!total) return 0;
    return (count / total) * 100;
  }
}
