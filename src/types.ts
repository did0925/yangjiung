export interface Track {
  id: number;
  title: string;
  artist: {
    name: string;
    picture: string;
  };
  album: {
    title: string;
    cover: string;
  };
  previewUrl: string;
  duration: number;
  link?: string;
  reason?: string; // Appended by AI recommendation engine
}

export interface PlaylistAnalysis {
  playlistTitle: string;
  analysisMarkdown: string;
  tracks: Track[];
}
