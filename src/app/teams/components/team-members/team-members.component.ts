import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../../core/config/app.config';
import { TeamMemberService, TeamMember } from '../../team-member.service';
import { UiService } from '../../../services/ui.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';

@Component({
  selector: 'app-team-members',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DatePickerComponent],
  templateUrl: './team-members.component.html',
  styles: [`
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: #3f3f46;
        border-radius: 20px;
      }
      .shadow-inset {
        box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.5);
      }
    `]
})
export class TeamMembersComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private memberService = inject(TeamMemberService);
  private ui = inject(UiService);
  private translate = inject(TranslateService);

  private teamId = this.route.parent?.snapshot.paramMap.get('id');

  // Tournament context (present when arriving from "Add Team to Tournament").
  // Lets this page gate a "next step" back into that tournament once the squad is complete.
  tournamentId = this.route.snapshot.queryParamMap.get('tournamentId');
  tournamentName = this.route.snapshot.queryParamMap.get('tournamentName') || '';

  /** Minimum squad size required before a team can join — passed from the tournament. */
  readonly requiredMembers = Number(this.route.snapshot.queryParamMap.get('required')) || 16;
  isJoining = signal(false);

  // State
  members = signal<TeamMember[]>([]);
  isModalOpen = signal(false);
  isSubmitting = signal(false);
  editingMemberId = signal<string | null>(null);
  activeMenuId = signal<string | null>(null);

  // Photo upload (Add/Edit modal)
  photoPreview = signal<string | null>(null);
  isUploadingPhoto = signal(false);

  // Read-only "View Profile" modal
  isProfileOpen = signal(false);
  profileMember = signal<TeamMember | null>(null);

  /** True when arriving from a tournament's add-team flow. */
  hasTournamentContext = computed(() => !!this.tournamentId);
  /** Whether the squad has reached the tournament's minimum member count. */
  hasEnoughMembers = computed(() => this.members().length >= this.requiredMembers);

  // Filters
  searchTerm = signal('');
  activeFilter = signal('all'); // all, players, staff, active, injured

  // New/Edit Member Form State
  newMember: Partial<TeamMember> = this.getInitialMemberState('player');

  // Computed Properties
  filteredMembers = computed(() => {
    let result = this.members();

    // Apply string search
    const term = this.searchTerm().toLowerCase();
    if (term) {
      result = result.filter(m =>
        m.name.toLowerCase().includes(term) ||
        (m.jerseyNumber && m.jerseyNumber.toString().includes(term))
      );
    }

    // Apply dropdown filter
    switch (this.activeFilter()) {
      case 'players':
        result = result.filter(m => ['player', 'captain', 'vice_captain'].includes(m.role));
        break;
      case 'staff':
        result = result.filter(m => ['coach', 'manager'].includes(m.role));
        break;
      case 'active':
        result = result.filter(m => m.status === 'active' || !m.status);
        break;
      case 'injured':
        result = result.filter(m => m.status === 'injured');
        break;
    }

    return result;
  });

  // We select the first captain we find to highlight
  captain = computed(() => {
    return this.members().find(m => m.role === 'captain');
  });

  ngOnInit() {
    this.loadMembers();
  }

  private getInitialMemberState(role: 'player' | 'staff' | 'captain' | 'vice_captain' | 'coach' | 'manager' = 'player'): Partial<TeamMember> {
    // 'staff' is a UI grouping, not a persisted role — default it to a concrete staff role
    const resolvedRole = role === 'staff' ? 'coach' : role;
    return {
      role: resolvedRole as any,
      status: 'active',
      position: '',
      jerseyNumber: undefined,
      dob: '',
      preferredFoot: 'right'
    };
  }

  loadMembers() {
    if (!this.teamId) return;
    this.memberService.getByTeamId(this.teamId).subscribe(data => {
      this.members.set(data);
    });
  }

  // Modal Actions
  openAddModal(type: 'player' | 'staff') {
    this.editingMemberId.set(null);
    this.newMember = this.getInitialMemberState(type);
    this.photoPreview.set(null);
    this.isUploadingPhoto.set(false);
    this.isModalOpen.set(true);
    this.activeMenuId.set(null); // close any open native menu
  }

  openEditModal(member: TeamMember) {
    this.editingMemberId.set(member.id);
    this.newMember = { ...member }; // open a copy to edit
    this.photoPreview.set(member.photoUrl ? this.imgUrl(member.photoUrl) : null);
    this.isUploadingPhoto.set(false);
    this.isModalOpen.set(true);
    this.activeMenuId.set(null);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingMemberId.set(null);
    this.newMember = this.getInitialMemberState('player');
    this.photoPreview.set(null);
    this.isUploadingPhoto.set(false);
  }

  /** Resolve a member photo path to an absolute URL for display. */
  imgUrl(path?: string): string {
    return this.memberService.fullUrl(path);
  }

  // View Profile (read-only) modal
  viewProfile(member: TeamMember) {
    this.profileMember.set(member);
    this.isProfileOpen.set(true);
    this.activeMenuId.set(null);
  }

  closeProfile() {
    this.isProfileOpen.set(false);
    this.profileMember.set(null);
  }

  /** From the profile modal, jump straight into editing the same member. */
  editFromProfile() {
    const member = this.profileMember();
    this.closeProfile();
    if (member) this.openEditModal(member);
  }

  /** i18n label for a member's role (e.g. 'vice_captain' → localized). */
  roleLabel(role?: string): string {
    return this.translate.instant('TEAM_MEMBERS.ROLES.' + (role || 'player').toUpperCase());
  }

  /** i18n label for a member's status. */
  statusLabel(status?: string): string {
    return this.translate.instant('TEAM_MEMBERS.STATUS.' + (status || 'active').toUpperCase());
  }

  /** i18n label for a member's preferred foot. */
  footLabel(foot?: string): string {
    if (!foot) return '—';
    return this.translate.instant('TEAM_MEMBERS.FOOT.' + foot.toUpperCase());
  }

  /** Handle picking a photo: validate, preview instantly, upload, then store the URL. */
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Accept only PNG/JPG up to 5 MB.
    const typeOk = ['image/png', 'image/jpeg'].includes(file.type);
    const sizeOk = file.size <= 5 * 1024 * 1024;
    if (!typeOk || !sizeOk) {
      this.ui.showToast(
        !typeOk ? 'Please choose a PNG or JPG image.' : 'Image must be 5 MB or smaller.',
        'error'
      );
      input.value = '';
      return;
    }

    if (!this.teamId) return;

    // Instant local preview while the upload runs.
    const reader = new FileReader();
    reader.onload = (e) => this.photoPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);

    this.isUploadingPhoto.set(true);
    this.memberService.uploadPhoto(this.teamId, file).subscribe({
      next: (res) => {
        this.isUploadingPhoto.set(false);
        this.newMember.photoUrl = res.photoUrl;
        this.photoPreview.set(this.imgUrl(res.photoUrl));
      },
      error: () => {
        this.isUploadingPhoto.set(false);
        this.photoPreview.set(this.newMember.photoUrl ? this.imgUrl(this.newMember.photoUrl) : null);
        this.ui.showToast('Photo upload failed. Please try again.', 'error');
      }
    });
    input.value = '';
  }

  /** Remove the currently selected/existing photo. Empty string clears it on save (undefined is ignored by the update). */
  removePhoto() {
    this.newMember.photoUrl = '';
    this.photoPreview.set(null);
  }

  // Action Menu Toggle
  toggleMenu(id: string) {
    if (this.activeMenuId() === id) {
      this.activeMenuId.set(null);
    } else {
      this.activeMenuId.set(id);
    }
  }

  saveMember() {
    if (!this.teamId || !this.newMember.name) return;

    this.isSubmitting.set(true);

    const editingId = this.editingMemberId();
    const request$ = editingId
      ? this.memberService.update(editingId, this.newMember)
      : this.memberService.create(this.teamId, this.newMember);

    request$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeModal();
        this.loadMembers();
      },
      error: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  /**
   * Squad is complete — add this team to the originating tournament and return to its
   * dashboard (Teams tab). The backend enforces the same member minimum, so this only
   * succeeds once the threshold is met.
   */
  goToTournamentNextStep() {
    if (!this.teamId || !this.tournamentId || !this.hasEnoughMembers()) return;

    this.isJoining.set(true);
    this.http.post(`${API_URL}/api/tournaments/${this.tournamentId}/teams/${this.teamId}`, {}).subscribe({
      next: () => {
        this.isJoining.set(false);
        this.ui.showToast(this.translate.instant('TEAM_MEMBERS.JOINED_TOURNAMENT'), 'success');
        this.router.navigate(['/admin/tournaments', this.tournamentId], { queryParams: { tab: 'teams' } });
      },
      error: (err) => {
        this.isJoining.set(false);
        this.ui.showToast(err?.error?.message || this.translate.instant('TEAM_MEMBERS.JOIN_ERROR'), 'error');
      }
    });
  }

  removeMember(id: string) {
    if (!confirm('Are you sure you want to remove this member?')) return;
    this.activeMenuId.set(null);

    this.memberService.delete(id).subscribe({
      next: () => this.loadMembers(),
      error: () => {}
    });
  }
}
