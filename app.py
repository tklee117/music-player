# app.py
from flask import Flask, render_template, request, redirect, url_for, jsonify
import os
import json
from urllib.parse import urlparse, parse_qs

app = Flask(__name__)

# Data storage
SONGS_FILE = 'songs.json'

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

def load_songs():
    """Load songs from JSON file"""
    if os.path.exists(SONGS_FILE):
        with open(SONGS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_songs(songs):
    """Save songs to JSON file"""
    with open(SONGS_FILE, 'w') as f:
        json.dump(songs, f, indent=2)

def get_youtube_thumbnail(youtube_id):
    return f"https://img.youtube.com/vi/{youtube_id}/hqdefault.jpg"

# Initialize with some default songs if file doesn't exist
if not os.path.exists(SONGS_FILE):
    default_songs = [
        {
            "id": 1,
            "title": "별 보러 가자",
            "artist": "적재",
            "youtube_id": "Mz031oU0Xfw",
            "cover_url": get_youtube_thumbnail("Mz031oU0Xfw")
        },
        {
            "id": 2,
            "title": "As It Was",
            "artist": "Harry Styles",
            "youtube_id": "H5v3kku4y6Q",
            "cover_url": get_youtube_thumbnail("H5v3kku4y6Q")
        },
        {
            "id": 3,
            "title": "Cruel Summer",
            "artist": "Taylor Swift",
            "youtube_id": "ic8j13piAhQ",
            "cover_url": "https://i.imgur.com/placeholder3.jpg"
        }
    ]
    save_songs(default_songs)

@app.route('/')
def index():
    """Render the main music player page"""
    songs = load_songs()
    return render_template('index.html', songs=songs)

@app.route('/add_song', methods=['POST'])
def add_song():
    """Add a new song to the playlist"""
    title = request.form.get('title')
    artist = request.form.get('artist')
    youtube_url = request.form.get('youtube_url')
    
    if not (title and artist and youtube_url):
        return jsonify({"error": "Missing required fields"}), 400
    
    youtube_id = get_youtube_id(youtube_url)
    if not youtube_id:
        return jsonify({"error": "Invalid YouTube URL"}), 400
    
    songs = load_songs()
    new_id = max([song.get('id', 0) for song in songs], default=0) + 1
    
    # Get thumbnail from YouTube
    cover_url = f"https://img.youtube.com/vi/{youtube_id}/0.jpg"
    
    new_song = {
        "id": new_id,
        "title": title,
        "artist": artist,
        "youtube_id": youtube_id,
        "cover_url": cover_url
    }
    
    songs.append(new_song)
    save_songs(songs)
    
    return redirect(url_for('index'))

@app.route('/remove_song/<int:song_id>', methods=['POST'])
def remove_song(song_id):
    """Remove a song from the playlist"""
    songs = load_songs()
    songs = [song for song in songs if song.get('id') != song_id]
    save_songs(songs)
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True)