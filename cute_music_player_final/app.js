// 전역 변수
let player;
let currentVideoId = null;
let playlist = [];
let currentIndex = 0;
let isPlaying = false;
let isShuffle = false;
let playerReady = false;

// DOM 요소
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const addSongBtn = document.getElementById('add-song-btn');
const youtubeUrlInput = document.getElementById('youtube-url');
const playlistElement = document.getElementById('playlist');
const songThumbnail = document.getElementById('song-thumbnail');
const songTitle = document.getElementById('song-title');
const songArtist = document.getElementById('song-artist');
const progressBar = document.getElementById('progress');
const currentTimeElement = document.getElementById('current-time');
const durationElement = document.getElementById('duration');

// 로컬 스토리지에서 재생 목록 불러오기
function loadPlaylistFromStorage() {
    const savedPlaylist = localStorage.getItem('musicPlaylist');
    if (savedPlaylist) {
        playlist = JSON.parse(savedPlaylist);
        renderPlaylist();
    }
}

// 재생 목록을 로컬 스토리지에 저장
function savePlaylistToStorage() {
    localStorage.setItem('musicPlaylist', JSON.stringify(playlist));
}

// YouTube API 준비
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '0',
        width: '0',
        playerVars: {
            'playsinline': 1,
            'controls': 0,
            'disablekb': 1,
            'rel': 0
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

// 플레이어 준비 완료
function onPlayerReady(event) {
    playerReady = true;
    loadPlaylistFromStorage();
    
    // 재생 목록이 있으면 첫 번째 곡 로드
    if (playlist.length > 0) {
        loadSong(0);
    }
}

// 플레이어 상태 변경 이벤트
function onPlayerStateChange(event) {
    // 재생 중
    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        startProgressUpdate();
    } 
    // 일시 정지
    else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        stopProgressUpdate();
    } 
    // 종료
    else if (event.data === YT.PlayerState.ENDED) {
        playNext();
    }
}

// YouTube URL에서 비디오 ID 추출
function extractVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
}

// YouTube API를 사용하여 비디오 정보 가져오기
async function getVideoInfo(videoId) {
    try {
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        const data = await response.json();
        return {
            title: data.title,
            author: data.author_name,
            thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        };
    } catch (error) {
        console.error('비디오 정보를 가져오는 중 오류 발생:', error);
        return {
            title: '알 수 없는 제목',
            author: '알 수 없는 아티스트',
            thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        };
    }
}

// 노래 추가
async function addSong() {
    const url = youtubeUrlInput.value.trim();
    if (!url) return;

    const videoId = extractVideoId(url);
    if (!videoId) {
        alert('유효한 YouTube URL을 입력해주세요.');
        return;
    }

    // 중복 체크
    if (playlist.some(song => song.videoId === videoId)) {
        alert('이미 재생 목록에 있는 노래입니다.');
        youtubeUrlInput.value = '';
        return;
    }

    try {
        const videoInfo = await getVideoInfo(videoId);
        const song = {
            videoId,
            title: videoInfo.title,
            artist: videoInfo.author,
            thumbnail: videoInfo.thumbnail
        };

        playlist.push(song);
        savePlaylistToStorage();
        renderPlaylist();
        youtubeUrlInput.value = '';

        // 재생 목록에 첫 곡이 추가되면 자동으로 로드
        if (playlist.length === 1) {
            loadSong(0);
        }
    } catch (error) {
        console.error('노래 추가 중 오류 발생:', error);
        alert('노래를 추가하는 중 오류가 발생했습니다.');
    }
}

