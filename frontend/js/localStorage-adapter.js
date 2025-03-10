/**
 * localStorage-adapter.js
 * 정적 웹사이트를 위한 localStorage 어댑터
 */

// 초기 노래 목록 데이터
const INITIAL_SONGS = [
  {
    "id": 1,
    "title": "Star",
    "artist": "Mingginyu",
    "youtube_id": "0t_ORa7dmO4",
    "cover_url": "https://img.youtube.com/vi/0t_ORa7dmO4/hqdefault.jpg"
  },
  {
    "id": 2,
    "title": "My shadow",
    "artist": "The Black Skirts",
    "youtube_id": "T15zuMtqBoE",
    "cover_url": "https://img.youtube.com/vi/T15zuMtqBoE/hqdefault.jpg"
  },
  {
    "id": 3,
    "title": "Luther",
    "artist": "Kendrick Lamar (feat. SZA)",
    "youtube_id": "HfWLgELllZs",
    "cover_url": "https://img.youtube.com/vi/HfWLgELllZs/hqdefault.jpg"
  },
  {
    "id": 4,
    "title": "Get You",
    "artist": "Daniel Caesar (feat. Kali Uchis)",
    "youtube_id": "WFLGrpGemLg",
    "cover_url": "https://img.youtube.com/vi/WFLGrpGemLg/0.jpg"
  },
  {
    "id": 5,
    "title": "Give Me Mercy",
    "artist": "The Weeknd",
    "youtube_id": "cVoO8ZYXkrQ",
    "cover_url": "https://img.youtube.com/vi/cVoO8ZYXkrQ/hqdefault.jpg"
  },
  {
    "id": 6,
    "title": "New Year",
    "artist": "Mk.gee",
    "youtube_id": "iGQjD4gOzNM",
    "cover_url": "https://img.youtube.com/vi/iGQjD4gOzNM/hqdefault.jpg"
  },
  {
    "id": 7,
    "title": "Thinkin Bout You",
    "artist": "Frank Ocean",
    "youtube_id": "6JHu3b-pbh8",
    "cover_url": "https://img.youtube.com/vi/6JHu3b-pbh8/hqdefault.jpg"
  },
  {
    "id": 8,
    "title": "Let's go watch the stars",
    "artist": "Jeok-Jae",
    "youtube_id": "Mz031oU0Xfw",
    "cover_url": "https://img.youtube.com/vi/Mz031oU0Xfw/hqdefault.jpg"
  }
];

// localStorage 키
const STORAGE_KEY = 'musicPlayer_songs';

/**
 * localStorage 초기화 함수
 * 저장된 데이터가 없으면 초기 데이터 저장
 */
function initLocalStorage() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SONGS));
    console.log('localStorage 초기화 완료');
  }
}

/**
 * 모든 노래 가져오기 (API /api/songs 대체)
 * @returns {Promise<Array>} 노래 목록
 */
async function getSongs() {
  return new Promise((resolve) => {
    // 불필요한 딜레이 제거
    const songs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    resolve(songs);
  });
}

/**
 * 노래 추가하기 (API /api/songs POST 대체)
 * @param {Object} songData - 추가할 노래 데이터
 * @returns {Promise<Object>} 추가된 노래 정보
 */
async function addSong(songData) {
  return new Promise((resolve) => {
    const songs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    
    // ID 생성 (기존 ID 중 최대값 + 1)
    const newId = songs.length > 0 
      ? Math.max(...songs.map(song => song.id)) + 1 
      : 1;
    
    // YouTube ID 확인
    const youtubeId = getYoutubeId(songData.youtube_url);
    
    // 새 노래 객체 생성
    const newSong = {
      id: newId,
      title: songData.title,
      artist: songData.artist,
      youtube_id: youtubeId,
      cover_url: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      is_new_added: true
    };
    
    // 배열에 추가
    songs.push(newSong);
    
    // localStorage 업데이트
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
    
    // 불필요한 딜레이 제거
    resolve(newSong);
  });
}

/**
 * 노래 삭제하기 (API /api/songs/:id DELETE 대체)
 * @param {number} songId - 삭제할 노래 ID
 * @returns {Promise<Object>} 성공 여부
 */
async function deleteSong(songId) {
  return new Promise((resolve) => {
    const songs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    
    // ID를 숫자로 변환하여 비교
    const filteredSongs = songs.filter(song => song.id !== parseInt(songId));
    
    // localStorage 업데이트
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSongs));
    
    // 불필요한 딜레이 제거
    resolve({ status: 'success' });
  });
}

/**
 * 모든 노래 삭제하기 (API /api/songs/all DELETE 대체)
 * @returns {Promise<Object>} 성공 여부
 */
async function deleteAllSongs() {
  return new Promise((resolve) => {
    // 빈 배열로 업데이트
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    
    // 불필요한 딜레이 제거
    resolve({ status: 'success' });
  });
}

/**
 * 초기 상태로 재설정 (API /api/reset POST 대체)
 * @returns {Promise<Object>} 성공 여부
 */
async function resetToDefault() {
  return new Promise((resolve) => {
    // 초기 데이터로 초기화
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SONGS));
    
    // 불필요한 딜레이 제거
    resolve({ status: 'success' });
  });
}

/**
 * YouTube URL에서 ID 추출
 * @param {string} url - YouTube URL 또는 ID
 * @returns {string} YouTube ID
 */
function getYoutubeId(url) {
  if (!url) return '';
  
  // 이미 ID인 경우
  if (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }
  
  // youtu.be 형식
  if (url.includes('youtu.be/')) {
    return url.split('youtu.be/')[1].split('?')[0].split('&')[0];
  }
  
  // youtube.com 형식
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  
  return match ? match[1] : '';
} 