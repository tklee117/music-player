// 유튜브 플레이어 관련 변수
let player;
let currentVideoId = '';
let isPlaying = false;
let currentSongIndex = 0;
let songs = [];
let progressInterval;

// DOM Elements
let coverPlayBtn, playBtn, nextBtn, replayBtn, shuffleBtn, clearPlaylistBtn;
let songTitle, songArtist, coverImage;
let playlistContainer, showAddFormBtn, addSongForm, cancelAddFormBtn;
let progressBar, progressFilled, progressHandle, currentTimeDisplay, durationDisplay;
let addSongFormElement;

// 페이지 로드 완료 시 실행
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    loadSongs();
    setupEventListeners();
});

// DOM 요소 초기화
function initializeElements() {
    coverPlayBtn = document.getElementById('cover-play-btn');
    playBtn = document.getElementById('play-btn');
    nextBtn = document.getElementById('next-btn');
    replayBtn = document.getElementById('replay-btn');
    shuffleBtn = document.getElementById('shuffle-btn');
    clearPlaylistBtn = document.getElementById('clear-playlist-btn');
    songTitle = document.getElementById('song-title');
    songArtist = document.getElementById('song-artist');
    coverImage = document.getElementById('cover-image');
    playlistContainer = document.getElementById('playlist-container');
    showAddFormBtn = document.getElementById('show-add-form-btn');
    addSongForm = document.getElementById('add-song-form');
    cancelAddFormBtn = document.getElementById('cancel-add-form-btn');
    addSongFormElement = document.getElementById('add-song-form-element');
    
    // 진행 바 관련 요소 초기화
    progressBar = document.querySelector('.progress-bar');
    progressFilled = document.querySelector('.progress-filled');
    progressHandle = document.querySelector('.progress-handle');
    currentTimeDisplay = document.querySelector('.current-time');
    durationDisplay = document.querySelector('.duration');
}

