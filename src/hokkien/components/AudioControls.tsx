import React, { useRef } from "react";
import { Download, Volume2 } from "lucide-react";

export const AudioControls = ({ entryId }: { entryId: number | null }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  if (entryId === null) return null;

  const folder = Math.floor(entryId / 1000);
  const audioUrl = `https://sutian.moe.edu.tw/media/senn/mp3/imtong/subak/${folder}/${entryId}.mp3`;

  const playAudio = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    audioRef.current?.play();
  };

  const downloadAudio = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${entryId}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(audioUrl, "_blank");
    }
  };

  return (
    <div className="flex items-center gap-2 ml-3">
      <audio ref={audioRef} src={audioUrl} preload="none"></audio>
      <button
        onClick={playAudio}
        title="Play"
        className="text-gray-400 hover:text-blue-600 transition-colors"
      >
        <Volume2 size={16} />
      </button>
      <button
        onClick={downloadAudio}
        title="Download"
        className="text-gray-400 hover:text-blue-600 transition-colors"
      >
        <Download size={16} />
      </button>
    </div>
  );
};
