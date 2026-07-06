import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TournamentService } from '../../../tournament/tournament.service';

@Component({
    selector: 'app-tournament-results',
    standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule],
    templateUrl: './tournament-results.component.html'
})
export class TournamentResultsComponent implements OnInit {
    private translate = inject(TranslateService);
    @Input() tournamentId!: string;

    private tournamentService = inject(TournamentService);
    structure = signal<any>(null);
    isLoadingStructure = signal(false);
    matches = signal<any[]>([]);
    isLoadingMatches = signal(false);
    topPerformance = signal<any>(null);
    isLoadingPerformance = signal(false);
    // Prize pool (amounts) from the tournament's finance settings.
    finance = signal<any>(null);

    ngOnInit() {
        if (this.tournamentId) {
            this.loadStructure();
            this.loadMatches();
            this.loadTopPerformance();
            this.loadFinance();
        }
    }

    loadFinance() {
        this.tournamentService.getById(this.tournamentId).subscribe({
            next: (t: any) => this.finance.set(t?.settings?.finance || null),
            error: () => { /* prize section just won't render */ }
        });
    }

    loadStructure() {
        this.isLoadingStructure.set(true);
        this.tournamentService.getStructure(this.tournamentId).subscribe({
            next: (data: any) => {
                this.structure.set(data);
                this.isLoadingStructure.set(false);
            },
            error: (err: any) => {
                this.isLoadingStructure.set(false);
            }
        });
    }

    loadMatches() {
        this.isLoadingMatches.set(true);
        this.tournamentService.getTournamentResults(this.tournamentId).subscribe({
            next: (data: any[]) => {
                this.matches.set(data);
                this.isLoadingMatches.set(false);
            },
            error: (err: any) => {
                this.isLoadingMatches.set(false);
            }
        });
    }

    loadTopPerformance() {
        this.isLoadingPerformance.set(true);
        this.tournamentService.getTournamentTopPerformance(this.tournamentId).subscribe({
            next: (data: any) => {
                this.topPerformance.set(data);
                this.isLoadingPerformance.set(false);
            },
            error: (err: any) => {
                this.isLoadingPerformance.set(false);
            }
        });
    }

    get groups() {
        if (!this.structure()?.groups) return [];
        return this.structure().groups;
    }

    /**
     * Overall team ranking (points → GD → GF). Prefers pre-computed group standings;
     * when those are empty (league/knockout formats without group tables) it derives the
     * table from completed match results so prizes reflect the actual outcomes.
     * Empty until at least one match has been played, so prizes stay "TBD" until then.
     */
    private rankedTeams(): any[] {
        const rows: any[] = [];
        for (const g of this.groups) {
            for (const r of (g.group_teams || [])) rows.push(r);
        }
        if (rows.some(r => (r.played || 0) > 0)) {
            return rows.slice().sort(this.byRank);
        }
        return this.standingsFromMatches();
    }

    /** Build a league table from completed matches when no group standings exist. */
    private standingsFromMatches(): any[] {
        const table = new Map<number, any>();
        const ensure = (team: any) => {
            if (!team?.id) return null;
            if (!table.has(team.id)) {
                table.set(team.id, { team, played: 0, points: 0, goals_for: 0, goals_against: 0, goal_difference: 0 });
            }
            return table.get(team.id);
        };

        for (const stageGroup of (this.matches() || [])) {
            for (const m of (stageGroup.matches || [])) {
                if (m.status !== 'completed') continue;
                const home = ensure(m.homeTeam);
                const away = ensure(m.awayTeam);
                if (!home || !away) continue;
                const hs = Number(m.homeScore) || 0;
                const as = Number(m.awayScore) || 0;
                home.played++; away.played++;
                home.goals_for += hs; home.goals_against += as;
                away.goals_for += as; away.goals_against += hs;
                if (hs > as) home.points += 3;
                else if (as > hs) away.points += 3;
                else { home.points += 1; away.points += 1; }
            }
        }

        const rows = Array.from(table.values());
        rows.forEach(r => r.goal_difference = r.goals_for - r.goals_against);
        if (!rows.some(r => r.played > 0)) return [];
        return rows.sort(this.byRank);
    }

    /** Standard league sort: points, then goal difference, then goals scored. */
    private byRank = (a: any, b: any): number =>
        (b.points || 0) - (a.points || 0) ||
        (b.goal_difference || 0) - (a.goal_difference || 0) ||
        (b.goals_for || 0) - (a.goals_for || 0);

    /**
     * Prize positions that carry money, each matched to the team currently in that
     * standings position (or null → shown as "to be decided").
     */
    prizeWinners(): { place: number; amount: number; team: any }[] {
        const dist: number[] = this.finance()?.prizeDistribution || [];
        const ranked = this.rankedTeams();
        return [0, 1, 2]
            .map(i => ({ place: i + 1, amount: Number(dist[i]) || 0, team: ranked[i]?.team || null }))
            .filter(p => p.amount > 0);
    }

    /** Medal tint classes per finishing place (1st gold, 2nd silver, 3rd bronze). */
    placeClasses(place: number): { badge: string; ring: string } {
        if (place === 1) return { badge: 'bg-gold-400 text-black', ring: 'border-gold-400/40' };
        if (place === 2) return { badge: 'bg-zinc-300 text-black', ring: 'border-zinc-300/30' };
        return { badge: 'bg-amber-600 text-white', ring: 'border-amber-600/30' };
    }
}
