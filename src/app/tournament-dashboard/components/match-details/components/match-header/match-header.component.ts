import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';
import { formatLiveClock, getLiveMinute, getLiveSeconds } from '../../../../../core/utils/live-clock.util';
import { API_URL } from '../../../../../core/config/app.config';

@Component({
    selector: 'app-match-header',
    standalone: true,
    imports: [CommonModule, TranslateModule],
    templateUrl: './match-header.component.html'
})
export class MatchHeaderComponent implements OnInit, OnDestroy, OnChanges {
    private translate = inject(TranslateService);
    @Input() match: any;
    @Input() isLoading = false;
    // Whether both teams have a complete, valid lineup. Gates the Start Match button.
    @Input() canStart = false;
    // Regulation length (minutes) from the tournament schedule — drives full-time detection.
    @Input() matchDuration = 90;

    @Output() editMatch = new EventEmitter<void>();
    @Output() addLineup = new EventEmitter<void>();
    @Output() startMatch = new EventEmitter<void>();
    @Output() completeMatch = new EventEmitter<void>();
    @Output() addExtraTime = new EventEmitter<void>();

    /** Live match on a break — its clock anchor is cleared. */
    get isPaused(): boolean {
        return this.match?.status === 'live' && !this.match?.periodStartedAt;
    }

    /** Resolve a team's logo (`logoUrl`, a `/uploads/...` path) to an absolute URL for <img>. */
    teamLogo(team: any): string {
        const path = team?.logoUrl;
        if (!path) return '';
        return path.startsWith('/uploads') ? `${API_URL}${path}` : path;
    }

    // Signals so the ticking clock re-renders under zoneless change detection.
    countdown = signal('');
    liveMinute = signal(0);
    liveClock = signal('0:00');
    // True once the live clock has reached regulation (+ added/extra) time — surfaces
    // the "Full Time" prompt so the admin can complete the match or add extra time.
    atFullTime = signal(false);
    private timer: any;

    ngOnInit() {
        this.initTimer();
    }

    ngOnChanges() {
        this.initTimer();
    }

    ngOnDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    private initTimer() {
        if (this.timer) clearInterval(this.timer);
        // Recomputed each live tick; reset here so it can't linger after the match
        // leaves the live state (scheduled/completed).
        this.atFullTime.set(false);

        if (this.match?.status === 'scheduled') {
            this.updateCountdown();
            this.timer = setInterval(() => this.updateCountdown(), 60000);
        } else if (this.match?.status === 'live') {
            this.updateLiveTimer();
            this.timer = setInterval(() => this.updateLiveTimer(), 1000); // tick every second to keep the clock running
        }
    }

    private updateLiveTimer() {
        const now = Date.now();
        this.liveMinute.set(getLiveMinute(this.match, now));
        this.liveClock.set(formatLiveClock(this.match, now));
        this.atFullTime.set(this.computeFullTime(now));
    }

    /**
     * Regulation time is up when the running clock passes the configured match
     * duration plus any referee added time / extra-time minutes. Skipped while
     * paused, at half time, or during a penalty shootout (no running clock there).
     */
    private computeFullTime(now: number): boolean {
        if (this.match?.status !== 'live' || this.isPaused) return false;
        const period = this.match?.match_period;
        if (period === 'half_time' || period === 'penalties') return false;
        const regulation = (Number(this.matchDuration) || 90) + (Number(this.match?.addedMinutes) || 0);
        return getLiveSeconds(this.match, now) >= regulation * 60;
    }

    private updateCountdown() {
        if (!this.match?.startTime) return;

        const now = new Date().getTime();
        const matchTime = new Date(this.match.startTime).getTime();
        const diff = matchTime - now;

        if (diff <= 0) {
            this.countdown.set(this.translate.instant('MATCH_DETAILS.HEADER.LIVE'));
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
            this.countdown.set(`${days}d ${hours}h`);
        } else {
            this.countdown.set(`${hours}h ${minutes}m`);
        }
    }
}
