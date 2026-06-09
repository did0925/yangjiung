import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// ES module path support
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini client to prevent crash if key is missing
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY environment variable is not configured. Please add it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to query Deezer API with resilience
async function searchDeezer(query: string): Promise<any[]> {
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) {
      throw new Error(`Deezer API responded with status ${response.status}`);
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.data)) {
      return [];
    }
    
    return data.data.map((item: any) => ({
      id: item.id,
      title: item.title,
      artist: {
        name: item.artist.name,
        picture: item.artist.picture_medium || item.artist.picture || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&h=150&fit=crop",
      },
      album: {
        title: item.album.title,
        cover: item.album.cover_medium || item.album.cover || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
      },
      previewUrl: item.preview,
      duration: item.duration,
      link: item.link
    }));
  } catch (error) {
    console.error("error fetching from Deezer API:", error);
    return [];
  }
}

// helper to enrich standard song from Deezer
async function enrichSongWithDeezer(title: string, artist: string): Promise<any> {
  const searchQuery = `${artist} - ${title}`;
  const results = await searchDeezer(searchQuery);
  if (results && results.length > 0) {
    // If exact or close match is found, return it
    return results[0];
  }
  // Fallback if no match is found
  return {
    id: Math.floor(Math.random() * 10000000),
    title,
    artist: {
      name: artist,
      picture: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&h=150&fit=crop"
    },
    album: {
      title: "Vibe AI Recommendation Album",
      cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop"
    },
    previewUrl: "",
    duration: 180,
    link: ""
  };
}

// API Routes

// 1. Music Search via Deezer
app.get("/api/music/search", async (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    res.status(400).json({ error: "Search query is required" });
    return;
  }
  try {
    const results = await searchDeezer(query);
    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Recommend similar music based on a primary track
app.post("/api/music/recommend", async (req, res) => {
  const { title, artist } = req.body;
  if (!title || !artist) {
    res.status(400).json({ error: "Title and Artist are required" });
    return;
  }

  try {
    const ai = getAiClient();
    const prompt = `You are an expert music curator. The user is a big fan of the song "${title}" by "${artist}".
Suggest exactly 6 tracks that share extremely similar taste, micro-genres, emotional atmospheres, tempo, or production style.
Provide the recommended tracks so we can query them later.
For each track, also write a personalized recommendation reason in Korean (Max 2 sentences) describing how its unique vibe matches the requested song.

Return the list of recommendations strictly adhering to the JSON schema. Ensure titles and artist names are accurate and spelled correctly in English or whatever language is original.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Track title" },
                  artist: { type: Type.STRING, description: "Artist name" },
                  reason: { type: Type.STRING, description: "Personalized Korean recommendation reason" }
                },
                required: ["title", "artist", "reason"]
              }
            }
          },
          required: ["recommendations"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No response returned from Gemini API");
    }

    const recData = JSON.parse(responseText.trim());
    const rawRecs = recData.recommendations || [];

    // Parallelly enrich recommendations with Deezer metadata
    const enrichedRecommendations = await Promise.all(
      rawRecs.map(async (rec: any) => {
        const metadata = await enrichSongWithDeezer(rec.title, rec.artist);
        return {
          ...metadata,
          reason: rec.reason
        };
      })
    );

    res.json({ recommendations: enrichedRecommendations });
  } catch (error: any) {
    console.error("Error in /api/music/recommend:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Analyze favorites and automatically construct a beautiful playlist
app.post("/api/music/analyze-and-playlist", async (req, res) => {
  const { favorites } = req.body; // Array of { title, artist } songs
  if (!favorites || !Array.isArray(favorites) || favorites.length === 0) {
    res.status(400).json({ error: "An array of favorite songs is required" });
    return;
  }

  try {
    const ai = getAiClient();
    const favoritesString = favorites.map((f: any, idx: number) => `${idx + 1}. "${f.title}" by "${f.artist}"`).join("\n");
    const prompt = `You are a master music therapist and playlist curator. The user has listed these ${favorites.length} songs as their current favorites:
${favoritesString}

Please analyze their musical taste profoundly. 
1. Create a beautiful, emotional Korean title for their personalized playlist (e.g. "새벽바람을 담은 몽환적 로파이", "빌딩 숲을 위로하는 따뜻한 어쿠스틱").
2. Write a highly analytical, friendly, and aesthetic music taste analysis in Korean (3-4 sentences/markdown format supported) explaining their sound profiles, common denominators, and underlying mood.
3. Generate a set of exactly 8 recommended tracks (different from the favorites list themselves) that seamlessly blend into this psychological profile and expand their playlist beautifully. Provide a reason for each track in Korean.

Format the output as a strict JSON response following the provided schema constraint. Keep the artist names and song titles accurate.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            playlistTitle: { type: Type.STRING, description: "An poetic, aesthetic matching playlist title" },
            analysisMarkdown: { type: Type.STRING, description: "Detailed 3-4 sentence music taste analysis in Korean" },
            tracks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Track title" },
                  artist: { type: Type.STRING, description: "Artist name" },
                  reason: { type: Type.STRING, description: "A brief Korean explanation of why this song perfectly expands their favorite pool" }
                },
                required: ["title", "artist", "reason"]
              }
            }
          },
          required: ["playlistTitle", "analysisMarkdown", "tracks"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No response returned from Gemini API");
    }

    const playlistPayload = JSON.parse(responseText.trim());
    const rawTracks = playlistPayload.tracks || [];

    // Parallel search on Deezer for each of the 8 playlist recommendation tracks
    const enrichedTracks = await Promise.all(
      rawTracks.map(async (track: any) => {
        const metadata = await enrichSongWithDeezer(track.title, track.artist);
        return {
          ...metadata,
          reason: track.reason
        };
      })
    );

    res.json({
      playlistTitle: playlistPayload.playlistTitle,
      analysisMarkdown: playlistPayload.analysisMarkdown,
      tracks: enrichedTracks
    });
  } catch (error: any) {
    console.error("Error in /api/music/analyze-and-playlist:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware development / static files in production setup
if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Port listening
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Music Vibe Server] Running on http://localhost:${PORT}`);
});
