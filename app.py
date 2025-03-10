# app.py
from flask import Flask, jsonify, request, send_from_directory
import os
import sqlite3
from urllib.parse import urlparse, parse_qs
from flask_caching import Cache
import time
from flask_cors import CORS  # CORS 지원 추가

app = Flask(__name__, static_folder='frontend')
CORS(app)  # 모든 경로에서 CORS 허용

# 한글 지원을 위한 Flask 설정
app.config['JSON_AS_ASCII'] = False  # JSON 응답에서 유니코드 문자가 이스케이프되지 않도록 설정

# 캐싱 설정
cache = Cache(app, config={
    'CACHE_TYPE': 'SimpleCache',
    'CACHE_DEFAULT_TIMEOUT': 300  # 5분
})

# Define an absolute path for database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, 'songs.db')

def get_youtube_id(url):
    """Extract YouTube ID from URL"""
    if not url:
        return None
    
    if 'youtu.be' in url:
        return url.split('/')[-1].split('?')[0]
    
    parsed_url = urlparse(url)
    if 'youtube.com' in parsed_url.netloc:
        if 'v' in parse_qs(parsed_url.query):
            return parse_qs(parsed_url.query)['v'][0]
    
    # If it's already just an ID
    if len(url) == 11 and '/' not in url and '?' not in url:
        return url
        
    return None

def get_youtube_thumbnail(youtube_id):
    return f"https://img.youtube.com/vi/{youtube_id}/hqdefault.jpg"

def get_db_connection():
    """Get SQLite database connection with UTF-8 support"""
    conn = sqlite3.connect(DB_FILE)
    # UTF-8 인코딩 명시적 설정
    conn.execute('PRAGMA encoding = "UTF-8"')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database if it doesn't exist"""
    conn = get_db_connection()
    
    # Create table if not exists
    conn.execute('''
        CREATE TABLE IF NOT EXISTS songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            youtube_id TEXT NOT NULL,
            cover_url TEXT NOT NULL
        )
    ''')
    
    # Check if table is empty
    result = conn.execute('SELECT COUNT(*) FROM songs').fetchone()
    
    # If empty, add default songs
    if result[0] == 0:
        default_songs = [
            # songs.json에 있던 노래들 추가
            {
                "title": "Star",
                "artist": "Mingginyu",
                "youtube_id": "0t_ORa7dmO4",
                "cover_url": "https://img.youtube.com/vi/0t_ORa7dmO4/hqdefault.jpg"
            },
            {
                "title": "My shadow",
                "artist": "The Black Skirts",
                "youtube_id": "T15zuMtqBoE",
                "cover_url": "https://img.youtube.com/vi/T15zuMtqBoE/hqdefault.jpg"
            },
            {
                "title": "Luther",
                "artist": "Kendrick Lamar (feat. SZA)",
                "youtube_id": "HfWLgELllZs",
                "cover_url": "https://img.youtube.com/vi/HfWLgELllZs/hqdefault.jpg"
            },
            {
                "title": "Get You",
                "artist": "Daniel Caesar (feat. Kali Uchis)",
                "youtube_id": "WFLGrpGemLg",
                "cover_url": "https://img.youtube.com/vi/WFLGrpGemLg/0.jpg"
            },
            {
                "title": "Give Me Mercy",
                "artist": "The Weeknd",
                "youtube_id": "cVoO8ZYXkrQ",
                "cover_url": "https://img.youtube.com/vi/cVoO8ZYXkrQ/hqdefault.jpg"
            },
            {
                "title": "New Year",
                "artist": "Mk.gee",
                "youtube_id": "iGQjD4gOzNM",
                "cover_url": "https://img.youtube.com/vi/iGQjD4gOzNM/hqdefault.jpg"
            },
            {
                "title": "Thinkin Bout You",
                "artist": "Frank Ocean",
                "youtube_id": "6JHu3b-pbh8",
                "cover_url": "https://img.youtube.com/vi/6JHu3b-pbh8/hqdefault.jpg"
            },
            {
                "title": "Let's go watch the stars",
                "artist": "Jeok-Jae",
                "youtube_id": "Mz031oU0Xfw",
                "cover_url": "https://img.youtube.com/vi/Mz031oU0Xfw/hqdefault.jpg"
            },
            # 한국어 노래 샘플 추가
            {
                "title": "사랑은 늘 도망가",
                "artist": "임영웅",
                "youtube_id": "z_8tUyl1eMo",
                "cover_url": "https://img.youtube.com/vi/z_8tUyl1eMo/hqdefault.jpg"
            },
            {
                "title": "봄여름가을겨울",
                "artist": "BIGBANG (빅뱅)",
                "youtube_id": "zZLz_u0trPI",
                "cover_url": "https://img.youtube.com/vi/zZLz_u0trPI/hqdefault.jpg"
            },
            {
                "title": "밤편지",
                "artist": "아이유 (IU)",
                "youtube_id": "BzYnNdJhZQw",
                "cover_url": "https://img.youtube.com/vi/BzYnNdJhZQw/hqdefault.jpg"
            }
        ]
        
        for song in default_songs:
            conn.execute('''
                INSERT INTO songs (title, artist, youtube_id, cover_url)
                VALUES (?, ?, ?, ?)
            ''', (song['title'], song['artist'], song['youtube_id'], song['cover_url']))
        
        conn.commit()
    
    conn.close()

# Initialize database
init_db()

# 정적 파일 서빙 (프론트엔드 파일)
@app.route('/')
def serve_frontend():
    return send_from_directory('frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('frontend', path)

# API 엔드포인트들
@app.route('/api/songs', methods=['GET'])
@cache.cached(timeout=60)  # 1분 캐싱
def get_songs():
    """모든 노래 목록 반환 API"""
    start_time = time.time()
    
    conn = get_db_connection()
    songs = conn.execute('SELECT * FROM songs').fetchall()
    conn.close()
    
    songs_list = [dict(song) for song in songs]
    
    # 페이지 로딩 시간 측정
    end_time = time.time()
    print(f"API rendered in {end_time - start_time:.4f} seconds")
    
    return jsonify(songs_list)

@app.route('/api/songs', methods=['POST'])
def add_song():
    """노래 추가 API"""
    data = request.json
    
    title = data.get('title')
    artist = data.get('artist')
    youtube_url = data.get('youtube_url')
    
    if not title or not artist or not youtube_url:
        return jsonify({"error": "Missing required fields"}), 400
    
    youtube_id = get_youtube_id(youtube_url)
    
    if not youtube_id:
        return jsonify({"error": "Invalid YouTube URL"}), 400
    
    cover_url = get_youtube_thumbnail(youtube_id)
    
    # Insert new song into database
    conn = get_db_connection()
    cursor = conn.execute('''
        INSERT INTO songs (title, artist, youtube_id, cover_url)
        VALUES (?, ?, ?, ?)
    ''', (title, artist, youtube_id, cover_url))
    
    # Get the new song ID
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # 캐시 무효화
    cache.delete_memoized(get_songs)
    
    # 새 노래 정보 반환
    return jsonify({
        "id": new_id,
        "title": title,
        "artist": artist,
        "youtube_id": youtube_id,
        "cover_url": cover_url,
        "is_new_added": True
    }), 201

@app.route('/api/songs/<int:song_id>', methods=['DELETE'])
def remove_song(song_id):
    """노래 삭제 API"""
    conn = get_db_connection()
    conn.execute('DELETE FROM songs WHERE id = ?', (song_id,))
    conn.commit()
    conn.close()
    
    # 캐시 무효화
    cache.delete_memoized(get_songs)
    
    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')