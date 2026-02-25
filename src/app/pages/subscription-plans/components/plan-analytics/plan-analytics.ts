import { ChartModule } from 'primeng/chart';
import { IEvent } from '@/interfaces/event';
import { CommonModule, isPlatformBrowser, DatePipe } from '@angular/common';
import { Component, input, computed, ChangeDetectionStrategy, inject, signal, DOCUMENT, PLATFORM_ID } from '@angular/core';
import { NavigationService } from '@/services/navigation.service';
import { SubscriptionService } from '@/services/subscription.service';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { ToasterService } from '@/services/toaster.service';
import { BaseApiService } from '@/services/base-api.service';
import { PlanAnalyticsData } from '@/interfaces/ISubscripton';
import { Chart } from 'chart.js/auto';

const noDataPlugin = {
  id: 'noDataPlugin',
  afterDraw(chart: any) {
    const { ctx, width, height, chartArea } = chart;

    const hasData =
      chart.data?.datasets &&
      chart.data.datasets.some(
        (dataset: any) =>
          dataset.data &&
          dataset.data.length > 0 &&
          dataset.data.some((value: number) => value !== 0)
      );

    if (!hasData && chartArea) {
      ctx.save();

      // Soft background overlay
      ctx.fillStyle = 'rgba(249, 250, 251, 0.8)';
      ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);

      // Main text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 15px Inter, Arial';
      ctx.fillStyle = '#374151';
      ctx.fillText('No revenue yet', width / 2, height / 2);

      // Sub text
      ctx.font = '400 12px Inter, Arial';
      ctx.fillStyle = '#9CA3AF';
      ctx.fillText('Revenue data will appear here', width / 2, height / 2 + 17);

      ctx.restore();
    }
  }
};

