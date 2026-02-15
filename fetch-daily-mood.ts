import fetch from "node-fetch";
import "dotenv/config";

interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  playedAt: string;
}

interface AudioFeatures {
  id: string;
  valence: number;
  energy: number;
  acousticness: number;
  danceability: number;
  tempo: number;
}

interface MoodData {
  avgValence: number;
  avgEnergy: number;
  avgAcousticness: number;
  trackCount: number;
  analyzedCount: number;
}

interface ElementData {
  name: "FIRE" | "WATER" | "AIR" | "EARTH" | "AETHER";
  gradient: string;
  description: string;
  mood: MoodData;
  date: string;
  tracks: SpotifyTrack[];
}

class SpotifyMoodAnalyzer {
  private accessToken: string | null = null;
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;

  constructor(clientId: string, clientSecret: string, refreshToken: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
  }

  /**
   * Get access token using refresh token
   */
  async getAccessToken(): Promise<void> {
    const authUrl = "https://accounts.spotify.com/api/token";
    const authData = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    try {
      const response = await fetch(authUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: authData.toString(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      console.log("✓ Access token obtained");
    } catch (error) {
      console.error("✗ Failed to get access token:", error);
      throw error;
    }
  }

  /**
   * Fetch recently played tracks from the last 24 hours
   */
  async getRecentlyPlayed(): Promise<SpotifyTrack[]> {
    if (!this.accessToken) {
      throw new Error("Access token not set");
    }

    const url = "https://api.spotify.com/v1/me/player/recently-played";

    // Calculate timestamp for 24 hours ago
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    try {
      const response = await fetch(
        `${url}?limit=50&after=${twentyFourHoursAgo}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch recently played: ${response.statusText}`,
        );
      }

      const data = await response.json();

      const tracks: SpotifyTrack[] = data.items.map((item: any) => ({
        id: item.track.id,
        name: item.track.name,
        artists: item.track.artists.map((artist: any) => artist.name),
        playedAt: item.played_at,
      }));

      console.log(`✓ Fetched ${tracks.length} tracks from the last 24 hours`);
      return tracks;
    } catch (error) {
      console.error("✗ Failed to fetch recently played:", error);
      return [];
    }
  }

  /**
   * Get audio features from SoundStat.info API
   * Uses Spotify track IDs to fetch audio analysis
   */
  async getSoundStatAudioFeatures(
    tracks: SpotifyTrack[],
  ): Promise<Map<string, AudioFeatures>> {
    const featuresMap = new Map<string, AudioFeatures>();

    // Get your API key from SoundStat dashboard
    const SOUNDSTAT_API_KEY = process.env.SOUNDSTAT_API_KEY!;
    const SOUNDSTAT_BASE_URL = "https://soundstat.info/api/v1";

    const uniqueTracks = Array.from(
      new Map(tracks.map((track) => [track.id, track])).values(),
    );

    console.log(
      `🎵 Analyzing ${uniqueTracks.length} tracks with SoundStat...\n`,
    );

    for (let i = 0; i < uniqueTracks.length; i++) {
      const track = uniqueTracks[i];

      try {
        const url = `${SOUNDSTAT_BASE_URL}/track/${track.id}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "x-api-key": SOUNDSTAT_API_KEY,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`Error response body: ${errorText}`);
          console.warn(`⚠️  Skip: "${track.name}" (${response.status})`);
          console.warn(`URL: ${url}`);
          continue;
        }

        const data = await response.json();

        if (data.features) {
          featuresMap.set(track.id, {
            id: track.id,
            valence: data.features.valence,
            energy: data.features.energy,
            acousticness: data.features.acousticness,
            danceability: data.features.danceability,
            tempo: data.features.tempo,
          });

          console.log(`✓ [${i + 1}/${uniqueTracks.length}] ${track.name}`);
        } else {
          // DEBUG: Log what we got instead
          console.warn(`⚠️  No features for: "${track.name}"`);
          console.warn(`Response keys:`, Object.keys(data));
          if (i < 3) {
            // Only log first 3 to avoid spam
            console.warn(`Full response:`, JSON.stringify(data, null, 2));
          }
        }
      } catch (error) {
        console.warn(`❌ Error: ${track.name}`, error);
      }
    }

    console.log(
      `\n✅ Got features for ${featuresMap.size}/${uniqueTracks.length} tracks`,
    );
    return featuresMap;
  }
  /**
   * Calculate aggregate mood from tracks
   */
  calculateAggregateMood(
    tracks: SpotifyTrack[],
    audioFeatures: Map<string, AudioFeatures>,
  ): MoodData | null {
    if (tracks.length === 0 || audioFeatures.size === 0) {
      return null;
    }

    const valences: number[] = [];
    const energies: number[] = [];
    const acousticnesses: number[] = [];

    tracks.forEach((track) => {
      const features = audioFeatures.get(track.id);
      if (features) {
        valences.push(features.valence);
        energies.push(features.energy);
        acousticnesses.push(features.acousticness);
      }
    });

    if (valences.length === 0) {
      return null;
    }

    const average = (arr: number[]) =>
      arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      avgValence: average(valences),
      avgEnergy: average(energies),
      avgAcousticness: average(acousticnesses),
      trackCount: tracks.length,
      analyzedCount: valences.length,
    };
  }

  /**
   * Map mood to element
   */
  mapToElement(mood: MoodData, tracks: SpotifyTrack[]): ElementData {
    const { avgValence, avgEnergy, avgAcousticness } = mood;

    // Fire: High energy + high valence (euphoric, intense)
    if (avgEnergy > 0.7 && avgValence > 0.6) {
      return {
        name: "FIRE",
        gradient:
          "linear-gradient(135deg, #ff6b00 0%, #ff0000 50%, #ffaa00 100%)",
        description: "Euphoric & Intense",
        mood,
        date: new Date().toISOString(),
        tracks,
      };
    }

    // Water: Low energy + variable valence (flowing, emotional)
    if (avgEnergy < 0.5 && avgValence < 0.6) {
      return {
        name: "WATER",
        gradient:
          "linear-gradient(135deg, #000814 0%, #003566 50%, #001d3d 100%)",
        description: "Flowing & Emotional",
        mood,
        date: new Date().toISOString(),
        tracks,
      };
    }

    // Air: High valence + moderate energy (light, uplifting)
    if (avgValence > 0.6 && avgEnergy >= 0.4 && avgEnergy <= 0.7) {
      return {
        name: "AIR",
        gradient:
          "linear-gradient(135deg, #e0f7ff 0%, #87ceeb 50%, #b8d4e6 100%)",
        description: "Light & Uplifting",
        mood,
        date: new Date().toISOString(),
        tracks,
      };
    }

    // Aether: High acousticness + low energy (ethereal, transcendent)
    if (avgAcousticness > 0.5 && avgEnergy < 0.5) {
      return {
        name: "AETHER",
        gradient:
          "linear-gradient(135deg, #0a0014 0%, #1a0033 50%, #2d1b47 100%)",
        description: "Ethereal & Transcendent",
        mood,
        date: new Date().toISOString(),
        tracks,
      };
    }

    // Earth: Low valence + low energy (grounded, melancholic)
    return {
      name: "EARTH",
      gradient:
        "linear-gradient(135deg, #0d1b0d 0%, #1a3319 50%, #0f2511 100%)",
      description: "Grounded & Melancholic",
      mood,
      date: new Date().toISOString(),
      tracks,
    };
  }

  /**
   * Main analysis function
   */
  async analyzeDailyMood(): Promise<ElementData | null> {
    console.log("🎵 Starting daily mood analysis...\n");

    // Step 1: Get access token
    await this.getAccessToken();

    // Step 2: Fetch recently played tracks
    const tracks = await this.getRecentlyPlayed();

    if (tracks.length === 0) {
      console.log("ℹ️  No tracks played in the last 24 hours");
      return null;
    }

    // Step 3: Get audio features
    const audioFeatures = await this.getSoundStatAudioFeatures(tracks);

    // Step 4: Calculate aggregate mood
    const mood = this.calculateAggregateMood(tracks, audioFeatures);

    if (!mood) {
      console.log("✗ Could not calculate mood");
      return null;
    }

    // Step 5: Map to element
    const element = this.mapToElement(mood, tracks);

    console.log("\n✨ Daily mood analysis complete!\n");
    console.log(`Element: ${element.name}`);
    console.log(`Description: ${element.description}`);
    console.log(`Valence: ${(mood.avgValence * 100).toFixed(1)}%`);
    console.log(`Energy: ${(mood.avgEnergy * 100).toFixed(1)}%`);
    console.log(`Acousticness: ${(mood.avgAcousticness * 100).toFixed(1)}%`);
    console.log(`Tracks analyzed: ${mood.analyzedCount}/${mood.trackCount}`);

    return element;
  }
}

// Main execution
async function main() {
  // Hardcoded credentials
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN!;
  if (
    !clientId ||
    !clientSecret ||
    !refreshToken ||
    clientId.includes("YOUR_") ||
    clientSecret.includes("YOUR_") ||
    refreshToken.includes("YOUR_")
  ) {
    console.error("❌ Missing Spotify credentials!");
    console.error("Please edit the script and add your:");
    console.error("  - Client ID");
    console.error("  - Client Secret");
    console.error("  - Refresh Token");
    process.exit(1);
  }

  const analyzer = new SpotifyMoodAnalyzer(
    clientId,
    clientSecret,
    refreshToken,
  );
  const elementData = await analyzer.analyzeDailyMood();

  if (elementData) {
    // Save to JSON file
    const fs = await import("fs/promises");
    await fs.writeFile(
      "current_mood.json",
      JSON.stringify(elementData, null, 2),
    );
    console.log("\n💾 Saved to current_mood.json");
  }
}

main().catch(console.error);