// 노래 목록 로드
async function loadSongs() {
    try {
        showLoading(true);
        const response = await fetch('/api/songs');
        
        if (!response.ok) {
            throw new Error('Failed to load songs');
        }
        
        songs = await response.json();
        renderPlaylist();
        
        // 유튜브 API 로드
        loadYoutubeApi();
    } catch (error) {
        console.error('Error loading songs:', error);
        showError('노래 목록을 로드하는데 실패했습니다.');
    } finally {
        showLoading(false);
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // Play/pause buttons
    coverPlayBtn.addEventListener('click', togglePlay);
    playBtn.addEventListener('click', togglePlay);
    
    // Next button
    nextBtn.addEventListener('click', playNext);
    
    // Replay button
    replayBtn.addEventListener('click', replaySong);
    
    // Shuffle button
    shuffleBtn.addEventListener('click', shufflePlaylist);
    
    // Clear playlist button
    clearPlaylistBtn.addEventListener('click', clearPlaylist);
    
    // Show add form button
    showAddFormBtn.addEventListener('click', function() {
        addSongForm.classList.remove('hidden');
    });
    
    // Cancel add form button
    cancelAddFormBtn.addEventListener('click', function() {
        addSongForm.classList.add('hidden');
    });
    
    // 노래 추가 폼 제출
    addSongFormElement.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const title = document.getElementById('title').value.trim();
        const artist = document.getElementById('artist').value.trim();
        const youtubeUrl = document.getElementById('youtube_url').value.trim();
        
        if (!title || !artist || !youtubeUrl) {
            alert('모든 필드를 입력해주세요.');
            return;
        }
        
        // YouTube ID 추출
        const youtubeId = getYoutubeId(youtubeUrl);
        if (!youtubeId) {
            alert('유효한 YouTube URL 또는 ID를 입력해주세요.');
            return;
        }
        
        try {
            const response = await fetch('/api/songs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: title,
                    artist: artist,
                    youtube_url: youtubeUrl
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to add song');
            }
            
            const newSong = await response.json();
            songs.push(newSong);
            
            // 플레이리스트 다시 렌더링
            renderPlaylist();
            
            // 폼 초기화
            addSongFormElement.reset();
            addSongForm.classList.add('hidden');
            
            // 새로 추가된 노래로 스크롤
            setTimeout(() => {
                const newSongElement = document.querySelector(`.playlist-item[data-id="${newSong.id}"]`);
                if (newSongElement) {
                    newSongElement.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
            
        } catch (error) {
            console.error('Error adding song:', error);
            alert('노래를 추가하는데 실패했습니다.');
        }
    });
    
    // 진행 바 클릭 이벤트
    if (progressBar) {
        progressBar.addEventListener('click', handleProgressBarClick);
    }
}

// 노래 목록 삭제
async function clearPlaylist() {
    if (confirm('정말로 모든 노래를 삭제하시겠습니까?')) {
        try {
            const response = await fetch('/api/songs/all', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to clear playlist');
            }
            
            songs = [];
            renderPlaylist();
            
            // 플레이어 초기화
            songTitle.textContent = '재생 가능한 노래 없음';
            songArtist.textContent = '노래를 추가해주세요';
            coverImage.src = 'https://via.placeholder.com/200?text=NoSong';
            
            // 재생 중지
            if (player && player.stopVideo) {
                player.stopVideo();
            }
            
            // 프로그레스 바 초기화
            resetProgressBar();
        } catch (error) {
            console.error('Error clearing playlist:', error);
            alert('재생 목록을 비우는데 실패했습니다.');
        }
    }
}

// 노래 지우기
async function deleteSong(songId) {
    try {
        const response = await fetch(`/api/songs/${songId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete song');
        }
        
        // 노래 배열에서 제거
        songs = songs.filter(song => song.id !== parseInt(songId));
        
        // 플레이리스트 다시 렌더링
        renderPlaylist();
        
        // 현재 재생 중인 노래가 삭제되었는지 확인
        const songElement = document.querySelector(`.playlist-item[data-id="${songId}"]`);
        if (songElement && songElement.classList.contains('active')) {
            if (songs.length > 0) {
                // 다음 노래 재생
                playNext();
            } else {
                // 노래가 없으면 플레이어 초기화
                songTitle.textContent = '재생 가능한 노래 없음';
                songArtist.textContent = '노래를 추가해주세요';
                coverImage.src = 'https://via.placeholder.com/200?text=NoSong';
                if (player && player.stopVideo) {
                    player.stopVideo();
                }
                resetProgressBar();
            }
        }
    } catch (error) {
        console.error('Error deleting song:', error);
        alert('노래를 삭제하는데 실패했습니다.');
    }
}

// 로딩 표시
function showLoading(isLoading) {
    playlistContainer.innerHTML = '';
    if (isLoading) {
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.innerHTML = '<div class="loading-spinner"></div>';
        playlistContainer.appendChild(loading);
    }
}

// 에러 메시지 표시
function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    playlistContainer.innerHTML = '';
    playlistContainer.appendChild(errorElement);
}

// 플레이리스트 렌더링
function renderPlaylist() {
    playlistContainer.innerHTML = '';
    
    if (!songs || songs.length === 0) {
        playlistContainer.innerHTML = '<div class="empty-playlist">재생 목록이 비어있습니다<br>노래를 추가해주세요!</div>';
        return;
    }
    
    songs.forEach(song => {
        const playlistItem = document.createElement('div');
        playlistItem.className = 'playlist-item';
        playlistItem.dataset.id = song.id;
        playlistItem.dataset.youtubeId = song.youtube_id;
        
        // 현재 재생 중인 노래인지 확인
        if (song.youtube_id === currentVideoId) {
            playlistItem.classList.add('active');
            
            // 재생 중이면 표시기 추가
            if (isPlaying) {
                const indicator = document.createElement('div');
                indicator.className = 'playing-indicator';
                playlistItem.appendChild(indicator);
            }
        }
        
        // 썸네일 이미지
        const img = document.createElement('img');
        img.className = 'playlist-item-img';
        img.src = song.cover_url;
        img.alt = song.title;
        img.loading = 'lazy';
        playlistItem.appendChild(img);
        
        // 노래 정보
        const info = document.createElement('div');
        info.className = 'playlist-item-info';
        
        const title = document.createElement('div');
        title.className = 'playlist-item-title';
        title.textContent = song.title;
        info.appendChild(title);
        
        const artist = document.createElement('div');
        artist.className = 'playlist-item-artist';
        artist.textContent = song.artist;
        info.appendChild(artist);
        
        playlistItem.appendChild(info);
        
        // 삭제 버튼
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-song-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteSong(song.id);
        });
        playlistItem.appendChild(deleteBtn);
        
        // 노래 클릭 이벤트
        playlistItem.addEventListener('click', function() {
            loadSong(this);
            if (player) {
                player.playVideo();
            }
        });
        
        playlistContainer.appendChild(playlistItem);
    });
}

// YouTube ID 추출
function getYoutubeId(url) {
    if (!url) return null;
    
    // 이미 YouTube ID인 경우
    if (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return url;
    }
    
    // youtu.be URL
    if (url.includes('youtu.be/')) {
        return url.split('youtu.be/')[1].split('?')[0].split('&')[0];
    }
    
    // youtube.com URL
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    
    return match ? match[1] : null;
}

// 진행 바 클릭 처리
function handleProgressBarClick(e) {
    if (!player || !player.getDuration) return;
    
    const percent = getClickPositionPercent(e);
    const duration = player.getDuration();
    const seekTime = duration * (percent / 100);
    
    player.seekTo(seekTime, true);
    updateProgressBar(percent);
}

// 클릭 위치의 퍼센트 계산
function getClickPositionPercent(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return (x / rect.width) * 100;
}

// 진행 바 업데이트
function updateProgressBar(percent = null) {
    if (!player || !player.getCurrentTime || !player.getDuration) return;
    
    if (percent === null) {
        const duration = player.getDuration() || 0;
        const currentTime = player.getCurrentTime() || 0;
        
        if (duration > 0) {
            percent = (currentTime / duration) * 100;
        } else {
            percent = 0;
        }
    }
    
    if (progressFilled) {
        progressFilled.style.width = `${percent}%`;
    }
    
    if (progressHandle) {
        progressHandle.style.left = `${percent}%`;
    }
    
    // 시간 표시 업데이트
    if (currentTimeDisplay && durationDisplay) {
        const duration = player.getDuration() || 0;
        const currentTime = player.getCurrentTime() || 0;
        
        currentTimeDisplay.textContent = formatTime(currentTime);
        durationDisplay.textContent = formatTime(duration);
    }
}

// 진행 바 리셋
function resetProgressBar() {
    if (progressFilled) {
        progressFilled.style.width = '0%';
    }
    
    if (progressHandle) {
        progressHandle.style.left = '0%';
    }
    
    if (currentTimeDisplay) {
        currentTimeDisplay.textContent = '0:00';
    }
    
    if (durationDisplay) {
        durationDisplay.textContent = '0:00';
    }
}

// 진행 바 업데이트 인터벌 설정
function updateProgressInterval() {
    // 이전 인터벌 제거
    if (progressInterval) {
        clearInterval(progressInterval);
    }
    
    // 새 인터벌 설정
    progressInterval = setInterval(() => {
        updateProgressBar();
    }, 1000);
}

// 시간 포맷 변환 (초 -> MM:SS)
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    seconds = Math.floor(seconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 유튜브 API 지연 로드
function loadYoutubeApi() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// YouTube API ready 콜백
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '0',
        width: '0',
        playerVars: {
            'playsinline': 1,
            'controls': 0,
            'disablekb': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

// 플레이어 준비 완료 콜백
function onPlayerReady(event) {
    // 첫 번째 노래 로드
    const playlistItems = document.querySelectorAll('.playlist-item');
    if (playlistItems.length > 0) {
        loadSong(playlistItems[0]);
    }
    
    // 초기 시간 표시 설정
    if (currentTimeDisplay && durationDisplay) {
        currentTimeDisplay.textContent = '0:00';
        durationDisplay.textContent = '0:00';
    }
}

// 플레이어 상태 변경 콜백
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        playNext();
    } else if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        updatePlayButton();
        updateProgressInterval();
    } else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        updatePlayButton();
        if (progressInterval) {
            clearInterval(progressInterval);
        }
    }
}

// 노래 로드
function loadSong(songElement) {
    if (!songElement) return;
    
    // 이전 활성 노래 클래스 제거
    document.querySelectorAll('.playlist-item').forEach(item => {
        item.classList.remove('active');
        
        // 재생 중 표시기 제거
        const indicator = item.querySelector('.playing-indicator');
        if (indicator) {
            indicator.remove();
        }
    });
    
    // 현재 노래에 활성 클래스 추가
    songElement.classList.add('active');
    
    // 현재 재생 중이면 표시기 추가
    if (isPlaying) {
        const indicator = document.createElement('div');
        indicator.className = 'playing-indicator';
        songElement.appendChild(indicator);
    }
    
    // 노래 정보 업데이트
    const title = songElement.querySelector('.playlist-item-title').textContent;
    const artist = songElement.querySelector('.playlist-item-artist').textContent;
    const youtubeId = songElement.getAttribute('data-youtube-id');
    const image = songElement.querySelector('.playlist-item-img').src;
    
    songTitle.textContent = title;
    songArtist.textContent = artist;
    coverImage.src = image;
    currentVideoId = youtubeId;
    
    // YouTube 비디오 로드
    if (player && player.loadVideoById) {
        player.loadVideoById(youtubeId);
    }
    
    // 현재 노래 인덱스 업데이트
    const playlistItems = document.querySelectorAll('.playlist-item');
    for (let i = 0; i < playlistItems.length; i++) {
        if (playlistItems[i] === songElement) {
            currentSongIndex = i;
            break;
        }
    }
}

// 재생/일시정지 전환
function togglePlay() {
    if (!player || !player.getPlayerState) return;
    
    if (isPlaying) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

// 재생 버튼 UI 업데이트
function updatePlayButton() {
    if (isPlaying) {
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        coverPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        coverPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
    
    // 재생 중 표시기 업데이트
    document.querySelectorAll('.playlist-item').forEach(item => {
        const indicator = item.querySelector('.playing-indicator');
        if (indicator) {
            indicator.remove();
        }
        
        if (item.classList.contains('active') && isPlaying) {
            const newIndicator = document.createElement('div');
            newIndicator.className = 'playing-indicator';
            item.appendChild(newIndicator);
        }
    });
}

// 다음 노래 재생
function playNext() {
    const playlistItems = document.querySelectorAll('.playlist-item');
    if (playlistItems.length > 0) {
        let nextIndex = (currentSongIndex + 1) % playlistItems.length;
        loadSong(playlistItems[nextIndex]);
        if (isPlaying) {
            player.playVideo();
        }
    }
}

// 현재 노래 재시작
function replaySong() {
    if (player) {
        player.seekTo(0);
        player.playVideo();
    }
}

// 플레이리스트 셔플
function shufflePlaylist() {
    const playlistItems = Array.from(document.querySelectorAll('.playlist-item'));
    if (playlistItems.length <= 1) return;
    
    // 현재 재생 중인 노래 선택
    const currentSong = playlistItems[currentSongIndex];
    
    // 현재 노래를 배열에서 제거
    playlistItems.splice(currentSongIndex, 1);
    
    // 나머지 노래들 셔플
    for (let i = playlistItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playlistItems[i], playlistItems[j]] = [playlistItems[j], playlistItems[i]];
    }
    
    // 현재 노래를 맨 앞에 추가
    playlistItems.unshift(currentSong);
    
    // DOM 업데이트
    playlistContainer.innerHTML = '';
    
    // 새로운 순서로 노래들 렌더링
    playlistItems.forEach(item => {
        playlistContainer.appendChild(item);
        
        // 재생 중인 표시기 다시 추가
        if (item.classList.contains('active') && isPlaying) {
            const indicator = document.createElement('div');
            indicator.className = 'playing-indicator';
            item.appendChild(indicator);
        }
    });
    
    // 현재 인덱스 재설정
    currentSongIndex = 0;
} 