// 재생 목록 렌더링
function renderPlaylist() {
    playlistElement.innerHTML = '';
    
    playlist.forEach((song, index) => {
        const li = document.createElement('li');
        li.className = `playlist-item ${index === currentIndex ? 'active' : ''}`;
        li.innerHTML = `
            <img class="playlist-thumbnail" src="${song.thumbnail}" alt="${song.title}">
            <div class="playlist-info">
                <div class="playlist-title">${song.title}</div>
                <div class="playlist-artist">${song.artist}</div>
            </div>
            <button class="playlist-remove" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // 노래 클릭 이벤트
        li.addEventListener('click', (e) => {
            if (!e.target.closest('.playlist-remove')) {
                loadSong(index);
            }
        });
        
        playlistElement.appendChild(li);
    });
    
    // 삭제 버튼 이벤트 추가
    document.querySelectorAll('.playlist-remove').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(button.dataset.index);
            removeSong(index);
        });
    });
}

// 노래 삭제
function removeSong(index) {
    // 현재 재생 중인 노래를 삭제하는 경우
    if (index === currentIndex) {
        if (playlist.length > 1) {
            // 다음 곡 재생
            playlist.splice(index, 1);
            if (index >= playlist.length) {
                currentIndex = 0;
            }
            loadSong(currentIndex);
        } else {
            // 마지막 곡인 경우 플레이어 초기화
            playlist = [];
            currentIndex = 0;
            resetPlayer();
        }
    } else {
        // 현재 재생 중이 아닌 노래 삭제
        playlist.splice(index, 1);
        if (index < currentIndex) {
            currentIndex--;
        }
        renderPlaylist();
    }
    
    savePlaylistToStorage();
}

// 플레이어 초기화
function resetPlayer() {
    if (player && playerReady) {
        player.stopVideo();
    }
    
    isPlaying = false;
    currentVideoId = null;
    playBtn.innerHTML = '<i class="fas fa-play"></i>';
    songThumbnail.src = 'https://via.placeholder.com/200';
    songTitle.textContent = '노래를 선택해주세요';
    songArtist.textContent = '아티스트';
    progressBar.style.width = '0%';
    currentTimeElement.textContent = '0:00';
    durationElement.textContent = '0:00';
    
    renderPlaylist();
}

// 노래 로드
function loadSong(index) {
    if (!playlist.length || index < 0 || index >= playlist.length || !playerReady) return;
    
    currentIndex = index;
    const song = playlist[currentIndex];
    currentVideoId = song.videoId;
    
    // 플레이어 업데이트
    player.loadVideoById(currentVideoId);
    
    // UI 업데이트
    songThumbnail.src = song.thumbnail;
    songTitle.textContent = song.title;
    songArtist.textContent = song.artist;
    
    renderPlaylist();
}

// 재생/일시정지 토글
function togglePlay() {
    if (!playlist.length) return;
    
    if (isPlaying) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

// 이전 곡 재생
function playPrev() {
    if (!playlist.length) return;
    
    if (isShuffle) {
        loadSong(getRandomIndex());
    } else {
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) prevIndex = playlist.length - 1;
        loadSong(prevIndex);
    }
}

// 다음 곡 재생
function playNext() {
    if (!playlist.length) return;
    
    if (isShuffle) {
        loadSong(getRandomIndex());
    } else {
        let nextIndex = currentIndex + 1;
        if (nextIndex >= playlist.length) nextIndex = 0;
        loadSong(nextIndex);
    }
}

// 랜덤 인덱스 생성 (현재 인덱스와 다른)
function getRandomIndex() {
    if (playlist.length <= 1) return 0;
    
    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * playlist.length);
    } while (randomIndex === currentIndex);
    
    return randomIndex;
}

// 셔플 모드 토글
function toggleShuffle() {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
    
    if (isShuffle) {
        shuffleBtn.style.color = '#ff5252';
    } else {
        shuffleBtn.style.color = 'white';
    }
}

// 시간 형식 변환 (초 -> MM:SS)
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// 진행 상태 업데이트 타이머
let progressTimer;

// 진행 상태 업데이트 시작
function startProgressUpdate() {
    stopProgressUpdate();
    progressTimer = setInterval(updateProgress, 1000);
}

// 진행 상태 업데이트 중지
function stopProgressUpdate() {
    if (progressTimer) {
        clearInterval(progressTimer);
    }
}

// 진행 상태 업데이트
function updateProgress() {
    if (!player || !isPlaying) return;
    
    const currentTime = player.getCurrentTime() || 0;
    const duration = player.getDuration() || 0;
    
    if (duration > 0) {
        const progressPercent = (currentTime / duration) * 100;
        progressBar.style.width = `${progressPercent}%`;
        
        currentTimeElement.textContent = formatTime(currentTime);
        durationElement.textContent = formatTime(duration);
    }
}

// 이벤트 리스너
playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', playPrev);
nextBtn.addEventListener('click', playNext);
shuffleBtn.addEventListener('click', toggleShuffle);
addSongBtn.addEventListener('click', addSong);

// Enter 키로 노래 추가
youtubeUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addSong();
    }
});

// 진행 바 클릭으로 시간 이동
document.querySelector('.progress-bar').addEventListener('click', (e) => {
    if (!playlist.length || !playerReady) return;
    
    const progressBar = e.currentTarget;
    const clickPosition = e.offsetX / progressBar.offsetWidth;
    const duration = player.getDuration();
    
    player.seekTo(clickPosition * duration);
});

// 서비스 워커 등록
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('서비스 워커가 등록되었습니다:', registration.scope);
            })
            .catch(error => {
                console.log('서비스 워커 등록 실패:', error);
            });
    });
}

// 페이지 로드 시 초기화
window.addEventListener('load', () => {
    // YouTube API가 이미 로드되었는지 확인
    if (typeof YT !== 'undefined' && YT.Player) {
        onYouTubeIframeAPIReady();
    }
}); 