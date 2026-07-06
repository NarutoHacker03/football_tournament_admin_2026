import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../core/config/app.config';

export interface TeamMember {
    id: string;
    name: string;
    role: 'player' | 'captain' | 'vice_captain' | 'coach' | 'manager';
    position?: string;
    jerseyNumber?: number;
    teamId: string;
    createdAt: string;
    status?: 'active' | 'injured' | 'suspended';
    photoUrl?: string;
    dob?: string;
    preferredFoot?: 'right' | 'left' | 'both';
}

@Injectable({
    providedIn: 'root'
})
export class TeamMemberService {
    private http = inject(HttpClient);
    private apiUrl = `${API_URL}/api/teams`;

    getByTeamId(teamId: string): Observable<TeamMember[]> {
        return this.http.get<TeamMember[]>(`${this.apiUrl}/${teamId}/members`);
    }

    /** Upload a member photo and get back its stored `/uploads/...` URL. */
    uploadPhoto(teamId: string, file: File): Observable<{ photoUrl: string }> {
        const form = new FormData();
        form.append('photo', file, file.name);
        return this.http.post<{ photoUrl: string }>(`${this.apiUrl}/${teamId}/members/photo`, form);
    }

    /** Turn a relative `/uploads/...` path into an absolute URL against the API host. */
    fullUrl(path?: string): string {
        if (!path) return '';
        return path.startsWith('/uploads') ? `${API_URL}${path}` : path;
    }

    create(teamId: string, data: Partial<TeamMember>): Observable<TeamMember> {
        return this.http.post<TeamMember>(`${this.apiUrl}/${teamId}/members`, data);
    }

    update(id: string, data: Partial<TeamMember>): Observable<TeamMember> {
        return this.http.put<TeamMember>(`${this.apiUrl}/members/${id}`, data);
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${API_URL}/api/teams/members/${id}`);
    }
}
