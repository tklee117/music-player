// 유튜브 플레이어 관련 변수
let player;
let currentVideoId = '';
let isPlaying = false;
let currentSongIndex = 0;
let songs = [];
let progressInterval; // 진행 바 업데이트 인터벌
let isInitialLoad = true; // 초기 로딩 여부 확인 변수 추가

// DOM Elements
let coverPlayBtn, playBtn, nextBtn, replayBtn, shuffleBtn, clearPlaylistBtn;
let songTitle, songArtist, coverImage;
let playlistContainer, showAddFormBtn, addSongForm, cancelAddFormBtn;
let progressBar, progressFilled, progressHandle, currentTimeDisplay, durationDisplay;

// 페이지 로드 완료 시 실행
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    loadSongs();
    setupEventListeners();
    loadBackgroundImage();
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
    
    // 진행 바 관련 요소 초기화
    progressBar = document.querySelector('.progress-bar');
    progressFilled = document.querySelector('.progress-filled');
    progressHandle = document.querySelector('.progress-handle');
    currentTimeDisplay = document.querySelector('.current-time');
    durationDisplay = document.querySelector('.duration');
}

// API를 통해 노래 목록 로드
async function loadSongs() {
    try {
        showLoading(true);
        const response = await fetch('/api/songs');
        if (!response.ok) throw new Error('노래 목록을 불러오는데 실패했습니다.');
        
        songs = await response.json();
        renderPlaylist();
        
        // 유튜브 API 로드
        loadYoutubeApi();
    } catch (error) {
        console.error('노래 목록 로드 오류:', error);
        showError('노래 목록을 로드하는데 실패했습니다.');
    } finally {
        showLoading(false);
    }
}

