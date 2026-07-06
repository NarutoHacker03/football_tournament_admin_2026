import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { API_URL } from '../../../../../core/config/app.config';

@Component({
    selector: 'app-lineup',
    standalone: true,
    imports: [CommonModule, TranslateModule],
    templateUrl: './lineup.component.html'
})
export class LineupComponent {
    @Input() homeTeam: any;
    @Input() awayTeam: any;
    @Input() homeLineup: any;
    @Input() awayLineup: any;

    /** Resolve a team's logo (`logoUrl`, a `/uploads/...` path) to an absolute URL for <img>. */
    teamLogo(team: any): string {
        const path = team?.logoUrl;
        if (!path) return '';
        return path.startsWith('/uploads') ? `${API_URL}${path}` : path;
    }

    // Helpers to safely extract lineup arrays
    get homeStarting() {
        return this.homeLineup?.starting || [];
    }

    get homeSubs() {
        return this.homeLineup?.subs || [];
    }

    get awayStarting() {
        return this.awayLineup?.starting || [];
    }

    get awaySubs() {
        return this.awayLineup?.subs || [];
    }
}
