import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TournamentService, TournamentDTO } from '../tournament/tournament.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { revealAndFocusInvalid } from '../shared/utils/form.util';

import { TournamentGeneralComponent } from './components/tournament-general/tournament-general.component';
import { TournamentOrganizerComponent } from './components/tournament-organizer/tournament-organizer.component';
import { TournamentParticipantsComponent } from './components/tournament-participants/tournament-participants.component';
import { TournamentFormatComponent } from './components/tournament-format/tournament-format.component';
import { TournamentScheduleComponent } from './components/tournament-schedule/tournament-schedule.component';
import { TournamentRulesComponent } from './components/tournament-rules/tournament-rules.component';
import { TournamentVenuesComponent } from './components/tournament-venues/tournament-venues.component';
import { TournamentFinanceComponent } from './components/tournament-finance/tournament-finance.component';
import { TournamentPresentationComponent } from './components/tournament-presentation/tournament-presentation.component';
import { TournamentResultsComponent } from './components/tournament-results/tournament-results.component';
import { TournamentTeamsComponent } from './components/tournament-teams/tournament-teams.component';
import { TournamentMatchesComponent } from './components/tournament-matches/tournament-matches.component';
import { TournamentSponsorsComponent } from './components/tournament-sponsors/tournament-sponsors.component';
import { TournamentStatusComponent } from './components/tournament-status/tournament-status.component';
import { LoaderComponent } from '../components/loader/loader.component';

import { UiService } from '../services/ui.service';

export interface TournamentSettings {
    general: {
        name: string;
        shortName: string;
        description: string;
        status: string;
        visibility: string;
        type: string;
        logo?: string;
        coverImage?: string;
        organizer: {
            name: string;
            email: string;
            phone: string;
            website: string;
        };
        sponsors: string[];
    };
    participants: {
        type: string;
        minTeams: number;
        maxTeams: number;
        regOpenDate: string;
        regCloseDate: string;
        approvalRequired: boolean;
        regFee: number;
        playerLimit: number;
        squadSize: number;
    };
    format: {
        type: string;
        numGroups: number;
        teamsPerGroup: number;
        homeAway: boolean;
        winPoints: number;
        drawPoints: number;
        lossPoints: number;
        tieBreaker: string;
        qualRules: string;
        format_data?: any[];
    };
    schedule: {
        startDate: string;
        endDate: string;
        matchDuration: number;
        halfDuration: number;
        breakTime: number;
        matchDays: Record<string, boolean>;
        timeSlots: string;
    };
    rules: {
        govBody: string;
        playersOnField: number;
        minPlayers: number;
        subsAllowed: number;
        offsideRule: boolean;
        ballSize: number;
        pitchType: string;
        extraTimeRule: string;
        penaltiesRule: boolean;
        yellowSuspensionLimit: number;
        redSuspensionLength: number;
        gkRules: string;
    };
    venues: {
        multipleVenues: boolean;
        primaryVenue: string;
        venueAddress: string;
        pitchCount: number;
        fieldType: string;
    };
    finance: {
        paymentMethod: string;
        prizePool: number;
        prizeMoney: number;
        paymentInfo: string;
        prizeDist: string;
        refundPolicy: string;
        regFee: number;
    };
    presentation: {
        themeColor: string;
        urlSlug: string;
        showStandings: boolean;
        showPlayerStats: boolean;
        showTopScorers: boolean;
        welcomeMsg: string;
        showLiveScores: boolean;
        showRecentResults: boolean;
        showCommentary: boolean;
        liveStreamLink: string;
    };

}

