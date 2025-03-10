# app.py
from flask import Flask, jsonify, request, send_from_directory
import os
import json
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
SONGS_JSON_FILE = os.path.join(BASE_DIR, 'songs.json')

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
    # Vercel의 서버리스 환경에서는 메모리 DB 사용
    if os.environ.get('VERCEL_ENV') == 'production':
        conn = sqlite3.connect(':memory:')
        
        # 메모리 DB 초기화
        cursor = conn.cursor()
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            youtube_id TEXT NOT NULL,
            cover_url TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        conn.commit()
        
        # songs.json의 데이터로 초기화
        try:
            with open(SONGS_JSON_FILE, 'r', encoding='utf-8') as f:
                songs_data = json.load(f)
                
            for song in songs_data['songs']:
                youtube_id = song['youtube_id']
                cover_url = song.get('cover_url') or get_youtube_thumbnail(youtube_id)
                
                cursor.execute('''
                INSERT INTO songs (title, artist, youtube_id, cover_url)
                VALUES (?, ?, ?, ?)
                ''', (song['title'], song['artist'], youtube_id, cover_url))
            
            conn.commit()
        except Exception as e:
            print(f"Error initializing memory DB: {e}")
            
        return conn
    else:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        return conn

def init_db():
    """Initialize database with songs.json if needed"""
    # 실제 DB 파일이 있는 경우에만 실행
    if os.environ.get('VERCEL_ENV') != 'production':
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Check if the table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='songs'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            print("Creating songs table...")
            cursor.execute('''
            CREATE TABLE songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                youtube_id TEXT NOT NULL,
                cover_url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            conn.commit()
            
            # Load initial songs from songs.json
            if os.path.exists(SONGS_JSON_FILE):
                try:
                    with open(SONGS_JSON_FILE, 'r', encoding='utf-8') as f:
                        songs_data = json.load(f)
                        
                    for song in songs_data['songs']:
                        youtube_id = song['youtube_id']
                        cover_url = song.get('cover_url') or get_youtube_thumbnail(youtube_id)
                        
                        cursor.execute('''
                        INSERT INTO songs (title, artist, youtube_id, cover_url)
                        VALUES (?, ?, ?, ?)
                        ''', (song['title'], song['artist'], youtube_id, cover_url))
                    
                    conn.commit()
                    print(f"Initialized DB with {len(songs_data['songs'])} songs from songs.json")
                except Exception as e:
                    print(f"Error loading songs from JSON: {e}")
            
        conn.close()

# Initialize database if it doesn't exist
init_db()

# Vercel 서버리스 함수 엔드포인트
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_frontend(path):
    try:
        # 먼저 frontend 디렉토리에서 파일 찾기
        return send_from_directory('frontend', path)
    except:
        try:
            # frontend에 없으면 static 디렉토리에서 파일 찾기
            return send_from_directory('static', path)
        except:
            # 파일이 없으면 index.html로 리다이렉트 (SPA 지원)
            return send_from_directory('frontend', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/js/<path:path>')
def serve_js(path):
    return send_from_directory('static/js', path)

@app.route('/css/<path:path>')
def serve_css(path):
    return send_from_directory('static/css', path)

@app.route('/assets/<path:path>')
def serve_assets(path):
    return send_from_directory('static/assets', path)

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

@app.route('/api/songs/all', methods=['DELETE'])
def remove_all_songs():
    """모든 노래 삭제 API"""
    conn = get_db_connection()
    conn.execute('DELETE FROM songs')
    conn.commit()
    conn.close()
    
    # 캐시 무효화
    cache.delete_memoized(get_songs)
    
    return jsonify({"status": "success", "message": "모든 노래가 삭제되었습니다."})

@app.route('/api/reset', methods=['POST'])
def reset_to_json():
    """데이터베이스를 songs.json 파일의 내용으로 초기화하는 API"""
    try:
        # 기존 데이터베이스 내용 삭제
        conn = get_db_connection()
        conn.execute('DELETE FROM songs')
        
        # songs.json에서 데이터 로드
        if os.path.exists(SONGS_JSON_FILE):
            with open(SONGS_JSON_FILE, 'r', encoding='utf-8') as f:
                songs_from_json = json.load(f)
            
            # JSON 파일에서 로드한 노래들을 데이터베이스에 추가
            for song in songs_from_json:
                title = song.get('title')
                artist = song.get('artist')
                youtube_id = song.get('youtube_id')
                cover_url = song.get('cover_url')
                
                if title and artist and youtube_id:
                    if not cover_url:
                        cover_url = get_youtube_thumbnail(youtube_id)
                    
                    conn.execute('''
                        INSERT INTO songs (title, artist, youtube_id, cover_url)
                        VALUES (?, ?, ?, ?)
                    ''', (title, artist, youtube_id, cover_url))
        
        conn.commit()
        conn.close()
        
        # 캐시 무효화
        cache.delete_memoized(get_songs)
        
        return jsonify({"status": "success", "message": "데이터베이스가 songs.json 파일로 초기화되었습니다."})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')