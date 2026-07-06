
import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { LoaderComponent } from '../components/loader/loader.component';
import { TournamentService, TournamentDTO } from './tournament.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TournamentCreateModalComponent } from '../components/shared/tournament-create-modal/tournament-create-modal.component';
import { UiService } from '../services/ui.service';
import { DatePickerComponent } from '../shared/components/date-picker/date-picker.component';
import { API_URL } from '../core/config/app.config';

@Component({
    selector: 'app-tournament',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        LoaderComponent,
        TranslateModule,
        TournamentCreateModalComponent,
        DatePickerComponent
    ],
    templateUrl: './tournament.component.html',
})
export class TournamentComponent implements OnInit {
    private tournamentService = inject(TournamentService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private ui = inject(UiService);

    currentTab = signal<'all' | 'live' | 'upcoming' | 'archived'>('live');
    isLoading = signal(true);
    showCreateModal = signal(false);

  // Filtering state

    // Filters
    searchQuery = '';
    filterDateFrom = '';
    filterDateTo = '';
    sortBy = 'name';

    platformStats = [
        {
            label: 'Total Tournaments',
            value: '42',
            icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
        },
        {
            label: 'Finished Tournaments',
            value: '18',
            icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
        },
        {
            label: 'Total Teams / Clubs',
            value: '156',
            icon: 'M3 13h10a1 1 0 00.78-.37l2.83-4.24a1 1 0 011.66 0l2.83 4.24a1 1 0 00.78.37h5m-5 0V6a3 3 0 10-6 0v7m-5 0h12'
        },
        {
            label: 'Total Players',
            value: '2,400+',
            icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
        }
    ];

    allTournaments: TournamentDTO[] = [];

    ngOnInit() {
        this.loadTournaments();

        // Apply a search term passed from the top-bar (?search=...) and show all statuses
        this.route.queryParams.subscribe(params => {
            const search = params['search'];
            if (search) {
                this.searchQuery = search;
                this.onFilterChange();
            }
            
            const tab = params['tab'];
            if (tab && ['all', 'live', 'upcoming', 'archived'].includes(tab)) {
                this.currentTab.set(tab as any);
            }
        });
    }

    loadTournaments() {
        this.isLoading.set(true);
        this.tournamentService.getAll().subscribe({
            next: (data) => {
                this.allTournaments = data;
                this.isLoading.set(false);
            },
            error: (err) => {
                this.isLoading.set(false);
                this.ui.showToast('Failed to load tournaments', 'error');
            }
        });
    }

    manageTournament(id: string | undefined) {
        if (id) {
            this.router.navigate(['/admin/tournaments', id]);
        }
    }

    viewMatchCenter(id: string | undefined) {
        if (id) {
            this.router.navigate(['/admin/tournaments', id, 'match-center']);
        }
    }

    // --- Soft delete ---

    async requestDelete(tournament: TournamentDTO) {
        if (!tournament?.id) return;
        
        const translate = inject(TranslateService);
        const title = translate.instant('TOURNAMENTS.DELETE_CONFIRM_TITLE');
        const message = translate.instant('TOURNAMENTS.DELETE_CONFIRM_MESSAGE') + ' ' + (tournament.name || '');
        
        const confirmed = await this.ui.confirmAction(title, message);
        
        if (confirmed) {
            this.tournamentService.delete(tournament.id.toString()).subscribe({
                next: () => {
                    this.allTournaments = this.allTournaments.filter(t => t.id !== tournament.id);
                    this.ui.showToast('Tournament deleted', 'success');
                },
                error: () => {
                    this.ui.showToast('Failed to delete tournament', 'error');
                }
            });
        }
    }

    /** Card image: prefer the logo, fall back to the cover. Resolves stored upload paths to an absolute URL. */
    tournamentImage(t: TournamentDTO): string {
        const src = t.logo || t.coverImage || '';
        if (!src) return '';
        if (src.startsWith('data:') || src.startsWith('http')) return src;
        // Stored paths come back as "/uploads/..." or "uploads/..." (no leading slash).
        if (src.includes('uploads/')) {
            return `${API_URL}${src.startsWith('/') ? '' : '/'}${src}`;
        }
        return src;
    }

    getStatusLabel(status: string): string {
        const map: Record<string, string> = {
            draft: 'Draft',
            registration_open: 'Registration Open',
            in_progress: 'In Progress',
            completed: 'Completed',
            archived: 'Archived'
        };
        return map[status?.toLowerCase()] || status || 'Unknown';
    }

    getStatusClass(status: string): string {
        const map: Record<string, string> = {
            draft: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
            registration_open: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
            in_progress: 'text-gold-400 border-gold-400/30 bg-gold-400/10',
            completed: 'text-zinc-400 border-zinc-400/30 bg-zinc-400/10',
            archived: 'text-zinc-600 border-zinc-600/30 bg-zinc-600/10'
        };
        return map[status?.toLowerCase()] || 'text-zinc-400 border-zinc-400/30 bg-zinc-400/10';
    }



    stats = [
        { label: 'ACTIVE CUPS', value: '24', icon: 'trophy' },
        { label: 'ACTIVE PLAYERS', value: '12,402', icon: 'users' },
        { label: 'GAMES TODAY', value: '156', icon: 'ticket' }
    ];

    get activeTournaments() {
        const query = this.searchQuery.trim().toLowerCase();
        
        const now = new Date();
        const todayString = now.toDateString();
        now.setHours(0, 0, 0, 0);

        let list: TournamentDTO[];
        switch (this.currentTab()) {
            case 'all':
                list = [...this.allTournaments];
                break;
            case 'upcoming':
                list = this.allTournaments.filter(t => {
                    if (t.startDate) {
                        const startDate = new Date(t.startDate);
                        startDate.setHours(0, 0, 0, 0);
                        if (startDate < now) return false; // Reject past dates
                    }
                    if (t.status === 'draft' || t.status === 'registration_open') return true;
                    if (t.startDate) {
                        const startDate = new Date(t.startDate);
                        startDate.setHours(0, 0, 0, 0);
                        if (startDate > now) return true;
                    }
                    return false;
                });
                break;
            case 'archived':
                list = this.allTournaments.filter(t => {
                    if (t.status === 'completed' || t.status === 'archived') return true;
                    if (t.startDate) {
                        const startDate = new Date(t.startDate);
                        startDate.setHours(0, 0, 0, 0);
                        if (startDate < now) return true;
                    }
                    return false;
                });
                break;
            case 'live':
            default:
                list = this.allTournaments.filter(t => {
                    // Only show tournaments where the schedule date is exactly today
                    if (!t.startDate) return false;
                    const startDate = new Date(t.startDate);
                    return startDate.toDateString() === todayString;
                });
                break;
        }

        // Search filter
        if (query) {
            list = list.filter(t =>
                (t.name?.toLowerCase().includes(query)) ||
                (t.maxTeams?.toString().includes(query))
            );
        }

        // Date range filter — compare against the local start/end of the chosen days
        // so a tournament starting any time on the "to" day is still included.
        if (this.filterDateFrom) {
            const from = new Date(this.filterDateFrom + 'T00:00:00').getTime();
            list = list.filter(t => t.startDate && new Date(t.startDate).getTime() >= from);
        }
        if (this.filterDateTo) {
            const to = new Date(this.filterDateTo + 'T23:59:59.999').getTime();
            list = list.filter(t => t.startDate && new Date(t.startDate).getTime() <= to);
        }

        // Sort
        switch (this.sortBy) {
            case 'name':
                list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                break;
            case 'date':
                list = [...list].sort((a, b) => {
                    const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
                    const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
                    return dateA - dateB;
                });
                break;
            case 'participants':
                list = [...list].sort((a, b) => {
                    const numA = typeof a.maxTeams === 'number' ? a.maxTeams : 0;
                    const numB = typeof b.maxTeams === 'number' ? b.maxTeams : 0;
                    return numB - numA;
                });
                break;
        }

        return list;
    }

    get activeFilterCount(): number {
        let count = 0;
        if (this.searchQuery.trim()) count++;
        if (this.filterDateFrom) count++;
        if (this.filterDateTo) count++;
        if (this.sortBy !== 'name') count++;
        return count;
    }

    clearFilters() {
        this.searchQuery = '';
        this.filterDateFrom = '';
        this.filterDateTo = '';
        this.sortBy = 'name';
    }

    switchTab(tab: 'all' | 'live' | 'upcoming' | 'archived') {
        this.currentTab.set(tab);
    }

    // When any filter is applied, jump to the "All" tab so matches across every
    // status are visible instead of being hidden by the current tab.
    onFilterChange() {
        if (this.activeFilterCount > 0 && this.currentTab() !== 'all') {
            this.currentTab.set('all');
        }
    }

    openCreateModal() {
        this.showCreateModal.set(true);
    }

    closeCreateModal() {
        this.showCreateModal.set(false);
    }

    onTournamentCreated(created: any) {
        this.ui.showToast('Tournament created successfully!', 'success');
        this.loadTournaments();
    }
}
