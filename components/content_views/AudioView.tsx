import React, { useState, useEffect, useRef } from 'react';
import { Content, User } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { AudioIcon } from '../icons/ResourceTypeIcons';
import { PlayIcon, PauseIcon, SpeakerIcon, SpeakerMuteIcon } from '../icons/AdminIcons';

interface AudioViewProps {
    lessonId: string;
    user: User;
}

const CustomAudioPlayer: React.FC<{ src: string; title: string }> = ({ src, title }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        if (!src || !audioRef.current) return;
        const audio = audioRef.current;

        const initAudio = () => {
            if (!audioContext) {
                try {
                    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                    const ctx = new AudioContextClass();
                    const anal = ctx.createAnalyser();
                    anal.fftSize = 256;
                    const srcNode = ctx.createMediaElementSource(audio);
                    srcNode.connect(anal);
                    anal.connect(ctx.destination);
                    setAudioContext(ctx);
                    setAnalyser(anal);
                } catch (e) { }
            } else if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
        };

        const handlePlay = () => { setIsPlaying(true); initAudio(); };
        const handlePause = () => setIsPlaying(false);
        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleLoadedMetadata = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [src, audioContext]);

    useEffect(() => {
        if (!analyser || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 2;
                const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
                gradient.addColorStop(0, '#60A5FA');
                gradient.addColorStop(1, '#2563EB');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(x, canvas.height - barHeight, barWidth, barHeight, [4, 4, 0, 0]);
                ctx.fill();
                x += barWidth + 1;
            }
        };

        if (isPlaying) draw();
        else {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
    }, [analyser, isPlaying]);

    const formatTime = (time: number) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="relative h-32 bg-gray-900 flex items-center justify-center overflow-hidden">
                <canvas ref={canvasRef} width={600} height={128} className="absolute bottom-0 w-full h-full opacity-80" />
                {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-10">
                        <button onClick={() => audioRef.current?.play()} className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg"><PlayIcon className="w-8 h-8 ml-1" /></button>
                    </div>
                )}
                <div className="absolute top-4 left-4 right-4 text-white font-medium z-10 pointer-events-none truncate">{title}</div>
            </div>
            <div className="p-4 space-y-4">
                <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
                    <span className="w-10 text-right">{formatTime(currentTime)}</span>
                    <input type="range" min="0" max={duration || 0} value={currentTime} onChange={e => { if (audioRef.current) audioRef.current.currentTime = Number(e.target.value); }} className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    <span className="w-10">{formatTime(duration)}</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-white transition-colors">
                            {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                        </button>
                        <div className="flex items-center gap-2 group relative">
                            <button onClick={() => { if (audioRef.current) { audioRef.current.muted = !isMuted; setIsMuted(!isMuted); } }} className="text-gray-600 dark:text-gray-400">
                                {isMuted || volume === 0 ? <SpeakerMuteIcon className="w-5 h-5" /> : <SpeakerIcon className="w-5 h-5" />}
                            </button>
                            <div className="w-0 overflow-hidden group-hover:w-24 transition-all duration-300">
                                <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={e => { const v = Number(e.target.value); if (audioRef.current) audioRef.current.volume = v; setVolume(v); }} className="w-20 h-1 accent-blue-600 cursor-pointer" />
                            </div>
                        </div>
                    </div>
                    <button onClick={() => { const s = [0.5, 1, 1.25, 1.5, 2]; const n = s[(s.indexOf(playbackRate) + 1) % s.length]; if (audioRef.current) audioRef.current.playbackRate = n; setPlaybackRate(n); }} className="px-2 py-1 text-xs font-bold text-gray-600 bg-gray-100 dark:bg-gray-700 rounded transition-colors">{playbackRate}x</button>
                </div>
            </div>
            <audio ref={audioRef} src={src} crossOrigin="anonymous" preload="metadata" className="hidden" />
        </div>
    );
};

const SavedAudioViewer: React.FC<{ content: Content }> = ({ content }) => {
    const src = content.file?.url || (content.filePath?.startsWith('http') ? content.filePath : (content.filePath ? `/api/content/${content._id}/file` : '')) || (content.body?.startsWith('http') ? content.body : '');

    useEffect(() => {
        if (content._id) {
            api.trackContentView(content._id).catch(() => { });
        }
    }, [content._id]);

    return (
        <div className="relative group">
            {src ? <CustomAudioPlayer src={src} title={content.title} /> : <div className="p-4 bg-red-50 text-red-500 rounded-lg text-sm">Audio source not found.</div>}
        </div>
    );
};

export const AudioView: React.FC<AudioViewProps> = ({ lessonId, user }) => {
    const { data: groupedContent, isLoading } = useApi(() => api.getContentsByLessonId(lessonId, ['audio'], true), [lessonId, user]);
    const audioContents = groupedContent?.[0]?.docs || [];

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <AudioIcon className="w-8 h-8 text-purple-600" />
                    <h1 className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-purple-600 dark:from-white dark:to-purple-400">Audio</h1>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
                {isLoading && <div className="text-center py-10 text-gray-500">Loading audio...</div>}
                {!isLoading && audioContents.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                        {audioContents.map(audio => <SavedAudioViewer key={audio._id} content={audio} />)}
                    </div>
                )}
                {!isLoading && audioContents.length === 0 && (
                    <div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg">
                        <AudioIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="mt-4 text-gray-500">No audio available.</p>
                    </div>
                )}
            </div>
        </div>
    );
};