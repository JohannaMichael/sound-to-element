# Spotify Daily Mood Analyzer

Analyzes your Spotify listening history from the last 24 hours and maps it to an elemental mood (Fire, Water, Air, Earth, or Aether).

## 🚀 Quick Setup

### 1. Edit the Script

Open `fetch-daily-mood.ts` and find these lines:

```typescript
const clientId = 'YOUR_CLIENT_ID_HERE';
const clientSecret = 'YOUR_CLIENT_SECRET_HERE';
const refreshToken = 'YOUR_REFRESH_TOKEN_HERE';
```

Replace them with your actual Spotify credentials.

### 2. Get Refresh Token (if you don't have one)

If you already have a refresh token from your previous script, use that!

If you need a new one:

1. Go to this URL (replace `YOUR_CLIENT_ID`):
```
https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost:3000/callback&scope=user-read-recently-played
```

2. Authorize the app

3. You'll be redirected to `http://localhost:3000/callback?code=SOME_CODE`

4. Copy the code and run this curl command:
```bash
curl -X POST https://accounts.spotify.com/api/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_CODE_FROM_URL" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

5. Save the `refresh_token` from the response

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Analyzer

```bash
npm run analyze
```

This will create `current_mood.json` with your daily mood data!

## 🤖 Automate with Cron

Run automatically every day at 11:59 PM:

```bash
# Edit crontab
crontab -e

# Add this line
59 23 * * * cd /path/to/spotify-mood-analyzer && npm run analyze
```

## 📊 Element Mapping

| Element | Criteria | Mood |
|---------|----------|------|
| 🔥 **FIRE** | High energy (>0.7) + High valence (>0.6) | Euphoric & Intense |
| 🌊 **WATER** | Low energy (<0.5) + Low valence (<0.6) | Flowing & Emotional |
| 💨 **AIR** | High valence (>0.6) + Moderate energy (0.4-0.7) | Light & Uplifting |
| ✨ **AETHER** | High acousticness (>0.5) + Low energy (<0.5) | Ethereal & Transcendent |
| 🌲 **EARTH** | Low valence + Low energy | Grounded & Melancholic |

## 📁 Output

The script creates `current_mood.json`:

```json
{
  "name": "FIRE",
  "gradient": "linear-gradient(...)",
  "description": "Euphoric & Intense",
  "mood": {
    "avgValence": 0.75,
    "avgEnergy": 0.82,
    "avgAcousticness": 0.15,
    "trackCount": 45,
    "analyzedCount": 45
  },
  "date": "2025-12-22T23:59:00.000Z",
  "tracks": [...]
}
```

## 🌐 Next: Build the Website

Your website just needs to:

```javascript
fetch('current_mood.json')
  .then(r => r.json())
  .then(data => {
    // Display element: data.name
    // Use gradient: data.gradient
    // Show description: data.description
  });
```
