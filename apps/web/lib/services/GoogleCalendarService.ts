const OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export class GoogleCalendarService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID ?? "";
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
    this.redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/google/callback`;
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: CALENDAR_SCOPE,
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `${OAUTH_URL}?${params}`;
  }

  async exchangeCode(code: string): Promise<{ access_token: string; refresh_token?: string }> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
    return res.json() as Promise<{ access_token: string; refresh_token?: string }>;
  }

  async getAccessToken(refreshToken: string): Promise<string> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
    const data = await res.json() as { access_token: string };
    return data.access_token;
  }

  async revokeToken(token: string): Promise<void> {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
  }

  async listExternalEvents(refreshToken: string): Promise<Array<{
    id: string;
    summary?: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }>> {
    const accessToken = await this.getAccessToken(refreshToken);
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const params = new URLSearchParams({
      timeMin, timeMax,
      maxResults: "500",
      singleEvents: "true",
      orderBy: "startTime",
    });
    const res = await fetch(`${CALENDAR_API}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Calendar API error ${res.status}: ${errText}`);
    }
    const data = await res.json() as { items?: Array<any> };
    return (data.items ?? []).filter(
      (e: any) =>
        e.status !== "cancelled" &&
        e.extendedProperties?.private?.source !== "agendaFamilia"
    );
  }

  async syncActivities(
    refreshToken: string,
    activities: Array<{
      id: string;
      title: string;
      description?: string | null;
      start_at: Date;
      end_at?: Date | null;
      location?: string | null;
      status: string;
    }>
  ): Promise<{ created: number; updated: number; deleted: number }> {
    const accessToken = await this.getAccessToken(refreshToken);

    const existing = await this.listAgendaEvents(accessToken);
    const existingMap = new Map(existing.map((e) => [e.agendaFamiliaId, e.googleId]));

    const activeActivities = activities.filter((a) => a.status === "ACTIVE");
    const activeIds = new Set(activeActivities.map((a) => a.id));

    let created = 0, updated = 0, deleted = 0;

    for (const { googleId, agendaFamiliaId } of existing) {
      if (!activeIds.has(agendaFamiliaId)) {
        await this.deleteEvent(accessToken, googleId);
        deleted++;
      }
    }

    for (const activity of activeActivities) {
      const googleId = existingMap.get(activity.id);
      if (googleId) {
        await this.updateEvent(accessToken, googleId, activity);
        updated++;
      } else {
        await this.createEvent(accessToken, activity);
        created++;
      }
    }

    return { created, updated, deleted };
  }

  private async listAgendaEvents(accessToken: string): Promise<Array<{ googleId: string; agendaFamiliaId: string }>> {
    const params = new URLSearchParams({
      privateExtendedProperty: "source=agendaFamilia",
      maxResults: "2500",
      singleEvents: "true",
    });
    const res = await fetch(`${CALENDAR_API}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      items?: Array<{
        id: string;
        extendedProperties?: { private?: { agendaFamiliaId?: string } };
      }>;
    };
    return (data.items ?? [])
      .filter((e) => e.extendedProperties?.private?.agendaFamiliaId)
      .map((e) => ({
        googleId: e.id,
        agendaFamiliaId: e.extendedProperties!.private!.agendaFamiliaId!,
      }));
  }

  private async createEvent(accessToken: string, activity: {
    id: string; title: string; description?: string | null;
    start_at: Date; end_at?: Date | null; location?: string | null;
  }): Promise<void> {
    await fetch(`${CALENDAR_API}/calendars/primary/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(this.buildEvent(activity)),
    });
  }

  private async updateEvent(accessToken: string, googleId: string, activity: {
    id: string; title: string; description?: string | null;
    start_at: Date; end_at?: Date | null; location?: string | null;
  }): Promise<void> {
    const res = await fetch(`${CALENDAR_API}/calendars/primary/events/${googleId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(this.buildEvent(activity)),
    });
    if (res.status === 404) {
      await this.createEvent(accessToken, activity);
    }
  }

  private async deleteEvent(accessToken: string, googleId: string): Promise<void> {
    await fetch(`${CALENDAR_API}/calendars/primary/events/${googleId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  private buildEvent(activity: {
    id: string; title: string; description?: string | null;
    start_at: Date; end_at?: Date | null; location?: string | null;
  }) {
    const end = activity.end_at ?? new Date(activity.start_at.getTime() + 60 * 60 * 1000);
    return {
      summary: activity.title,
      ...(activity.description && { description: activity.description }),
      ...(activity.location && { location: activity.location }),
      start: { dateTime: activity.start_at.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
      extendedProperties: {
        private: { source: "agendaFamilia", agendaFamiliaId: activity.id },
      },
    };
  }
}
