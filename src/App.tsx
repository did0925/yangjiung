import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { 
  Search, 
  Music, 
  Sparkles, 
  Heart, 
  ListMusic, 
  Play, 
  Pause, 
  Loader2, 
  Volume2, 
  VolumeX, 
  Plus, 
  Check, 
  ExternalLink,
  Disc,
  Trash2,
  GitBranch,
  CloudLightning,
  CornerDownRight,
  Info
} from "lucide-react";
import { Track, PlaylistAnalysis } from "./types";

export default function App() {
  // Pure state management
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Recommendations state
  const [activeRecommendationBase, setActiveRecommendationBase] = useState<Track | null>(null);
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);
  
  // Favorites list (persisted in localStorage)
  const [favorites, setFavorites] = useState<Track[]>(() => {
    try {
      const stored = localStorage.getItem("vibesync_favorites");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // AI Playlist Auto Generator State
  const [playlistAnalysis, setPlaylistAnalysis] = useState<PlaylistAnalysis | null>(() => {
    try {
      const stored = localStorage.getItem("vibesync_playlist_analysis");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isGeneratingPlaylist, setIsGeneratingPlaylist] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Music Player State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playMode, setPlayMode] = useState<"preview" | "youtube">("youtube");
  const [isYoutubeExpanded, setIsYoutubeExpanded] = useState(true);
  
  // Audio tag reference
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync favorites to localStorage
  useEffect(() => {
    localStorage.setItem("vibesync_favorites", JSON.stringify(favorites));
  }, [favorites]);

  // Sync latest playlist to localStorage
  useEffect(() => {
    if (playlistAnalysis) {
      localStorage.setItem("vibesync_playlist_analysis", JSON.stringify(playlistAnalysis));
    }
  }, [playlistAnalysis]);

  // Initial dummy or seed search to make the app gorgeous on first load
  useEffect(() => {
    handleSearch("Jazz Lofi");
  }, []);

  // Handle Playback Progress & Track end
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentTrack]);

  // Auto play when track changes
  useEffect(() => {
    if (currentTrack && audioRef.current) {
      if (playMode === "preview") {
        audioRef.current.load();
        if (isPlaying) {
          audioRef.current.play().catch((err) => {
            console.warn("Autoplay was blocked or preview url is empty", err);
            setIsPlaying(false);
          });
        }
      } else {
        // Under YouTube full mode, make sure HTML5 preview is paused
        audioRef.current.pause();
      }
    }
  }, [currentTrack, playMode]);

  // Monitor Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Music Search handler
  const handleSearch = async (queryToSearch?: string) => {
    const query = queryToSearch || searchQuery;
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchQuery(query);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search request failed");
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("Error searching music:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Music Recommendation handler (similar taste)
  const getSimiliarRecommendations = async (track: Track) => {
    setIsRecommending(true);
    setActiveRecommendationBase(track);
    setAiError(null);
    try {
      const res = await fetch("/api/music/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist.name
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Recommendation request failed");
      }

      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (error: any) {
      console.error("Error getting recommendation:", error);
      setAiError(error.message || "Failed to generate recommendations. Please confirm GEMINI_API_KEY is configured.");
    } finally {
      setIsRecommending(false);
    }
  };

  // Favorites Toggle
  const toggleFavorite = (track: Track) => {
    const isFav = favorites.some((f) => f.id === track.id);
    if (isFav) {
      setFavorites(favorites.filter((f) => f.id !== track.id));
    } else {
      setFavorites([...favorites, track]);
    }
  };

  // Clear favorites list
  const clearFavorites = () => {
    setFavorites([]);
  };

  // Generate Personalized Playlist Analysis
  const generatePlaylist = async () => {
    if (favorites.length === 0) return;
    setIsGeneratingPlaylist(true);
    setAiError(null);
    try {
      const payloadFavorites = favorites.map((fav) => ({
        title: fav.title,
        artist: fav.artist.name,
      }));

      const res = await fetch("/api/music/analyze-and-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites: payloadFavorites })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "AI Generation failed");
      }

      const data = await res.json();
      setPlaylistAnalysis(data);
    } catch (error: any) {
      console.error("Error generating playlist:", error);
      setAiError(error.message || "Could not analyze list. Check your Gemini API connection.");
    } finally {
      setIsGeneratingPlaylist(false);
    }
  };

  // Controls for interactive music player
  const handlePlayPause = () => {
    if (!currentTrack) {
      // Pick first search result or favorite to start playing
      const fallback = searchResults[0] || favorites[0] || recommendations[0];
      if (fallback) {
        selectTrack(fallback);
      }
      return;
    }
    
    if (playMode === "preview") {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch((err) => {
            console.error("Playback block", err);
          });
        }
      }
    } else {
      // Toggle YouTube playback state
      setIsPlaying(!isPlaying);
    }
  };

  const selectTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  // Navigation track bar change
  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Format second to mm:ss
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div className="w-full min-h-screen bg-[#07050d] text-[#e0e0e0] font-sans flex flex-col justify-between selection:bg-purple-500 selection:text-white relative overflow-hidden">
      
      {/* Dynamic Floating Colorful Neon Blobs in the Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/20 blur-[130px] animate-pulse duration-[8000ms]"></div>
        <div className="absolute top-1/4 -right-20 w-[450px] h-[450px] rounded-full bg-rose-600/15 blur-[150px] animate-bounce duration-[14000ms]"></div>
        <div className="absolute bottom-10 left-1/3 w-[500px] h-[500px] rounded-full bg-purple-600/15 blur-[160px] animate-pulse duration-[10000ms]"></div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-emerald-600/15 blur-[120px] duration-[12000ms]"></div>
      </div>

      {/* Hidden audio tag for playback */}
      {currentTrack && (
        <audio
          ref={audioRef}
          src={currentTrack.previewUrl}
          preload="auto"
        />
      )}

      {/* Top Navigation Bar */}
      <nav className="h-16 border-b border-white/10 flex items-center justify-between px-6 sm:px-10 bg-[#07050d]/70 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-8">
          <div className="text-xl font-bold tracking-tighter flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center relative shadow-lg shadow-white/10">
              <div className="w-4 h-4 bg-black rounded-sm rotate-45 animate-pulse"></div>
              {/* Disc-like spinning track effect */}
              {isPlaying && (
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/50 animate-spin-slow"></div>
              )}
            </div>
            <span className="font-display tracking-[0.05em] text-white">VIBESYNC</span>
          </div>
          <div className="hidden md:flex gap-6 text-sm font-medium text-white/50">
            <a href="#discover" className="text-white border-b-2 border-white pb-1 transition-all">Discover & Find Match</a>
            <a href="#favorites" className="hover:text-white transition-colors">Liked Collection ({favorites.length})</a>
            <a href="#ai-playlists" className="hover:text-white transition-colors">AI Personalized Room</a>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-zinc-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            VERCEL_EDGE_READY
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-mono text-indigo-300">
            <GitBranch className="w-3.5 h-3.5" />
            <span>GITHUB_SYNCED</span>
          </div>
        </div>
      </nav>

      {/* Core Body Section with flex layout */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden relative z-10">
        
        {/* Left Interactive Sidebar panel */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-white/5 p-6 bg-purple-950/10 backdrop-blur-md flex flex-col gap-6">
          
          {/* Realtime Music Mood / Insights Widget */}
          <section className="bg-gradient-to-r from-purple-500/10 to-indigo-500/5 border border-purple-500/20 p-5 rounded-2xl relative overflow-hidden backdrop-blur-xl">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3 font-semibold flex items-center justify-between">
              <span>LIVE AI INSIGHT </span>
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping"></span>
            </h3>
            {favorites.length > 0 ? (
              <div>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-3">
                  "{favorites.length}개의 리스닝 곡을 토대로 입체적인 음악 DNA 및 바이브를 모니터링 중입니다. 리듬 깊이와 템포 상응 계수를 추출 가능합니다."
                </p>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>에너지 스펙트럼</span>
                    <span className="text-zinc-300">{(65 + favorites.length * 3) % 100}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-zinc-100 h-full transition-all duration-700" 
                      style={{ width: `${Math.min(95, 65 + favorites.length * 3)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">
                검색창에서 곡을 검색하고, '♡ 좋아함'에 추가하면 AI가 여러분의 특별한 음악적 성향 리듬과 톤을 입체적으로 인지하기 시작합니다.
              </p>
            )}
          </section>

          {/* Quick Shortcuts & Preset Flows */}
          <section className="flex-1 space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#888] font-bold">SAMPLE SEED SEARCH</h3>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {[
                { name: "Neon Synthwave", query: "The Midnight Nightcall" },
                { name: "Cozy Lo-Fi Beats", query: "Chill lofi study" },
                { name: "Sophisticated Jazz", query: "Bill Evans Blue" },
                { name: "Deep Techno Mood", query: "Peggy Gou Itgehane" },
              ].map((seed) => (
                <button
                  key={seed.name}
                  onClick={() => handleSearch(seed.query)}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 text-left text-xs font-medium text-white/80 transition-all cursor-pointer group"
                >
                  <span className="w-6 h-6 bg-zinc-900 rounded-lg flex items-center justify-center text-[10px] text-indigo-400 font-mono group-hover:scale-105 transition-transform">#</span>
                  <div className="truncate">
                    <p className="font-semibold text-white/90 truncate">{seed.name}</p>
                    <p className="text-[10px] text-[#666] truncate">"{seed.query}"</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Integration Status info */}
          <section className="mt-auto pt-4 border-t border-white/5">
            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
              <div className="flex items-center gap-2 mb-1.5 text-indigo-300 font-semibold text-xs">
                <CloudLightning className="w-3.5 h-3.5" />
                <span>Vercel Edge API Active</span>
              </div>
              <p className="text-[10.5px] text-zinc-400 leading-normal">
                Deezer 글로벌 음악 API와 Google Gemini 3.5의 즉각적인 추론 기술이 정적 Vercel 정밀 환경에 실시간으로 구동됩니다.
              </p>
            </div>
          </section>
        </aside>

        {/* Right Active Workspace Panel */}
        <main className="flex-1 flex flex-col bg-[#07050d]/40 backdrop-blur-3xl overflow-y-auto px-4 sm:px-10 py-8 space-y-10" id="discover">
          
          {/* Header & Hero Search Panel */}
          <header className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] font-semibold text-zinc-400">
              <Sparkles className="w-3 h-3 text-white" />
              <span>음악 취향 추론 & 플레이리스트 생성 메이트</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extralight tracking-tight text-white leading-tight">
              가장 아름다운 소리의 <span className="font-serif italic text-white/70 block sm:inline">공명(Resonance)</span>을 찾아서
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 max-w-2xl font-light">
              마음에 품고 있는 곡이나 아티스트 이름을 입력해 보세요. 실시간 음악 메타데이터 연동 및 고성능 AI 추론을 통해, 보석처럼 귀한 당신만을 위한 초정밀 맞춤형 숨은 트랙들을 빚어내어 제공합니다.
            </p>

            {/* Error alerts */}
            {aiError && (
              <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs text-red-200">
                  <p className="font-semibold mb-1">AI Recommendation Guide</p>
                  <p>{aiError}</p>
                </div>
              </div>
            )}

            {/* Unified Search Bar */}
            <div className="relative w-full max-w-2xl group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500">
                <Search className="w-5 h-5 group-focus-within:text-white transition-colors" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="곡명, 아티스트명 또는 떠오르는 음악 키워드를 적어주세요..." 
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-32 text-sm sm:text-base text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all placeholder:text-zinc-600 shadow-xl"
              />
              <button 
                onClick={() => handleSearch()}
                disabled={isSearching}
                className="absolute right-3 top-2.5 sm:top-2 bg-white text-black hover:bg-zinc-200 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>검색하기</span>
                )}
              </button>
            </div>
          </header>

          {/* 1. Search Results List Section */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-white/5 pb-2">
              <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-white/50 flex items-center gap-2">
                <Music className="w-3.5 h-3.5" />
                <span>검색 결과 {searchResults.length > 0 && `(${searchResults.length}개 발견)`}</span>
              </h2>
              {searchQuery && (
                <span className="text-[11px] text-zinc-500 font-mono">
                  Query: "{searchQuery}"
                </span>
              )}
            </div>

            {isSearching ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <p className="text-sm text-zinc-500 font-medium">Deezer 음악 데이터베이스에서 곡을 발굴하고 있습니다...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {searchResults.map((track) => {
                  const isFav = favorites.some((f) => f.id === track.id);
                  const isCurrent = currentTrack?.id === track.id;
                  
                  return (
                    <div 
                      key={track.id} 
                      className={`group p-4 bg-purple-950/15 hover:bg-purple-900/25 border rounded-2xl flex items-center justify-between gap-4 transition-all duration-300 ${
                        isCurrent ? "border-purple-400 bg-purple-950/40 shadow-lg shadow-purple-500/10" : "border-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 overflow-hidden flex-1">
                        {/* Album Cover Art */}
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-300 bg-zinc-800">
                          <img 
                            src={track.album.cover} 
                            alt={track.title} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback cover if image fails to load
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150&amp;h=150&amp;fit=crop";
                            }}
                          />
                          <button 
                            onClick={() => selectTrack(track)}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="w-4 h-4 text-white fill-white" />
                            ) : (
                              <Play className="w-4 h-4 text-white fill-white" />
                            )}
                          </button>
                        </div>

                        <div className="overflow-hidden flex-1">
                          <p 
                            className={`text-sm font-semibold truncate cursor-pointer hover:text-[#fff] transition-colors ${
                              isCurrent ? "text-white" : "text-zinc-200"
                            }`}
                            onClick={() => selectTrack(track)}
                          >
                            {track.title}
                          </p>
                          <p className="text-xs text-zinc-500 truncate font-medium">{track.artist.name}</p>
                        </div>
                      </div>

                      {/* Control buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Match taste button */}
                        <button 
                          onClick={() => getSimiliarRecommendations(track)}
                          title="이 곡 기준으로 취향 매칭 음악 추천 받기"
                          className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-indigo-400" />
                        </button>

                        {/* Add to Favorite List */}
                        <button 
                          onClick={() => toggleFavorite(track)}
                          title={isFav ? "좋아함 취소" : "좋아함 보관함에 저장"}
                          className={`p-2 transition-colors duration-300 rounded-xl hover:bg-white/5 cursor-pointer ${
                            isFav ? "text-rose-500 font-semibold" : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isFav ? "fill-rose-500" : ""}`} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-14 text-center rounded-2xl border border-dashed border-white/5 bg-[#090909]/40">
                <Music className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">원하시는 곡이나 가수 이름을 검색해 보세요.</p>
                <p className="text-xs text-zinc-600 mt-1">예: "Hotel California", "IU", "NewJeans", "Coldplay"</p>
              </div>
            )}
          </section>

          {/* 2. Similar Taste Recommendation Section via Gemini 3.5 */}
          {activeRecommendationBase && (
            <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-white/[0.04] to-transparent border border-white/10 space-y-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI SIMILAR MATCH RESULT</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-light text-white">
                    "{activeRecommendationBase.title}"에 깃든 유사 주파수 분석
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    Gemini AI가 해당 명작의 사운드 질감, 무드, 가사 결을 비교 분석하여 6개의 공명 트랙을 선곡했습니다.
                  </p>
                </div>

                <button 
                  onClick={() => getSimiliarRecommendations(activeRecommendationBase)}
                  disabled={isRecommending}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Loader2 className={`w-3.5 h-3.5 animate-spin ${isRecommending ? "block" : "hidden"}`} />
                  <span>새로고침</span>
                </button>
              </div>

              {isRecommending ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                    <Sparkles className="w-4 h-4 text-white absolute -top-1 -right-1 animate-bounce" />
                  </div>
                  <p className="text-xs text-indigo-300 font-medium">유사곡 음악 감성 스펙트럼 인코딩 및 가사 감수 중...</p>
                </div>
              ) : recommendations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recommendations.map((track) => {
                    const isFav = favorites.some((f) => f.id === track.id);
                    const isPlayingCurrent = currentTrack?.id === track.id && isPlaying;
                    
                    return (
                      <div 
                        key={track.id} 
                        className="group bg-indigo-950/20 border border-white/10 hover:border-indigo-500/30 p-4 rounded-2xl flex flex-col justify-between gap-3 transition-all duration-300 relative backdrop-blur-sm"
                      >
                        <div className="flex items-start gap-3">
                          {/* Rich artwork overlay */}
                          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-neutral-900 relative">
                            <img src={track.album.cover} alt={track.title} className="w-full h-full object-cover" />
                            <button 
                              onClick={() => selectTrack(track)}
                              className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {isPlayingCurrent ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
                            </button>
                          </div>

                          <div className="overflow-hidden flex-1">
                            <p 
                              onClick={() => selectTrack(track)}
                              className="text-sm font-semibold truncate text-[#f3f4f6] cursor-pointer hover:text-white"
                            >
                              {track.title}
                            </p>
                            <p className="text-xs text-zinc-500 truncate">{track.artist.name}</p>
                          </div>
                        </div>

                        {/* Recommendation rationale in Korean */}
                        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <div className="flex gap-1.5 items-start">
                            <CornerDownRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans font-light">
                              {track.reason}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          {track.previewUrl ? (
                            <span className="text-zinc-500 font-mono flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              30s Preview
                            </span>
                          ) : (
                            <span className="text-zinc-600 font-mono">Audio Clip Unavailable</span>
                          )}

                          <div className="flex items-center gap-2">
                            {/* Heart favorite to persist */}
                            <button
                              onClick={() => toggleFavorite(track)}
                              className={`p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer ${
                                isFav ? "text-rose-500" : "text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-rose-500" : ""}`} />
                            </button>

                            {track.link && (
                              <a 
                                href={track.link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                                title="Deezer 원본 주소로 이동"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          )}

          {/* 3. Liked Collection Favorites Management */}
          <section className="space-y-4" id="favorites">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-white/50 flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                <span>내가 좋아하는 곡 목록 ({favorites.length})</span>
              </h2>

              {favorites.length > 0 && (
                <button 
                  onClick={clearFavorites}
                  className="text-[11px] text-zinc-500 hover:text-rose-400 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>목록 초기화</span>
                </button>
              )}
            </div>

            {favorites.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {favorites.map((track, index) => {
                    const isPlayingCurrent = currentTrack?.id === track.id && isPlaying;
                    return (
                      <div 
                        key={track.id} 
                        className="p-3 bg-rose-950/10 border border-rose-500/15 rounded-xl hover:border-rose-500/40 flex items-center justify-between gap-3 group transition-all backdrop-blur-sm"
                      >
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                          <span className="text-xs font-mono text-zinc-600 w-5 shrink-0">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          
                          <div className="relative w-10 h-10 rounded-md overflow-hidden bg-zinc-900 shrink-0">
                            <img src={track.album.cover} alt={track.title} className="w-full h-full object-cover" />
                            <button 
                              onClick={() => selectTrack(track)}
                              className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {isPlayingCurrent ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white" />}
                            </button>
                          </div>

                          <div className="overflow-hidden flex-1">
                            <p 
                              className={`text-xs font-semibold truncate cursor-pointer hover:text-white ${
                                isPlayingCurrent ? "text-indigo-400" : "text-zinc-200"
                              }`}
                              onClick={() => selectTrack(track)}
                            >
                              {track.title}
                            </p>
                            <p className="text-[11px] text-zinc-500 truncate">{track.artist.name}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            onClick={() => toggleFavorite(track)}
                            className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="좋아함 목록에서 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Aesthetic Action trigger for Auto AI Playlist analysis */}
                <div className="mt-8 p-6 rounded-3xl bg-gradient-to-r from-zinc-900 to-indigo-950/40 border border-indigo-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">
                      AUTOPLAYLIST GENERATOR
                    </span>
                    <h4 className="text-lg font-medium text-white mb-1.5">선호 데이터 기반 AI 맞춤형 앨범 생성</h4>
                    <p className="text-xs text-zinc-400 max-w-xl">
                      현재 등록된 {favorites.length}곡의 리듬 구조, 감성의 무게 중심, 보컬 무드의 상호 비례 등을 인공지능이 해석하여, 전반적인 취향 분석서와 함께 그에 꼭 동화하는 완벽한 8곡의 새로운 트랙리스트를 신규 배정합니다.
                    </p>
                  </div>
                  <button 
                    onClick={generatePlaylist}
                    disabled={isGeneratingPlaylist || favorites.length === 0}
                    className="px-6 py-3 bg-white text-black font-bold rounded-xl text-xs sm:text-sm hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 active:scale-95 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    {isGeneratingPlaylist ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>입체 분석 중...</span>
                      </>
                    ) : (
                      <>
                        <ListMusic className="w-4 h-4" />
                        <span>AI 신규 플레이리스트 생성</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center rounded-2xl border border-dashed border-white/5 bg-[#090909]/40 text-zinc-500">
                <Heart className="w-7 h-7 text-zinc-800 mx-auto mb-2" />
                <p className="text-sm">선호하는 음악 보관함이 비어 있습니다.</p>
                <p className="text-xs text-zinc-600 mt-1">검색 결과에서 하트 버튼을 눌러 곡들을 모아 보세요!</p>
              </div>
            )}
          </section>

          {/* 4. AI Best Playlist & Deep Analysis Room */}
          {playlistAnalysis && (
            <section className="space-y-6 pt-4" id="ai-playlists">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <ListMusic className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-white/50">
                  AI PERSONALIZED ALBUM ROOM
                </h2>
              </div>

              <div className="bg-[#0b0b0b] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                {/* Playlist Art Cover banner */}
                <div className="relative bg-gradient-to-r from-zinc-950 via-indigo-950/80 to-zinc-950 p-6 sm:p-10 border-b border-white/5">
                  <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-indigo-500/10 to-transparent blur-2xl pointer-events-none"></div>
                  
                  <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative z-10">
                    {/* Vinyl spinning style icon as artwork cover */}
                    <div className="w-32 h-32 bg-gradient-to-tr from-zinc-800 to-indigo-900 rounded-2xl flex items-center justify-center relative shadow-2xl shrink-0 group">
                      <Disc className="w-16 h-16 text-zinc-400 group-hover:rotate-180 transition-transform duration-1000" />
                      <div className="absolute inset-0 border-4 border-dashed border-white/5 rounded-2xl"></div>
                    </div>

                    <div className="text-center md:text-left space-y-3">
                      <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-mono rounded-full uppercase tracking-widest inline-block">
                        AUTOMATICALLY COMPILED
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-normal">
                        {playlistAnalysis.playlistTitle}
                      </h3>
                      <p className="text-xs text-zinc-400">
                        선택된 {favorites.length}곡의 정밀 연계 구성을 기반으로 8개의 독자적 트랙 배정 완료
                      </p>
                    </div>
                  </div>
                </div>

                {/* Taste analysis */}
                <div className="p-6 sm:p-8 bg-zinc-950/50 border-b border-white/5 space-y-3">
                  <h4 className="text-xs uppercase tracking-widest font-semibold text-zinc-400">음악 성향 정밀 진단서</h4>
                  <div className="text-sm text-zinc-300 leading-relaxed font-light whitespace-pre-line prose prose-invert">
                    {playlistAnalysis.analysisMarkdown}
                  </div>
                </div>

                {/* 8 Tracklist curated */}
                <div className="p-4 sm:p-8 space-y-4">
                  <h4 className="text-xs uppercase tracking-widest font-semibold text-zinc-400 px-2">큐레이션 추천 트랙 리스트 (8곡)</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {playlistAnalysis.tracks.map((track, idx) => {
                      const isPlayingCurrent = currentTrack?.id === track.id && isPlaying;
                      const isFav = favorites.some((f) => f.id === track.id);
                      return (
                        <div 
                          key={track.id} 
                          className="p-4 bg-white/[0.01] border border-white/5 hover:border-white/10 rounded-2xl transition-all flex flex-col justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-zinc-600 w-5">
                              {String(idx + 1).padStart(2, "0")}
                            </span>

                            <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-zinc-900 shrink-0">
                              <img src={track.album.cover} alt={track.title} className="w-full h-full object-cover" />
                              <button 
                                onClick={() => selectTrack(track)}
                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                {isPlayingCurrent ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
                              </button>
                            </div>

                            <div className="overflow-hidden flex-1">
                              <p 
                                className={`text-sm font-semibold truncate cursor-pointer hover:text-white ${
                                  isPlayingCurrent ? "text-indigo-400" : "text-zinc-200"
                                }`}
                                onClick={() => selectTrack(track)}
                              >
                                {track.title}
                              </p>
                              <p className="text-xs text-zinc-500 truncate">{track.artist.name}</p>
                            </div>
                          </div>

                          {/* Curated Track Reason */}
                          <div className="pl-8 text-[11px] text-zinc-400 leading-relaxed italic border-l border-white/5">
                            "{track.reason}"
                          </div>

                          <div className="flex items-center justify-between pl-8 pt-1 text-[10px]">
                            <span className="text-zinc-500 font-mono">Deezer Audio Source</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleFavorite(track)}
                                className={`p-1 rounded hover:bg-white/5 cursor-pointer ${
                                  isFav ? "text-rose-500" : "text-zinc-600 hover:text-zinc-300"
                                }`}
                                title="내 즐겨찾기에 보관"
                              >
                                <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-rose-500" : ""}`} />
                              </button>
                              {track.link && (
                                <a href={track.link} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-zinc-400">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Interactive sticky bottom music player bar */}
      <footer className="bg-[#07050d]/90 border-t border-white/10 p-4 sm:p-6 sticky bottom-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-4 sm:gap-8 justify-between">
          
          {/* Cover and Name details */}
          <div className="w-full md:w-64 flex items-center gap-4">
            {currentTrack ? (
              <>
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/10 rounded-lg overflow-hidden shrink-0 relative group border border-white/10 shadow-lg shadow-black">
                  <img 
                    src={currentTrack.album.cover} 
                    alt={currentTrack.title} 
                    className={`w-full h-full object-cover ${isPlaying ? 'animate-spin-slow' : ''}`} 
                  />
                  <div className="absolute inset-0 bg-black/10"></div>
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
                  <p className="text-xs text-zinc-400 truncate">{currentTrack.artist.name}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/5 rounded-lg flex items-center justify-center shrink-0 border border-white/5">
                  <Disc className="w-6 h-6 text-zinc-700" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-bold">오디오 정지 상태</p>
                  <p className="text-[10px] text-zinc-600 font-medium">검색어 음악 재생 클릭을 기다리는 중입니다</p>
                </div>
              </>
            )}
          </div>

          {/* Player Navigation Buttons / Timelines */}
          <div className="flex-1 w-full max-w-lg flex flex-col items-center gap-2">
            <div className="flex items-center gap-5">
              {/* Play Mode Toggle */}
              <div className="flex items-center bg-white/5 border border-white/10 p-0.5 rounded-full text-[10px]">
                <button 
                  onClick={() => {
                    setPlayMode("preview");
                    if (isPlaying && audioRef.current) {
                      audioRef.current.load();
                      audioRef.current.play().catch(() => {});
                    }
                  }}
                  className={`px-2.5 py-0.5 rounded-full font-medium transition-colors cursor-pointer ${
                    playMode === "preview" 
                      ? "bg-white text-black font-semibold" 
                      : "text-zinc-400 hover:text-white"
                  }`}
                  title="30초 미리듣기 원본 모드"
                >
                  30s 예청
                </button>
                <button 
                  onClick={() => {
                    setPlayMode("youtube");
                    if (audioRef.current) {
                      audioRef.current.pause();
                    }
                  }}
                  className={`px-2.5 py-0.5 rounded-full font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    playMode === "youtube" 
                      ? "bg-indigo-600 text-white font-semibold" 
                      : "text-zinc-400 hover:text-white"
                  }`}
                  title="YouTube 기반 전체 및 고품질 스트리밍 모드"
                >
                  <span>전체 듣기</span>
                  <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse"></span>
                </button>
              </div>

              <button 
                onClick={handlePlayPause}
                className="w-10 h-10 bg-white hover:bg-zinc-200 text-black rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all text-sm font-bold cursor-pointer"
                title={isPlaying ? "일시정지" : "재생"}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 text-black fill-black" />
                ) : (
                  <Play className="w-4 h-4 text-black fill-black ml-0.5" />
                )}
              </button>
            </div>

            <div className="w-full flex items-center gap-3">
              {playMode === "preview" ? (
                <>
                  <span className="text-[10px] font-mono text-zinc-500 w-8 text-right">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white hover:bg-white/20 transition-all outline-none"
                  />
                  <span className="text-[10px] font-mono text-zinc-500 w-8">
                    {formatTime(duration)}
                  </span>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-2 py-0.5 text-xs text-indigo-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-400 font-semibold">HQ 전체 스트리밍 모니터 활성화</span>
                </div>
              )}
            </div>
          </div>

          {/* Volume and extra links */}
          <div className="w-full md:w-64 flex justify-end items-center gap-4">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4.5 h-4.5" />
              ) : (
                <Volume2 className="w-4.5 h-4.5" />
              )}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                setIsMuted(false);
              }}
              className="w-20 col-span-2 sm:w-24 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white hover:bg-white/20 outline-none"
            />
            
            {currentTrack?.link && (
              <a 
                href={currentTrack.link}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 px-2.5 py-1 rounded-lg bg-white/5 transition-all"
              >
                <span>Full Song</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </footer>

      {/* Floating HQ YouTube Video & Audio Player Frame */}
      {currentTrack && playMode === "youtube" && (
        <div className={`fixed right-6 bottom-28 z-50 bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
          isYoutubeExpanded ? "w-80 sm:w-96" : "w-14 h-14 rounded-full flex items-center justify-center bg-indigo-600 border-indigo-400 cursor-pointer shadow-lg shadow-indigo-500/20"
        }`}>
          {isYoutubeExpanded ? (
            <div className="flex flex-col">
              {/* Header with control links */}
              <div className="bg-zinc-950 p-3 px-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  <p className="text-[11px] font-bold text-zinc-300 truncate">
                    전체 재생: {currentTrack.artist.name} - {currentTrack.title}
                  </p>
                </div>
                <button 
                  onClick={() => setIsYoutubeExpanded(false)}
                  className="text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded font-bold cursor-pointer transition-colors"
                >
                  최소화
                </button>
              </div>

              {/* Player sandbox screen */}
              <div className="aspect-video bg-black relative">
                {isPlaying ? (
                  <iframe
                    src={`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(currentTrack.artist.name + " " + currentTrack.title)}&autoplay=1`}
                    width="100%"
                    height="100%"
                    title="YouTube Real Audio Player"
                    className="border-0"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  ></iframe>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 gap-2 p-4 text-center">
                    <Disc className="w-8 h-8 text-zinc-600 animate-pulse" />
                    <p className="text-xs text-zinc-400 font-medium">전체 스트리밍이 대기 상태입니다</p>
                    <button 
                      onClick={() => setIsPlaying(true)}
                      className="mt-1 text-xs font-bold bg-white text-black px-3 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                    >
                      지금 듣기
                    </button>
                  </div>
                )}
              </div>
              
              {/* Player info bar */}
              <div className="p-2 px-3 bg-zinc-950/80 border-t border-white/5 flex justify-between items-center text-[10px] font-mono text-zinc-500">
                <span>YouTube Media Service</span>
                <span className="text-[#a5b4fc] font-bold">1080p Streamed</span>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsYoutubeExpanded(true)}
              className="w-full h-full flex items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all"
              title="유튜브 전체화면 플레이어 확대"
            >
              <Disc className="w-6 h-6 animate-spin-slow text-white" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