@Component({
    selector: 'app-tournament-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TournamentGeneralComponent,
        TournamentOrganizerComponent,
        TournamentParticipantsComponent,
        TournamentFormatComponent,
        TournamentScheduleComponent,
        TournamentRulesComponent,
        TournamentVenuesComponent,
        TournamentFinanceComponent,
        TournamentPresentationComponent,
        TournamentResultsComponent,
        TournamentTeamsComponent,
        TournamentMatchesComponent,
        TournamentSponsorsComponent,
        TournamentStatusComponent,
        LoaderComponent,
        TranslateModule
    ],
    templateUrl: './tournament-dashboard.component.html',
})
export class TournamentDashboardComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private tournamentService = inject(TournamentService);
    public ui = inject(UiService);
    private translate = inject(TranslateService);

    tournament = signal<TournamentDTO | null>(null);
    isLoading = signal(true);
    activeTab = signal<string>('general');
    private pendingTab?: string;
    formatChanged = false;
    showValidationErrors = signal(false);

    // Live counts for the non-gated runtime tabs, fetched independently of the child
    // tabs (which only mount when active). These drive the teams/schedule/matches
    // completion ticks so those tabs go green only once real data exists.
    registeredTeamsCount = signal<number>(0);
    scheduledMatchesCount = signal<number>(0);

    // Sequential setup frontier: gated steps whose order-index is <= this are unlocked.
    // It advances ONE step per "Save & Next" — so a later step can't unlock just because
    // its default values happen to satisfy a completion rule (e.g. format/finance defaults).
    maxStepIndex = signal<number>(0);

    // Informational tabs (sponsors/presentation/status/results) have no data-driven
    // completion rule; they turn "complete" (green) once the user saves them. Tracked here
    // so the stepper reacts when the tab is saved via Save / Save & Next.
    visitedTabs = signal<Set<string>>(new Set<string>());

    /** The reactive FormGroup of the currently-mounted migrated tab (null for non-form tabs). */
    activeForm = signal<FormGroup | null>(null);

    settings: TournamentSettings = this.getDefaultSettings();

    // Snapshot of `settings` as last persisted (on load and after each successful
    // save). Tab gating is evaluated against THIS, not the live form — so editing
    // a tab does not unlock the next step until the user actually saves it.
    private savedSettings: TournamentSettings = this.getDefaultSettings();

    private snapshotSavedSettings() {
        this.savedSettings = JSON.parse(JSON.stringify(this.settings));
    }

    // Wizard steps in display order. `gated` steps must be completed sequentially;
    // non-gated (runtime) steps unlock once all gated steps are complete.
    wizardTabs = [
        { id: 'general', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.GENERAL', icon: 'settings', gated: true },
        { id: 'organizer', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.ORGANIZER', icon: 'user', gated: true },
        { id: 'participants', label: 'TOURNAMENT_DASHBOARD.WIZARD.PARTICIPATION', icon: 'users', gated: true },
        { id: 'rules', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.RULES', icon: 'scale-balanced', gated: true },
        { id: 'venues', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.VENUES', icon: 'map-pin', gated: true },
        { id: 'format', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.FORMAT', icon: 'grid', gated: true },
        { id: 'finance', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.FINANCE', icon: 'coins', gated: true },
        { id: 'sponsors', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.SPONSORS', icon: 'list', gated: false },
        { id: 'teams', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.TEAMS', icon: 'shield', gated: false },
        { id: 'schedule', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.SCHEDULE', icon: 'calendar', gated: false },
        { id: 'matches', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.MATCHES', icon: 'list', gated: false },
        { id: 'presentation', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.PRESENTATION', icon: 'monitor', gated: false },
        { id: 'status', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.STATUS', icon: 'flag', gated: false },
        { id: 'results', label: 'TOURNAMENT_DASHBOARD.SIDEBAR.RESULTS', icon: 'bar-chart', gated: false }
    ];

    /** Ordered ids of the gated setup steps (drives sequential locking + submit validation). */
    private gatedOrder = ['general', 'organizer', 'participants', 'rules', 'venues', 'format', 'finance'];

    /** Per-step completion predicates evaluated from `settings` (mount-independent). */
    private completionRules: Record<string, (s: TournamentSettings) => boolean> = {
        general: s => !!s.general.name?.trim() && !!s.general.type,
        organizer: s => !!s.general.organizer?.name?.trim()
            && !!s.general.organizer?.email?.trim()
            && !!s.general.organizer?.phone?.trim(),
        participants: s => s.participants.minTeams > 0 && s.participants.maxTeams >= s.participants.minTeams
            && !!s.participants.regOpenDate && !!s.participants.regCloseDate,
        rules: s => !!s.rules.playersOnField && s.rules.playersOnField > 0,
        venues: s => !!s.venues.primaryVenue?.trim(),
        format: s => !!s.format.type,
        finance: s => s.finance.regFee >= 0
    };

    /**
     * Completion predicates for the non-gated runtime tabs, evaluated against the
     * live counts (teams registered, matches generated) rather than `settings`.
     * A tab here is "complete" only once the corresponding real work is done.
     */
    private runtimeCompletionRules: Record<string, () => boolean> = {
        teams: () => this.registeredTeamsCount() >= (this.savedSettings.participants.minTeams || 2),
        schedule: () => this.scheduledMatchesCount() > 0,
        matches: () => this.scheduledMatchesCount() > 0,
    };

    // ── Wizard completion / gating ──────────────────────────────────────────
    // Evaluated against the SAVED snapshot so a step is only "complete" (and thus
    // unlocks the next one) once its data has actually been persisted.
    isComplete(tabId: string): boolean {
        const rule = this.completionRules[tabId];
        if (rule) return rule(this.savedSettings);
        // Runtime tabs (teams/schedule/matches) are complete only when real data
        // exists — never merely because the gated setup finished and unlocked them.
        const runtimeRule = this.runtimeCompletionRules[tabId];
        if (runtimeRule) return runtimeRule();
        // Informational tabs (sponsors, presentation, status, results) have no data
        // criterion — they turn complete (green) once the user has saved them.
        return this.visitedTabs().has(tabId);
    }

    private allGatedComplete(): boolean {
        return this.gatedOrder.every(id => this.isComplete(id));
    }

    /** True once the user has progressed (via Save & Next) through every gated step. */
    private allGatedProgressed(): boolean {
        return this.maxStepIndex() >= this.gatedOrder.length;
    }

    /**
     * Baseline the wizard frontier from the saved data: unlock the contiguous run of
     * already-complete gated steps. A freshly created tournament therefore stops at the
     * first incomplete step, while a fully-configured one re-opens completely unlocked.
     */
    private initProgress() {
        let i = 0;
        while (i < this.gatedOrder.length && this.isComplete(this.gatedOrder[i])) i++;
        this.maxStepIndex.set(i);
    }

    /** Move the frontier forward by one when the active gated step is saved & complete. */
    private advanceProgress() {
        const idx = this.gatedOrder.indexOf(this.activeTab());
        if (idx === -1) return;                       // not a gated setup step
        if (!this.isComplete(this.activeTab())) return; // don't unlock the next step yet
        if (idx + 1 > this.maxStepIndex()) this.maxStepIndex.set(idx + 1);
    }

    /**
     * A step is locked until the user reaches it via "Save & Next":
     *  - gated steps unlock sequentially up to the frontier (`maxStepIndex`);
     *  - non-gated (runtime) steps unlock only once the whole gated wizard is done.
     */
    isLocked(tabId: string): boolean {
        const tab = this.wizardTabs.find(t => t.id === tabId);
        if (!tab) return false;
        if (!tab.gated) return !this.allGatedProgressed();
        return this.gatedOrder.indexOf(tabId) > this.maxStepIndex();
    }

    /** Visual state for the stepper. */
    tabState(tabId: string): 'active' | 'complete' | 'locked' | 'pending' {
        if (this.activeTab() === tabId) return 'active';
        if (this.isLocked(tabId)) return 'locked';
        if (this.isComplete(tabId)) return 'complete';
        return 'pending';
    }

    private firstIncompleteGatedLabel(): string {
        const id = this.gatedOrder.find(g => !this.isComplete(g));
        const tab = this.wizardTabs.find(t => t.id === id);
        return tab ? this.translate.instant(tab.label) : '';
    }

    /** Label of the next gated step the user must Save & Next through to move the frontier. */
    private nextRequiredStepLabel(): string {
        const idx = this.maxStepIndex();
        const id = idx < this.gatedOrder.length ? this.gatedOrder[idx] : undefined;
        const tab = this.wizardTabs.find(t => t.id === id);
        return tab ? this.translate.instant(tab.label) : this.firstIncompleteGatedLabel();
    }

    /** Stepper click handler — blocks navigation to a locked step with a message. */
    goToTab(tabId: string) {
        if (this.isLocked(tabId)) {
            this.ui.showToast(
                this.translate.instant('TOURNAMENT_DASHBOARD.WIZARD.LOCKED_MSG', { section: this.nextRequiredStepLabel() }),
                'error'
            );
            return;
        }
        this.setTab(tabId);
    }

    ngOnInit() {
        this.route.paramMap.subscribe(params => {
            const id = params.get('id');
            // Deep-linked tab via path (tournaments/:id/:tab) or ?tab= query param.
            this.pendingTab = params.get('tab') ?? this.route.snapshot.queryParamMap.get('tab') ?? undefined;
            if (id) {
                this.loadTournament(id);
            }
        });
    }

    /** Low-level tab switch used by the save error-jump. No auto-save. */
    setActiveTab(tabId: string, _skipSave = false) {
        this.setTab(tabId);
    }

    hasVenueDetails(): boolean {
        return !!this.settings.venues?.primaryVenue?.trim();
    }

    // Triggered by child components when an action needs venue details that are missing
    onRequireVenue() {
        this.showValidationErrors.set(true);
        this.ui.showToast('TOURNAMENT_DASHBOARD.SCHEDULE.ERR_VENUE_REQUIRED', 'error');
        this.setTab('venues');
    }

    private syncRegFee() {
        // Synchronize the registration fee across sub-settings before switching tabs or saving
        if (this.activeTab() === 'participants') {
            if (this.settings.finance) this.settings.finance.regFee = this.settings.participants.regFee;
        } else if (this.activeTab() === 'finance') {
            if (this.settings.participants) this.settings.participants.regFee = this.settings.finance.regFee;
        }
    }

    getDefaultSettings(): TournamentSettings {
        const today = new Date().toISOString().split('T')[0];
        return {
            general: {
                name: 'New Tournament',
                shortName: '',
                description: '',
                status: 'draft',
                visibility: 'public',
                type: '11aside',
                logo: '',
                coverImage: '',
                organizer: {
                    name: '',
                    email: '',
                    phone: '',
                    website: ''
                },
                sponsors: [] as string[]
            },
            participants: {
                type: 'team',
                minTeams: 8,
                maxTeams: 16,
                regOpenDate: '',
                regCloseDate: '',
                approvalRequired: true,
                regFee: 0,
                playerLimit: 25,
                squadSize: 18
            },
            format: {
                type: 'knockout',
                numGroups: 4,
                teamsPerGroup: 4,
                homeAway: false,
                winPoints: 3,
                drawPoints: 1,
                lossPoints: 0,
                tieBreaker: Object.keys({ 'head-to-head': true, 'goal-difference': true, 'goals-scored': true }).join(','),
                qualRules: 'Top 2 Advance'
            },
            schedule: {
                startDate: today,
                endDate: today,
                matchDuration: 90,
                halfDuration: 45,
                breakTime: 15,
                matchDays: { MON: true, TUE: true, WED: true, THU: true, FRI: true, SAT: true, SUN: true },
                timeSlots: '18:00, 20:00'
            },
            rules: {
                govBody: 'FIFA',
                playersOnField: 11,
                minPlayers: 7,
                subsAllowed: 5,
                offsideRule: true,
                ballSize: 5,
                pitchType: 'Grass',
                extraTimeRule: 'None',
                penaltiesRule: true,
                yellowSuspensionLimit: 3,
                redSuspensionLength: 1,
                gkRules: 'Standard'
            },
            venues: {
                multipleVenues: false,
                primaryVenue: '',
                venueAddress: '',
                pitchCount: 1,
                fieldType: 'grass'
            },
            finance: {
                paymentMethod: 'bank',
                prizePool: 10000,
                prizeMoney: 10000,
                paymentInfo: '',
                prizeDist: '1st: 60%, 2nd: 30%, 3rd: 10%',
                refundPolicy: 'No Refunds',
                regFee: 0
            },
            presentation: {
                themeColor: 'gold',
                urlSlug: '',
                showStandings: true,
                showPlayerStats: true,
                showTopScorers: true,
                welcomeMsg: '',
                showLiveScores: true,
                showCommentary: false,
                liveStreamLink: '',
                showRecentResults: true
            }
        };
    }

    loadTournament(id: string) {
        this.isLoading.set(true);
        this.tournamentService.getById(id).subscribe({
            next: (tournament) => {
                this.tournament.set(tournament);
                this.mergeTournamentToSettings(tournament);
                // Restore completed-tab progress so the green ticks persist across refresh.
                this.visitedTabs.set(new Set<string>((tournament as any)?.settings?.completedTabs || []));
                // Baseline the gating snapshot from the persisted data on load.
                this.snapshotSavedSettings();
                // Seed the wizard frontier from how far the saved data already reaches.
                this.initProgress();
                // Pull live teams/matches counts so the runtime tabs reflect real progress.
                this.refreshRuntimeProgress();
                this.isLoading.set(false);
                // Honour a deep-linked tab now that settings are loaded.
                if (this.pendingTab && this.wizardTabs.some(t => t.id === this.pendingTab)) {
                    this.setTab(this.pendingTab);
                    this.pendingTab = undefined;
                }
                // No auto-save: changes persist only when the user clicks Save / Save & Next.
            },
            error: (err) => {
                this.isLoading.set(false);
            }
        });
    }

    /**
     * Fetch the live counts that drive the runtime-tab completion ticks (registered
     * teams + generated matches). Best-effort and non-blocking — on failure the
     * counts are left as-is so the affected tabs simply stay "pending".
     */
    private refreshRuntimeProgress() {
        const id = this.tournament()?.id;
        if (!id) return;
        this.tournamentService.getTeams(id).subscribe({
            next: (regs) => this.registeredTeamsCount.set(Array.isArray(regs) ? regs.length : 0),
            error: () => { /* leave the existing count untouched */ }
        });
        this.tournamentService.getStructure(id).subscribe({
            next: (struct) => this.scheduledMatchesCount.set(struct?.matches?.length || 0),
            error: () => { /* leave the existing count untouched */ }
        });
    }

    mergeTournamentToSettings(tournament: TournamentDTO): boolean {
        const today = new Date().toISOString().split('T')[0];
        let injectedDefaults = false;

        // ── Mandatory fields: inject smart defaults if missing ──────────────
        const rawName = tournament.name?.trim();
        if (!rawName || rawName === 'null' || rawName === 'undefined') {
            this.settings.general.name = 'New Tournament';
            injectedDefaults = true;
        } else {
            this.settings.general.name = rawName;
        }

        const rawType = tournament.type?.trim();
        if (!rawType || rawType === 'null' || rawType === 'undefined') {
            this.settings.general.type = '11aside';
            injectedDefaults = true;
        } else {
            this.settings.general.type = rawType;
        }

        const rawStart = tournament.startDate?.split('T')[0];
        if (!rawStart || rawStart === 'null') {
            this.settings.schedule.startDate = today;
            injectedDefaults = true;
        } else {
            this.settings.schedule.startDate = rawStart;
        }

        const rawEnd = tournament.endDate?.split('T')[0];
        if (!rawEnd || rawEnd === 'null') {
            this.settings.schedule.endDate = today;
            injectedDefaults = true;
        } else {
            this.settings.schedule.endDate = rawEnd;
        }
        // ────────────────────────────────────────────────────────────────────

        this.settings.general.description = tournament.description || '';
        this.settings.participants.maxTeams = tournament.maxTeams || 16;
        this.settings.general.status = tournament.status || 'draft';
        this.settings.general.shortName = tournament.shortName || '';
        this.settings.general.visibility = tournament.visibility || 'public';
        this.settings.general.logo = tournament.logo || '';
        this.settings.general.coverImage = tournament.coverImage || '';
        this.settings.participants.type = tournament.participantType || 'team';
        this.settings.participants.minTeams = tournament.minTeams || 8;
        this.settings.participants.regOpenDate = tournament.regOpenDate?.split('T')[0] || '';
        this.settings.participants.regCloseDate = tournament.regCloseDate?.split('T')[0] || '';
        this.settings.participants.approvalRequired = tournament.approvalRequired !== undefined ? tournament.approvalRequired : true;
        this.settings.participants.regFee = tournament.regFee || 0;
        this.settings.participants.playerLimit = tournament.playerLimit || 25;
        this.settings.participants.squadSize = tournament.squadSize || 18;
        if (tournament.organizer) {
            this.settings.general.organizer = tournament.organizer;
        }

        if (tournament.sponsors) {
            try {
                this.settings.general.sponsors = JSON.parse(tournament.sponsors);
            } catch (e) {
                this.settings.general.sponsors = tournament.sponsors.split(',').map(s => s.trim()).filter(Boolean);
            }
        } else {
            this.settings.general.sponsors = [];
        }

        if (tournament.settings) {
            // Deep merge to avoid losing fields like general.type if settings.general is partially returned
            this.settings.rules = { ...this.settings.rules, ...(tournament.settings.rules || {}) };
            this.settings.schedule = { ...this.settings.schedule, ...(tournament.settings.schedule || {}) };
            this.settings.venues = { ...this.settings.venues, ...(tournament.settings.venues || {}) };
            this.settings.finance = { ...this.settings.finance, ...(tournament.settings.finance || {}) };
            this.settings.presentation = { ...this.settings.presentation, ...(tournament.settings.presentation || {}) };

            // Re-assert mandatory date defaults — deep merge from stored settings can overwrite with nulls
            if (!this.settings.schedule.startDate || this.settings.schedule.startDate === 'null') {
                this.settings.schedule.startDate = today;
                injectedDefaults = true;
            }
            if (!this.settings.schedule.endDate || this.settings.schedule.endDate === 'null') {
                this.settings.schedule.endDate = today;
                injectedDefaults = true;
            }
        }

        // Force sync regFee from top-level to all sub-settings
        const unifiedRegFee = tournament.regFee || 0;
        this.settings.participants.regFee = unifiedRegFee;
        this.settings.finance.regFee = unifiedRegFee;

        // Ensure we load the format entity data directly if available
        if (tournament.format) {
            // Normalize backend (plural/mismatched) to frontend naming
            let normalizedType = tournament.format.format_type || (tournament.format as any).type || this.settings.format.type;
            if (normalizedType === 'groups') normalizedType = 'group';
            if (normalizedType === 'groups_knockout') normalizedType = 'group_knockout';

            let incomingFormatData = tournament.format.format_data;
            if (typeof incomingFormatData === 'string') {
                try {
                    incomingFormatData = JSON.parse(incomingFormatData);
                } catch (e) {
                }
            }

            // If incoming format_data is valid, use it. Otherwise keep what we have if it exists.
            const finalFormatData = (incomingFormatData && Array.isArray(incomingFormatData) && incomingFormatData.length > 0)
                ? incomingFormatData
                : (this.settings.format.format_data || []);

            this.settings.format = {
                ...this.settings.format,
                type: normalizedType,
                format_data: finalFormatData,
                homeAway: tournament.format.home_away_enabled !== undefined ? tournament.format.home_away_enabled : (tournament.format as any).homeAway ?? this.settings.format.homeAway,
                winPoints: tournament.format.win_points ?? (tournament.format as any).winPoints ?? this.settings.format.winPoints,
                drawPoints: tournament.format.draw_points ?? (tournament.format as any).drawPoints ?? this.settings.format.drawPoints,
                lossPoints: tournament.format.loss_points ?? (tournament.format as any).lossPoints ?? this.settings.format.lossPoints
            };
        }

        return injectedDefaults;
    }

    setTab(tab: string) {
        // Reset the active form reference; the newly-mounted migrated tab (if any) re-emits via (formReady).
        const prev = this.activeTab();
        this.activeForm.set(null);
        this.activeTab.set(tab);
        if (tab === 'format' && this.settings.format) {
            // Force a new object reference so ngOnChanges fires in the child component
            this.settings.format = { ...this.settings.format };
        }
        // Leaving a tab where runtime data is edited (teams registered, schedule
        // generated) inside the child component — re-pull the counts so the stepper
        // ticks update to reflect that work.
        if (prev !== tab && (prev === 'teams' || prev === 'schedule' || prev === 'matches')) {
            this.refreshRuntimeProgress();
        }
    }

    /** A migrated reactive tab reports its FormGroup so the wizard can validate it on Save. */
    onActiveForm(form: FormGroup) {
        this.activeForm.set(form);
    }

    isResultsTab(): boolean {
        return this.activeTab() === 'results';
    }

    activeStepNumber(): number {
        return this.wizardTabs.findIndex(t => t.id === this.activeTab()) + 1;
    }

    /** Index helper for "Save & Next" navigation. */
    private nextTabId(): string | null {
        const idx = this.wizardTabs.findIndex(t => t.id === this.activeTab());
        const next = this.wizardTabs[idx + 1];
        return next ? next.id : null;
    }

    isFirstTab(): boolean {
        return this.activeTab() === this.wizardTabs[0].id;
    }

    /** Go back one step without saving (previous steps are already complete). */
    goPrevious() {
        const idx = this.wizardTabs.findIndex(t => t.id === this.activeTab());
        const prev = this.wizardTabs[idx - 1];
        if (prev) this.setTab(prev.id);
    }

    /**
     * Save handler for the footer buttons.
     * Validates the active tab's reactive form (if any) before persisting; on success
     * optionally advances to the next step.
     */
    saveCurrent(goNext: boolean) {
        const form = this.activeForm();
        if (form && !revealAndFocusInvalid(form)) {
            // revealAndFocusInvalid already surfaced <app-validation> messages + focused the field.
            this.ui.showToast(this.translate.instant('TOURNAMENT_DASHBOARD.WIZARD.FIX_FIELDS'), 'error');
            return;
        }

        const savedTab = this.activeTab();
        this.saveChanges(false, () => {
            // Mark the just-saved tab visited so informational tabs turn green.
            this.markVisited(savedTab);
            if (goNext) {
                // Unlock the next step only now that the current one is saved & complete.
                this.advanceProgress();
                const next = this.nextTabId();
                if (next && !this.isLocked(next)) this.setTab(next);
            }
        });
    }

    /** Record that a tab has been saved (drives the "complete" tick for informational tabs). */
    private markVisited(tabId: string) {
        if (this.visitedTabs().has(tabId)) return;
        const next = new Set(this.visitedTabs());
        next.add(tabId);
        this.visitedTabs.set(next);
    }

    /** Final-step action: validate all gated steps, confirm, then submit. */
    async submitTournament() {
        if (!this.allGatedComplete()) {
            this.ui.showToast(
                this.translate.instant('TOURNAMENT_DASHBOARD.WIZARD.LOCKED_MSG', { section: this.firstIncompleteGatedLabel() }),
                'error'
            );
            const firstIncomplete = this.gatedOrder.find(g => !this.isComplete(g));
            if (firstIncomplete) this.setTab(firstIncomplete);
            return;
        }

        const confirmed = await this.ui.confirmAction(
            this.translate.instant('TOURNAMENT_DASHBOARD.WIZARD.SUBMIT_CONFIRM_TITLE'),
            this.translate.instant('TOURNAMENT_DASHBOARD.WIZARD.SUBMIT_CONFIRM_MSG'),
            this.translate.instant('TOURNAMENT_DASHBOARD.WIZARD.SUBMIT')
        );
        if (!confirmed) return;

        const t = this.tournament();
        if (!t || !t.id) return;

        this.ui.startAction();
        this.tournamentService.submit(t.id).subscribe({
            next: (updated) => {
                this.ui.endAction();
                this.tournament.set(updated);
                this.settings.general.status = updated.status;
                this.showToast('TOURNAMENT_DASHBOARD.WIZARD.SUBMIT_SUCCESS', 'success');
                this.router.navigate(['/admin/tournaments']);
            },
            error: () => {
                // The global error interceptor surfaces the server's "missing sections" message.
                this.ui.endAction();
            }
        });
    }

    handleSettingsUpdate(key: keyof TournamentSettings, data: any) {
        this.settings[key] = { ...this.settings[key], ...data };

        // If tournament type changed, update playersOnField and other relevant rules
        if (key === 'general' && data.type) {
            const type = data.type;
            if (type === 'futsal') {
                this.settings.rules.playersOnField = 5;
                this.settings.rules.minPlayers = 3;
                this.settings.rules.subsAllowed = 99; // Rolling
                this.settings.participants.squadSize = 12;
            } else if (type === '7aside') {
                this.settings.rules.playersOnField = 7;
                this.settings.rules.minPlayers = 5;
                this.settings.rules.subsAllowed = 5;
                this.settings.participants.squadSize = 14;
            } else if (type === '11aside') {
                this.settings.rules.playersOnField = 11;
                this.settings.rules.minPlayers = 7;
                this.settings.rules.subsAllowed = 5;
                this.settings.participants.squadSize = 25;
            }
        }

        this.formatChanged = true;
    }

    onFormatChange(newFormat: any) {
        this.settings.format = newFormat;
        this.formatChanged = true;
    }

    saveChanges(silent: boolean = false, onSuccess?: () => void) {
        const t = this.tournament();
        if (!t || !t.id) return;

        if (!this.settings.general.name || !this.settings.general.type || !this.settings.schedule.startDate || !this.settings.schedule.endDate) {
            this.showValidationErrors.set(true);
            if (!silent) this.ui.showToast('Please fill all mandatory fields.', 'error');

            if (!this.settings.general.name || !this.settings.general.type) {
                this.setActiveTab('general', true);
            } else if (!this.settings.schedule.startDate || !this.settings.schedule.endDate) {
                this.setActiveTab('schedule', true);
            }
            return;
        }

        this.showValidationErrors.set(false);
        this.syncRegFee();

        // Persist which informational tabs the user has completed so the green ticks
        // survive a refresh (stored in the tournament's settings JSON).
        (this.settings as any).completedTabs = Array.from(this.visitedTabs());

        if (!silent) {
            this.ui.startAction();
        }

        this.tournamentService.update(t.id, {
            name: this.settings.general.name,
            description: this.settings.general.description,
            startDate: this.settings.schedule.startDate,
            endDate: this.settings.schedule.endDate,
            maxTeams: this.settings.participants.maxTeams,
            status: this.settings.general.status,
            shortName: this.settings.general.shortName,
            type: this.settings.general.type,
            visibility: this.settings.general.visibility,
            logo: this.settings.general.logo,
            coverImage: this.settings.general.coverImage,
            sponsors: JSON.stringify(this.settings.general.sponsors),
            organizer: this.settings.general.organizer,
            participantType: this.settings.participants.type,
            minTeams: this.settings.participants.minTeams,
            regOpenDate: this.settings.participants.regOpenDate,
            regCloseDate: this.settings.participants.regCloseDate,
            approvalRequired: this.settings.participants.approvalRequired,
            regFee: this.settings.participants.regFee,
            playerLimit: this.settings.participants.playerLimit,
            squadSize: this.settings.participants.squadSize,
            settings: this.settings,
            format: {
                format_type: this.settings.format.type === 'group' ? 'groups' :
                    this.settings.format.type === 'group_knockout' ? 'groups_knockout' :
                        this.settings.format.type,
                format_data: (this.settings.format as any).format_data,
                home_away_enabled: this.settings.format.homeAway,
                win_points: this.settings.format.winPoints,
                draw_points: this.settings.format.drawPoints,
                loss_points: this.settings.format.lossPoints
            },
        }).subscribe({
            next: (updated) => {
                this.tournament.set(updated);

                // The tournament data is now saved. If the format changed, also try to
                // (re)generate the structure — but this is best-effort: it legitimately
                // fails until there are ≥2 approved teams, so we suppress that error and
                // let it regenerate automatically on a later save once teams exist.
                if (this.formatChanged && t.id) {
                    this.tournamentService.generateStructure(t.id, undefined, true).subscribe({
                        next: () => {
                            this.formatChanged = false;
                            this.finishSave(silent, onSuccess, 'TOURNAMENT_DASHBOARD.TOAST.STRUCTURE_SUCCESS');
                        },
                        error: () => {
                            // Structure not ready yet (e.g. needs teams) — the save still succeeded.
                            this.finishSave(silent, onSuccess, 'TOURNAMENT_DASHBOARD.TOAST.SAVE_SUCCESS');
                        }
                    });
                } else {
                    this.finishSave(silent, onSuccess, 'TOURNAMENT_DASHBOARD.TOAST.SAVE_SUCCESS');
                }
            },
            error: (err) => {
                if (!silent) {
                    this.ui.endAction();
                    // Surface the server's actual reason (e.g. a specific validation/DB
                    // message) instead of a generic failure, so the cause is visible.
                    const serverMsg = err?.error?.message;
                    this.showToast(serverMsg || 'TOURNAMENT_DASHBOARD.TOAST.SAVE_ERROR', 'error');
                }
            }
        });
    }

    /** Common save-completion: stop the loader, toast success, and advance if requested. */
    private finishSave(silent: boolean, onSuccess: (() => void) | undefined, successKey: string) {
        // Data is now persisted — refresh the gating snapshot so the just-saved tab
        // counts as complete and the next step unlocks. Must run before onSuccess
        // (which may navigate to the next, now-unlocked, tab).
        this.snapshotSavedSettings();
        // A save may have (re)generated the structure once teams exist — refresh the
        // runtime counts so the schedule/matches ticks stay accurate.
        this.refreshRuntimeProgress();
        if (!silent) {
            this.ui.endAction();
            this.showToast(successKey, 'success');
        }
        onSuccess?.();
    }

    closeDashboard() {
        this.router.navigate(['/admin/tournaments']);
    }

    goBack() {
        this.router.navigate(['/admin/tournaments']);
    }

    showToast(key: string, type: 'success' | 'error' | 'info' = 'success') {
        // `key` is an i18n key (e.g. TOURNAMENT_DASHBOARD.TOAST.SAVE_SUCCESS). Resolve it
        // before display; if it's already plain text (e.g. a server error message),
        // translate.instant returns it unchanged, so this is safe for both cases.
        this.ui.showToast(this.translate.instant(key), type);
    }

    getStatusLabel(status: string): string {
        const map: Record<string, string> = {
            draft: 'TOURNAMENT_DASHBOARD.STATUS.DRAFT',
            registration_open: 'TOURNAMENT_DASHBOARD.STATUS.REGISTRATION_OPEN',
            in_progress: 'TOURNAMENT_DASHBOARD.STATUS.IN_PROGRESS',
            completed: 'TOURNAMENT_DASHBOARD.STATUS.COMPLETED',
        };
        return map[status] || status;
    }

    getStatusClass(status: string): string {
        const map: Record<string, string> = {
            draft: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
            registration_open: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
            in_progress: 'text-gold-400 border-gold-400/30 bg-gold-400/10',
            completed: 'text-zinc-400 border-zinc-400/30 bg-zinc-400/10',
        };
        return map[status] || '';
    }
}