@Component({
  selector: 'app-plan-analytics',
  imports: [CommonModule, ChartModule],
  providers: [DatePipe],
  styleUrl: './plan-analytics.scss',
  templateUrl: './plan-analytics.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanAnalytics {
  navigationService = inject(NavigationService);
  subscriptionService = inject(SubscriptionService);
  toasterService = inject(ToasterService);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private datePipe = inject(DatePipe);

  plan = input<any | null>(null);
  isSponsor = input<boolean>(false);
  events = input<IEvent[]>([]);
  totalSubscribers = input<number>(0);
  isDownloading = signal(false);

  // Analytics data from API
  analyticsData = input<PlanAnalyticsData | null>(null);
  isLoading = input<boolean>(true);
  selectedRevenueView = signal<'all' | 'mrr'>('all');

  ngOnInit(): void {
    if (!Chart.registry.plugins.get('noDataPlugin')) {
      Chart.register(noDataPlugin);
    }
  }

  // Chart data and options
  chartData = computed(() => {
    const isSponsor = this.isSponsor();
    const analytics = this.analyticsData();
    const selectedView = this.selectedRevenueView();

    if (!analytics) {
      return {
        labels: [],
        datasets: []
      };
    }

    // Get the appropriate graph data based on selected view
    const graphData = selectedView === 'all' ? analytics.graph?.all : analytics.graph?.mrr;

    if (!graphData || !Array.isArray(graphData)) {
      return {
        labels: [],
        datasets: []
      };
    }

    // Extract labels and data from the API response
    const labels = graphData.map(item => selectedView === 'all' ? item.month : item.date?.substring(8, 10) || '');
    const fullDates = graphData.map(item => item.date);
    const data = graphData.map(item => item.amount || 0);

    // Create gradient function for sponsor plans
    const getBorderColor = (context: any) => {
      if (!isSponsor) {
        return '#2B5BDE';
      }

      const chart = context.chart;
      const { ctx, chartArea } = chart;

      if (!chartArea) {
        return '#F5BC61';
      }

      const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      gradient.addColorStop(0, '#9E8F76');
      gradient.addColorStop(0.1428, '#7A6A50');
      gradient.addColorStop(0.2409, '#F6D9AB');
      gradient.addColorStop(0.405, '#9D7F4E');
      gradient.addColorStop(0.6046, '#C9A770');
      gradient.addColorStop(0.8652, '#796A52');

      return gradient;
    };

    const getPointColor = (context: any) => {
      if (!isSponsor) {
        return '#2B5BDE';
      }

      const chart = context.chart;
      const { ctx, chartArea } = chart;

      if (!chartArea) {
        return '#F5BC61';
      }

      const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      gradient.addColorStop(0, '#9E8F76');
      gradient.addColorStop(0.1428, '#7A6A50');
      gradient.addColorStop(0.2409, '#F6D9AB');
      gradient.addColorStop(0.405, '#9D7F4E');
      gradient.addColorStop(0.6046, '#C9A770');
      gradient.addColorStop(0.8652, '#796A52');

      return gradient;
    };

    return {
      labels,
      datasets: [
        {
          label: selectedView === 'all' ? 'All-Time Revenue' : 'MRR',
          data,
          fullDates,
          borderColor: getBorderColor,
          backgroundColor: 'transparent',
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: getPointColor,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }
      ]
    };
  });

  chartOptions = computed(() => {
    const isSponsor = this.isSponsor();

    // For tooltip, use a solid color (gradients don't work well in tooltips)
    const tooltipColor = isSponsor ? '#F5BC61' : '#2B5BDE';

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: tooltipColor,
          padding: 8,
          titleFont: {
            size: 12,
            weight: 'bold'
          },
          bodyFont: {
            size: 11
          },
          displayColors: false,
          callbacks: {
            title: (context: any) => {
              const dataset = context[0].dataset;
              const index = context[0].dataIndex;

              if (this.selectedRevenueView() === 'mrr') {
                const fullDate = dataset.fullDates?.[index];
                if (fullDate) {
                  const date = new Date(fullDate);
                  return this.datePipe.transform(date, 'd MMM y')?.toLowerCase() || '';
                }
                return '';
              }
              return context[0].label;
            },
            label: (context: any) => {
              return `$${context.parsed.y || 0}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#6B7280',
            font: {
              size: 10
            },
            callback: (value: any) => `$${value}`
          },
          grid: {
            color: '#E5E7EB',
            lineWidth: 0.5,
            borderDash: [2, 2]
          }
        },
        x: {
          ticks: {
            color: '#6B7280',
            autoSkip: true,
            font: {
              size: 10
            },
            ...(this.isBrowser && window.innerWidth < 480 && {
              maxTicksLimit: 6
            })
          },
          grid: {
            display: false
          }
        }
      }
    };
  });

  selectAllTimeRevenue(): void {
    this.selectedRevenueView.set('all');
  }

  selectMrr(): void {
    this.selectedRevenueView.set('mrr');
  }

  chartTitle = computed(() => {
    return this.selectedRevenueView() === 'all' ? 'All Time Revenue' : 'Monthly Recurring Revenue';
  });

  // Event statistics
  totalEvents = computed(() => {
    return this.events().length;
  });

  completedEvents = computed(() => {
    const now = new Date();
    return this.events().filter((event) => {
      if (!event.start_date) return false;
      const eventDate = new Date(event.start_date);
      return eventDate.getTime() < now.getTime();
    }).length;
  });

  upcomingEvents = computed(() => {
    const now = new Date();
    return this.events().filter((event) => {
      if (!event.start_date) return false;
      const eventDate = new Date(event.start_date);
      return eventDate.getTime() > now.getTime();
    }).length;
  });

  buttonColor = computed(() => {
    const isSponsor = this.isSponsor();
    return !isSponsor ? '#2B5BDE' : undefined;
  });

  navigateToEvents(): void {
    const planId = this.plan()?.id;
    if (planId) {
      const isSponsor = this.isSponsor();
      this.navigationService.navigateForward(`/subscription/${planId}/events?is_sponsor=${isSponsor ? 'true' : 'false'}`);
    }
  }

  navigateToSubscribers(): void {
    const planId = this.plan()?.id;
    if (planId) {
      this.navigationService.navigateForward(`/subscription/${planId}/subscribers`);
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }

  async downloadPlanAnalytics() {
    this.isDownloading.set(true);
    try {
      const csv = await this.subscriptionService.downloadPlanAnalytics(this.plan()?.id);

      const BOM = '\uFEFF';
      const content = BOM + csv;

      const sanitizedName = this.sanitizeFileName(this.plan()?.name || '');
      const fileName = `${sanitizedName}-analytics-${Date.now()}.csv`;

      if (Capacitor.getPlatform() === 'web') {
        const blob = new Blob([content], {
          type: 'text/csv;charset=utf-8;'
        });

        const url = URL.createObjectURL(blob);
        const link = this.document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      const base64Data = btoa(unescape(encodeURIComponent(content)));

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents
      });

      if (Capacitor.getPlatform() === 'ios') {
        await Share.share({
          title: 'Plan Analytics',
          url: savedFile.uri
        });
      } else {
        this.toasterService.showSuccess('CSV saved successfully!');
      }
    } catch (error) {
      console.error('CSV download failed', error);
      const message = BaseApiService.getErrorMessage(error, 'Failed to download CSV');
      this.toasterService.showError(message);
    } finally {
      this.isDownloading.set(false);
    }
  }
}