// 로딩 표시
function showLoading(isLoading) {
    const loadingElement = document.getElementById('loading');
    if (isLoading) {
        if (!loadingElement) {
            const loading = document.createElement('div');
            loading.id = 'loading';
            loading.className = 'loading';
            loading.innerHTML = '<div class="loading-spinner"></div>';
            playlistContainer.appendChild(loading);
        }
    } else if (loadingElement) {
        loadingElement.remove();
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
    
    if (songs.length === 0) {
        playlistContainer.innerHTML = '<div class="empty-playlist">재생 목록이 비어있습니다<br>노래를 추가해주세요!</div>';
        // 노래가 없을 때 플레이어 초기화
        songTitle.textContent = '재생 가능한 노래 없음';
        songArtist.textContent = '노래를 추가해주세요';
        coverImage.src = 'https://via.placeholder.com/200?text=NoSong';
        return;
    }
    
    songs.forEach((song, index) => {
        const playlistItem = document.createElement('div');
        playlistItem.className = `playlist-item${song.is_new_added ? ' new-added' : ''}`;
        playlistItem.setAttribute('data-id', song.id);
        playlistItem.setAttribute('data-youtube-id', song.youtube_id);
        playlistItem.setAttribute('data-index', index);
        
        playlistItem.innerHTML = `
            <img class="playlist-item-img" src="${song.cover_url}" alt="${song.title}" loading="lazy">
            <div class="playlist-item-info">
                <div class="playlist-item-title">${song.title}</div>
                <div class="playlist-item-artist">${song.artist}</div>
            </div>
            <button class="delete-song-btn" data-id="${song.id}">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        playlistContainer.appendChild(playlistItem);
        
        // 항목 클릭 이벤트
        playlistItem.addEventListener('click', function() {
            loadSong(this);
            if (player) player.playVideo();
        });
        
        // 삭제 버튼 이벤트
        const deleteBtn = playlistItem.querySelector('.delete-song-btn');
        deleteBtn.addEventListener('click', function(event) {
            event.stopPropagation();
            const songId = this.getAttribute('data-id');
            deleteSong(songId);
        });
    });
    
    // 첫 번째 항목이 있으면 선택
    if (songs.length > 0 && player) {
        const firstItem = playlistContainer.querySelector('.playlist-item');
        if (firstItem) loadSong(firstItem);
    }
    
    // 새로 추가된 항목 애니메이션 제거 타이머
    setTimeout(() => {
        document.querySelectorAll('.new-added').forEach(item => {
            item.classList.remove('new-added');
        });
    }, 10000);
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 재생/일시정지 버튼
    coverPlayBtn.addEventListener('click', togglePlay);
    playBtn.addEventListener('click', togglePlay);
    
    // 다음 버튼
    nextBtn.addEventListener('click', playNext);
    
    // 다시 재생 버튼
    replayBtn.addEventListener('click', replaySong);
    
    // 셔플 버튼
    shuffleBtn.addEventListener('click', shufflePlaylist);
    
    // 플레이리스트 초기화 버튼
    clearPlaylistBtn.addEventListener('click', clearPlaylist);
    
    // 노래 추가 폼 표시 버튼
    showAddFormBtn.addEventListener('click', () => {
        addSongForm.classList.remove('hidden');
    });
    
    // 추가 취소 버튼
    cancelAddFormBtn.addEventListener('click', () => {
        addSongForm.classList.add('hidden');
    });
    
    // 진행 바 클릭 이벤트
    if (progressBar) {
        progressBar.addEventListener('click', handleProgressBarClick);
        
        // 진행 바 드래그 이벤트
        let isDragging = false;
        
        progressBar.addEventListener('mousedown', () => {
            isDragging = true;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging && player) {
                const percent = getClickPositionPercent(e);
                updateProgressBar(percent);
                
                // 드래그 중에는 영상 업데이트 중지 (성능 이슈 방지)
                clearInterval(progressInterval);
            }
        });
        
        document.addEventListener('mouseup', (e) => {
            if (isDragging && player) {
                isDragging = false;
                const percent = getClickPositionPercent(e);
                const duration = player.getDuration();
                const seekTime = duration * percent;
                
                player.seekTo(seekTime, true);
                updateProgressInterval();
            }
        });
    }
    
    // 노래 추가 폼 제출
    const form = addSongForm.querySelector('form');
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const titleInput = this.querySelector('#title');
        const artistInput = this.querySelector('#artist');
        const youtubeUrlInput = this.querySelector('#youtube_url');
        
        const title = titleInput.value.trim();
        const artist = artistInput.value.trim();
        const youtubeUrl = youtubeUrlInput.value.trim();
        
        if (!title || !artist || !youtubeUrl) {
            alert('모든 필드를 입력해주세요.');
            return;
        }
        
        try {
            // 로딩 표시
            const submitBtn = this.querySelector('.form-submit');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = '추가 중...';
            submitBtn.disabled = true;
            
            const response = await fetch('/api/songs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title,
                    artist,
                    youtube_url: youtubeUrl
                })
            });
            
            if (!response.ok) {
                throw new Error('노래 추가에 실패했습니다.');
            }
            
            const newSong = await response.json();
            
            // 새 노래를 목록에 추가하고 화면 갱신
            songs.push(newSong);
            renderPlaylist();
            
            // 폼 초기화 및 숨기기
            titleInput.value = '';
            artistInput.value = '';
            youtubeUrlInput.value = '';
            addSongForm.classList.add('hidden');
            
            // 새 노래를 선택하여 재생
            const newItem = playlistContainer.querySelector(`.playlist-item[data-id="${newSong.id}"]`);
            if (newItem) {
                loadSong(newItem);
                if (player) player.playVideo();
            }
            
        } catch (error) {
            console.error('노래 추가 오류:', error);
            alert('노래를 추가하는데 실패했습니다. 다시 시도해주세요.');
        } finally {
            // 버튼 상태 복원
            const submitBtn = this.querySelector('.form-submit');
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }
    });
}

// 플레이리스트 초기화
async function clearPlaylist() {
    if (songs.length === 0) return;
    
    if (!confirm('정말로 모든 노래를 삭제하시겠습니까?')) return;
    
    try {
        showLoading(true);
        
        // 새로운 API 엔드포인트를 통해 모든 노래 한 번에 삭제
        const response = await fetch('/api/songs/all', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('플레이리스트를 초기화하는데 실패했습니다.');
        }
        
        // 목록 비우기
        songs = [];
        renderPlaylist();
        
        // 플레이어 초기화
        if (player) {
            player.stopVideo();
        }
        
        isPlaying = false;
        updatePlayButton();
        
        // 진행 바 초기화
        if (progressFilled && progressHandle) {
            progressFilled.style.width = '0%';
            progressHandle.style.left = '0%';
        }
        if (currentTimeDisplay && durationDisplay) {
            currentTimeDisplay.textContent = '0:00';
            durationDisplay.textContent = '0:00';
        }
        
    } catch (error) {
        console.error('플레이리스트 초기화 오류:', error);
        alert('플레이리스트 초기화에 실패했습니다.');
    } finally {
        showLoading(false);
    }
}

// 진행 바 클릭 이벤트 처리 함수
function handleProgressBarClick(e) {
    if (!player) return;
    
    const percent = getClickPositionPercent(e);
    const duration = player.getDuration();
    const seekTime = duration * percent;
    
    player.seekTo(seekTime, true);
    updateProgressBar(percent);
}

// 클릭 위치의 퍼센트 계산
function getClickPositionPercent(e) {
    const rect = progressBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return Math.min(Math.max(x / rect.width, 0), 1);
}

// 진행 바 업데이트 함수
function updateProgressBar(percent = null) {
    if (!player || !progressFilled || !progressHandle || !currentTimeDisplay || !durationDisplay) return;
    
    if (percent === null) {
        // player API를 사용하여 현재 진행 상태 가져오기
        const duration = player.getDuration();
        const currentTime = player.getCurrentTime();
        percent = currentTime / duration;
    }
    
    // 진행 바 업데이트
    const percentString = `${percent * 100}%`;
    progressFilled.style.width = percentString;
    progressHandle.style.left = percentString;
    
    // 시간 텍스트 업데이트
    if (player.getDuration && player.getCurrentTime) {
        const duration = player.getDuration();
        const currentTime = percent * duration;
        
        currentTimeDisplay.textContent = formatTime(currentTime);
        durationDisplay.textContent = formatTime(duration);
    }
}

// 진행 바 업데이트 인터벌 설정/해제
function updateProgressInterval() {
    // 기존 인터벌 제거
    clearInterval(progressInterval);
    
    if (isPlaying) {
        // 0.5초마다 진행 바 업데이트
        progressInterval = setInterval(() => {
            updateProgressBar();
        }, 500);
    }
}

// 시간 형식 변환 (초 -> mm:ss)
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// 배경 이미지 로드
function loadBackgroundImage() {
    const bgContainer = document.getElementById('bg-container');
    const bgImage = new Image();
    bgImage.onload = function() {
        bgContainer.style.backgroundImage = `url('${bgImage.src}')`;
        bgContainer.style.opacity = '1';
    };
    bgImage.src = '/assets/cup_of_coffee_love.gif';
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
    
    // 초기 로딩 시 로딩 화면 감추기
    const initialLoading = document.getElementById('initial-loading');
    if (initialLoading) {
        initialLoading.style.opacity = '0';
        setTimeout(() => {
            initialLoading.style.display = 'none';
        }, 500);
    }
}

// 플레이어 상태 변경 이벤트
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        playNext();
    } else if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        updatePlayButton();
        updateProgressInterval(); // 진행 바 업데이트 시작
    } else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        updatePlayButton();
        updateProgressInterval(); // 인터벌 중지
    }
}

// 노래 로드 함수
function loadSong(songElement) {
    // 모든 항목에서 active 클래스 제거 및 재생 표시 제거
    document.querySelectorAll('.playlist-item').forEach(item => {
        item.classList.remove('active');
        const indicator = item.querySelector('.playing-indicator');
        if (indicator) indicator.remove();
    });
    
    // 현재 항목에 active 클래스 추가
    songElement.classList.add('active');
    
    // 재생 중이면 재생 표시 추가
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
    const index = parseInt(songElement.getAttribute('data-index'));
    
    songTitle.textContent = title;
    songArtist.textContent = artist;
    coverImage.src = image;
    currentVideoId = youtubeId;
    currentSongIndex = index;
    
    // 유튜브 영상 로드
    if (player && player.loadVideoById) {
        player.loadVideoById(youtubeId);
        
        // 로드 후 바로 시간 정보 업데이트는 불가능 (데이터가 아직 없음)
        // 로드 후 잠시 후에 시간 정보 초기화
        setTimeout(() => {
            updateProgressBar();
        }, 500);
    }
}

// 재생/일시정지 토글
function togglePlay() {
    if (player && player.getPlayerState) {
        if (isPlaying) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    }
}

// 재생 버튼 UI 업데이트
function updatePlayButton() {
    if (isPlaying) {
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        playBtn.classList.add('pause');
        coverPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        playBtn.classList.remove('pause');
        coverPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
    
    // 재생 표시 업데이트
    document.querySelectorAll('.playlist-item').forEach(item => {
        const indicator = item.querySelector('.playing-indicator');
        if (indicator) indicator.remove();
        
        if (item.classList.contains('active') && isPlaying) {
            const newIndicator = document.createElement('div');
            newIndicator.className = 'playing-indicator';
            item.appendChild(newIndicator);
        }
    });
}

// 다음 노래 재생
function playNext() {
    if (songs.length > 0) {
        const nextIndex = (currentSongIndex + 1) % songs.length;
        const nextSong = document.querySelector(`.playlist-item[data-index="${nextIndex}"]`);
        if (nextSong) {
            loadSong(nextSong);
            if (isPlaying) player.playVideo();
        }
    }
}

// 현재 노래 다시 재생
function replaySong() {
    if (player) {
        player.seekTo(0);
        player.playVideo();
    }
}

// 플레이리스트 셔플
function shufflePlaylist() {
    if (songs.length <= 1) return;
    
    // 현재 재생 중인 노래 저장
    const currentSong = songs[currentSongIndex];
    
    // 나머지 노래들 배열 생성
    const remainingSongs = [...songs];
    remainingSongs.splice(currentSongIndex, 1);
    
    // 나머지 노래들 셔플
    for (let i = remainingSongs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
    }
    
    // 현재 노래를 맨 앞에 두고 셔플된 노래들 추가
    songs = [currentSong, ...remainingSongs];
    
    // 인덱스 재설정
    currentSongIndex = 0;
    
    // 화면 갱신
    renderPlaylist();
    
    // 현재 노래 활성화
    const firstItem = document.querySelector('.playlist-item');
    if (firstItem) loadSong(firstItem);
}

// 노래 삭제
async function deleteSong(songId) {
    try {
        const response = await fetch(`/api/songs/${songId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('노래를 삭제하는데 실패했습니다.');
        }
        
        // DOM에서 요소 찾기
        const songElement = document.querySelector(`.playlist-item[data-id="${songId}"]`);
        const isCurrentlyPlaying = songElement.classList.contains('active');
        const songIndex = parseInt(songElement.getAttribute('data-index'));
        
        // 노래 배열에서 삭제
        songs = songs.filter(song => song.id != songId);
        
        // DOM에서 노래 삭제
        songElement.remove();
        
        // 인덱스 재조정
        document.querySelectorAll('.playlist-item').forEach((item, index) => {
            item.setAttribute('data-index', index);
        });
        
        // 다음 노래 재생 (삭제된 노래가 현재 재생 중이었을 경우)
        if (isCurrentlyPlaying) {
            // 마지막 노래였으면 첫 번째 노래로, 아니면 다음 노래로
            let nextIndex = songs.length <= songIndex ? 0 : songIndex;
            const nextSong = document.querySelector(`.playlist-item[data-index="${nextIndex}"]`);
            
            if (nextSong) {
                loadSong(nextSong);
                if (isPlaying) player.playVideo();
            } else if (songs.length === 0) {
                // 노래가 모두 삭제된 경우
                songTitle.textContent = '재생 가능한 노래 없음';
                songArtist.textContent = '노래를 추가해주세요';
                coverImage.src = 'https://via.placeholder.com/200?text=NoSong';
                if (player) player.stopVideo();
                
                // 진행 바 초기화
                if (progressFilled && progressHandle) {
                    progressFilled.style.width = '0%';
                    progressHandle.style.left = '0%';
                }
                if (currentTimeDisplay && durationDisplay) {
                    currentTimeDisplay.textContent = '0:00';
                    durationDisplay.textContent = '0:00';
                }
            }
        }
        
    } catch (error) {
        console.error('노래 삭제 오류:', error);
        alert('노래를 삭제하는데 실패했습니다.');
    }
} 